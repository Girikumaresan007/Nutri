package com.nutritrack.auth;

import com.nutritrack.config.JwtProperties;
import com.nutritrack.config.RefreshTokenProperties;
import com.nutritrack.exception.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Opaque, random, rotating refresh tokens. Only a SHA-256 hash is persisted. Presenting a token that was already
 * rotated (after a short grace window for concurrent tabs and network retries) is treated as theft and revokes all of
 * the user's tokens. Durable rotation metadata in PostgreSQL enables recovery from proxy timeouts across server restarts.
 */
@Service
public class RefreshTokenService {
    /** 90-second reuse grace window accommodates mobile reconnections, backgrounding, and Render cold-start latency. */
    private static final Duration REUSE_GRACE = Duration.ofSeconds(90);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RefreshTokenRepository repo;
    private final RefreshTokenProperties props;
    private final Clock clock;
    private final byte[] aesKey;

    public record ActiveRotation(UUID userId, String newToken, String clientProof, Instant rotatedAt) {}
    private final ConcurrentMap<String, ActiveRotation> activeRotations = new ConcurrentHashMap<>();

    @Autowired
    public RefreshTokenService(RefreshTokenRepository repo, RefreshTokenProperties props, JwtProperties jwtProps, Clock clock) {
        this.repo = repo;
        this.props = props;
        this.clock = clock;
        this.aesKey = deriveAesKey(jwtProps != null ? jwtProps.secret() : null);
    }

    public RefreshTokenService(RefreshTokenRepository repo, RefreshTokenProperties props, Clock clock) {
        this(repo, props, new JwtProperties("nutritrack-default-recovery-secret-key-32b", Duration.ofMinutes(15), "nutritrack-ai"), clock);
    }

    public record Rotation(UUID userId, String newToken) {}

    @Transactional
    public String issue(UUID userId) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        RefreshToken t = new RefreshToken();
        t.setUserId(userId);
        t.setTokenHash(hash(raw));
        t.setExpiresAt(clock.instant().plus(props.ttl()));
        repo.save(t);
        return raw;
    }

    /** noRollbackFor: the "revoke everything" side effect must survive the 401 we throw afterwards. */
    @Transactional(noRollbackFor = ApiException.class)
    public Rotation rotate(String rawToken) {
        return rotate(rawToken, null);
    }

    /** noRollbackFor: the "revoke everything" side effect must survive the 401 we throw afterwards. */
    @Transactional(noRollbackFor = ApiException.class)
    public Rotation rotate(String rawToken, String clientProof) {
        if (rawToken == null || rawToken.isBlank()) {
            throw invalid();
        }
        Instant now = clock.instant();
        String tokenHash = hash(rawToken);
        RefreshToken t = repo.findByTokenHash(tokenHash).orElseThrow(RefreshTokenService::invalid);
        if (t.getExpiresAt().isBefore(now)) {
            throw invalid();
        }

        // Evict expired grace rotation entries from memory
        activeRotations.entrySet().removeIf(e -> e.getValue().rotatedAt().plus(REUSE_GRACE).isBefore(now));

        if (t.getRevokedAt() != null) {
            // 1. Expired Replay Attack (> 90s): Token was revoked outside the grace window
            if (t.getRevokedAt().plus(REUSE_GRACE).isBefore(now)) {
                repo.revokeAllForUser(t.getUserId(), now);
                activeRotations.remove(tokenHash);
                throw invalid();
            }

            // 2. Revoked token presented within 90-second reuse grace window.
            // Check in-memory activeRotations first (microsecond cache), fall back to durable encrypted DB storage
            ActiveRotation active = activeRotations.get(tokenHash);
            String successorToken = active != null ? active.newToken() : decryptToken(t.getSuccessorTokenEncrypted());
            String recordedProof = active != null ? active.clientProof() : t.getClientProof();

            if (successorToken != null && recordedProof != null && !recordedProof.isBlank()) {
                if (clientProof != null && !clientProof.isBlank() && clientProof.equals(recordedProof)) {
                    // Legitimate concurrent request or retry after lost response (even across restarts!):
                    // Return the EXACT SAME successor token already minted during the initial rotation.
                    // Do NOT mint a new token or branch the token family!
                    return new Rotation(t.getUserId(), successorToken);
                }

                // Recorded rotation exists (in DB or memory) from a DIFFERENT client proof -> confirmed live theft replay attack!
                repo.revokeAllForUser(t.getUserId(), now);
                activeRotations.remove(tokenHash);
                throw ApiException.unauthorized("TOKEN_THEFT_DETECTED", "Suspicious token reuse detected");
            }

            // active == null and no DB successor: The server restarted or token was revoked without recovery metadata.
            // Safely reject with 401 WITHOUT revoking all user sessions, preventing false logouts of valid sessions!
            throw invalid();
        }

        t.setRevokedAt(now);
        String newToken = issue(t.getUserId());
        if (clientProof != null && !clientProof.isBlank()) {
            activeRotations.put(tokenHash, new ActiveRotation(t.getUserId(), newToken, clientProof, now));
            t.setClientProof(clientProof);
            t.setSuccessorTokenEncrypted(encryptToken(newToken));
        }
        return new Rotation(t.getUserId(), newToken);
    }

    @Transactional
    public void revoke(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        String tokenHash = hash(rawToken);
        activeRotations.remove(tokenHash);
        repo.findByTokenHash(tokenHash).ifPresent(t -> {
            if (t.getRevokedAt() == null) {
                t.setRevokedAt(clock.instant());
            }
        });
    }

    @Transactional
    public void revokeAll(UUID userId) {
        activeRotations.entrySet().removeIf(e -> e.getValue().userId().equals(userId));
        repo.revokeAllForUser(userId, clock.instant());
    }

    @Scheduled(cron = "0 15 3 * * *")
    @Transactional
    public void purgeExpired() {
        activeRotations.entrySet().removeIf(e -> e.getValue().rotatedAt().plus(REUSE_GRACE).isBefore(clock.instant()));
        repo.deleteExpiredBefore(clock.instant().minus(Duration.ofDays(1)));
    }

    static String hash(String raw) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static byte[] deriveAesKey(String secret) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return md.digest(("NutriTrack-Token-Recovery-Key:" + (secret != null ? secret : "fallback-secret")).getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    String encryptToken(String rawToken) {
        if (rawToken == null) return null;
        try {
            byte[] iv = new byte[12];
            RANDOM.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(aesKey, "AES"), new GCMParameterSpec(128, iv));
            byte[] cipherText = cipher.doFinal(rawToken.getBytes(StandardCharsets.UTF_8));
            byte[] combined = new byte[iv.length + cipherText.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(cipherText, 0, combined, iv.length, cipherText.length);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(combined);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to encrypt successor token", e);
        }
    }

    String decryptToken(String encrypted) {
        if (encrypted == null || encrypted.isBlank()) return null;
        try {
            byte[] combined = Base64.getUrlDecoder().decode(encrypted);
            if (combined.length < 13) return null;
            byte[] iv = new byte[12];
            System.arraycopy(combined, 0, iv, 0, 12);
            byte[] cipherText = new byte[combined.length - 12];
            System.arraycopy(combined, 12, cipherText, 0, cipherText.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(aesKey, "AES"), new GCMParameterSpec(128, iv));
            byte[] plainText = cipher.doFinal(cipherText);
            return new String(plainText, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    private static ApiException invalid() {
        return ApiException.unauthorized("INVALID_REFRESH_TOKEN", "Session expired. Please sign in again.");
    }
}
