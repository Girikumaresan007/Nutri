package com.nutritrack.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties("nutritrack.refresh-token")
public record RefreshTokenProperties(
        Duration ttl,
        String cookieName,
        boolean cookieSecure,
        String cookieSameSite,
        String cookiePath,
        String cookieDomain,
        @DefaultValue("true") boolean cookiePartitioned) {
}
