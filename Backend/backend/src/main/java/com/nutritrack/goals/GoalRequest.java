package com.nutritrack.goals;

import com.nutritrack.common.GoalType;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record GoalRequest(
        LocalDate effectiveFrom,
        @NotNull GoalType goalType,
        @NotNull @Min(800) @Max(10000) Integer dailyCalories,
        @NotNull @DecimalMin("0") @DecimalMax("1500") BigDecimal protein,
        @NotNull @DecimalMin("0") @DecimalMax("1500") BigDecimal carbohydrates,
        @NotNull @DecimalMin("0") @DecimalMax("1500") BigDecimal fat,
        @NotNull @DecimalMin("0") @DecimalMax("500") BigDecimal fiber,
        @DecimalMin("20") @DecimalMax("500") BigDecimal targetWeightKg) {}
