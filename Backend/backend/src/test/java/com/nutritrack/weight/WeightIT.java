package com.nutritrack.weight;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.nutritrack.IntegrationTestBase;
import java.util.Map;
import org.junit.jupiter.api.Test;

class WeightIT extends IntegrationTestBase {

    @Test
    void historyIsPreservedAndOrdered() throws Exception {
        String t = registerUser();
        postAs(t, "/api/v1/weights", Map.of("date", "2025-03-10", "weightKg", 79.5)).andExpect(status().isCreated());
        postAs(t, "/api/v1/weights", Map.of("date", "2025-03-01", "weightKg", 80.5, "note", "start")).andExpect(status().isCreated());
        // A second measurement on the same day does not overwrite the first.
        postAs(t, "/api/v1/weights", Map.of("date", "2025-03-01", "weightKg", 80.1)).andExpect(status().isCreated());

        getAs(t, "/api/v1/weights").andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.items[0].date").value("2025-03-01")).andExpect(jsonPath("$.items[2].date").value("2025-03-10"));
        getAs(t, "/api/v1/weights?from=2025-03-05&to=2025-03-31").andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void updateDeleteAndValidation() throws Exception {
        String t = registerUser();
        String id = body(postAs(t, "/api/v1/weights", Map.of("date", "2025-03-01", "weightKg", 80)).andReturn()).get("id").asText();
        putAs(t, "/api/v1/weights/" + id, Map.of("date", "2025-03-01", "weightKg", 79.2, "note", "fixed")).andExpect(jsonPath("$.weightKg").value(79.2));
        deleteAs(t, "/api/v1/weights/" + id).andExpect(status().isNoContent());
        postAs(t, "/api/v1/weights", Map.of("date", "2025-03-01", "weightKg", -5)).andExpect(status().isBadRequest());
        postAs(t, "/api/v1/weights", Map.of("date", "2025-03-01", "weightKg", 900)).andExpect(status().isBadRequest());
    }
}
