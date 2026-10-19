package com.nutritrack.food;

import com.nutritrack.common.Meal;
import com.nutritrack.common.Nutrition;

public record MealSummary(Meal meal, long entryCount, Nutrition totals) {}
