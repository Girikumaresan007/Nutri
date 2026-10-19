package com.nutritrack.analytics;

import com.nutritrack.common.DateRange;
import com.nutritrack.common.Nutrition;
import com.nutritrack.exception.ApiException;
import com.nutritrack.food.DaySummary;
import com.nutritrack.food.FoodSummaryService;
import com.nutritrack.goals.GoalRepository;
import com.nutritrack.goals.GoalResponse;
import com.nutritrack.goals.NutritionGoal;
import com.nutritrack.nutrition.ExerciseTotals;
import com.nutritrack.weight.WeightLog;
import com.nutritrack.weight.WeightLogRepository;
import com.nutritrack.workouts.WorkoutDayRow;
import com.nutritrack.workouts.WorkoutRepository;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Loads food aggregates, effective-dated goals, workout aggregates and weights for the range with a handful of
 * queries, then derives per-day and period statistics. Each day is compared with the goal effective ON THAT DAY.
 */
@Service
public class AnalyticsService {
    private static final int MAX_WEEKLY_DAYS = 31;

    private final FoodSummaryService food;
    private final GoalRepository goals;
    private final WorkoutRepository workouts;
    private final WeightLogRepository weights;

    public AnalyticsService(FoodSummaryService food, GoalRepository goals, WorkoutRepository workouts, WeightLogRepository weights) {
        this.food = food;
        this.goals = goals;
        this.workouts = workouts;
        this.weights = weights;
    }

    @Transactional(readOnly = true)
    public DayAnalytics daily(UUID userId, LocalDate date) {
        return loadDays(userId, date, date).days().get(0);
    }

    @Transactional(readOnly = true)
    public PeriodAnalytics weekly(UUID userId, LocalDate from, LocalDate to) {
        DateRange r = DateRange.of(from, to, MAX_WEEKLY_DAYS);
        return period(userId, r.from(), r.to());
    }

    @Transactional(readOnly = true)
    public PeriodAnalytics monthly(UUID userId, int year, int month) {
        if (month < 1 || month > 12) throw ApiException.validation("month", "month must be between 1 and 12");
        validateYear(year);
        YearMonth ym = YearMonth.of(year, month);
        return period(userId, ym.atDay(1), ym.atEndOfMonth());
    }

    @Transactional(readOnly = true)
    public PeriodAnalytics yearly(UUID userId, int year) {
        validateYear(year);
        LocalDate from = LocalDate.of(year, 1, 1);
        LocalDate to = LocalDate.of(year, 12, 31);
        Loaded loaded = loadDays(userId, from, to);
        List<PeriodAnalytics> months = new ArrayList<>();
        for (int m = 1; m <= 12; m++) {
            YearMonth ym = YearMonth.of(year, m);
            List<DayAnalytics> monthDays = loaded.days().stream()
                    .filter(d -> YearMonth.from(d.date()).equals(ym)).toList();
            List<WeightPoint> monthWeights = loaded.weightPoints().stream()
                    .filter(w -> YearMonth.from(w.date()).equals(ym)).toList();
            months.add(AnalyticsCalculator.compute(ym.atDay(1), ym.atEndOfMonth(), monthDays, monthWeights, false, false));
        }
        PeriodAnalytics whole = AnalyticsCalculator.compute(from, to, loaded.days(), loaded.weightPoints(), false, false);
        long annualEntries = months.stream().mapToLong(PeriodAnalytics::totalEntries).sum();
        return new PeriodAnalytics(whole.from(), whole.to(), whole.calendarDays(), whole.loggedDays(), whole.missingDays(),
                null, annualEntries, whole.averageIntake(), whole.daysOverTarget(), whole.daysUnderTarget(), whole.daysWithoutTarget(),
                whole.exercise(), whole.weight(), null, months);
    }

    private PeriodAnalytics period(UUID userId, LocalDate from, LocalDate to) {
        Loaded l = loadDays(userId, from, to);
        return AnalyticsCalculator.compute(from, to, l.days(), l.weightPoints(), true, true);
    }

    private record Loaded(List<DayAnalytics> days, List<WeightPoint> weightPoints) {}

    private Loaded loadDays(UUID userId, LocalDate from, LocalDate to) {
        TreeMap<LocalDate, DaySummary> intake = food.byDay(userId, from, to);

        TreeMap<LocalDate, NutritionGoal> goalTimeline = new TreeMap<>();
        for (NutritionGoal g : goals.findByUserIdAndEffectiveFromLessThanEqualOrderByEffectiveFromAsc(userId, to)) {
            goalTimeline.put(g.getEffectiveFrom(), g);
        }

        Map<LocalDate, WorkoutDayRow> exercise = new HashMap<>();
        workouts.aggregate(userId, from, to).forEach(w -> exercise.put(w.date(), w));

        List<WeightLog> logs = weights.findByUserIdAndLogDateBetweenOrderByLogDateAscCreatedAtAsc(userId, from, to);
        Map<LocalDate, java.math.BigDecimal> lastWeightPerDay = new HashMap<>();
        List<WeightPoint> points = new ArrayList<>();
        for (WeightLog w : logs) {
            lastWeightPerDay.put(w.getLogDate(), w.getWeightKg());
            points.add(new WeightPoint(w.getLogDate(), w.getWeightKg()));
        }

        List<DayAnalytics> days = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            DaySummary s = intake.get(d);
            var goalEntry = goalTimeline.floorEntry(d);
            NutritionGoal goal = goalEntry == null ? null : goalEntry.getValue();
            Nutrition totals = s == null ? null : s.totals();
            Nutrition remaining = (goal == null || totals == null) ? null : new Nutrition(
                    java.math.BigDecimal.valueOf(goal.getDailyCalories()).subtract(totals.calories()),
                    goal.getProtein().subtract(totals.protein()),
                    goal.getCarbohydrates().subtract(totals.carbohydrates()),
                    goal.getFat().subtract(totals.fat()),
                    goal.getFiber().subtract(totals.fiber()));
            WorkoutDayRow w = exercise.get(d);
            ExerciseTotals ex = w == null ? new ExerciseTotals(0, 0, null)
                    : new ExerciseTotals(w.sessions(), w.minutes() == null ? 0 : w.minutes(), w.calories());
            days.add(new DayAnalytics(d, s != null, s == null ? 0 : s.entryCount(), totals,
                    s == null ? null : s.meals(),
                    goal == null ? null : GoalResponse.from(goal),
                    remaining,
                    AnalyticsCalculator.status(totals, goal == null ? null : goal.getDailyCalories()),
                    ex, lastWeightPerDay.get(d)));
        }
        return new Loaded(days, points);
    }

    private static void validateYear(int year) {
        if (year < 2000 || year > 2200) throw ApiException.validation("year", "year is outside the supported range");
    }
}
