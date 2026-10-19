package com.nutritrack.goals;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.nutritrack.IntegrationTestBase;
import org.junit.jupiter.api.Test;

class GoalIT extends IntegrationTestBase {

    @Test
    void activeGoalIsLatestEffectiveOnOrBeforeDate() throws Exception {
        String t = registerUser();
        postAs(t, "/api/v1/goals", goal("2025-01-01", 2000)).andExpect(status().isCreated());
        postAs(t, "/api/v1/goals", goal("2025-03-01", 1800)).andExpect(status().isCreated());

        getAs(t, "/api/v1/goals/active?date=2024-12-31").andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("NO_ACTIVE_GOAL"));
        getAs(t, "/api/v1/goals/active?date=2025-01-01").andExpect(jsonPath("$.dailyCalories").value(2000));
        getAs(t, "/api/v1/goals/active?date=2025-02-28").andExpect(jsonPath("$.dailyCalories").value(2000));
        getAs(t, "/api/v1/goals/active?date=2025-03-01").andExpect(jsonPath("$.dailyCalories").value(1800));
        getAs(t, "/api/v1/goals/active?date=2025-12-01").andExpect(jsonPath("$.dailyCalories").value(1800));
        getAs(t, "/api/v1/goals").andExpect(jsonPath("$[0].effectiveFrom").value("2025-03-01"));
    }

    @Test
    void duplicateDateAndBackdatedGoalsAreRejected() throws Exception {
        String t = registerUser();
        postAs(t, "/api/v1/goals", goal("2025-03-01", 2000)).andExpect(status().isCreated());
        postAs(t, "/api/v1/goals", goal("2025-03-01", 1900)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("GOAL_EFFECTIVE_DATE_EXISTS"));
        postAs(t, "/api/v1/goals", goal("2025-01-01", 1900)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("GOAL_DATE_NOT_LATEST"));
    }

    @Test
    void newGoalDoesNotRewriteHistoricalTarget() throws Exception {
        String t = registerUser();
        String oldId = body(postAs(t, "/api/v1/goals", goal("2025-01-01", 2000)).andReturn()).get("id").asText();
        postAs(t, "/api/v1/goals", goal("2025-06-01", 1500)).andExpect(status().isCreated());
        getAs(t, "/api/v1/goals/" + oldId).andExpect(jsonPath("$.dailyCalories").value(2000));
        getAs(t, "/api/v1/goals/active?date=2025-02-01").andExpect(jsonPath("$.dailyCalories").value(2000));
    }

    @Test
    void effectiveDateIsImmutableButValuesCanBeCorrected() throws Exception {
        String t = registerUser();
        String id = body(postAs(t, "/api/v1/goals", goal("2025-01-01", 2000)).andReturn()).get("id").asText();
        putAs(t, "/api/v1/goals/" + id, goal("2025-02-01", 2100)).andExpect(status().isBadRequest());
        putAs(t, "/api/v1/goals/" + id, goal("2025-01-01", 2100)).andExpect(status().isOk()).andExpect(jsonPath("$.dailyCalories").value(2100));
    }

    @Test
    void goalGoverningLoggedDaysCannotBeDeleted() throws Exception {
        String t = registerUser();
        String id = body(postAs(t, "/api/v1/goals", goal("2025-01-01", 2000)).andReturn()).get("id").asText();
        postAs(t, "/api/v1/food-entries", foodEntry("2025-01-10", "lunch", "Rice", 130, 2.7, 28, 0.3, 0.4)).andExpect(status().isCreated());
        deleteAs(t, "/api/v1/goals/" + id).andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("GOAL_REQUIRED_FOR_HISTORY"));

        String free = body(postAs(t, "/api/v1/goals", goal("2025-05-01", 1900)).andReturn()).get("id").asText();
        deleteAs(t, "/api/v1/goals/" + free).andExpect(status().isNoContent());
    }

    @Test
    void validationRejectsImplausibleValues() throws Exception {
        String t = registerUser();
        postAs(t, "/api/v1/goals", goal("2025-01-01", 100)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("dailyCalories"));
    }
}
