package com.nutritrack.scanner;

import com.nutritrack.common.Confidence;
import com.nutritrack.common.Nutrition;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;

/**
 * quantity/servingUnit describe the estimated amount present (servingAmount x servings). nutritionPerServing is for one
 * serving of {servingAmount servingUnit}; estimatedNutrition is for the whole estimated quantity (computed by the server).
 * candidates contains deterministic candidate foods from the PostgreSQL food catalog for user review.
 */
public record DetectedFood(
        String name,
        BigDecimal quantity,
        String servingUnit,
        BigDecimal servingAmount,
        BigDecimal servings,
        Nutrition nutritionPerServing,
        Nutrition estimatedNutrition,
        Confidence confidence,
        List<String> uncertainty,
        List<String> warnings,
        List<FoodCandidateDto> candidates
) {
    public DetectedFood(
            String name,
            BigDecimal quantity,
            String servingUnit,
            BigDecimal servingAmount,
            BigDecimal servings,
            Nutrition nutritionPerServing,
            Nutrition estimatedNutrition,
            Confidence confidence,
            List<String> uncertainty,
            List<String> warnings
    ) {
        this(name, quantity, servingUnit, servingAmount, servings,
                nutritionPerServing, estimatedNutrition, confidence,
                uncertainty, warnings, Collections.emptyList());
    }
}
