package com.nutritrack.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("nutritrack.jwt")
public record JwtProperties(String secret, Duration accessTokenTtl, String issuer) {}
