package com.nutritrack.analytics;

import com.nutritrack.common.Nutrition;
import com.nutritrack.food.MealSummary;
import com.nutritrack.goals.GoalResponse;
import com.nutritrack.nutrition.ExerciseTotals;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * One calendar day. When {@code logged} is false, {@code intake} and {@code meals} are null: the day is MISSING data,
 * not a verified zero-intake day. {@code target} is the goal that was effective on that date (historical).
 */
public record DayAnalytics(LocalDate date, boolean logged, long entryCount, Nutrition intake, List<MealSummary> meals,
                           GoalResponse target, Nutrition remaining, CalorieStatus calorieStatus, ExerciseTotals exercise,
                           BigDecimal weightKg) {}
