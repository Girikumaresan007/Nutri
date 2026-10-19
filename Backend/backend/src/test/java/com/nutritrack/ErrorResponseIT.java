package com.nutritrack;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

class ErrorResponseIT extends IntegrationTestBase {

    @Test
    void errorsHaveConsistentShapeAndLeakNothing() throws Exception {
        String t = registerUser();
        MvcResult r = getAs(t, "/api/v1/food-entries/not-a-uuid").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.timestamp").isNotEmpty()).andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").isNotEmpty()).andExpect(jsonPath("$.message").isNotEmpty())
                .andExpect(jsonPath("$.path").value("/api/v1/food-entries/not-a-uuid")).andReturn();
        assertThat(r.getResponse().getContentAsString()).doesNotContain("Exception").doesNotContain("at com.");

        mvc.perform(post("/api/v1/food-entries").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{bad json")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("MALFORMED_REQUEST"));
        mvc.perform(post("/api/v1/food-entries").header("Authorization", "Bearer " + t)
                .contentType(MediaType.TEXT_PLAIN).content("x")).andExpect(status().isUnsupportedMediaType());
        getAs(t, "/api/v1/does-not-exist").andExpect(status().isNotFound());
    }

    @Test
    void healthEndpointIsPublicAndHidesDetails() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.components").doesNotExist());
        mvc.perform(get("/actuator/env")).andExpect(status().is4xxClientError());
    }

    @Test
    void corsOnlyAllowsConfiguredOrigins() throws Exception {
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options("/api/v1/profile")
                .header("Origin", "http://localhost:5173").header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options("/api/v1/profile")
                .header("Origin", "http://evil.example").header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden());
    }
}
