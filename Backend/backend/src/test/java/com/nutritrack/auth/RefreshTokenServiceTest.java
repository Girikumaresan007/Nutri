package com.nutritrack.auth;

import com.nutritrack.config.RefreshTokenProperties;
import com.nutritrack.exception.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("RefreshTokenService Unit Tests")
class RefreshTokenServiceTest {

    private RefreshTokenRepository repo;
    private RefreshTokenProperties props;
    private Instant now;
    private Clock clock;
    private RefreshTokenService service;

    @BeforeEach
    void setUp() {
        repo = mock(RefreshTokenRepository.class);
        props = new RefreshTokenProperties(
                Duration.ofDays(14),
                "nt_refresh",
                true,
                "None",
                "/api/v1/auth",
                "",
                true
        );
        now = Instant.parse("2026-10-20T12:00:00Z");
        clock = Clock.fixed(now, ZoneId.of("UTC"));
        service = new RefreshTokenService(repo, props, clock);
    }

    @Test
    @DisplayName("issue() generates a valid random token and saves its SHA-256 hash")
    void issueGeneratesAndPersistsHash() {
        UUID userId = UUID.randomUUID();
        String rawToken = service.issue(userId);

        assertThat(rawToken).isNotBlank();
        ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(repo).save(captor.capture());

        RefreshToken saved = captor.getValue();
        assertThat(saved.getUserId()).isEqualTo(userId);
        assertThat(saved.getTokenHash()).isEqualTo(RefreshTokenService.hash(rawToken));
        assertThat(saved.getExpiresAt()).isEqualTo(now.plus(Duration.ofDays(14)));
        assertThat(saved.getRevokedAt()).isNull();
    }

    @Test
    @DisplayName("rotate() successfully rotates an unrevoked, unexpired token")
    void rotateValidToken() {
        UUID userId = UUID.randomUUID();
        String rawToken = "sample-raw-token-123";
        String hash = RefreshTokenService.hash(rawToken);

        RefreshToken existing = new RefreshToken();
        existing.setUserId(userId);
        existing.setTokenHash(hash);
        existing.setExpiresAt(now.plus(Duration.ofDays(14)));
        existing.setRevokedAt(null);

        when(repo.findByTokenHash(hash)).thenReturn(Optional.of(existing));

        RefreshTokenService.Rotation rotation = service.rotate(rawToken, "client-ip-1|Mozilla");

        assertThat(rotation.userId()).isEqualTo(userId);
        assertThat(rotation.newToken()).isNotBlank();
        assertThat(rotation.newToken()).isNotEqualTo(rawToken);
        assertThat(existing.getRevokedAt()).isEqualTo(now);
    }

    @Test
    @DisplayName("rotate() within grace window from legitimate concurrent client returns identical successor token without minting new tokens")
    void rotateConcurrentLegitimateRequestsSameClient() {
        UUID userId = UUID.randomUUID();
        String rawToken = "concurrent-raw-token";
        String hash = RefreshTokenService.hash(rawToken);
        String clientProof = "192.168.1.100|Chrome-120";

        RefreshToken existing = new RefreshToken();
        existing.setUserId(userId);
        existing.setTokenHash(hash);
        existing.setExpiresAt(now.plus(Duration.ofDays(14)));
        existing.setRevokedAt(null);

        when(repo.findByTokenHash(hash)).thenReturn(Optional.of(existing));

        // Initial rotation by Client A
        RefreshTokenService.Rotation firstRotation = service.rotate(rawToken, clientProof);
        assertThat(firstRotation.newToken()).isNotBlank();
        assertThat(existing.getRevokedAt()).isEqualTo(now);

        // Legitimate concurrent request 5 seconds later by the SAME client proof
        RefreshTokenService.Rotation secondRotation = service.rotate(rawToken, clientProof);

        // Must return the EXACT SAME successor token already issued, avoiding family branching
        assertThat(secondRotation.userId()).isEqualTo(userId);
        assertThat(secondRotation.newToken()).isEqualTo(firstRotation.newToken());

        // Must NOT have revoked user tokens
        verify(repo, never()).revokeAllForUser(eq(userId), any());
    }

    @Test
    @DisplayName("rotate() within grace window by different client triggers theft detection and revokes all user tokens")
    void rotateReplayAttackDifferentClientTriggersTheftRevocation() {
        UUID userId = UUID.randomUUID();
        String rawToken = "compromised-token";
        String hash = RefreshTokenService.hash(rawToken);
        String legitimateClientProof = "192.168.1.100|Chrome-120";
        String attackerClientProof = "203.0.113.42|MaliciousClient";

        RefreshToken existing = new RefreshToken();
        existing.setUserId(userId);
        existing.setTokenHash(hash);
        existing.setExpiresAt(now.plus(Duration.ofDays(14)));
        existing.setRevokedAt(null);

        when(repo.findByTokenHash(hash)).thenReturn(Optional.of(existing));

        // Legitimate client initiates rotation
        RefreshTokenService.Rotation legitimateRotation = service.rotate(rawToken, legitimateClientProof);
        assertThat(legitimateRotation.newToken()).isNotBlank();

        // Attacker Eve replays the revoked rawToken within grace window using a different client proof
        assertThatThrownBy(() -> service.rotate(rawToken, attackerClientProof))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Suspicious token reuse detected");

        // MUST have revoked all tokens for the user due to theft detection
        verify(repo).revokeAllForUser(eq(userId), eq(now));
    }

    @Test
    @DisplayName("rotate() recovers session after server restart and lost proxy response using durable encrypted successor")
    void rotateDurableRecoveryAfterServerRestartAndLostResponse() {
        UUID userId = UUID.randomUUID();
        String t1 = "initial-token-t1";
        String hashT1 = RefreshTokenService.hash(t1);
        String clientProof = "device-uuid-12345";

        RefreshToken existing = new RefreshToken();
        existing.setUserId(userId);
        existing.setTokenHash(hashT1);
        existing.setExpiresAt(now.plus(Duration.ofDays(14)));
        existing.setRevokedAt(null);

        when(repo.findByTokenHash(hashT1)).thenReturn(Optional.of(existing));

        // Step 1: Initial rotation by backend (T1 -> T2)
        RefreshTokenService.Rotation initialRotation = service.rotate(t1, clientProof);
        String t2 = initialRotation.newToken();
        assertThat(t2).isNotBlank();
        assertThat(existing.getRevokedAt()).isEqualTo(now);
        assertThat(existing.getClientProof()).isEqualTo(clientProof);
        assertThat(existing.getSuccessorTokenEncrypted()).isNotBlank();

        // Step 2: Response containing T2 is lost (proxy timeout) and backend restarts (empty memory)
        RefreshTokenService restartedService = new RefreshTokenService(repo, props, clock);

        // Step 3: Frontend retries with T1 and matching client proof
        RefreshTokenService.Rotation recoveredRotation = restartedService.rotate(t1, clientProof);

        // Step 4: Successfully recovers the exact same successor token T2 without new sign-in
        assertThat(recoveredRotation.userId()).isEqualTo(userId);
        assertThat(recoveredRotation.newToken()).isEqualTo(t2);

        // MUST NOT revoke user tokens
        verify(repo, never()).revokeAllForUser(eq(userId), any());
    }

    @Test
    @DisplayName("rotate() after server restart rejects replay by different client and revokes all user sessions")
    void rotateDurableRecoveryRejectsAttackerAfterServerRestart() {
        UUID userId = UUID.randomUUID();
        String t1 = "stolen-token-t1";
        String hashT1 = RefreshTokenService.hash(t1);
        String legitimateProof = "device-uuid-12345";
        String attackerProof = "attacker-uuid-99999";

        RefreshToken existing = new RefreshToken();
        existing.setUserId(userId);
        existing.setTokenHash(hashT1);
        existing.setExpiresAt(now.plus(Duration.ofDays(14)));
        existing.setRevokedAt(null);

        when(repo.findByTokenHash(hashT1)).thenReturn(Optional.of(existing));

        // Initial rotation by legitimate client
        RefreshTokenService.Rotation initialRotation = service.rotate(t1, legitimateProof);
        assertThat(initialRotation.newToken()).isNotBlank();

        // Backend restarts (empty memory)
        RefreshTokenService restartedService = new RefreshTokenService(repo, props, clock);

        // Attacker presents T1 after restart with mismatched client proof
        assertThatThrownBy(() -> restartedService.rotate(t1, attackerProof))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Suspicious token reuse detected");

        // MUST trigger total revocation due to theft detection
        verify(repo).revokeAllForUser(eq(userId), eq(now));
    }

    @Test
    @DisplayName("rotate() presenting revoked token without active rotation record rejects token without false logout of valid user sessions")
    void rotateRevokedTokenWithoutActiveRecordSafelyRejectsWithoutFalseLogout() {
        UUID userId = UUID.randomUUID();
        String rawToken = "orphaned-revoked-token";
        String hash = RefreshTokenService.hash(rawToken);

        RefreshToken existing = new RefreshToken();
        existing.setUserId(userId);
        existing.setTokenHash(hash);
        existing.setExpiresAt(now.plus(Duration.ofDays(14)));
        existing.setRevokedAt(now.minusSeconds(20)); // Revoked 20s ago, but no recovery metadata

        when(repo.findByTokenHash(hash)).thenReturn(Optional.of(existing));

        // Must reject with 401 Unauthorized
        assertThatThrownBy(() -> service.rotate(rawToken, "client-proof"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Session expired");

        // MUST NOT revoke all user tokens (prevents false logouts of valid sessions)
        verify(repo, never()).revokeAllForUser(eq(userId), any());
    }

    @Test
    @DisplayName("rotate() after the 90-second reuse grace window triggers theft detection and revokes all user tokens")
    void rotateAfterGraceTriggersTotalRevocation() {
        UUID userId = UUID.randomUUID();
        String rawToken = "stale-compromised-token";
        String hash = RefreshTokenService.hash(rawToken);

        RefreshToken existing = new RefreshToken();
        existing.setUserId(userId);
        existing.setTokenHash(hash);
        existing.setExpiresAt(now.plus(Duration.ofDays(14)));
        // Rotated 100 seconds ago (past 90-second grace)
        existing.setRevokedAt(now.minusSeconds(100));

        when(repo.findByTokenHash(hash)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.rotate(rawToken, "client-proof"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Session expired");

        // MUST have triggered theft defense
        verify(repo).revokeAllForUser(eq(userId), eq(now));
    }

    @Test
    @DisplayName("rotate() rejects expired refresh tokens")
    void rotateRejectsExpiredTokens() {
        UUID userId = UUID.randomUUID();
        String rawToken = "expired-token";
        String hash = RefreshTokenService.hash(rawToken);

        RefreshToken existing = new RefreshToken();
        existing.setUserId(userId);
        existing.setTokenHash(hash);
        existing.setExpiresAt(now.minusSeconds(10));
        existing.setRevokedAt(null);

        when(repo.findByTokenHash(hash)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.rotate(rawToken, "client-proof"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Session expired");
    }

    @Test
    @DisplayName("RefreshTokenService constructor annotated with @Autowired is selected and instantiated properly")
    void autowiredConstructorInstantiation() throws Exception {
        var constructor = RefreshTokenService.class.getConstructor(
                RefreshTokenRepository.class,
                RefreshTokenProperties.class,
                com.nutritrack.config.JwtProperties.class,
                Clock.class
        );
        assertThat(constructor.isAnnotationPresent(org.springframework.beans.factory.annotation.Autowired.class)).isTrue();

        var jwtProps = new com.nutritrack.config.JwtProperties("custom-secret-key-for-test-32bytes", Duration.ofMinutes(15), "nutritrack-ai");
        RefreshTokenService autowiredService = constructor.newInstance(repo, props, jwtProps, clock);
        assertThat(autowiredService).isNotNull();
    }
}
