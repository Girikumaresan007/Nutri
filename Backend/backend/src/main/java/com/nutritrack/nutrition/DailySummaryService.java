package com.nutritrack.nutrition;

import com.nutritrack.common.Nutrition;
import com.nutritrack.food.DaySummary;
import com.nutritrack.food.FoodSummaryService;
import com.nutritrack.goals.GoalResponse;
import com.nutritrack.goals.GoalService;
import com.nutritrack.workouts.WorkoutDayRow;
import com.nutritrack.workouts.WorkoutService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DailySummaryService {
    private final FoodSummaryService food;
    private final GoalService goals;
    private final WorkoutService workouts;

    public DailySummaryService(FoodSummaryService food, GoalService goals, WorkoutService workouts) {
        this.food = food;
        this.goals = goals;
        this.workouts = workouts;
    }

    @Transactional(readOnly = true)
    public DailySummaryResponse summarize(UUID userId, LocalDate date) {
        DaySummary day = food.byDay(userId, date, date).get(date);
        GoalResponse target = goals.findActive(userId, date).map(GoalResponse::from).orElse(null);
        WorkoutDayRow w = workouts.totalsFor(userId, date);
        ExerciseTotals exercise = new ExerciseTotals(w.sessions(), w.minutes() == null ? 0 : w.minutes(), w.calories());
        if (day == null) {
            return new DailySummaryResponse(date, false, Nutrition.ZERO, java.util.List.of(), target, null, exercise);
        }
        Nutrition remaining = target == null ? null : new Nutrition(
                BigDecimal.valueOf(target.dailyCalories()).subtract(day.totals().calories()),
                target.protein().subtract(day.totals().protein()),
                target.carbohydrates().subtract(day.totals().carbohydrates()),
                target.fat().subtract(day.totals().fat()),
                target.fiber().subtract(day.totals().fiber()));
        return new DailySummaryResponse(date, true, day.totals(), day.meals(), target, remaining, exercise);
    }
}
