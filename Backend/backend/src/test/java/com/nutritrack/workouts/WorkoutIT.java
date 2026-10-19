package com.nutritrack.workouts;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.nutritrack.IntegrationTestBase;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class WorkoutIT extends IntegrationTestBase {

    private Map<String, Object> strength(String date) {
        return Map.of("type", "strength", "date", date, "name", "Push day", "durationMinutes", 60, "estimatedCalories", 300,
                "split", "chest_triceps", "notes", "felt good",
                "exercises", List.of(
                        Map.of("name", "Bench press", "sets", 4, "reps", 8, "weightKg", 80),
                        Map.of("name", "Dips", "sets", 3, "reps", 10, "weightKg", 0, "notes", "bodyweight")));
    }

    @Test
    void strengthCrud() throws Exception {
        String t = registerUser();
        String id = body(postAs(t, "/api/v1/workouts", strength("2025-03-01")).andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("strength")).andExpect(jsonPath("$.caloriesAreEstimate").value(true))
                .andExpect(jsonPath("$.exercises.length()").value(2)).andExpect(jsonPath("$.cardioType").doesNotExist())
                .andReturn()).get("id").asText();

        getAs(t, "/api/v1/workouts/" + id).andExpect(jsonPath("$.exercises[0].name").value("Bench press"))
                .andExpect(jsonPath("$.exercises[1].name").value("Dips"));

        putAs(t, "/api/v1/workouts/" + id, Map.of("type", "strength", "date", "2025-03-01", "name", "Leg day", "durationMinutes", 50,
                "split", "legs", "exercises", List.of(Map.of("name", "Squat", "sets", 5, "reps", 5, "weightKg", 100))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.split").value("legs")).andExpect(jsonPath("$.exercises.length()").value(1));

        getAs(t, "/api/v1/workouts?date=2025-03-01").andExpect(jsonPath("$.totalElements").value(1));
        deleteAs(t, "/api/v1/workouts/" + id).andExpect(status().isNoContent());
        getAs(t, "/api/v1/workouts/" + id).andExpect(status().isNotFound());
    }

    @Test
    void cardioSessionWithDistance() throws Exception {
        String t = registerUser();
        postAs(t, "/api/v1/workouts", Map.of("type", "cardio", "date", "2025-03-02", "name", "Morning run", "durationMinutes", 30,
                "cardioType", "running", "distanceKm", 5.2)).andExpect(status().isCreated())
                .andExpect(jsonPath("$.cardioType").value("running")).andExpect(jsonPath("$.distanceKm").value(5.2))
                .andExpect(jsonPath("$.exercises").doesNotExist());
        getAs(t, "/api/v1/workouts?from=2025-03-01&to=2025-03-31").andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void variantRulesAreEnforced() throws Exception {
        String t = registerUser();
        postAs(t, "/api/v1/workouts", Map.of("type", "strength", "date", "2025-03-01", "name", "No exercises", "durationMinutes", 30, "split", "legs"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors[0].field").value("exercises"));
        postAs(t, "/api/v1/workouts", Map.of("type", "cardio", "date", "2025-03-01", "name", "No type", "durationMinutes", 30))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors[0].field").value("cardioType"));
        postAs(t, "/api/v1/workouts", Map.of("type", "cardio", "date", "2025-03-01", "name", "Bad", "durationMinutes", 0, "cardioType", "running"))
                .andExpect(status().isBadRequest());
    }
}
