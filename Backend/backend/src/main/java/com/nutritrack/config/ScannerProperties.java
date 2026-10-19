package com.nutritrack.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;

@ConfigurationProperties("nutritrack.scanner")
public record ScannerProperties(String provider, DataSize maxFileSize, Anthropic anthropic, HuggingFace huggingface) {
    public record Anthropic(String endpoint, String apiKey, String model, int maxTokens, Duration timeout) {}
    public record HuggingFace(String endpoint, String apiToken, Duration timeout, Double minConfidence) {}
}
