package com.nutritrack.scanner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.nutritrack.IntegrationTestBase;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;

@TestPropertySource(properties = {"nutritrack.scanner.provider=mock", "nutritrack.scanner.max-file-size=2KB"})
class ScannerMockProviderIT extends IntegrationTestBase {

    private static byte[] jpeg(int size) {
        byte[] b = new byte[size];
        b[0] = (byte) 0xFF; b[1] = (byte) 0xD8; b[2] = (byte) 0xFF;
        return b;
    }

    @Test
    void analyzeReturnsEstimatesAndPersistsNothing() throws Exception {
        String t = registerUser();
        Integer foodBefore = jdbc.queryForObject("select count(*) from food_entries", Integer.class);
        List<String> tablesBefore = tableRowCounts();

        mvc.perform(multipart("/api/v1/scanner/analyze").file(new MockMultipartFile("image", "meal.jpg", "image/jpeg", jpeg(500)))
                        .param("description", "lunch").header("Authorization", "Bearer " + t))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isEstimate").value(true))
                .andExpect(jsonPath("$.analysisId").isNotEmpty())
                .andExpect(jsonPath("$.disclaimer").isNotEmpty())
                .andExpect(jsonPath("$.items[0].confidence").isNotEmpty())
                .andExpect(jsonPath("$.items[0].uncertainty").isArray())
                .andExpect(jsonPath("$.items[0].quantity").value(150.0))           // 100 g x 1.5 servings
                .andExpect(jsonPath("$.items[0].estimatedNutrition.calories").value(247.5))
                .andExpect(jsonPath("$.items[0].nutritionPerServing.calories").value(165.0));

        // Nothing saved to the diary, and no table gained any row (no history, no image bytes).
        assertThat(jdbc.queryForObject("select count(*) from food_entries", Integer.class)).isEqualTo(foodBefore);
        assertThat(tableRowCounts()).isEqualTo(tablesBefore);
    }

    @Test
    void invalidAndOversizedUploadsAreRejected() throws Exception {
        String t = registerUser();
        mvc.perform(multipart("/api/v1/scanner/analyze").file(new MockMultipartFile("image", "x.jpg", "image/jpeg", "not an image".getBytes()))
                .header("Authorization", "Bearer " + t)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_IMAGE"));
        mvc.perform(multipart("/api/v1/scanner/analyze").file(new MockMultipartFile("image", "x.pdf", "application/pdf", "%PDF-1.4".getBytes()))
                .header("Authorization", "Bearer " + t)).andExpect(status().isUnsupportedMediaType());
        mvc.perform(multipart("/api/v1/scanner/analyze").file(new MockMultipartFile("image", "big.jpg", "image/jpeg", jpeg(4096)))
                .header("Authorization", "Bearer " + t)).andExpect(status().isPayloadTooLarge());
        mvc.perform(multipart("/api/v1/scanner/analyze").header("Authorization", "Bearer " + t)).andExpect(status().isBadRequest());
    }

    @Test
    void textEstimateWorksAndDoesNotSaveToDiary() throws Exception {
        String t = registerUser();
        postAs(t, "/api/v1/scanner/text-estimate", Map.of("description", "chicken and rice")).andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2));
        getAs(t, "/api/v1/food-entries?from=2025-01-01&to=2026-12-31").andExpect(jsonPath("$.totalElements").value(0));
    }

    private List<String> tableRowCounts() {
        return jdbc.queryForList("select table_name from information_schema.tables where table_schema = 'public' order by 1", String.class)
                .stream().map(n -> n + "=" + jdbc.queryForObject("select count(*) from \"" + n + "\"", Integer.class))
                .filter(s -> !s.startsWith("users=") && !s.startsWith("user_profiles=") && !s.startsWith("refresh_tokens=") && !s.startsWith("flyway"))
                .collect(Collectors.toList());
    }
}
