package com.nutritrack.catalog;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record CalculateNutritionRequest(
        @NotNull UUID catalogId,
        @NotNull @DecimalMin(value = "0", inclusive = false) @DecimalMax("100000") BigDecimal quantity,
        @NotBlank String unit,
        @DecimalMin(value = "0", inclusive = false) @DecimalMax("100000") BigDecimal customGrams
) {
    public CalculateNutritionRequest(UUID catalogId, BigDecimal quantity, String unit) {
        this(catalogId, quantity, unit, null);
    }
}
