package com.nutritrack.scanner;

import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Default when no provider is configured: reports unavailable and never fabricates an analysis. */
@Component
@ConditionalOnProperty(prefix = "nutritrack.scanner", name = "provider", havingValue = "none", matchIfMissing = true)
public class NoopFoodVisionProvider implements FoodVisionProvider {
    @Override public String name() { return "none"; }
    @Override public boolean isAvailable() { return false; }
    @Override public List<RawDetectedFood> analyzeImage(byte[] image, String mimeType, String description) {
        throw new UnsupportedOperationException("No scanner provider configured");
    }
    @Override public List<RawDetectedFood> analyzeText(String description) {
        throw new UnsupportedOperationException("No scanner provider configured");
    }
}
