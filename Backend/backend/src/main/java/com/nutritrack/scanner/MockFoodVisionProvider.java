package com.nutritrack.scanner;

import com.nutritrack.common.Confidence;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

/** DEVELOPMENT ONLY. Returns fixed sample data and ignores the image. Refuses to start under the prod profile. */
@Component
@ConditionalOnProperty(prefix = "nutritrack.scanner", name = "provider", havingValue = "mock")
public class MockFoodVisionProvider implements FoodVisionProvider {

    public MockFoodVisionProvider(Environment env) {
        if (env.acceptsProfiles(Profiles.of("prod"))) {
            throw new IllegalStateException("The mock scanner provider cannot be used in prod");
        }
    }

    @Override public String name() { return "mock"; }
    @Override public boolean isAvailable() { return true; }

    @Override
    public List<RawDetectedFood> analyzeImage(byte[] image, String mimeType, String description) {
        return sample();
    }

    @Override
    public List<RawDetectedFood> analyzeText(String description) {
        return sample();
    }

    private static List<RawDetectedFood> sample() {
        return List.of(
                new RawDetectedFood("Grilled chicken breast (MOCK)", new BigDecimal("100"), "g", new BigDecimal("1.5"),
                        new BigDecimal("165"), new BigDecimal("31"), BigDecimal.ZERO, new BigDecimal("3.6"), BigDecimal.ZERO,
                        Confidence.MEDIUM, List.of("Portion size estimated from plate size."),
                        List.of("Cooking oil or marinade may add calories that are not visible.")),
                new RawDetectedFood("Steamed rice (MOCK)", new BigDecimal("100"), "g", new BigDecimal("1.2"),
                        new BigDecimal("130"), new BigDecimal("2.7"), new BigDecimal("28"), new BigDecimal("0.3"), new BigDecimal("0.4"),
                        Confidence.LOW, List.of("Rice type and portion are hard to judge."), List.of()));
    }
}
