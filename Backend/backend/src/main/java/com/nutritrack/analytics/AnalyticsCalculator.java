package com.nutritrack.analytics;

import com.nutritrack.common.Nutrition;
import com.nutritrack.nutrition.ExerciseTotals;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** Pure statistics over a list of days; no I/O. */
final class AnalyticsCalculator {
    private AnalyticsCalculator() {}

    static PeriodAnalytics compute(LocalDate from, LocalDate to, List<DayAnalytics> days,
                                   List<WeightPoint> weights, boolean includeDays, boolean includeMissingDates) {
        int logged = 0, over = 0, under = 0, noTarget = 0;
        long sessions = 0, minutes = 0;
        long totalEntries = 0;
        Long calories = null;
        Nutrition sum = Nutrition.ZERO;
        List<LocalDate> missing = new ArrayList<>();
        for (DayAnalytics d : days) {
            if (d.logged()) {
                logged++;
                totalEntries += d.entryCount();
                sum = sum.plus(d.intake());
                switch (d.calorieStatus()) {
                    case OVER -> over++;
                    case UNDER -> under++;
                    default -> noTarget++;
                }
            } else if (includeMissingDates) {
                missing.add(d.date());
            }
            if (d.exercise() != null) {
                sessions += d.exercise().sessionCount();
                minutes += d.exercise().durationMinutes();
                if (d.exercise().estimatedCalories() != null) {
                    calories = (calories == null ? 0L : calories) + d.exercise().estimatedCalories();
                }
            }
        }
        Nutrition avg = logged == 0 ? null : sum.dividedBy(logged);
        return new PeriodAnalytics(from, to, days.size(), logged, days.size() - logged,
                includeMissingDates ? missing : null, totalEntries, avg, over, under, noTarget,
                new ExerciseTotals(sessions, minutes, calories), weightTrend(weights),
                includeDays ? days : null, null);
    }

    static CalorieStatus status(Nutrition intake, Integer targetCalories) {
        if (intake == null) return CalorieStatus.NOT_LOGGED;
        if (targetCalories == null) return CalorieStatus.NO_TARGET;
        return intake.calories().compareTo(BigDecimal.valueOf(targetCalories)) > 0 ? CalorieStatus.OVER : CalorieStatus.UNDER;
    }

    static WeightTrend weightTrend(List<WeightPoint> points) {
        if (points.isEmpty()) {
            return new WeightTrend(null, null, null, List.of());
        }
        BigDecimal start = points.get(0).weightKg();
        BigDecimal end = points.get(points.size() - 1).weightKg();
        return new WeightTrend(start, end, end.subtract(start), points);
    }
}
