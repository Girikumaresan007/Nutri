package com.nutritrack.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.nutritrack.common.GoalType;
import com.nutritrack.common.Meal;
import com.nutritrack.common.Nutrition;
import com.nutritrack.exception.ApiException;
import com.nutritrack.food.DaySummary;
import com.nutritrack.food.FoodSummaryService;
import com.nutritrack.food.MealSummary;
import com.nutritrack.goals.GoalRepository;
import com.nutritrack.goals.NutritionGoal;
import com.nutritrack.weight.WeightLog;
import com.nutritrack.weight.WeightLogRepository;
import com.nutritrack.workouts.WorkoutDayRow;
import com.nutritrack.workouts.WorkoutRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.TreeMap;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AnalyticsServiceTest {

    private FoodSummaryService food;
    private GoalRepository goals;
    private WorkoutRepository workouts;
    private WeightLogRepository weights;
    private AnalyticsService service;

    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        food = mock(FoodSummaryService.class);
        goals = mock(GoalRepository.class);
        workouts = mock(WorkoutRepository.class);
        weights = mock(WeightLogRepository.class);
        service = new AnalyticsService(food, goals, workouts, weights);
    }

    @Test
    @DisplayName("Daily analytics returns DayAnalytics with confirmed meals, remaining calories, and workout totals")
    void testDailyAnalytics() {
        LocalDate date = LocalDate.of(2026, 3, 15);

        Nutrition intakeNutrition = new Nutrition(BigDecimal.valueOf(1850), BigDecimal.valueOf(95), BigDecimal.valueOf(210), BigDecimal.valueOf(65), BigDecimal.valueOf(22));
        List<MealSummary> mealSummaries = List.of(
                new MealSummary(Meal.BREAKFAST, 2, new Nutrition(BigDecimal.valueOf(450), BigDecimal.valueOf(25), BigDecimal.valueOf(50), BigDecimal.valueOf(15), BigDecimal.valueOf(5))),
                new MealSummary(Meal.LUNCH, 2, new Nutrition(BigDecimal.valueOf(800), BigDecimal.valueOf(40), BigDecimal.valueOf(100), BigDecimal.valueOf(30), BigDecimal.valueOf(10))),
                new MealSummary(Meal.DINNER, 1, new Nutrition(BigDecimal.valueOf(600), BigDecimal.valueOf(30), BigDecimal.valueOf(60), BigDecimal.valueOf(20), BigDecimal.valueOf(7)))
        );
        DaySummary daySummary = new DaySummary(date, 5, intakeNutrition, mealSummaries);
        TreeMap<LocalDate, DaySummary> intakeMap = new TreeMap<>();
        intakeMap.put(date, daySummary);

        when(food.byDay(userId, date, date)).thenReturn(intakeMap);

        NutritionGoal goal = new NutritionGoal();
        goal.setId(UUID.randomUUID());
        goal.setUserId(userId);
        goal.setEffectiveFrom(LocalDate.of(2026, 1, 1));
        goal.setGoalType(GoalType.LOSE_WEIGHT);
        goal.setDailyCalories(2000);
        goal.setProtein(BigDecimal.valueOf(120));
        goal.setCarbohydrates(BigDecimal.valueOf(220));
        goal.setFat(BigDecimal.valueOf(65));
        goal.setFiber(BigDecimal.valueOf(28));
        when(goals.findByUserIdAndEffectiveFromLessThanEqualOrderByEffectiveFromAsc(userId, date)).thenReturn(List.of(goal));

        when(workouts.aggregate(userId, date, date)).thenReturn(List.of(
                new WorkoutDayRow(date, 1L, 45L, 320L)
        ));

        WeightLog weightLog = new WeightLog();
        weightLog.setId(UUID.randomUUID());
        weightLog.setUserId(userId);
        weightLog.setLogDate(date);
        weightLog.setWeightKg(BigDecimal.valueOf(78.5));
        when(weights.findByUserIdAndLogDateBetweenOrderByLogDateAscCreatedAtAsc(userId, date, date)).thenReturn(List.of(weightLog));

        DayAnalytics result = service.daily(userId, date);

        assertThat(result.date()).isEqualTo(date);
        assertThat(result.logged()).isTrue();
        assertThat(result.entryCount()).isEqualTo(5);
        assertThat(result.intake().calories()).isEqualByComparingTo("1850");
        assertThat(result.target().dailyCalories()).isEqualTo(2000);
        assertThat(result.remaining()).isNotNull();
        // 2000 - 1850 = 150
        assertThat(result.remaining().calories()).isEqualByComparingTo("150");
        assertThat(result.calorieStatus()).isEqualTo(CalorieStatus.UNDER);
        assertThat(result.exercise().sessionCount()).isEqualTo(1);
        assertThat(result.exercise().durationMinutes()).isEqualTo(45);
        assertThat(result.exercise().estimatedCalories()).isEqualTo(320L);
        assertThat(result.weightKg()).isEqualByComparingTo("78.5");
        assertThat(result.meals()).hasSize(3);
    }

    @Test
    @DisplayName("Weekly analytics rejects date ranges exceeding 31 days")
    void testWeeklyExceedsRangeLimit() {
        LocalDate from = LocalDate.of(2026, 1, 1);
        LocalDate to = LocalDate.of(2026, 2, 15); // 46 days

        assertThatThrownBy(() -> service.weekly(userId, from, to))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException ae = (ApiException) e;
                    assertThat(ae.code()).isEqualTo("VALIDATION_FAILED");
                    assertThat(ae.fieldErrors()).anyMatch(f -> f.message().contains("must not exceed 31 days"));
                });
    }

    @Test
    @DisplayName("Monthly analytics validates month bounds (1-12)")
    void testMonthlyValidatesMonth() {
        assertThatThrownBy(() -> service.monthly(userId, 2026, 0))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.monthly(userId, 2026, 13))
                .isInstanceOf(ApiException.class);
    }

    @Test
    @DisplayName("Yearly analytics calculates monthly aggregates and annual total entries across 12 months")
    void testYearlyAnalytics() {
        when(food.byDay(eq(userId), any(LocalDate.class), any(LocalDate.class))).thenReturn(new TreeMap<>());
        when(goals.findByUserIdAndEffectiveFromLessThanEqualOrderByEffectiveFromAsc(eq(userId), any(LocalDate.class))).thenReturn(List.of());
        when(workouts.aggregate(eq(userId), any(LocalDate.class), any(LocalDate.class))).thenReturn(List.of());
        when(weights.findByUserIdAndLogDateBetweenOrderByLogDateAscCreatedAtAsc(eq(userId), any(LocalDate.class), any(LocalDate.class))).thenReturn(List.of());

        PeriodAnalytics yearly = service.yearly(userId, 2026);

        assertThat(yearly.calendarDays()).isEqualTo(365);
        assertThat(yearly.loggedDays()).isEqualTo(0);
        assertThat(yearly.months()).hasSize(12);
        assertThat(yearly.months().get(0).calendarDays()).isEqualTo(31); // Jan
        assertThat(yearly.months().get(1).calendarDays()).isEqualTo(28); // Feb 2026
        assertThat(yearly.averageIntake()).isNull();
        assertThat(yearly.totalEntries()).isEqualTo(0);
    }
}
