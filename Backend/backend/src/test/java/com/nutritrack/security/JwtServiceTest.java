package com.nutritrack.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.nutritrack.config.JwtProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class JwtServiceTest {
    private static final String SECRET = "unit-test-secret-unit-test-secret-0123456789";

    private JwtService service(Clock clock, String secret) {
        return new JwtService(new JwtProperties(secret, Duration.ofMinutes(15), "nutritrack-ai"), clock);
    }

    @Test
    void roundTrip() {
        JwtService s = service(Clock.systemUTC(), SECRET);
        UUID id = UUID.randomUUID();
        AuthenticatedUser u = s.parse(s.generateAccessToken(id, "a@b.com")).orElseThrow();
        assertThat(u.id()).isEqualTo(id);
        assertThat(u.email()).isEqualTo("a@b.com");
    }

    @Test
    void tamperedTokenRejected() {
        JwtService s = service(Clock.systemUTC(), SECRET);
        String t = s.generateAccessToken(UUID.randomUUID(), "a@b.com");
        assertThat(s.parse(t.substring(0, t.length() - 3) + "abc")).isEmpty();
        assertThat(s.parse("not.a.jwt")).isEmpty();
    }

    @Test
    void tokenSignedWithOtherSecretRejected() {
        String t = service(Clock.systemUTC(), SECRET).generateAccessToken(UUID.randomUUID(), "a@b.com");
        assertThat(service(Clock.systemUTC(), "another-secret-another-secret-0123456789").parse(t)).isEmpty();
    }

    @Test
    void expiredTokenRejected() {
        Instant past = Instant.now().minus(Duration.ofHours(1));
        String t = service(Clock.fixed(past, ZoneOffset.UTC), SECRET).generateAccessToken(UUID.randomUUID(), "a@b.com");
        assertThat(service(Clock.systemUTC(), SECRET).parse(t)).isEmpty();
    }

    @Test
    void shortSecretFailsStartup() {
        assertThatThrownBy(() -> service(Clock.systemUTC(), "too-short")).isInstanceOf(IllegalStateException.class);
    }
}
