package com.nutritrack.food;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.nutritrack.IntegrationTestBase;
import java.util.Map;
import org.junit.jupiter.api.Test;

class FoodEntryIT extends IntegrationTestBase {

    @Test
    void crudAndDuplicate() throws Exception {
        String t = registerUser();
        String id = body(postAs(t, "/api/v1/food-entries", foodEntry("2025-03-01", "breakfast", "Oats", 150, 5, 27, 3, 4))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.nutrition.calories").value(150.0)).andReturn()).get("id").asText();

        getAs(t, "/api/v1/food-entries/" + id).andExpect(status().isOk()).andExpect(jsonPath("$.meal").value("breakfast"));
        putAs(t, "/api/v1/food-entries/" + id, foodEntry("2025-03-01", "snacks", "Oats+milk", 200, 9, 30, 5, 4))
                .andExpect(status().isOk()).andExpect(jsonPath("$.meal").value("snacks")).andExpect(jsonPath("$.nutrition.calories").value(200.0));

        postAs(t, "/api/v1/food-entries/" + id + "/duplicate", Map.of("date", "2025-03-02", "meal", "dinner"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.date").value("2025-03-02")).andExpect(jsonPath("$.meal").value("dinner"))
                .andExpect(jsonPath("$.name").value("Oats+milk"));

        getAs(t, "/api/v1/food-entries?from=2025-03-01&to=2025-03-02").andExpect(jsonPath("$.totalElements").value(2));
        deleteAs(t, "/api/v1/food-entries/" + id).andExpect(status().isNoContent());
        getAs(t, "/api/v1/food-entries/" + id).andExpect(status().isNotFound());
    }

    @Test
    void validationRules() throws Exception {
        String t = registerUser();
        Map<String, Object> badQty = new java.util.HashMap<>(foodEntry("2025-03-01", "lunch", "X", 10, 1, 1, 1, 1));
        badQty.put("quantity", 0);
        postAs(t, "/api/v1/food-entries", badQty).andExpect(status().isBadRequest());

        Map<String, Object> badMeal = new java.util.HashMap<>(foodEntry("2025-03-01", "lunch", "X", 10, 1, 1, 1, 1));
        badMeal.put("meal", "brunch");
        postAs(t, "/api/v1/food-entries", badMeal).andExpect(status().isBadRequest());

        postAs(t, "/api/v1/food-entries", foodEntry("2025-03-01", "lunch", "X", 999999, 1, 1, 1, 1)).andExpect(status().isBadRequest());
        postAs(t, "/api/v1/food-entries", foodEntry("1990-01-01", "lunch", "X", 10, 1, 1, 1, 1)).andExpect(status().isBadRequest());
        postAs(t, "/api/v1/food-entries", foodEntry("2999-01-01", "lunch", "X", 10, 1, 1, 1, 1)).andExpect(status().isBadRequest());
        getAs(t, "/api/v1/food-entries").andExpect(status().isBadRequest());
        getAs(t, "/api/v1/food-entries?date=2025-13-45").andExpect(status().isBadRequest());
    }

    @Test
    void nutritionSnapshotIsStoredWithEntryAndUnchangedByLaterEdits() throws Exception {
        String t = registerUser();
        String a = body(postAs(t, "/api/v1/food-entries", foodEntry("2025-03-01", "lunch", "Apple", 52, 0.3, 14, 0.2, 2.4)).andReturn()).get("id").asText();
        // A second entry with the same food name but different values must not alter the first.
        postAs(t, "/api/v1/food-entries", foodEntry("2025-03-05", "lunch", "Apple", 95, 0.5, 25, 0.3, 4.4)).andExpect(status().isCreated());
        getAs(t, "/api/v1/food-entries/" + a).andExpect(jsonPath("$.nutrition.calories").value(52.0)).andExpect(jsonPath("$.nutrition.fiber").value(2.4));
        Double stored = jdbc.queryForObject("select calories::float8 from food_entries where id = ?::uuid", Double.class, a);
        assertThat(stored).isEqualTo(52.0);
    }

    @Test
    void summaryTotalsAreComputedServerSideFromSavedEntries() throws Exception {
        String t = registerUser();
        postAs(t, "/api/v1/food-entries", foodEntry("2025-03-01", "breakfast", "A", 300, 10, 40, 8, 5));
        postAs(t, "/api/v1/food-entries", foodEntry("2025-03-01", "breakfast", "B", 100, 5, 10, 2, 1));
        postAs(t, "/api/v1/food-entries", foodEntry("2025-03-01", "dinner", "C", 600, 40, 50, 20, 8));
        postAs(t, "/api/v1/food-entries", foodEntry("2025-03-03", "lunch", "D", 400, 20, 30, 10, 3));

        getAs(t, "/api/v1/food-entries/summary?date=2025-03-01").andExpect(status().isOk())
                .andExpect(jsonPath("$.loggedDays").value(1))
                .andExpect(jsonPath("$.totals.calories").value(1000.0))
                .andExpect(jsonPath("$.totals.protein").value(55.0))
                .andExpect(jsonPath("$.days[0].meals[0].meal").value("breakfast"))
                .andExpect(jsonPath("$.days[0].meals[0].totals.calories").value(400.0))
                .andExpect(jsonPath("$.days[0].meals[0].entryCount").value(2))
                .andExpect(jsonPath("$.days[0].meals[1].meal").value("lunch"))
                .andExpect(jsonPath("$.days[0].meals[1].totals.calories").value(0.0))
                .andExpect(jsonPath("$.days[0].meals[3].totals.calories").value(600.0));

        getAs(t, "/api/v1/food-entries/summary?from=2025-03-01&to=2025-03-05")
                .andExpect(jsonPath("$.loggedDays").value(2)).andExpect(jsonPath("$.totals.calories").value(1400.0))
                .andExpect(jsonPath("$.days.length()").value(2));

        getAs(t, "/api/v1/nutrition/daily-summary?date=2025-03-02").andExpect(jsonPath("$.logged").value(false));
    }

    @Test
    void dailySummaryShowsRemainingAgainstEffectiveGoalAndKeepsExerciseSeparate() throws Exception {
        String t = registerUser();
        postAs(t, "/api/v1/goals", goal("2025-01-01", 2000));
        postAs(t, "/api/v1/food-entries", foodEntry("2025-03-01", "lunch", "A", 700, 30, 80, 20, 6));
        postAs(t, "/api/v1/workouts", Map.of("type", "cardio", "date", "2025-03-01", "name", "Run", "durationMinutes", 45,
                "estimatedCalories", 400, "cardioType", "running"));
        getAs(t, "/api/v1/nutrition/daily-summary?date=2025-03-01").andExpect(status().isOk())
                .andExpect(jsonPath("$.logged").value(true))
                .andExpect(jsonPath("$.remaining.calories").value(1300.0))   // exercise NOT added back
                .andExpect(jsonPath("$.exercise.estimatedCalories").value(400))
                .andExpect(jsonPath("$.exercise.durationMinutes").value(45));
    }

    @Test
    void paginationBoundsAreEnforced() throws Exception {
        String t = registerUser();
        for (int i = 0; i < 3; i++) {
            postAs(t, "/api/v1/food-entries", foodEntry("2025-03-01", "lunch", "Item" + i, 10, 1, 1, 1, 1));
        }
        getAs(t, "/api/v1/food-entries?date=2025-03-01&size=2&page=1").andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.totalPages").value(2));
        getAs(t, "/api/v1/food-entries?date=2025-03-01&size=100000").andExpect(status().isBadRequest());
    }
}
