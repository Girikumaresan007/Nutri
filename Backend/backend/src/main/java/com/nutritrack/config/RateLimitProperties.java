package com.nutritrack.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("nutritrack.rate-limit")
public record RateLimitProperties(int authAttempts, Duration authWindow, int scannerRequests, Duration scannerWindow) {}
