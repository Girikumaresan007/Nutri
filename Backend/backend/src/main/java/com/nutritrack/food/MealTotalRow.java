package com.nutritrack.food;

import com.nutritrack.common.Meal;
import com.nutritrack.common.Nutrition;
import java.math.BigDecimal;
import java.time.LocalDate;

/** One (date, meal) aggregate row produced by a database GROUP BY. */
public record MealTotalRow(LocalDate date, Meal meal, Long entryCount, BigDecimal calories, BigDecimal protein,
                           BigDecimal carbohydrates, BigDecimal fat, BigDecimal fiber) {
    public Nutrition toNutrition() {
        return new Nutrition(calories, protein, carbohydrates, fat, fiber);
    }
}
