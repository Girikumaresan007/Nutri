package com.nutritrack.goals;

import com.nutritrack.common.GoalType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record GoalResponse(UUID id, LocalDate effectiveFrom, GoalType goalType, Integer dailyCalories,
                           BigDecimal protein, BigDecimal carbohydrates, BigDecimal fat, BigDecimal fiber,
                           BigDecimal targetWeightKg) {
    public static GoalResponse from(NutritionGoal g) {
        return new GoalResponse(g.getId(), g.getEffectiveFrom(), g.getGoalType(), g.getDailyCalories(),
                g.getProtein(), g.getCarbohydrates(), g.getFat(), g.getFiber(), g.getTargetWeightKg());
    }
}
