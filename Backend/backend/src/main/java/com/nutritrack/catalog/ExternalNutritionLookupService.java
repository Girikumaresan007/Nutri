package com.nutritrack.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class ExternalNutritionLookupService {

    private static final Logger log = LoggerFactory.getLogger(ExternalNutritionLookupService.class);

    private static final String OFF_SEARCH_URL = "https://world.openfoodfacts.net/cgi/search.pl";
    private static final String OFF_FALLBACK_URL = "https://world.openfoodfacts.org/cgi/search.pl";
    private static final String USER_AGENT = "NutriTrackAI/1.0 (https://nutritrack.example.com; contact: api@nutritrack.example.com)";
    private static final Duration CONNECT_TIMEOUT = Duration.ofMillis(2500);
    private static final Duration REQUEST_TIMEOUT = Duration.ofMillis(3500);
    private static final long CACHE_TTL_SECONDS = 3600; // 1 hour TTL
    private static final int MAX_CACHE_ENTRIES = 200;

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    // In-memory thread-safe cache to respect provider rate-limits and avoid repeated queries
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    private record CacheEntry(List<ExternalFoodItem> results, Instant expiry) {}

    public ExternalNutritionLookupService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    /**
     * Query external nutrition databases (primarily Open Food Facts) for missing foods.
     * Guaranteed never to throw uncaught network exceptions or fabricate results.
     *
     * @param query Search query for missing food/product
     * @param limit Maximum results to return
     * @return List of validated external food records
     */
    public List<ExternalFoodItem> searchExternalFoods(String query, int limit) {
        if (query == null || query.isBlank()) {
            return Collections.emptyList();
        }

        String cleanQuery = query.trim().toLowerCase(Locale.ROOT);
        int maxResults = Math.min(Math.max(1, limit), 10);

        // Check cache
        CacheEntry cached = cache.get(cleanQuery);
        if (cached != null && Instant.now().isBefore(cached.expiry())) {
            log.debug("External lookup cache hit for query '{}'", cleanQuery);
            return cached.results().stream().limit(maxResults).toList();
        }

        List<ExternalFoodItem> fetched = queryOpenFoodFacts(cleanQuery, maxResults);

        // Cache valid results (even empty list to avoid hammering offline services repeatedly)
        if (cache.size() >= MAX_CACHE_ENTRIES) {
            evictOldestCacheEntry();
        }
        cache.put(cleanQuery, new CacheEntry(fetched, Instant.now().plusSeconds(CACHE_TTL_SECONDS)));

        return fetched;
    }

    private List<ExternalFoodItem> queryOpenFoodFacts(String cleanQuery, int maxResults) {
        try {
            String encodedQuery = URLEncoder.encode(cleanQuery, StandardCharsets.UTF_8);
            String url = String.format("%s?search_terms=%s&search_simple=1&action=process&json=1&page_size=%d",
                    OFF_SEARCH_URL, encodedQuery, maxResults * 2);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("User-Agent", USER_AGENT)
                    .header("Accept", "application/json")
                    .timeout(REQUEST_TIMEOUT)
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.warn("Open Food Facts primary returned HTTP {} for query '{}', trying fallback", response.statusCode(), cleanQuery);
                String fallbackUrl = String.format("%s?search_terms=%s&search_simple=1&action=process&json=1&page_size=%d",
                        OFF_FALLBACK_URL, encodedQuery, maxResults * 2);
                HttpRequest fallbackReq = HttpRequest.newBuilder()
                        .uri(URI.create(fallbackUrl))
                        .header("User-Agent", USER_AGENT)
                        .header("Accept", "application/json")
                        .timeout(REQUEST_TIMEOUT)
                        .GET()
                        .build();
                response = httpClient.send(fallbackReq, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() != 200) {
                    log.warn("Open Food Facts fallback returned HTTP {} for query '{}'", response.statusCode(), cleanQuery);
                    return Collections.emptyList();
                }
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode products = root.path("products");

            if (!products.isArray() || products.isEmpty()) {
                log.info("No external products found in Open Food Facts for '{}'", cleanQuery);
                return Collections.emptyList();
            }

            List<ExternalFoodItem> items = new ArrayList<>();

            for (JsonNode product : products) {
                if (items.size() >= maxResults) break;

                ExternalFoodItem item = parseProduct(product);
                if (item != null) {
                    items.add(item);
                }
            }

            return items;

        } catch (IOException | InterruptedException e) {
            log.warn("External nutrition lookup timed out or network unavailable: {}", e.getMessage());
            return Collections.emptyList();
        } catch (Exception e) {
            log.warn("Unexpected error during external nutrition lookup: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    private ExternalFoodItem parseProduct(JsonNode product) {
        String name = product.path("product_name").asText(null);
        if (name == null || name.isBlank()) {
            name = product.path("product_name_en").asText(null);
        }
        if (name == null || name.isBlank()) {
            return null; // Skip products without readable names
        }

        String brand = product.path("brands").asText(null);
        String barcode = product.path("code").asText(null);
        String code = "OFF_" + (barcode != null && !barcode.isBlank() ? barcode : UUIDName(name));

        JsonNode nutriments = product.path("nutriments");
        if (nutriments.isMissingNode() || nutriments.isEmpty()) {
            return null; // Must contain nutritional facts
        }

        BigDecimal calories = extractNutrient(nutriments, "energy-kcal_100g", "energy-kcal_value", "energy-kcal");
        if (calories == null) {
            // Check kJ and convert if available
            BigDecimal kj = extractNutrient(nutriments, "energy-kj_100g", "energy_100g");
            if (kj != null && kj.compareTo(BigDecimal.ZERO) > 0) {
                calories = kj.divide(new BigDecimal("4.184"), 1, RoundingMode.HALF_UP);
            }
        }

        BigDecimal protein = extractNutrient(nutriments, "proteins_100g", "proteins_value", "proteins");
        BigDecimal carbs = extractNutrient(nutriments, "carbohydrates_100g", "carbohydrates_value", "carbohydrates");
        BigDecimal fat = extractNutrient(nutriments, "fat_100g", "fat_value", "fat");
        BigDecimal fiber = extractNutrient(nutriments, "fiber_100g", "fiber_value", "fiber");

        // If calories is still missing, attempt Atwater approximation if macros exist
        if (calories == null && protein != null && carbs != null && fat != null) {
            calories = protein.multiply(new BigDecimal("4"))
                    .add(carbs.multiply(new BigDecimal("4")))
                    .add(fat.multiply(new BigDecimal("9")))
                    .setScale(1, RoundingMode.HALF_UP);
        }

        if (calories == null || calories.compareTo(BigDecimal.ZERO) < 0 || calories.compareTo(new BigDecimal("10000")) > 0) {
            return null; // Skip implausible entries
        }

        protein = (protein != null && protein.compareTo(BigDecimal.ZERO) >= 0) ? protein.setScale(1, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        carbs = (carbs != null && carbs.compareTo(BigDecimal.ZERO) >= 0) ? carbs.setScale(1, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        fat = (fat != null && fat.compareTo(BigDecimal.ZERO) >= 0) ? fat.setScale(1, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        boolean fiberReported = fiber != null && fiber.compareTo(BigDecimal.ZERO) >= 0;
        fiber = fiberReported ? fiber.setScale(1, RoundingMode.HALF_UP) : BigDecimal.ZERO;

        String servingSize = product.path("serving_size").asText("");
        BigDecimal defaultGrams = parseServingGrams(servingSize);

        Map<String, BigDecimal> conversions = new LinkedHashMap<>();
        conversions.put("g", BigDecimal.ONE);
        if (defaultGrams.compareTo(BigDecimal.ONE) != 0) {
            conversions.put("serving", defaultGrams);
        }

        String displayName = (brand != null && !brand.isBlank()) ? String.format("%s (%s)", name.trim(), brand.trim()) : name.trim();
        String note = fiberReported
                ? "Manufacturer packaging label data via Open Food Facts."
                : "Manufacturer packaging label via Open Food Facts. Note: Dietary fiber was not reported on the label.";

        return new ExternalFoodItem(
                code,
                displayName,
                brand,
                "PACKAGED_STAPLES",
                calories,
                protein,
                carbs,
                fat,
                fiber,
                "per 100g",
                "serving",
                defaultGrams,
                conversions,
                "Open Food Facts",
                barcode,
                "BRANDED_PRODUCT",
                note
        );
    }

    private BigDecimal extractNutrient(JsonNode nutriments, String... keys) {
        for (String key : keys) {
            JsonNode node = nutriments.path(key);
            if (node.isNumber()) {
                return BigDecimal.valueOf(node.asDouble());
            } else if (node.isTextual()) {
                try {
                    return new BigDecimal(node.asText().trim());
                } catch (NumberFormatException ignored) {}
            }
        }
        return null;
    }

    private BigDecimal parseServingGrams(String servingSize) {
        if (servingSize == null || servingSize.isBlank()) {
            return new BigDecimal("100.0");
        }
        try {
            // Match digits followed by g or ml
            String clean = servingSize.toLowerCase(Locale.ROOT).replaceAll("[^0-9.]", " ").trim();
            String[] tokens = clean.split("\\s+");
            for (String token : tokens) {
                if (!token.isBlank()) {
                    double val = Double.parseDouble(token);
                    if (val > 0 && val <= 1000) {
                        return BigDecimal.valueOf(val).setScale(1, RoundingMode.HALF_UP);
                    }
                }
            }
        } catch (Exception ignored) {}
        return new BigDecimal("100.0");
    }

    private String UUIDName(String name) {
        return name.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "_").replaceAll("_+", "_");
    }

    private void evictOldestCacheEntry() {
        var it = cache.entrySet().iterator();
        if (it.hasNext()) {
            it.next();
            it.remove();
        }
    }
}
