package com.nutritrack.profile;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.nutritrack.IntegrationTestBase;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ProfileIT extends IntegrationTestBase {

    private Map<String, Object> profile(String dob) {
        Map<String, Object> m = new HashMap<>();
        m.put("name", "Ann Lee");
        m.put("dateOfBirth", dob);
        m.put("heightCm", 180);
        m.put("currentWeightKg", 80);
        m.put("biologicalSex", "male");
        m.put("activityLevel", "moderate");
        m.put("goalType", "lose_weight");
        m.put("targetWeightKg", 75);
        m.put("weightUnit", "kg");
        m.put("heightUnit", "cm");
        return m;
    }

    @Test
    void profileRoundTripAndDerivedAge() throws Exception {
        String t = registerUser();
        String dob = LocalDate.now().minusYears(30).minusDays(1).toString();
        putAs(t, "/api/v1/profile", profile(dob)).andExpect(status().isOk())
                .andExpect(jsonPath("$.age").value(30)).andExpect(jsonPath("$.profileUpdatedAt").isNotEmpty());
        getAs(t, "/api/v1/profile").andExpect(jsonPath("$.name").value("Ann Lee")).andExpect(jsonPath("$.goalType").value("lose_weight"));
    }

    @Test
    void futureOrImplausibleBirthDatesRejected() throws Exception {
        String t = registerUser();
        putAs(t, "/api/v1/profile", profile(LocalDate.now().plusDays(1).toString())).andExpect(status().isBadRequest());
        putAs(t, "/api/v1/profile", profile("1800-01-01")).andExpect(status().isBadRequest());
        putAs(t, "/api/v1/profile", profile(LocalDate.now().minusYears(5).toString())).andExpect(status().isBadRequest());
        Map<String, Object> bad = profile("1990-01-01");
        bad.put("heightCm", 5);
        putAs(t, "/api/v1/profile", bad).andExpect(status().isBadRequest());
    }

    @Test
    void estimateRequiresCompleteProfileThenReturnsEstimateFlagAndNotes() throws Exception {
        String t = registerUser();
        getAs(t, "/api/v1/nutrition/estimate").andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("PROFILE_INCOMPLETE"));
        putAs(t, "/api/v1/profile", profile(LocalDate.now().minusYears(30).minusDays(5).toString())).andExpect(status().isOk());
        getAs(t, "/api/v1/nutrition/estimate").andExpect(status().isOk())
                .andExpect(jsonPath("$.age").value(30)).andExpect(jsonPath("$.estimatedBmr").value(1780))
                .andExpect(jsonPath("$.estimatedMaintenanceCalories").value(2759))
                .andExpect(jsonPath("$.suggestedCalorieTarget").value(2259))
                .andExpect(jsonPath("$.formula").value("mifflin-st-jeor-1990"))
                .andExpect(jsonPath("$.isEstimate").value(true)).andExpect(jsonPath("$.notes").isNotEmpty());
    }
}
