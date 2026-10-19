package com.nutritrack.auth;

import com.nutritrack.config.RefreshTokenProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.Optional;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class RefreshCookieFactory {
    private final RefreshTokenProperties props;

    public RefreshCookieFactory(RefreshTokenProperties props) {
        this.props = props;
    }

    public ResponseCookie create(String token) {
        return base(token).maxAge(props.ttl()).build();
    }

    public ResponseCookie clear() {
        return base("").maxAge(Duration.ZERO).build();
    }

    public Optional<String> read(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return Optional.empty();
        }
        for (Cookie c : request.getCookies()) {
            if (props.cookieName().equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()) {
                return Optional.of(c.getValue());
            }
        }
        return Optional.empty();
    }

    private ResponseCookie.ResponseCookieBuilder base(String value) {
        ResponseCookie.ResponseCookieBuilder b = ResponseCookie.from(props.cookieName(), value)
                .httpOnly(true)
                .secure(props.cookieSecure())
                .sameSite(props.cookieSameSite())
                .path(props.cookiePath());
        if (props.cookieDomain() != null && !props.cookieDomain().isBlank()) {
            b.domain(props.cookieDomain());
        }
        if (props.cookieSecure() && (props.cookiePartitioned() || "None".equalsIgnoreCase(props.cookieSameSite()))) {
            b.partitioned(true);
        }
        return b;
    }
}
