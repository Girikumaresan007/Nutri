package com.nutritrack.catalog;

import java.math.BigDecimal;
import java.util.UUID;

public record CalculateNutritionResponse(
        UUID catalogId,
        String canonicalName,
        BigDecimal quantity,
        String unit,
        BigDecimal calculatedGrams,
        BigDecimal calories,
        BigDecimal protein,
        BigDecimal carbohydrates,
        BigDecimal fat,
        BigDecimal fiber,
        String dataSource,
        String sourceReferenceId,
        String calculationNote,
        String warning
) {}
