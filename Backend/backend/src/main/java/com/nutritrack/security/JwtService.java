package com.nutritrack.security;

import com.nutritrack.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
    private final JwtProperties props;
    private final Clock clock;
    private final SecretKey key;

    public JwtService(JwtProperties props, Clock clock) {
        byte[] bytes = props.secret() == null ? new byte[0] : props.secret().getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("JWT secret must be at least 32 bytes (256 bits)");
        }
        this.props = props;
        this.clock = clock;
        this.key = Keys.hmacShaKeyFor(bytes);
    }

    public String generateAccessToken(UUID userId, String email) {
        Instant now = clock.instant();
        return Jwts.builder()
                .issuer(props.issuer())
                .subject(userId.toString())
                .claim("email", email)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(props.accessTokenTtl())))
                .signWith(key)
                .compact();
    }

    public long accessTokenTtlSeconds() {
        return props.accessTokenTtl().toSeconds();
    }

    /** Returns empty for any invalid, tampered, expired or foreign token. Token contents are never logged. */
    public Optional<AuthenticatedUser> parse(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).requireIssuer(props.issuer())
                    .clock(() -> Date.from(clock.instant()))
                    .build().parseSignedClaims(token).getPayload();
            return Optional.of(new AuthenticatedUser(UUID.fromString(claims.getSubject()), claims.get("email", String.class)));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
