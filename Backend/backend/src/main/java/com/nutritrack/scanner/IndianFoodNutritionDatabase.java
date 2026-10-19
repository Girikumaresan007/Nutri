package com.nutritrack.scanner;

import com.nutritrack.common.Confidence;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Standard reference nutritional database for Indian food classification.
 * Food classification identifies the dish; nutritional values represent standard reference portions
 * based on Indian Food Composition Tables (IFCT / NIN-ICMR).
 */
public final class IndianFoodNutritionDatabase {

    public record FoodNutrientProfile(
            String displayName,
            BigDecimal servingAmount,
            String servingUnit,
            BigDecimal calories,
            BigDecimal protein,
            BigDecimal carbohydrates,
            BigDecimal fat,
            BigDecimal fiber,
            String defaultWarning
    ) {}

    private static final Map<String, FoodNutrientProfile> PROFILES = new HashMap<>();

    static {
        register("samosa", "Samosa", 1, "piece (80g)", 210, 3.5, 24.0, 11.0, 2.0, "Deep-fried item; cooking oil absorption varies with frying temperature.");
        register("idli", "Idli", 2, "pieces (100g)", 116, 4.0, 24.0, 0.4, 2.0, "Steamed fermented rice and urad dal; chutney and sambar calories should be added separately if consumed.");
        register("plain_dosa", "Homemade Plain Dosa", 1, "dosa (75g)", 135, 3.8, 24.5, 3.2, 1.4, "Standard homemade plain dosa with modest cooking oil (~1 tsp). Batter ratio, diameter, and oil/ghee alter calories. Add chutney and sambar separately.");
        register("homemade_dosa", "Homemade Plain Dosa", 1, "dosa (75g)", 135, 3.8, 24.5, 3.2, 1.4, "Standard homemade plain dosa with modest cooking oil (~1 tsp). Batter ratio, diameter, and oil/ghee alter calories. Add chutney and sambar separately.");
        register("dosa", "Plain Dosa", 1, "dosa (80g)", 145, 4.0, 26.0, 3.5, 1.5, "Standard plain dosa. Size and cooking oil affect total calories. Accompaniments should be counted separately.");
        register("masala_dosa", "Masala Dosa", 1, "dosa (150g)", 280, 5.5, 38.0, 11.5, 3.5, "Restaurant/large dosa with spiced potato filling. Roasting ghee/oil and filling portion vary by preparation.");
        register("rava_dosa", "Rava Dosa", 1, "dosa (120g)", 230, 4.5, 36.0, 7.5, 1.9, "Semolina and rice crepe. Requires generous tawa oil for crisp lace texture.");
        register("set_dosa", "Set Dosa", 1, "set (3 pieces, 150g)", 185, 4.8, 32.0, 4.2, 2.1, "Thick spongy dosas prepared with minimal surface oil.");
        register("coconut_chutney", "Coconut Chutney", 1, "serving (30g)", 85, 1.2, 3.5, 7.8, 1.8, "Fresh grated coconut with mustard-curry leaf tadka. Calorie-dense from natural coconut fat.");
        register("tomato_chutney", "Tomato Chutney", 1, "serving (30g)", 42, 0.8, 5.2, 2.1, 1.1, "Sauteed tomato and onion relish; lower in fat than coconut chutney.");
        register("chole_bhature", "Chole Bhature", 1, "plate (300g)", 550, 14.0, 65.0, 26.0, 8.0, "Includes 2 bhature and chole curry. High in refined flour and frying oil.");
        register("dal_makhani", "Dal Makhani", 1, "bowl (200g)", 280, 10.0, 24.0, 16.0, 5.0, "Restaurant preparations often include generous amounts of butter and cream.");
        register("butter_naan", "Butter Naan", 1, "naan (90g)", 260, 7.0, 42.0, 7.5, 2.0, "Refined flour flatbread; butter amount varies by restaurant.");
        register("chapati", "Chapati / Phulka", 2, "rotis (80g)", 208, 6.2, 40.0, 1.6, 5.6, "Whole wheat roti without oil/ghee. Add ~45 kcal if brushed with ghee.");
        register("pav_bhaji", "Pav Bhaji", 1, "plate (250g)", 400, 8.0, 52.0, 18.0, 6.0, "Includes 2 buttered pav and mixed vegetable bhaji with butter garnish.");
        register("paani_puri", "Pani Puri / Golgappa", 1, "plate / 6 puris (120g)", 180, 3.0, 28.0, 6.0, 2.0, "Spiced mint water and potato-chickpea filling. Sweet chutney adds extra sugar.");
        register("dhokla", "Khaman Dhokla", 2, "pieces (80g)", 160, 5.0, 26.0, 4.0, 2.0, "Steamed chickpea cake; sugar syrup tempering increases calorie density.");
        register("kadai_paneer", "Kadai Paneer", 1, "bowl (200g)", 320, 16.0, 12.0, 24.0, 3.0, "Cottage cheese in spiced tomato-capsicum gravy; rich in protein and dairy fat.");
        register("kaathi_rolls", "Kathi Roll", 1, "roll (180g)", 350, 12.0, 42.0, 15.0, 3.0, "Paratha roll with spiced filling and sauce. Calories depend on filling and oil.");
        register("momos", "Steamed Momos", 6, "dumplings (150g)", 240, 8.0, 36.0, 7.0, 2.0, "Steamed dumplings; spicy chili dipping sauce is typically low calorie.");
        register("pakode", "Pakode / Bhajji", 1, "plate (100g)", 280, 5.0, 24.0, 18.0, 3.0, "Deep-fried gram flour fritters; oil absorption can vary.");
        register("fried_rice", "Vegetable Fried Rice", 1, "plate (250g)", 380, 7.0, 58.0, 14.0, 3.0, "Wok-tossed rice with vegetables and cooking oil.");
        register("chai", "Indian Masala Chai", 1, "cup (150ml)", 110, 3.5, 14.0, 4.5, 0.0, "Brewed with whole milk and ~1 tsp sugar. Unsweetened chai is ~60 kcal.");
        register("jalebi", "Jalebi", 2, "pieces (60g)", 240, 1.0, 44.0, 7.0, 0.5, "Deep-fried fermented batter soaked in sugar syrup; very high in simple sugars.");
        register("kulfi", "Kulfi", 1, "kulfi (80g)", 190, 4.5, 22.0, 9.5, 0.5, "Traditional condensed milk dessert; rich in milk solids and sugar.");
        register("burger", "Burger", 1, "burger (180g)", 360, 11.0, 48.0, 14.0, 4.0, "Bun, vegetable/patty, and dressing; mayonnaise increases total fat.");
        register("pizza", "Pizza Slice", 1, "slice (120g)", 280, 10.0, 32.0, 12.0, 2.5, "Crust with tomato sauce, vegetables, and mozzarella cheese.");
        register("eggs", "Scrambled Eggs", 2, "eggs (100g)", 148, 12.0, 1.5, 10.0, 0.0, "Cooking butter or oil adds extra calories.");
        register("toast", "Whole Wheat Toast", 1, "slice (30g)", 75, 3.0, 13.0, 1.0, 1.5, "Buttered toast adds ~35 kcal per pat of butter.");
        register("chicken", "Grilled Chicken Breast", 1, "portion (120g)", 198, 37.0, 0.0, 4.3, 0.0, "Lean protein; oil or marinade adds calories.");
        register("rice", "Steamed White Rice", 1, "cup (150g)", 195, 4.0, 42.0, 0.4, 0.6, "Plain cooked rice without added oil or salt.");
        register("salad", "Fresh Garden Salad", 1, "bowl (150g)", 45, 2.0, 8.0, 0.5, 3.0, "Salad dressing can add 70-150 kcal depending on oil content.");
        register("biryani", "Chicken Biryani", 1, "plate (250g)", 462, 21.2, 55.0, 17.5, 3.0, "Layered spiced basmati rice and marinated chicken cooked in dum. Ghee/oil varies.");
        register("chicken_biryani", "Chicken Biryani", 1, "plate (250g)", 462, 21.2, 55.0, 17.5, 3.0, "Layered spiced basmati rice and marinated chicken cooked in dum.");
        register("veg_biryani", "Vegetable Dum Biryani", 1, "plate (250g)", 400, 9.5, 65.0, 11.2, 6.2, "Basmati rice cooked with spiced vegetables and fried onions.");
        register("pongal", "Ven Pongal", 1, "bowl (200g)", 330, 9.0, 52.0, 9.6, 4.4, "Cooked rice and moong dal tempered with ghee, pepper and cashews.");
        register("upma", "Rava Upma", 1, "bowl (180g)", 279, 6.3, 45.0, 8.1, 3.6, "Roasted semolina cooked with vegetables, curry leaves and mustard seeds.");
        register("medu_vada", "Medu Vada", 1, "piece (45g)", 124, 3.8, 14.0, 5.8, 1.9, "Deep-fried spiced urad dal fritter. Oil absorption varies.");
        register("sambar", "Sambar", 1, "bowl (150g)", 98, 4.2, 14.2, 2.7, 3.3, "Toor dal simmered with vegetables, tamarind and ground spices.");
        register("rasam", "Rasam", 1, "cup (150ml)", 53, 1.5, 9.0, 1.2, 0.9, "Thin tamarind and tomato broth seasoned with rasam powder.");
        register("curd_rice", "Curd Rice", 1, "bowl (200g)", 250, 6.4, 40.0, 7.0, 1.6, "Steamed rice mixed with plain curd and tempered with mustard seeds.");
        register("dal_tadka", "Dal Tadka", 1, "bowl (150g)", 172, 8.2, 22.5, 5.7, 5.2, "Boiled yellow pigeon pea (toor dal) with cumin-ghee tadka.");
        register("rajma", "Rajma Masala", 1, "bowl (180g)", 234, 10.4, 32.4, 7.2, 8.6, "Red kidney beans stewed in spiced onion-tomato gravy.");
        register("palak_paneer", "Palak Paneer", 1, "bowl (180g)", 261, 13.5, 9.0, 19.8, 4.5, "Cottage cheese cubes simmered in spiced pureed spinach gravy.");
        register("paneer_butter_masala", "Paneer Butter Masala", 1, "bowl (180g)", 342, 12.6, 14.4, 26.1, 3.2, "Paneer in rich tomato-cashew gravy with butter and cream.");
        register("apple", "Fresh Apple", 1, "piece (150g)", 78, 0.45, 20.7, 0.3, 3.6, "Raw whole apple with skin.");
        register("banana", "Fresh Banana", 1, "piece (100g)", 89, 1.1, 22.8, 0.3, 2.6, "Raw fresh peeled banana.");
    }

    private static void register(String key, String displayName, double amount, String unit,
                                 double cal, double p, double c, double f, double fib, String warning) {
        PROFILES.put(key.toLowerCase(Locale.ROOT), new FoodNutrientProfile(
                displayName,
                BigDecimal.valueOf(amount),
                unit,
                BigDecimal.valueOf(cal),
                BigDecimal.valueOf(p),
                BigDecimal.valueOf(c),
                BigDecimal.valueOf(f),
                BigDecimal.valueOf(fib),
                warning
        ));
    }

    public static FoodNutrientProfile get(String label) {
        if (label == null) return null;
        String normalized = label.trim().toLowerCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        return PROFILES.get(normalized);
    }

    public static RawDetectedFood buildRawDetectedFood(String label, double score) {
        return buildRawDetectedFood(label, score, BigDecimal.ONE);
    }

    public static RawDetectedFood buildRawDetectedFood(String label, double score, BigDecimal servings) {
        FoodNutrientProfile p = get(label);
        BigDecimal actualServings = (servings != null && servings.compareTo(BigDecimal.ZERO) > 0) ? servings : BigDecimal.ONE;

        if (p == null) {
            // Fallback for unknown classes
            return new RawDetectedFood(
                    label.replace('_', ' '),
                    BigDecimal.ONE,
                    "serving",
                    actualServings,
                    new BigDecimal("250.0"),
                    new BigDecimal("8.0"),
                    new BigDecimal("30.0"),
                    new BigDecimal("10.0"),
                    new BigDecimal("2.0"),
                    Confidence.LOW,
                    List.of("Dish not found in standard Indian reference database. Review and adjust calories."),
                    List.of("Serving size and ingredients are unknown.")
            );
        }

        Confidence confidence = score >= 0.70 ? Confidence.HIGH : (score >= 0.35 ? Confidence.MEDIUM : Confidence.LOW);
        String uncertaintyNote = String.format(Locale.ROOT,
                "Food classified via ViT image model (model confidence: %.1f%%). Nutrition calculated from standard reference portion. Portion size cannot be determined from photo alone; please review.",
                score * 100);

        List<String> uncertainties = List.of(uncertaintyNote);
        List<String> warnings = p.defaultWarning() != null ? List.of(p.defaultWarning()) : Collections.emptyList();

        return new RawDetectedFood(
                p.displayName(),
                p.servingAmount(),
                p.servingUnit(),
                actualServings,
                p.calories(),
                p.protein(),
                p.carbohydrates(),
                p.fat(),
                p.fiber(),
                confidence,
                uncertainties,
                warnings
        );
    }

    public static RawDetectedFood matchFromText(String description) {
        if (description == null || description.isBlank()) return null;
        String raw = description.trim();
        String lower = raw.toLowerCase(Locale.ROOT);

        // Detect quantity prefix (e.g. "2 homemade dosas", "3 idlis", "1 cup chai")
        BigDecimal detectedServings = BigDecimal.ONE;
        java.util.regex.Pattern numPattern = java.util.regex.Pattern.compile("^(\\d+(?:\\.\\d+)?)\\s+");
        java.util.regex.Matcher m = numPattern.matcher(lower);
        if (m.find()) {
            try {
                detectedServings = new BigDecimal(m.group(1));
            } catch (Exception ignored) {}
        } else if (lower.startsWith("two ") || lower.startsWith("a couple of ")) {
            detectedServings = new BigDecimal("2");
        } else if (lower.startsWith("three ")) {
            detectedServings = new BigDecimal("3");
        } else if (lower.startsWith("four ")) {
            detectedServings = new BigDecimal("4");
        }

        // Specific multi-word precedence rules
        if (lower.contains("homemade") && lower.contains("dosa")) {
            return buildRawDetectedFood("homemade_dosa", 0.95, detectedServings);
        }
        if (lower.contains("rava dosa") || lower.contains("suji dosa") || lower.contains("sooji dosa")) {
            return buildRawDetectedFood("rava_dosa", 0.95, detectedServings);
        }
        if (lower.contains("set dosa") || lower.contains("sponge dosa")) {
            return buildRawDetectedFood("set_dosa", 0.95, detectedServings);
        }
        if (lower.contains("masala dosa") || lower.contains("aloo dosa")) {
            return buildRawDetectedFood("masala_dosa", 0.95, detectedServings);
        }
        if (lower.contains("plain dosa") || lower.contains("sada dosa")) {
            return buildRawDetectedFood("plain_dosa", 0.95, detectedServings);
        }
        if (lower.contains("coconut chutney")) {
            return buildRawDetectedFood("coconut_chutney", 0.95, detectedServings);
        }
        if (lower.contains("tomato chutney")) {
            return buildRawDetectedFood("tomato_chutney", 0.95, detectedServings);
        }

        // Generic key search with preference for longer keys first
        List<Map.Entry<String, FoodNutrientProfile>> sorted = new ArrayList<>(PROFILES.entrySet());
        sorted.sort((a, b) -> Integer.compare(b.getKey().length(), a.getKey().length()));

        for (Map.Entry<String, FoodNutrientProfile> entry : sorted) {
            String key = entry.getKey().replace('_', ' ');
            if (lower.contains(key) || lower.contains(entry.getKey())) {
                return buildRawDetectedFood(entry.getKey(), 0.90, detectedServings);
            }
        }

        // General text estimate fallback
        String cleanName = raw;
        if (cleanName.length() > 50) cleanName = cleanName.substring(0, 50) + "...";
        return new RawDetectedFood(
                cleanName,
                BigDecimal.ONE,
                "serving",
                detectedServings,
                new BigDecimal("250.0"),
                new BigDecimal("10.0"),
                new BigDecimal("30.0"),
                new BigDecimal("9.0"),
                new BigDecimal("2.0"),
                Confidence.LOW,
                List.of("Text estimate generated from description. Actual calories depend on ingredients and portion."),
                List.of("Review and adjust values to match your specific meal.")
        );
    }
}
