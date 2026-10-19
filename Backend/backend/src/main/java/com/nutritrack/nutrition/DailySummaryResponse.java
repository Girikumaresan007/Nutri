package com.nutritrack.nutrition;

import com.nutritrack.common.Nutrition;
import com.nutritrack.food.MealSummary;
import com.nutritrack.goals.GoalResponse;
import java.time.LocalDate;
import java.util.List;

/**
 * {@code logged=false} means nothing was recorded for the day (NOT a verified zero-intake day).
 * {@code remaining} is target minus consumed and is only present when the day is logged and a goal applies.
 * Exercise calories are never subtracted from or added to the target.
 */
public record DailySummaryResponse(LocalDate date, boolean logged, Nutrition consumed, List<MealSummary> meals,
                                   GoalResponse target, Nutrition remaining, ExerciseTotals exercise) {}
