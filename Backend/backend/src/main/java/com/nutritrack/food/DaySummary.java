package com.nutritrack.food;

import com.nutritrack.common.Nutrition;
import java.time.LocalDate;
import java.util.List;

/** Totals for one logged day. Always lists all four meals in order (breakfast, lunch, snacks, dinner). */
public record DaySummary(LocalDate date, long entryCount, Nutrition totals, List<MealSummary> meals) {}
