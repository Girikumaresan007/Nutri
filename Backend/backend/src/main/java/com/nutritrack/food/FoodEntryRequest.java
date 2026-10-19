package com.nutritrack.food;

import com.nutritrack.common.FoodSource;
import com.nutritrack.common.Meal;
import com.nutritrack.common.Nutrition;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record FoodEntryRequest(
        @NotNull LocalDate date,
        @NotNull Meal meal,
        @NotBlank @Size(max = 200) String name,
        @NotNull @DecimalMin(value = "0", inclusive = false) @DecimalMax("100000") BigDecimal quantity,
        @NotBlank @Pattern(regexp = "^[A-Za-z][A-Za-z0-9 ._()/-]{0,29}$", message = "invalid serving unit") String unit,
        @NotNull @Valid Nutrition nutrition,
        @Size(max = 1000) String notes,
        FoodSource source) {}
