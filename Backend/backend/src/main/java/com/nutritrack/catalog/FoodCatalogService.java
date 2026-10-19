package com.nutritrack.catalog;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nutritrack.exception.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FoodCatalogService {
    private static final Logger log = LoggerFactory.getLogger(FoodCatalogService.class);

    private final FoodCatalogRepository repository;
    private final ObjectMapper mapper;
    private final ExternalNutritionLookupService externalLookupService;

    public FoodCatalogService(FoodCatalogRepository repository, ObjectMapper mapper) {
        this(repository, mapper, new ExternalNutritionLookupService(mapper));
    }

    @org.springframework.beans.factory.annotation.Autowired
    public FoodCatalogService(FoodCatalogRepository repository, ObjectMapper mapper, ExternalNutritionLookupService externalLookupService) {
        this.repository = repository;
        this.mapper = mapper;
        this.externalLookupService = externalLookupService;
    }

    @Transactional(readOnly = true)
    public List<FoodCatalogResponse> search(String query, String category, int limit) {
        int pageSize = Math.min(Math.max(1, limit), 250);
        String cleanQuery = (query != null && !query.isBlank()) ? query.trim() : null;
        if (cleanQuery != null && cleanQuery.length() > 100) {
            cleanQuery = cleanQuery.substring(0, 100);
        }
        String cleanCat = (category != null && !category.isBlank()) ? category.trim() : null;
        if (cleanCat != null && cleanCat.length() > 50) {
            cleanCat = cleanCat.substring(0, 50);
        }
        return repository.searchCatalog(cleanQuery, cleanCat, PageRequest.of(0, pageSize))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<FoodCatalogResponse> findBestMatches(String foodName, int limit) {
        if (foodName == null || foodName.isBlank()) {
            return Collections.emptyList();
        }
        String clean = foodName.trim();
        if (clean.length() > 100) {
            clean = clean.substring(0, 100);
        }
        int pageSize = Math.min(Math.max(1, limit), 20);
        return repository.findBestMatches(clean, PageRequest.of(0, pageSize))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public Optional<FoodCatalogResponse> getById(UUID id) {
        return repository.findById(id).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Optional<FoodCatalogResponse> getByCode(String code) {
        return repository.findByCode(code).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Optional<FoodCatalogResponse> findByName(String name) {
        return repository.findByCanonicalNameIgnoreCase(name).map(this::toResponse);
    }

    /**
     * Unified food lookup that searches local PostgreSQL catalog first,
     * and optionally queries external open food providers when requested or when local catalog has no match.
     */
    @Transactional
    public FoodLookupResponse lookup(String query, boolean includeExternal, int limit) {
        if (query == null || query.isBlank()) {
            return new FoodLookupResponse("", Collections.emptyList(), Collections.emptyList(), "NO_MATCH", "Empty query");
        }
        String cleanQuery = query.trim();
        if (cleanQuery.length() > 100) {
            cleanQuery = cleanQuery.substring(0, 100).trim();
        }

        int maxLimit = Math.min(Math.max(1, limit), 20);
        List<FoodCatalogResponse> local = search(cleanQuery, null, maxLimit);

        if (!local.isEmpty() && !includeExternal) {
            return new FoodLookupResponse(
                    cleanQuery,
                    local,
                    Collections.emptyList(),
                    "LOCAL_MATCH",
                    "Matches retrieved from verified NutriTrack reference catalog."
            );
        }

        // If local is empty OR user explicitly requested external lookup
        List<ExternalFoodItem> external = Collections.emptyList();
        String status = "NO_MATCH";
        try {
            external = externalLookupService.searchExternalFoods(query, maxLimit);
            if (!external.isEmpty()) {
                status = local.isEmpty() ? "EXTERNAL_MATCH" : "LOCAL_AND_EXTERNAL_MATCH";
            } else if (!local.isEmpty()) {
                status = "LOCAL_MATCH";
            }
        } catch (Exception e) {
            log.warn("External lookup degraded for '{}': {}", query, e.getMessage());
            status = local.isEmpty() ? "EXTERNAL_DEGRADED" : "LOCAL_MATCH";
        }

        String note = (status.equals("EXTERNAL_MATCH") || status.equals("LOCAL_AND_EXTERNAL_MATCH"))
                ? "External matches retrieved from Open Food Facts open database. Nutrient values are sourced from commercial packaging labels."
                : (local.isEmpty() ? "No matching food found in local verified catalog or external sources." : "Verified NutriTrack catalog matches.");

        return new FoodLookupResponse(query, local, external, status, note);
    }

    /**
     * Idempotently import and cache a validated external food into PostgreSQL food_catalog.
     * Generates a stable UUID so users can calculate portions and log meals reliably.
     */
    @Transactional
    public FoodCatalogResponse importExternalFood(ExternalFoodItem externalItem) {
        if (externalItem == null || externalItem.code() == null || externalItem.code().isBlank()) {
            throw ApiException.badRequest("INVALID_EXTERNAL_FOOD", "External food item code must not be blank");
        }

        // Check if item already exists by code
        Optional<FoodCatalogItem> existing = repository.findByCode(externalItem.code());
        if (existing.isPresent()) {
            return toResponse(existing.get());
        }

        FoodCatalogItem newItem = new FoodCatalogItem();
        newItem.setId(UUID.randomUUID());
        newItem.setCode(externalItem.code());
        newItem.setCanonicalName(externalItem.canonicalName());
        newItem.setRegionalAliases(externalItem.brand() != null ? externalItem.brand() : "");
        newItem.setCategory(externalItem.category() != null ? externalItem.category() : "PACKAGED_STAPLES");
        newItem.setPreparationMethod("Commercially packaged food item");
        newItem.setCaloriesPer100g(externalItem.caloriesPer100g());
        newItem.setProteinPer100g(externalItem.proteinPer100g());
        newItem.setCarbohydratesPer100g(externalItem.carbohydratesPer100g());
        newItem.setFatPer100g(externalItem.fatPer100g());
        newItem.setFiberPer100g(externalItem.fiberPer100g());
        newItem.setDataSource(externalItem.dataSource() != null ? externalItem.dataSource() : "Open Food Facts");
        newItem.setSourceReferenceId(externalItem.sourceReferenceId());
        newItem.setRecipeType("BRANDED_PRODUCT");
        newItem.setDefaultServingUnit(externalItem.defaultServingUnit() != null ? externalItem.defaultServingUnit() : "serving");
        newItem.setDefaultServingGrams(externalItem.defaultServingGrams() != null ? externalItem.defaultServingGrams() : new BigDecimal("100.0"));

        String conversionsJson = "{\"g\": 1, \"serving\": " + newItem.getDefaultServingGrams() + "}";
        if (externalItem.servingConversions() != null && !externalItem.servingConversions().isEmpty()) {
            try {
                conversionsJson = mapper.writeValueAsString(externalItem.servingConversions());
            } catch (Exception ignored) {}
        }
        newItem.setServingConversions(conversionsJson);
        newItem.setDefaultWarning(externalItem.uncertaintyNote());
        newItem.setVersion(1);
        newItem.setCreatedAt(Instant.now());
        newItem.setUpdatedAt(Instant.now());

        FoodCatalogItem saved = repository.save(newItem);
        log.info("Imported and cached external food item '{}' (code: {}) into catalog", saved.getCanonicalName(), saved.getCode());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public CalculateNutritionResponse calculateNutrition(CalculateNutritionRequest request) {
        if (request == null || request.catalogId() == null) {
            throw ApiException.badRequest("INVALID_REQUEST", "Calculation request and catalogId must not be null");
        }
        if (request.quantity() == null || request.quantity().compareTo(BigDecimal.ZERO) <= 0) {
            throw ApiException.badRequest("INVALID_QUANTITY", "Serving quantity must be greater than zero");
        }
        if (request.quantity().compareTo(new BigDecimal("100000")) > 0) {
            throw ApiException.badRequest("EXCESSIVE_QUANTITY", "Serving quantity exceeds maximum allowable threshold (100,000)");
        }
        if (request.unit() == null || request.unit().isBlank()) {
            throw ApiException.badRequest("INVALID_UNIT", "Serving unit must not be blank");
        }

        FoodCatalogItem item = repository.findById(request.catalogId())
                .orElseThrow(() -> ApiException.notFound("FOOD_NOT_FOUND", "Food item not found in catalog"));

        BigDecimal quantity = request.quantity();
        String unit = request.unit().trim();

        Map<String, BigDecimal> conversions = parseConversions(item.getServingConversions());

        BigDecimal gramsPerUnit;
        boolean customWeightApplied = false;
        if (request.customGrams() != null && request.customGrams().compareTo(BigDecimal.ZERO) > 0) {
            gramsPerUnit = request.customGrams();
            customWeightApplied = true;
        } else {
            gramsPerUnit = resolveGramsPerUnit(unit, item, conversions);
        }

        BigDecimal totalGrams = quantity.multiply(gramsPerUnit).setScale(2, RoundingMode.HALF_UP);
        BigDecimal factor100g = totalGrams.divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP);

        BigDecimal calories = item.getCaloriesPer100g().multiply(factor100g).setScale(1, RoundingMode.HALF_UP);
        BigDecimal protein = item.getProteinPer100g().multiply(factor100g).setScale(1, RoundingMode.HALF_UP);
        BigDecimal carbs = item.getCarbohydratesPer100g().multiply(factor100g).setScale(1, RoundingMode.HALF_UP);
        BigDecimal fat = item.getFatPer100g().multiply(factor100g).setScale(1, RoundingMode.HALF_UP);
        BigDecimal fiber = item.getFiberPer100g().multiply(factor100g).setScale(1, RoundingMode.HALF_UP);

        String note = customWeightApplied
                ? String.format(Locale.ROOT,
                        "Calculated for %s %s with user-adjusted weight (%sg/unit, total %sg) based on verified per-100g reference values from %s (%s).",
                        quantity.stripTrailingZeros().toPlainString(),
                        unit,
                        gramsPerUnit.stripTrailingZeros().toPlainString(),
                        totalGrams.stripTrailingZeros().toPlainString(),
                        item.getDataSource(),
                        item.getSourceReferenceId() != null ? item.getSourceReferenceId() : "Standard Reference")
                : String.format(Locale.ROOT,
                        "Calculated for %s %s (equivalent to %sg) based on verified per-100g reference values from %s (%s).",
                        quantity.stripTrailingZeros().toPlainString(),
                        unit,
                        totalGrams.stripTrailingZeros().toPlainString(),
                        item.getDataSource(),
                        item.getSourceReferenceId() != null ? item.getSourceReferenceId() : "Standard Reference");

        String warning = item.getDefaultWarning();
        if ("APPROXIMATE_RECIPE".equals(item.getRecipeType())) {
            String recipeNotice = "Approximate recipe formulation: Actual preparation calories may vary with cooking fat and household recipe.";
            warning = (warning != null && !warning.isBlank()) ? warning + " " + recipeNotice : recipeNotice;
        }

        return new CalculateNutritionResponse(
                item.getId(),
                item.getCanonicalName(),
                quantity,
                unit,
                totalGrams,
                calories,
                protein,
                carbs,
                fat,
                fiber,
                item.getDataSource(),
                item.getSourceReferenceId(),
                note,
                warning
        );
    }

    private BigDecimal resolveGramsPerUnit(String unit, FoodCatalogItem item, Map<String, BigDecimal> conversions) {
        String lowerUnit = unit.toLowerCase(Locale.ROOT);
        if (lowerUnit.equals("g") || lowerUnit.equals("gram") || lowerUnit.equals("grams")) {
            return BigDecimal.ONE;
        }

        // 1. Exact match in conversions map
        for (Map.Entry<String, BigDecimal> entry : conversions.entrySet()) {
            if (entry.getKey().equalsIgnoreCase(unit)) {
                return entry.getValue();
            }
        }

        // 2. Exact match with item's default serving unit
        if (unit.equalsIgnoreCase(item.getDefaultServingUnit())) {
            return item.getDefaultServingGrams();
        }

        // 3. Fallback to case-insensitive partial match
        for (Map.Entry<String, BigDecimal> entry : conversions.entrySet()) {
            if (entry.getKey().toLowerCase(Locale.ROOT).contains(lowerUnit)) {
                return entry.getValue();
            }
        }

        // 4. Defensible fallback to default portion weight with log notice
        log.info("No explicit unit conversion found for unit '{}' on '{}'; defaulting to {}g",
                unit, item.getCanonicalName(), item.getDefaultServingGrams());
        return item.getDefaultServingGrams();
    }

    public FoodCatalogResponse toResponse(FoodCatalogItem item) {
        return new FoodCatalogResponse(
                item.getId(),
                item.getCode(),
                item.getCanonicalName(),
                item.getRegionalAliases(),
                item.getCategory(),
                item.getPreparationMethod(),
                item.getCaloriesPer100g(),
                item.getProteinPer100g(),
                item.getCarbohydratesPer100g(),
                item.getFatPer100g(),
                item.getFiberPer100g(),
                item.getDataSource(),
                item.getSourceReferenceId(),
                item.getRecipeType(),
                item.getDefaultServingUnit(),
                item.getDefaultServingGrams(),
                parseConversions(item.getServingConversions()),
                item.getDefaultWarning()
        );
    }

    private Map<String, BigDecimal> parseConversions(String json) {
        if (json == null || json.isBlank()) return Collections.emptyMap();
        try {
            Map<String, Object> raw = mapper.readValue(json, new TypeReference<Map<String, Object>>() {});
            Map<String, BigDecimal> res = new HashMap<>();
            for (Map.Entry<String, Object> e : raw.entrySet()) {
                res.put(e.getKey(), new BigDecimal(String.valueOf(e.getValue())));
            }
            return res;
        } catch (Exception e) {
            log.warn("Failed to parse serving conversions JSON: {}", json);
            return Collections.emptyMap();
        }
    }
}
