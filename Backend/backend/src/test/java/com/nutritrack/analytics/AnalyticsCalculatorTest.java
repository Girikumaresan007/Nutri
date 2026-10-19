package com.nutritrack.analytics;

import static org.assertj.core.api.Assertions.assertThat;

import com.nutritrack.common.Nutrition;
import com.nutritrack.goals.GoalResponse;
import com.nutritrack.nutrition.ExerciseTotals;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AnalyticsCalculatorTest {

    private DayAnalytics day(LocalDate date, boolean logged, long entryCount, Double cals, Double p, Double c, Double f, Double fiber, Integer targetCals, ExerciseTotals ex, Double weightKg) {
        Nutrition intake = logged ? new Nutrition(BigDecimal.valueOf(cals), BigDecimal.valueOf(p), BigDecimal.valueOf(c), BigDecimal.valueOf(f), BigDecimal.valueOf(fiber)) : null;
        GoalResponse target = targetCals == null ? null : new GoalResponse(java.util.UUID.randomUUID(), date, com.nutritrack.common.GoalType.MAINTAIN, targetCals, BigDecimal.valueOf(120), BigDecimal.valueOf(250), BigDecimal.valueOf(70), BigDecimal.valueOf(30), null);
        Nutrition remaining = (target == null || intake == null) ? null : new Nutrition(
                BigDecimal.valueOf(target.dailyCalories()).subtract(intake.calories()),
                target.protein().subtract(intake.protein()),
                target.carbohydrates().subtract(intake.carbohydrates()),
                target.fat().subtract(intake.fat()),
                target.fiber().subtract(intake.fiber()));
        CalorieStatus status = AnalyticsCalculator.status(intake, targetCals);
        return new DayAnalytics(date, logged, entryCount, intake, null, target, remaining, status, ex, weightKg == null ? null : BigDecimal.valueOf(weightKg));
    }

    @Test
    @DisplayName("Empty days period yields zero logged days, no average intake, and zero total entries")
    void testEmptyDaysYieldsZeroLoggedAndNullAverage() {
        LocalDate from = LocalDate.of(2026, 3, 1);
        LocalDate to = LocalDate.of(2026, 3, 7);
        List<DayAnalytics> days = List.of(
                day(from, false, 0, null, null, null, null, null, 2000, null, null),
                day(from.plusDays(1), false, 0, null, null, null, null, null, 2000, null, null),
                day(from.plusDays(2), false, 0, null, null, null, null, null, 2000, null, null)
        );

        PeriodAnalytics p = AnalyticsCalculator.compute(from, to, days, List.of(), true, true);
        assertThat(p.calendarDays()).isEqualTo(3);
        assertThat(p.loggedDays()).isEqualTo(0);
        assertThat(p.missingDays()).isEqualTo(3);
        assertThat(p.missingDates()).containsExactly(from, from.plusDays(1), from.plusDays(2));
        assertThat(p.totalEntries()).isEqualTo(0);
        assertThat(p.averageIntake()).isNull();
        assertThat(p.daysOverTarget()).isEqualTo(0);
        assertThat(p.daysUnderTarget()).isEqualTo(0);
    }

    @Test
    @DisplayName("Average intake divides sum by logged days ONLY, never by total calendar days")
    void testLoggedDaysAverageComputesOverLoggedDaysOnly() {
        LocalDate d1 = LocalDate.of(2026, 3, 1);
        LocalDate d2 = LocalDate.of(2026, 3, 2);
        LocalDate d3 = LocalDate.of(2026, 3, 3);
        LocalDate d4 = LocalDate.of(2026, 3, 4);

        List<DayAnalytics> days = List.of(
                day(d1, true, 3, 2200.0, 110.0, 260.0, 75.0, 25.0, 2000, null, null), // OVER
                day(d2, true, 2, 1800.0, 90.0, 200.0, 60.0, 20.0, 2000, null, null),  // UNDER
                day(d3, false, 0, null, null, null, null, null, 2000, null, null),     // MISSING
                day(d4, true, 1, 1600.0, 80.0, 180.0, 50.0, 18.0, 1500, null, null)   // OVER
        );

        PeriodAnalytics p = AnalyticsCalculator.compute(d1, d4, days, List.of(), true, true);
        assertThat(p.calendarDays()).isEqualTo(4);
        assertThat(p.loggedDays()).isEqualTo(3);
        assertThat(p.missingDays()).isEqualTo(1);
        assertThat(p.missingDates()).containsExactly(d3);
        assertThat(p.totalEntries()).isEqualTo(6); // 3 + 2 + 1
        assertThat(p.daysOverTarget()).isEqualTo(2);
        assertThat(p.daysUnderTarget()).isEqualTo(1);

        // Sum = 2200 + 1800 + 1600 = 5600. Divided by 3 logged days = 1866.67 (NOT / 4 = 1400)
        assertThat(p.averageIntake().calories()).isEqualByComparingTo("1866.67");
        assertThat(p.averageIntake().protein()).isEqualByComparingTo("93.33");
    }

    @Test
    @DisplayName("Calorie status matches exact target thresholding")
    void testCalorieStatusLogic() {
        Nutrition n2000 = new Nutrition(BigDecimal.valueOf(2000), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
        Nutrition n2001 = new Nutrition(BigDecimal.valueOf(2001), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
        Nutrition n1999 = new Nutrition(BigDecimal.valueOf(1999), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);

        assertThat(AnalyticsCalculator.status(null, 2000)).isEqualTo(CalorieStatus.NOT_LOGGED);
        assertThat(AnalyticsCalculator.status(n2000, null)).isEqualTo(CalorieStatus.NO_TARGET);
        assertThat(AnalyticsCalculator.status(n2001, 2000)).isEqualTo(CalorieStatus.OVER);
        assertThat(AnalyticsCalculator.status(n1999, 2000)).isEqualTo(CalorieStatus.UNDER);
        assertThat(AnalyticsCalculator.status(n2000, 2000)).isEqualTo(CalorieStatus.UNDER);
    }

    @Test
    @DisplayName("Exercise totals are aggregated separately from food intake")
    void testExerciseTotalsSeparatedFromFoodIntake() {
        LocalDate d1 = LocalDate.of(2026, 3, 1);
        LocalDate d2 = LocalDate.of(2026, 3, 2);

        ExerciseTotals ex1 = new ExerciseTotals(1, 45, 350L);
        ExerciseTotals ex2 = new ExerciseTotals(2, 60, 500L);

        List<DayAnalytics> days = List.of(
                day(d1, true, 2, 2000.0, 100.0, 220.0, 70.0, 25.0, 2000, ex1, null),
                day(d2, false, 0, null, null, null, null, null, 2000, ex2, null)
        );

        PeriodAnalytics p = AnalyticsCalculator.compute(d1, d2, days, List.of(), true, false);
        assertThat(p.exercise().sessionCount()).isEqualTo(3);
        assertThat(p.exercise().durationMinutes()).isEqualTo(105);
        assertThat(p.exercise().estimatedCalories()).isEqualTo(850L);
        // Food calories remain exactly 2000.0 (one logged day)
        assertThat(p.averageIntake().calories()).isEqualByComparingTo("2000.00");
    }

    @Test
    @DisplayName("Weight trend computes start, end, and net change")
    void testWeightTrend() {
        LocalDate d1 = LocalDate.of(2026, 3, 1);
        LocalDate d2 = LocalDate.of(2026, 3, 5);
        LocalDate d3 = LocalDate.of(2026, 3, 10);

        List<WeightPoint> points = List.of(
                new WeightPoint(d1, BigDecimal.valueOf(82.5)),
                new WeightPoint(d2, BigDecimal.valueOf(81.8)),
                new WeightPoint(d3, BigDecimal.valueOf(80.5))
        );

        WeightTrend trend = AnalyticsCalculator.weightTrend(points);
        assertThat(trend.startKg()).isEqualByComparingTo("82.5");
        assertThat(trend.endKg()).isEqualByComparingTo("80.5");
        assertThat(trend.changeKg()).isEqualByComparingTo("-2.0");
        assertThat(trend.points()).hasSize(3);

        WeightTrend empty = AnalyticsCalculator.weightTrend(List.of());
        assertThat(empty.startKg()).isNull();
        assertThat(empty.endKg()).isNull();
        assertThat(empty.changeKg()).isNull();
        assertThat(empty.points()).isEmpty();
    }
}
