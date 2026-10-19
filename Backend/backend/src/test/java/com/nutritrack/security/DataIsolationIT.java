package com.nutritrack.security;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.nutritrack.IntegrationTestBase;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class DataIsolationIT extends IntegrationTestBase {

    @Test
    void userCannotReadOrModifyAnotherUsersRecords() throws Exception {
        String alice = registerUser();
        String bob = registerUser();

        String foodId = body(postAs(alice, "/api/v1/food-entries", foodEntry("2025-03-01", "lunch", "Rice", 130, 2.7, 28, 0.3, 0.4))
                .andExpect(status().isCreated()).andReturn()).get("id").asText();
        String goalId = body(postAs(alice, "/api/v1/goals", goal("2025-01-01", 2000)).andExpect(status().isCreated()).andReturn()).get("id").asText();
        String weightId = body(postAs(alice, "/api/v1/weights", Map.of("date", "2025-03-01", "weightKg", 80)).andExpect(status().isCreated()).andReturn()).get("id").asText();
        String workoutId = body(postAs(alice, "/api/v1/workouts", Map.of("type", "cardio", "date", "2025-03-01", "name", "Run",
                "durationMinutes", 30, "cardioType", "running")).andExpect(status().isCreated()).andReturn()).get("id").asText();

        // Reads and writes by Bob are indistinguishable from "does not exist".
        getAs(bob, "/api/v1/food-entries/" + foodId).andExpect(status().isNotFound());
        putAs(bob, "/api/v1/food-entries/" + foodId, foodEntry("2025-03-01", "lunch", "Hacked", 1, 1, 1, 1, 1)).andExpect(status().isNotFound());
        deleteAs(bob, "/api/v1/food-entries/" + foodId).andExpect(status().isNotFound());
        postAs(bob, "/api/v1/food-entries/" + foodId + "/duplicate", Map.of()).andExpect(status().isNotFound());
        getAs(bob, "/api/v1/goals/" + goalId).andExpect(status().isNotFound());
        deleteAs(bob, "/api/v1/goals/" + goalId).andExpect(status().isNotFound());
        putAs(bob, "/api/v1/weights/" + weightId, Map.of("date", "2025-03-01", "weightKg", 50)).andExpect(status().isNotFound());
        deleteAs(bob, "/api/v1/weights/" + weightId).andExpect(status().isNotFound());
        getAs(bob, "/api/v1/workouts/" + workoutId).andExpect(status().isNotFound());
        deleteAs(bob, "/api/v1/workouts/" + workoutId).andExpect(status().isNotFound());

        // Lists and aggregates only contain Bob's (empty) data.
        getAs(bob, "/api/v1/food-entries?date=2025-03-01").andExpect(jsonPath("$.totalElements").value(0));
        getAs(bob, "/api/v1/weights").andExpect(jsonPath("$.totalElements").value(0));
        getAs(bob, "/api/v1/workouts?date=2025-03-01").andExpect(jsonPath("$.totalElements").value(0));
        getAs(bob, "/api/v1/goals").andExpect(jsonPath("$").isEmpty());
        getAs(bob, "/api/v1/food-entries/summary?date=2025-03-01").andExpect(jsonPath("$.loggedDays").value(0));

        // Alice's data is untouched.
        getAs(alice, "/api/v1/food-entries/" + foodId).andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Rice"));
    }

    @Test
    void clientSuppliedUserIdIsIgnored() throws Exception {
        String alice = registerUser();
        String bob = registerUser();
        String bobId = body(getAs(bob, "/api/v1/auth/me").andReturn()).get("id").asText();
        Map<String, Object> payload = new java.util.HashMap<>(foodEntry("2025-03-02", "lunch", "Mine", 100, 1, 1, 1, 1));
        payload.put("userId", bobId);
        postAs(alice, "/api/v1/food-entries", payload).andExpect(status().isCreated());
        getAs(bob, "/api/v1/food-entries?date=2025-03-02").andExpect(jsonPath("$.totalElements").value(0));
        getAs(alice, "/api/v1/food-entries?date=2025-03-02").andExpect(jsonPath("$.totalElements").value(1));
    }
}
