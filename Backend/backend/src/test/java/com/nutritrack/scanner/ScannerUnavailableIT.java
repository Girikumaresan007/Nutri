package com.nutritrack.scanner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.nutritrack.IntegrationTestBase;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

/** Default test profile has no scanner provider configured. */
class ScannerUnavailableIT extends IntegrationTestBase {

    @Test
    void returns503InsteadOfInventingAnAnalysis() throws Exception {
        String t = registerUser();
        MockMultipartFile img = new MockMultipartFile("image", "a.jpg", "image/jpeg", new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0, 1, 2});
        mvc.perform(multipart("/api/v1/scanner/analyze").file(img).header("Authorization", "Bearer " + t))
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error").value("SCANNER_UNAVAILABLE"))
                .andExpect(jsonPath("$.items").doesNotExist());
        postAs(t, "/api/v1/scanner/text-estimate", Map.of("description", "two eggs")).andExpect(status().isServiceUnavailable());
    }

    @Test
    void requiresAuthentication() throws Exception {
        MockMultipartFile img = new MockMultipartFile("image", "a.jpg", "image/jpeg", new byte[]{1});
        mvc.perform(multipart("/api/v1/scanner/analyze").file(img)).andExpect(status().isUnauthorized());
    }
}
