package com.nutritrack.catalog;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

public record FoodCatalogResponse(
        UUID id,
        String code,
        String canonicalName,
        String regionalAliases,
        String category,
        String preparationMethod,
        BigDecimal caloriesPer100g,
        BigDecimal proteinPer100g,
        BigDecimal carbohydratesPer100g,
        BigDecimal fatPer100g,
        BigDecimal fiberPer100g,
        String dataSource,
        String sourceReferenceId,
        String recipeType,
        String defaultServingUnit,
        BigDecimal defaultServingGrams,
        Map<String, BigDecimal> servingConversions,
        String defaultWarning
) {}
