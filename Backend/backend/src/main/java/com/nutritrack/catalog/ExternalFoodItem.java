package com.nutritrack.catalog;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Validated nutrition representation for foods discovered via external providers
 * (e.g., Open Food Facts, USDA FoodData Central).
 */
public record ExternalFoodItem(
        String code,
        String canonicalName,
        String brand,
        String category,
        BigDecimal caloriesPer100g,
        BigDecimal proteinPer100g,
        BigDecimal carbohydratesPer100g,
        BigDecimal fatPer100g,
        BigDecimal fiberPer100g,
        String servingBasis,
        String defaultServingUnit,
        BigDecimal defaultServingGrams,
        Map<String, BigDecimal> servingConversions,
        String dataSource,
        String sourceReferenceId,
        String recipeType,
        String uncertaintyNote
) {}
