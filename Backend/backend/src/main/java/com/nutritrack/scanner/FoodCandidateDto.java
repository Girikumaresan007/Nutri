package com.nutritrack.scanner;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Deterministic candidate food item grounded in the verified PostgreSQL food catalog.
 * Surfaced to users when predictions are ambiguous, uncertain, or out-of-distribution,
 * as well as for healthy model suggestions.
 */
public record FoodCandidateDto(
        UUID catalogId,
        String canonicalName,
        String category,
        BigDecimal caloriesPer100g,
        BigDecimal proteinPer100g,
        BigDecimal carbohydratesPer100g,
        BigDecimal fatPer100g,
        BigDecimal fiberPer100g,
        String defaultServingUnit,
        BigDecimal defaultServingGrams,
        String dataSource,
        double matchScore,
        String matchReason
) {}
