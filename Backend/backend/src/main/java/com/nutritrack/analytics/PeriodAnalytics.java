package com.nutritrack.analytics;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.nutritrack.common.Nutrition;
import com.nutritrack.nutrition.ExerciseTotals;
import java.time.LocalDate;
import java.util.List;

/**
 * Period statistics. Averages are over LOGGED days only. Over/under counts only consider logged days that had a
 * target on that date. {@code days} is present for weekly/monthly; {@code months} for yearly.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PeriodAnalytics(
        LocalDate from, LocalDate to, int calendarDays, int loggedDays, int missingDays,
        List<LocalDate> missingDates, long totalEntries, Nutrition averageIntake,
        int daysOverTarget, int daysUnderTarget, int daysWithoutTarget,
        ExerciseTotals exercise, WeightTrend weight,
        List<DayAnalytics> days, List<PeriodAnalytics> months) {}
