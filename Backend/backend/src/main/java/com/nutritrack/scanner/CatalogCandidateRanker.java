package com.nutritrack.scanner;

import com.nutritrack.catalog.FoodCatalogItem;
import com.nutritrack.catalog.FoodCatalogRepository;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Deterministic, explainable candidate ranking grounded exclusively in the
 * verified PostgreSQL food catalog.
 *
 * Evaluates candidate items based on:
 * 1. User-entered text (highest priority)
 * 2. Exact or partial canonical-name match
 * 3. Regional and colloquial aliases
 * 4. Vision model predicted class and alternative predictions
 * 5. Visual texture family / category similarity for ambiguous classes
 */
@Component
public class CatalogCandidateRanker {

    private final FoodCatalogRepository catalogRepository;

    public CatalogCandidateRanker(FoodCatalogRepository catalogRepository) {
        this.catalogRepository = catalogRepository;
    }

    public record PredictionInput(String label, double score) {}

    /**
     * Known ambiguous visual texture classes that commonly absorb unmodeled dishes
     * in the 20-class ViT model.
     */
    public static final Set<String> AMBIGUOUS_CLASSES = Set.of(
            "fried_rice",
            "pizza",
            "dal_makhani",
            "chapati",
            "butter_naan",
            "pakode"
    );

    /**
     * Deterministically rank candidates from the PostgreSQL food catalog.
     *
     * @param userDescription Optional user-provided text description
     * @param predictions Top predictions from vision model (label and score)
     * @param limit Maximum number of candidate items to return (e.g. 6)
     * @return Deterministically ordered list of FoodCandidateDto items
     */
    public List<FoodCandidateDto> rankCandidates(
            String userDescription,
            List<PredictionInput> predictions,
            int limit
    ) {
        List<FoodCatalogItem> allItems = catalogRepository.findAll();
        if (allItems.isEmpty()) {
            return Collections.emptyList();
        }

        String cleanText = (userDescription != null && !userDescription.isBlank())
                ? userDescription.trim().toLowerCase(Locale.ROOT)
                : null;

        PredictionInput topPred = (predictions != null && !predictions.isEmpty()) ? predictions.get(0) : null;
        String topLabel = topPred != null ? topPred.label().toLowerCase(Locale.ROOT) : null;
        double topScore = topPred != null ? topPred.score() : 0.0;

        List<ScoredCandidate> scored = new ArrayList<>();

        for (FoodCatalogItem item : allItems) {
            double score = 0.0;
            String reason = null;

            String canonLower = item.getCanonicalName().toLowerCase(Locale.ROOT);
            String aliasesLower = item.getRegionalAliases() != null
                    ? item.getRegionalAliases().toLowerCase(Locale.ROOT)
                    : "";
            String category = item.getCategory() != null ? item.getCategory() : "";

            // 1. User Text Matching (Highest Priority)
            if (cleanText != null) {
                if (canonLower.equals(cleanText)) {
                    score = 100.0;
                    reason = "Exact user match: canonical name";
                } else if (matchesAliasExact(aliasesLower, cleanText)) {
                    score = 95.0;
                    reason = "Exact user match: regional alias ('" + cleanText + "')";
                } else if (canonLower.contains(cleanText) || cleanText.contains(canonLower)) {
                    score = 85.0;
                    reason = "Partial match: user text in canonical name";
                } else if (aliasesLower.contains(cleanText)) {
                    score = 80.0;
                    reason = "Partial match: user text in regional aliases";
                }
            }

            // 2. Vision Model Top Prediction Direct Match
            if (score == 0.0 && topLabel != null) {
                String normTop = topLabel.replace('_', ' ');
                if (canonLower.equalsIgnoreCase(normTop) || canonLower.startsWith(normTop) || normTop.startsWith(canonLower)) {
                    score = 75.0 + Math.min(topScore * 10.0, 10.0);
                    reason = "Vision model direct class match (" + topLabel + ")";
                } else if (aliasesLower.contains(normTop)) {
                    score = 70.0 + Math.min(topScore * 5.0, 5.0);
                    reason = "Vision model alias match (" + topLabel + ")";
                }
            }

            // 3. Vision Model Alternate Predictions Match (Top 2-5)
            if (score == 0.0 && predictions != null && predictions.size() > 1) {
                for (int i = 1; i < Math.min(predictions.size(), 5); i++) {
                    PredictionInput alt = predictions.get(i);
                    String altNorm = alt.label().replace('_', ' ').toLowerCase(Locale.ROOT);
                    if (canonLower.contains(altNorm) || altNorm.contains(canonLower)) {
                        score = 45.0 + (alt.score() * 15.0);
                        reason = "Model alternate prediction match (" + alt.label() + ", rank #" + (i + 1) + ")";
                        break;
                    } else if (aliasesLower.contains(altNorm)) {
                        score = 40.0 + (alt.score() * 10.0);
                        reason = "Model alternate prediction alias match (" + alt.label() + ")";
                        break;
                    }
                }
            }

            // 4. Ambiguous Class / Visual Texture Family Mapping
            if (score == 0.0 && topLabel != null) {
                if (topLabel.equals("fried_rice")) {
                    // Rice and grain composite dishes - Biryani and Pulao are prime visual conflations
                    if (canonLower.contains("biryani") || canonLower.contains("pulao")) {
                        score = 62.0;
                        reason = "Visually related biryani/pulao dish (fried rice texture family)";
                    } else if ("RICE_DISHES".equalsIgnoreCase(category)) {
                        score = 58.0;
                        reason = "Visually related rice/grain dish (fried rice texture family)";
                    } else if (canonLower.contains("pongal") || canonLower.contains("khichdi")) {
                        score = 56.0;
                        reason = "Related composite rice/lentil grain dish";
                    }
                } else if (topLabel.equals("pizza")) {
                    // Spiced tomato/red-brown gravy curries - Rajma and Chole are prime visual conflations
                    if ("CURRIES_GRAVIES".equalsIgnoreCase(category)) {
                        if (canonLower.contains("rajma") || canonLower.contains("chole") || canonLower.contains("chana")) {
                            score = 62.0;
                            reason = "Prime visual conflation: textured red/brown legume curry (thick sauce family)";
                        } else if (canonLower.contains("kadai") || canonLower.contains("paneer")) {
                            score = 58.0;
                            reason = "Visually related textured red-gravy curry (thick textured sauce visual family)";
                        } else {
                            score = 52.0;
                            reason = "Visually related spiced gravy dish (textured sauce visual family)";
                        }
                    } else if ("BREADS".equalsIgnoreCase(category)) {
                        score = 50.0;
                        reason = "Related flatbread/crust category item";
                    }
                } else if (topLabel.equals("dal_makhani")) {
                    // Lentil and pulse curries
                    if ("CURRIES_GRAVIES".equalsIgnoreCase(category) &&
                            (canonLower.contains("dal") || canonLower.contains("sambar") ||
                             canonLower.contains("rajma") || canonLower.contains("chole") ||
                             canonLower.contains("rasam"))) {
                        score = 60.0;
                        reason = "Lentil/pulse curry visual family";
                    }
                } else if (topLabel.equals("chapati") || topLabel.equals("butter_naan")) {
                    // Flatbreads & rotis
                    if ("BREADS".equalsIgnoreCase(category)) {
                        score = 60.0;
                        reason = "Indian flatbread category match";
                    }
                } else if (topLabel.equals("pakode") || topLabel.equals("samosa")) {
                    // Fried snacks and street food
                    if ("SNACKS_STREETFOOD".equalsIgnoreCase(category)) {
                        score = 60.0;
                        reason = "Street food and snack visual family";
                    }
                } else if (topLabel.equals("masala_dosa") || topLabel.equals("dosa")) {
                    // Dosa family and breakfast grain crepes
                    if (canonLower.contains("plain dosa") || canonLower.contains("homemade")) {
                        score = 72.0;
                        reason = "Plain/homemade dosa alternative (photo cannot verify filling or oil quantity)";
                    } else if (canonLower.contains("rava dosa")) {
                        score = 65.0;
                        reason = "Related dosa crepe variant";
                    } else if (canonLower.contains("set dosa") || canonLower.contains("neer dosa") || canonLower.contains("pesarattu")) {
                        score = 62.0;
                        reason = "Related South Indian breakfast crepe";
                    } else if (canonLower.contains("sambar") || canonLower.contains("chutney")) {
                        score = 55.0;
                        reason = "Common accompaniment for dosa (sambar / chutney)";
                    }
                }
            }

            // 5. Default Category Overlap for other predictions
            if (score == 0.0 && topLabel != null) {
                String expectedCategory = mapLabelToCategory(topLabel);
                if (expectedCategory != null && expectedCategory.equalsIgnoreCase(category)) {
                    score = 30.0;
                    reason = "General dish category alignment (" + category + ")";
                }
            }

            if (score > 0.0) {
                FoodCandidateDto dto = new FoodCandidateDto(
                        item.getId(),
                        item.getCanonicalName(),
                        item.getCategory(),
                        item.getCaloriesPer100g(),
                        item.getProteinPer100g(),
                        item.getCarbohydratesPer100g(),
                        item.getFatPer100g(),
                        item.getFiberPer100g(),
                        item.getDefaultServingUnit(),
                        item.getDefaultServingGrams(),
                        item.getDataSource(),
                        Math.round(score * 10.0) / 10.0,
                        reason
                );
                scored.add(new ScoredCandidate(score, dto));
            }
        }

        // Deterministic sort: matchScore DESC, then canonicalName ASC
        scored.sort(Comparator
                .comparingDouble(ScoredCandidate::score).reversed()
                .thenComparing(c -> c.dto().canonicalName()));

        int max = Math.min(limit, scored.size());
        List<FoodCandidateDto> results = new ArrayList<>(max);
        for (int i = 0; i < max; i++) {
            results.add(scored.get(i).dto());
        }
        return results;
    }

    private boolean matchesAliasExact(String aliasesCsv, String text) {
        if (aliasesCsv == null || aliasesCsv.isBlank()) return false;
        String[] parts = aliasesCsv.split(",");
        for (String p : parts) {
            if (p.trim().equalsIgnoreCase(text)) {
                return true;
            }
        }
        return false;
    }

    private String mapLabelToCategory(String label) {
        return switch (label) {
            case "idli", "masala_dosa", "dhokla" -> "BREAKFAST_GRAINS";
            case "fried_rice" -> "RICE_DISHES";
            case "chapati", "butter_naan" -> "BREADS";
            case "dal_makhani", "kadai_paneer", "pav_bhaji" -> "CURRIES_GRAVIES";
            case "samosa", "pakode", "paani_puri", "momos", "kaathi_rolls" -> "SNACKS_STREETFOOD";
            case "chai" -> "BEVERAGES";
            case "jalebi", "kulfi" -> "SWEETS_DESSERTS";
            default -> null;
        };
    }

    private record ScoredCandidate(double score, FoodCandidateDto dto) {}
}
