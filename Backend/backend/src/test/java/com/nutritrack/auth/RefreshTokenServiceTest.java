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

        RefreshTokenService.Rotation rotation = service.rotate(rawToken);

        assertThat(rotation.userId()).isEqualTo(userId);
        assertThat(rotation.newToken()).isNotBlank();
        assertThat(rotation.newToken()).isNotEqualTo(rawToken);
        assertThat(existing.getRevokedAt()).isEqualTo(now);
    }

    @Test
    @DisplayName("rotate() within the 90-second reuse grace window does not revoke all tokens")
    void rotateWithinGraceDoesNotRevokeAll() {
        UUID userId = UUID.randomUUID();
        String rawToken = "recently-rotated-token";
        String hash = RefreshTokenService.hash(rawToken);

        RefreshToken existing = new RefreshToken();
        existing.setUserId(userId);
        existing.setTokenHash(hash);
        existing.setExpiresAt(now.plus(Duration.ofDays(14)));
        // Rotated 20 seconds ago (well within 90-second grace)
        existing.setRevokedAt(now.minusSeconds(20));

        when(repo.findByTokenHash(hash)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.rotate(rawToken))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Session expired");

        // Must NOT have revoked all tokens for user
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

        assertThatThrownBy(() -> service.rotate(rawToken))
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

        assertThatThrownBy(() -> service.rotate(rawToken))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Session expired");
    }
}
