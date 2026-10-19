package com.nutritrack.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("nutritrack.refresh-token")
public record RefreshTokenProperties(Duration ttl, String cookieName, boolean cookieSecure,
                                     String cookieSameSite, String cookiePath, String cookieDomain) {}
