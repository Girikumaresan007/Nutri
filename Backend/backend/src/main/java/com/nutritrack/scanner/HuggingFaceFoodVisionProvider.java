package com.nutritrack.scanner;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nutritrack.catalog.FoodCatalogResponse;
import com.nutritrack.catalog.FoodCatalogService;
import com.nutritrack.common.Confidence;
import com.nutritrack.config.ScannerProperties;
import com.nutritrack.exception.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Real AI Food Vision provider using the fine-tuned Indian Food ViT model
 * coupled with the verified PostgreSQL Food Catalog (ICMR-NIN IFCT 2017 & USDA FoodData Central).
 * Implements Stage 14 Safe Candidate Matching, Decision Policy, and Prediction Safety.
 */
@Component
@ConditionalOnProperty(prefix = "nutritrack.scanner", name = "provider", havingValue = "huggingface")
public class HuggingFaceFoodVisionProvider implements FoodVisionProvider {
    private static final Logger log = LoggerFactory.getLogger(HuggingFaceFoodVisionProvider.class);

    private final ScannerProperties.HuggingFace cfg;
    private final ObjectMapper mapper;
    private final RestClient client;
    private final double minConfidence;
    private final FoodCatalogService catalogService;
    private final CatalogCandidateRanker candidateRanker;

    public HuggingFaceFoodVisionProvider(
            ScannerProperties props,
            ObjectMapper mapper,
            FoodCatalogService catalogService,
            CatalogCandidateRanker candidateRanker
    ) {
        this.cfg = props.huggingface() != null ? props.huggingface() :
                new ScannerProperties.HuggingFace("http://127.0.0.1:5001/classify", "", Duration.ofSeconds(15), 0.25);
        this.mapper = mapper;
        this.catalogService = catalogService;
        this.candidateRanker = candidateRanker;
        this.minConfidence = (this.cfg.minConfidence() != null && this.cfg.minConfidence() > 0)
                ? this.cfg.minConfidence() : 0.25;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        int timeoutMs = this.cfg.timeout() != null ? (int) this.cfg.timeout().toMillis() : 15_000;
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(timeoutMs);

        RestClient.Builder builder = RestClient.builder().requestFactory(factory);
        if (cfg.apiToken() != null && !cfg.apiToken().isBlank()) {
            builder.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + cfg.apiToken());
        }
        this.client = builder.build();
    }

    @Override
    public String name() {
        return "huggingface";
    }

    @Override
    public boolean isAvailable() {
        return cfg.endpoint() != null && !cfg.endpoint().isBlank();
    }

    @Override
    public List<RawDetectedFood> analyzeImage(byte[] image, String mimeType, String description) {
        if (!isAvailable()) {
            throw ApiException.unavailable("SCANNER_UNAVAILABLE", "Hugging Face vision provider is not configured.");
        }

        try {
            MediaType mediaType = MediaType.parseMediaType(mimeType);
            String rawResponse = client.post()
                    .uri(cfg.endpoint())
                    .contentType(mediaType)
                    .body(image)
                    .retrieve()
                    .body(String.class);

            return parsePredictions(rawResponse, description);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Hugging Face vision inference call failed: {}", e.getClass().getSimpleName());
            throw ApiException.unavailable("SCANNER_PROVIDER_FAILURE",
                    "Hugging Face vision inference service is temporarily unavailable. Please try again.");
        }
    }

    @Override
    public List<RawDetectedFood> analyzeText(String description) {
        if (description == null || description.isBlank()) {
            return Collections.emptyList();
        }

        List<FoodCandidateDto> candidates = candidateRanker.rankCandidates(description, Collections.emptyList(), 6);

        // 1. Try PostgreSQL Verified Food Catalog first
        List<FoodCatalogResponse> matches = catalogService.findBestMatches(description.trim(), 1);
        if (!matches.isEmpty()) {
            FoodCatalogResponse cat = matches.get(0);
            return List.of(fromCatalogResponse(cat, 0.95, null, candidates));
        }

        // 2. Fallback to static mapping
        RawDetectedFood matched = IndianFoodNutritionDatabase.matchFromText(description);
        if (matched != null) {
            return List.of(new RawDetectedFood(
                    matched.name(),
                    matched.servingAmount(),
                    matched.servingUnit(),
                    matched.servings(),
                    matched.calories(),
                    matched.protein(),
                    matched.carbohydrates(),
                    matched.fat(),
                    matched.fiber(),
                    matched.confidence(),
                    matched.uncertainty(),
                    matched.warnings(),
                    candidates
            ));
        }

        return Collections.emptyList();
    }

    private List<RawDetectedFood> parsePredictions(String jsonResponse, String userDescription) {
        if (jsonResponse == null || jsonResponse.isBlank()) {
            return Collections.emptyList();
        }

        try {
            JsonNode root = mapper.readTree(jsonResponse);
            boolean isDegraded = root.path("is_degraded").asBoolean(false);
            String engine = root.path("engine").asText("real_vit_model");
            String degradedReason = root.path("degraded_reason").asText(null);

            JsonNode predictionsNode = root.path("predictions");
            if (!predictionsNode.isArray() && root.isArray()) {
                predictionsNode = root;
            }

            if (!predictionsNode.isArray() || predictionsNode.isEmpty()) {
                return Collections.emptyList();
            }

            List<CatalogCandidateRanker.PredictionInput> predInputs = new ArrayList<>();
            for (JsonNode p : predictionsNode) {
                predInputs.add(new CatalogCandidateRanker.PredictionInput(
                        p.path("label").asText(),
                        p.path("score").asDouble(0.0)
                ));
            }

            // Always compute deterministic catalog candidates
            List<FoodCandidateDto> candidates = candidateRanker.rankCandidates(userDescription, predInputs, 6);

            // If user provided an explicit description along with the photo, check catalog match first
            if (userDescription != null && !userDescription.isBlank()) {
                List<FoodCatalogResponse> descMatches = catalogService.findBestMatches(userDescription.trim(), 1);
                if (!descMatches.isEmpty()) {
                    FoodCatalogResponse cat = descMatches.get(0);
                    return List.of(fromCatalogResponse(cat, 0.92,
                            "Food identified via user description context validated against verified nutrition catalog.", candidates));
                }
            }

            JsonNode top1 = predictionsNode.get(0);
            String topLabel = top1.path("label").asText();
            double topScore = top1.path("score").asDouble(0.0);

            if (topLabel.isBlank()) {
                return Collections.emptyList();
            }

            boolean isUncertain = root.path("is_uncertain").asBoolean(topScore < 0.70);
            boolean isAmbiguous = CatalogCandidateRanker.AMBIGUOUS_CLASSES.contains(topLabel.toLowerCase(Locale.ROOT));

            // Candidate summaries string for explanation
            List<String> candidateSummaries = new ArrayList<>();
            for (int i = 0; i < Math.min(predictionsNode.size(), 4); i++) {
                JsonNode p = predictionsNode.get(i);
                String lbl = p.path("label").asText().replace('_', ' ');
                double sc = p.path("score").asDouble(0.0);
                candidateSummaries.add(String.format(Locale.ROOT, "%s (%.0f%%)", lbl, sc * 100));
            }
            String altText = (isDegraded ? "Heuristic candidate estimates: " : "Model top predictions: ")
                    + String.join(", ", candidateSummaries);

            // --- PHASE 2 DECISION POLICY ---

            // Condition A: Degraded Fallback Mode
            if (isDegraded) {
                String warning = "Automatic AI vision recognition is temporarily operating in degraded fallback mode (genuine ViT weights not active). "
                        + (degradedReason != null ? degradedReason : "Please verify and search the food catalog below.");

                List<FoodCatalogResponse> fallbackMatches = catalogService.findBestMatches(topLabel.replace('_', ' '), 1);
                RawDetectedFood baseFood = !fallbackMatches.isEmpty()
                        ? fromCatalogResponse(fallbackMatches.get(0), topScore, null, candidates)
                        : IndianFoodNutritionDatabase.buildRawDetectedFood(topLabel, topScore);

                List<String> warnings = new ArrayList<>(baseFood.warnings());
                warnings.add(warning);
                List<String> uncertainties = new ArrayList<>();
                uncertainties.add(warning);
                uncertainties.add(altText);
                uncertainties.add("Portion size and recipe composition must be confirmed before saving.");

                Confidence assignedConfidence = topScore >= 0.85 ? Confidence.MEDIUM : Confidence.LOW;
                return List.of(new RawDetectedFood(
                        baseFood.name() + " (Degraded heuristic estimate)",
                        baseFood.servingAmount(),
                        baseFood.servingUnit(),
                        baseFood.servings(),
                        baseFood.calories(),
                        baseFood.protein(),
                        baseFood.carbohydrates(),
                        baseFood.fat(),
                        baseFood.fiber(),
                        assignedConfidence,
                        uncertainties,
                        warnings,
                        candidates
                ));
            }

            // Condition B: Low confidence / Out-of-Distribution (OOD) / Uncertain prediction
            if (isUncertain || topScore < 0.70) {
                String warning = String.format(Locale.ROOT,
                        "Visual classification confidence is low (%.1f%%). This food may be outside the model's 20-category classifier. Search or select the actual food from the catalog below.",
                        topScore * 100);

                List<FoodCatalogResponse> fallbackMatches = catalogService.findBestMatches(topLabel.replace('_', ' '), 1);
                RawDetectedFood baseFood = !fallbackMatches.isEmpty()
                        ? fromCatalogResponse(fallbackMatches.get(0), topScore, null, candidates)
                        : IndianFoodNutritionDatabase.buildRawDetectedFood(topLabel, topScore);

                List<String> warnings = new ArrayList<>(baseFood.warnings());
                warnings.add(warning);

                List<String> uncertainties = new ArrayList<>();
                uncertainties.add(warning);
                uncertainties.add(altText);
                uncertainties.add("Portion size and recipe composition must be confirmed before saving.");

                return List.of(new RawDetectedFood(
                        baseFood.name() + " (Uncertain match)",
                        baseFood.servingAmount(),
                        baseFood.servingUnit(),
                        baseFood.servings(),
                        baseFood.calories(),
                        baseFood.protein(),
                        baseFood.carbohydrates(),
                        baseFood.fat(),
                        baseFood.fiber(),
                        Confidence.LOW,
                        uncertainties,
                        warnings,
                        candidates
                ));
            }

            // Condition C: Ambiguous Mixed Dish (High confidence on ambiguous class: fried_rice, pizza, dal_makhani)
            if (isAmbiguous) {
                List<FoodCatalogResponse> catalogMatches = catalogService.findBestMatches(topLabel.replace('_', ' '), 1);
                RawDetectedFood baseFood = !catalogMatches.isEmpty()
                        ? fromCatalogResponse(catalogMatches.get(0), topScore, null, candidates)
                        : IndianFoodNutritionDatabase.buildRawDetectedFood(topLabel, topScore);

                String ambiguityWarning;
                String foodDisplayName;
                if ("fried_rice".equalsIgnoreCase(topLabel)) {
                    ambiguityWarning = String.format(Locale.ROOT,
                            "Visual appearance resembles rice grains (%s, %.1f%% confidence). Closed-set vision models often conflate Fried Rice with Biryani, Pulao, or Curd Rice. Please confirm your dish from suggested candidates below.",
                            topLabel.replace('_', ' '), topScore * 100);
                    foodDisplayName = baseFood.name() + " (Review suggested candidates)";
                } else if ("pizza".equalsIgnoreCase(topLabel)) {
                    ambiguityWarning = String.format(Locale.ROOT,
                            "Visual appearance resembles textured reddish topping (%s, %.1f%% confidence). Visual models frequently conflate pizza with red-gravy curries like Rajma Masala or Chana Masala. Please confirm from candidates below.",
                            topLabel.replace('_', ' '), topScore * 100);
                    foodDisplayName = baseFood.name() + " (Review suggested candidates)";
                } else if ("masala_dosa".equalsIgnoreCase(topLabel) || "dosa".equalsIgnoreCase(topLabel)) {
                    ambiguityWarning = String.format(Locale.ROOT,
                            "Visual appearance identifies a dosa (%s, %.1f%% confidence). A photo cannot determine whether it is homemade plain dosa (~135 kcal) or masala dosa with potato filling (280-330 kcal), nor measure cooking oil quantity. Please confirm your dosa variety and portion below.",
                            topLabel.replace('_', ' '), topScore * 100);
                    foodDisplayName = baseFood.name() + " (Confirm portion & recipe)";
                } else {
                    ambiguityWarning = String.format(Locale.ROOT,
                            "Visual appearance resembles a mixed dish or composite texture (%s). Visually related dishes are suggested below for your review.",
                            topLabel.replace('_', ' '));
                    foodDisplayName = baseFood.name() + " (Review suggested candidates)";
                }

                List<String> warnings = new ArrayList<>(baseFood.warnings());
                warnings.add(ambiguityWarning);

                List<String> uncertainties = new ArrayList<>();
                uncertainties.add(ambiguityWarning);
                uncertainties.add(altText);
                uncertainties.add("Portion size and recipe composition must be confirmed before saving.");

                Confidence assignedConfidence = topScore >= 0.85 ? Confidence.MEDIUM : Confidence.LOW;

                return List.of(new RawDetectedFood(
                        foodDisplayName,
                        baseFood.servingAmount(),
                        baseFood.servingUnit(),
                        baseFood.servings(),
                        baseFood.calories(),
                        baseFood.protein(),
                        baseFood.carbohydrates(),
                        baseFood.fat(),
                        baseFood.fiber(),
                        assignedConfidence,
                        uncertainties,
                        warnings,
                        candidates
                ));
            }

            // Condition C: Real model high confidence match on unambiguous supported class (>= 70% and not uncertain)
            if (topScore >= 0.70 && !isUncertain) {
                List<FoodCatalogResponse> catalogMatches = catalogService.findBestMatches(topLabel.replace('_', ' '), 1);
                if (!catalogMatches.isEmpty()) {
                    FoodCatalogResponse cat = catalogMatches.get(0);
                    return List.of(fromCatalogResponse(cat, topScore, null, candidates));
                }
                RawDetectedFood raw = IndianFoodNutritionDatabase.buildRawDetectedFood(topLabel, topScore);
                return List.of(new RawDetectedFood(
                        raw.name(), raw.servingAmount(), raw.servingUnit(), raw.servings(),
                        raw.calories(), raw.protein(), raw.carbohydrates(), raw.fat(), raw.fiber(),
                        raw.confidence(), raw.uncertainty(), raw.warnings(), candidates
                ));
            }

            // Condition D: Low confidence / Out-of-Distribution (OOD) / Uncertain prediction
            String warning = String.format(Locale.ROOT,
                    "Visual classification confidence is low (%.1f%%). This food may be outside the model's 20-category classifier. Search or select the actual food from the catalog below.",
                    topScore * 100);

            List<FoodCatalogResponse> fallbackMatches = catalogService.findBestMatches(topLabel.replace('_', ' '), 1);
            RawDetectedFood baseFood = !fallbackMatches.isEmpty()
                    ? fromCatalogResponse(fallbackMatches.get(0), topScore, null, candidates)
                    : IndianFoodNutritionDatabase.buildRawDetectedFood(topLabel, topScore);

            List<String> warnings = new ArrayList<>(baseFood.warnings());
            warnings.add(warning);

            List<String> uncertainties = new ArrayList<>();
            uncertainties.add(warning);
            uncertainties.add(altText);
            uncertainties.add("Portion size and recipe composition must be confirmed before saving.");

            return List.of(new RawDetectedFood(
                    baseFood.name() + " (Uncertain match)",
                    baseFood.servingAmount(),
                    baseFood.servingUnit(),
                    baseFood.servings(),
                    baseFood.calories(),
                    baseFood.protein(),
                    baseFood.carbohydrates(),
                    baseFood.fat(),
                    baseFood.fiber(),
                    Confidence.LOW,
                    uncertainties,
                    warnings,
                    candidates
            ));
        } catch (Exception e) {
            log.warn("Failed to parse inference service response: {}", e.getMessage());
            throw ApiException.unavailable("SCANNER_PROVIDER_FAILURE",
                    "The vision analysis service returned an unreadable response format.");
        }
    }

    private RawDetectedFood fromCatalogResponse(
            FoodCatalogResponse cat,
            double score,
            String customNote,
            List<FoodCandidateDto> candidates
    ) {
        BigDecimal grams = cat.defaultServingGrams();
        BigDecimal factor = grams.divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP);

        BigDecimal cal = cat.caloriesPer100g().multiply(factor).setScale(1, RoundingMode.HALF_UP);
        BigDecimal pro = cat.proteinPer100g().multiply(factor).setScale(1, RoundingMode.HALF_UP);
        BigDecimal carb = cat.carbohydratesPer100g().multiply(factor).setScale(1, RoundingMode.HALF_UP);
        BigDecimal fat = cat.fatPer100g().multiply(factor).setScale(1, RoundingMode.HALF_UP);
        BigDecimal fib = cat.fiberPer100g().multiply(factor).setScale(1, RoundingMode.HALF_UP);

        Confidence confidence = score >= 0.70 ? Confidence.HIGH : (score >= 0.35 ? Confidence.MEDIUM : Confidence.LOW);

        String note = (customNote != null) ? customNote : String.format(Locale.ROOT,
                "Food classified via ViT image model (model confidence: %.1f%%). Nutrition calculated from verified reference entry (%s - %s). Standard serving: %s %s (%sg). Portion size cannot be determined from photo alone; please review.",
                score * 100,
                cat.dataSource(),
                cat.sourceReferenceId() != null ? cat.sourceReferenceId() : "Standard Reference",
                BigDecimal.ONE.toPlainString(),
                cat.defaultServingUnit(),
                grams.stripTrailingZeros().toPlainString());

        List<String> warnings = cat.defaultWarning() != null
                ? List.of(cat.defaultWarning())
                : Collections.emptyList();

        return new RawDetectedFood(
                cat.canonicalName(),
                BigDecimal.ONE,
                cat.defaultServingUnit(),
                BigDecimal.ONE,
                cal, pro, carb, fat, fib,
                confidence,
                List.of(note),
                warnings,
                candidates != null ? candidates : Collections.emptyList()
        );
    }
}
