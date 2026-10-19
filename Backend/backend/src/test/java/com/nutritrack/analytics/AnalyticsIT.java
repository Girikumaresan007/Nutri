package com.nutritrack.analytics;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.nutritrack.IntegrationTestBase;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AnalyticsIT extends IntegrationTestBase {

    private void seed(String t) throws Exception {
        postAs(t, "/api/v1/goals", goal("2025-03-01", 2000));
        postAs(t, "/api/v1/goals", goal("2025-03-04", 1500));
        postAs(t, "/api/v1/food-entries", foodEntry("2025-03-01", "lunch", "A", 2200, 100, 250, 70, 20));   // over 2000
        postAs(t, "/api/v1/food-entries", foodEntry("2025-03-02", "lunch", "B", 1800, 90, 200, 60, 25));    // under 2000
        postAs(t, "/api/v1/food-entries", foodEntry("2025-03-04", "lunch", "C", 1600, 80, 180, 50, 22));    // over NEW 1500, would be under old
        postAs(t, "/api/v1/workouts", Map.of("type", "cardio", "date", "2025-03-02", "name", "Run", "durationMinutes", 30,
                "estimatedCalories", 300, "cardioType", "running"));
        postAs(t, "/api/v1/weights", Map.of("date", "2025-03-01", "weightKg", 80));
        postAs(t, "/api/v1/weights", Map.of("date", "2025-03-06", "weightKg", 79));
    }

    @Test
    void weeklyUsesHistoricalTargetsAndReportsMissingDaysSeparately() throws Exception {
        String t = registerUser();
        seed(t);
        getAs(t, "/api/v1/analytics/weekly?from=2025-03-01&to=2025-03-07").andExpect(status().isOk())
                .andExpect(jsonPath("$.calendarDays").value(7))
                .andExpect(jsonPath("$.loggedDays").value(3))
                .andExpect(jsonPath("$.missingDays").value(4))
                .andExpect(jsonPath("$.missingDates[0]").value("2025-03-03"))
                .andExpect(jsonPath("$.daysOverTarget").value(2))
                .andExpect(jsonPath("$.daysUnderTarget").value(1))
                .andExpect(jsonPath("$.averageIntake.calories").value(1866.67))   // logged days only, not /7
                .andExpect(jsonPath("$.days[0].target.dailyCalories").value(2000))
                .andExpect(jsonPath("$.days[3].target.dailyCalories").value(1500))
                .andExpect(jsonPath("$.days[3].calorieStatus").value("over"))
                .andExpect(jsonPath("$.days[2].logged").value(false))
                .andExpect(jsonPath("$.days[2].intake").doesNotExist())
                .andExpect(jsonPath("$.days[2].calorieStatus").value("not_logged"))
                .andExpect(jsonPath("$.exercise.estimatedCalories").value(300))
                .andExpect(jsonPath("$.exercise.durationMinutes").value(30))
                .andExpect(jsonPath("$.weight.changeKg").value(-1.0))
                .andExpect(jsonPath("$.weight.points.length()").value(2));
    }

    @Test
    void dailyMonthlyAndYearly() throws Exception {
        String t = registerUser();
        seed(t);
        getAs(t, "/api/v1/analytics/daily?date=2025-03-02").andExpect(jsonPath("$.logged").value(true))
                .andExpect(jsonPath("$.intake.calories").value(1800.0)).andExpect(jsonPath("$.exercise.sessionCount").value(1));
        getAs(t, "/api/v1/analytics/monthly?year=2025&month=3").andExpect(jsonPath("$.calendarDays").value(31))
                .andExpect(jsonPath("$.loggedDays").value(3)).andExpect(jsonPath("$.missingDays").value(28));
        getAs(t, "/api/v1/analytics/yearly?year=2025").andExpect(jsonPath("$.calendarDays").value(365))
                .andExpect(jsonPath("$.loggedDays").value(3)).andExpect(jsonPath("$.months.length()").value(12))
                .andExpect(jsonPath("$.months[2].loggedDays").value(3)).andExpect(jsonPath("$.months[0].loggedDays").value(0))
                .andExpect(jsonPath("$.months[0].averageIntake").doesNotExist()).andExpect(jsonPath("$.days").doesNotExist());
        getAs(t, "/api/v1/analytics/monthly?year=2025&month=13").andExpect(status().isBadRequest());
        getAs(t, "/api/v1/analytics/weekly?from=2025-01-01&to=2025-12-31").andExpect(status().isBadRequest());
    }
}
