package com.nutritrack.scanner;

import com.nutritrack.common.Nutrition;
import com.nutritrack.common.RateLimiter;
import com.nutritrack.config.RateLimitProperties;
import com.nutritrack.exception.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Orchestrates validation -> provider -> composition-data refinement. Deliberately NOT transactional and has no
 * repository: scanner input and output are never persisted, and results are never saved to the diary automatically.
 */
@Service
public class ScannerService {
    static final String DISCLAIMER = "Values are AI-generated estimates, not exact measurements. Portion sizes, "
            + "ingredients and preparation methods may differ from what was detected. Review and edit before saving.";

    private final FoodVisionProvider vision;
    private final NutritionDataProvider nutritionData;
    private final ImageValidator validator;
    private final RateLimiter limiter;
    private final RateLimitProperties limits;

    public ScannerService(FoodVisionProvider vision, NutritionDataProvider nutritionData, ImageValidator validator,
                          RateLimiter limiter, RateLimitProperties limits) {
        this.vision = vision;
        this.nutritionData = nutritionData;
        this.validator = validator;
        this.limiter = limiter;
        this.limits = limits;
    }

    public ScanResponse analyzeImage(UUID userId, org.springframework.web.multipart.MultipartFile file, String description) {
        requireProvider();
        limiter.check("scanner:" + userId, limits.scannerRequests(), limits.scannerWindow());
        ValidatedImage image = validator.validate(file);
        String ctx = clean(description);
        return build(vision.analyzeImage(image.bytes(), image.mimeType(), ctx));
    }

    public ScanResponse estimateText(UUID userId, String description) {
        requireProvider();
        limiter.check("scanner:" + userId, limits.scannerRequests(), limits.scannerWindow());
        return build(vision.analyzeText(clean(description)));
    }

    private void requireProvider() {
        if (!vision.isAvailable()) {
            throw ApiException.unavailable("SCANNER_UNAVAILABLE",
                    "Food scanning is not available because no analysis provider is configured. You can still add food manually.");
        }
    }

    private ScanResponse build(List<RawDetectedFood> raw) {
        List<DetectedFood> items = new ArrayList<>();
        for (RawDetectedFood r : raw) {
            RawDetectedFood f = nutritionData.refine(r);
            Nutrition perServing = new Nutrition(f.calories(), f.protein(), f.carbohydrates(), f.fat(), f.fiber());
            items.add(new DetectedFood(f.name(), f.servingAmount().multiply(f.servings()).setScale(2, RoundingMode.HALF_UP),
                    f.servingUnit(), f.servingAmount(), f.servings(), perServing, perServing.times(f.servings()),
                    f.confidence(), f.uncertainty(), f.warnings(), f.candidates()));
        }
        List<String> warnings = new ArrayList<>();
        if (items.isEmpty()) {
            warnings.add("No food could be identified. Try a clearer photo or describe the meal.");
        }
        return new ScanResponse(UUID.randomUUID(), true, vision.name(), DISCLAIMER, items, warnings);
    }

    private static String clean(String s) {
        if (s == null) return null;
        String t = s.replaceAll("\\p{Cntrl}", " ").trim();
        return t.length() > 1000 ? t.substring(0, 1000) : t;
    }
}
