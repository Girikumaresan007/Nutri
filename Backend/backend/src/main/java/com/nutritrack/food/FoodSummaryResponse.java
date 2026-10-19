package com.nutritrack.food;

import com.nutritrack.common.Nutrition;
import java.time.LocalDate;
import java.util.List;

/** {@code days} contains only days that have at least one entry; days without entries are simply absent (not zero). */
public record FoodSummaryResponse(LocalDate from, LocalDate to, int loggedDays, Nutrition totals, List<DaySummary> days) {}
