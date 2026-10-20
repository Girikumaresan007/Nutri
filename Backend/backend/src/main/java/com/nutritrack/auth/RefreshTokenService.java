package com.nutritrack.auth;

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
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Opaque, random, rotating refresh tokens. Only a SHA-256 hash is persisted. Presenting a token that was already
 * rotated (after a short grace window for concurrent tabs) is treated as theft and revokes all of the user's tokens.
 */
@Service
public class RefreshTokenService {
    /** 90-second reuse grace window accommodates mobile reconnections, backgrounding, and Render cold-start latency. */
    private static final Duration REUSE_GRACE = Duration.ofSeconds(90);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RefreshTokenRepository repo;
    private final RefreshTokenProperties props;
    private final Clock clock;

    public RefreshTokenService(RefreshTokenRepository repo, RefreshTokenProperties props, Clock clock) {
        this.repo = repo;
        this.props = props;
        this.clock = clock;
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
        if (rawToken == null || rawToken.isBlank()) {
            throw invalid();
        }
        Instant now = clock.instant();
        RefreshToken t = repo.findByTokenHash(hash(rawToken)).orElseThrow(RefreshTokenService::invalid);
        if (t.getRevokedAt() != null) {
            if (t.getRevokedAt().plus(REUSE_GRACE).isBefore(now)) {
                repo.revokeAllForUser(t.getUserId(), now);
            }
            throw invalid();
        }
        if (t.getExpiresAt().isBefore(now)) {
            throw invalid();
        }
        t.setRevokedAt(now);
        return new Rotation(t.getUserId(), issue(t.getUserId()));
    }

    @Transactional
    public void revoke(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        repo.findByTokenHash(hash(rawToken)).ifPresent(t -> {
            if (t.getRevokedAt() == null) {
                t.setRevokedAt(clock.instant());
            }
        });
    }

    @Transactional
    public void revokeAll(UUID userId) {
        repo.revokeAllForUser(userId, clock.instant());
    }

    @Scheduled(cron = "0 15 3 * * *")
    @Transactional
    public void purgeExpired() {
        repo.deleteExpiredBefore(clock.instant().minus(Duration.ofDays(1)));
    }

    static String hash(String raw) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static ApiException invalid() {
        return ApiException.unauthorized("INVALID_REFRESH_TOKEN", "Session expired. Please sign in again.");
    }
}
