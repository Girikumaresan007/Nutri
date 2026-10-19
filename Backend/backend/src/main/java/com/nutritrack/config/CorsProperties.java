package com.nutritrack.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("nutritrack.cors")
public record CorsProperties(List<String> allowedOrigins) {}
