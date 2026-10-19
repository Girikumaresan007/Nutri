package com.nutritrack.scanner;

import com.nutritrack.common.Confidence;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;

/**
 * Provider-neutral detection result. Nutrition is per ONE serving of (servingAmount servingUnit).
 * Includes grounded candidate options for user review.
 */
public record RawDetectedFood(
        String name,
        BigDecimal servingAmount,
        String servingUnit,
        BigDecimal servings,
        BigDecimal calories,
        BigDecimal protein,
        BigDecimal carbohydrates,
        BigDecimal fat,
        BigDecimal fiber,
        Confidence confidence,
        List<String> uncertainty,
        List<String> warnings,
        List<FoodCandidateDto> candidates
) {
    public RawDetectedFood(
            String name,
            BigDecimal servingAmount,
            String servingUnit,
            BigDecimal servings,
            BigDecimal calories,
            BigDecimal protein,
            BigDecimal carbohydrates,
            BigDecimal fat,
            BigDecimal fiber,
            Confidence confidence,
            List<String> uncertainty,
            List<String> warnings
    ) {
        this(name, servingAmount, servingUnit, servings, calories, protein, carbohydrates, fat, fiber,
                confidence, uncertainty, warnings, Collections.emptyList());
    }
}
