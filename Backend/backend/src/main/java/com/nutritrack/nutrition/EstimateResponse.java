package com.nutritrack.nutrition;

import com.nutritrack.common.GoalType;
import java.math.BigDecimal;
import java.util.List;

public record EstimateResponse(
        int age, int estimatedBmr, BigDecimal activityMultiplier, int estimatedMaintenanceCalories,
        GoalType goalType, int suggestedCalorieTarget, NutritionCalculator.Macros suggestedMacros,
        String formula, String biologicalSexHandling, boolean isEstimate, List<String> notes) {}
