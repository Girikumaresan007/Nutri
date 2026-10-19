package com.nutritrack.scanner;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nutritrack.common.Confidence;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Leniently parses and SANITISES model output: unknown fields ignored, strings trimmed/length-capped, numbers
 * range-checked; items that fail validation are dropped. Model output is untrusted input (e.g. text inside an image).
 */
public final class ProviderJsonParser {
    private ProviderJsonParser() {}

    public static List<RawDetectedFood> parse(String modelText, ObjectMapper mapper) {
        if (modelText == null) return List.of();
        String text = modelText.trim();
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new IllegalArgumentException("no JSON object in provider output");
        }
        try {
            JsonNode root = mapper.readTree(text.substring(start, end + 1));
            JsonNode items = root.path("items");
            List<RawDetectedFood> out = new ArrayList<>();
            if (items.isArray()) {
                for (JsonNode n : items) {
                    RawDetectedFood f = item(n);
                    if (f != null && out.size() < 20) out.add(f);
                }
            }
            return out;
        } catch (java.io.IOException e) {
            throw new IllegalArgumentException("provider output is not valid JSON");
        }
    }

    private static RawDetectedFood item(JsonNode n) {
        String name = str(n.path("name"), 120);
        String unit = str(n.path("serving_unit"), 30);
        BigDecimal amount = num(n.path("serving_amount"), "0.01", "100000");
        BigDecimal servings = num(n.path("servings"), "0.01", "100");
        BigDecimal cal = num(n.path("calories"), "0", "10000");
        BigDecimal protein = num(n.path("protein"), "0", "2000");
        BigDecimal carbs = num(n.path("carbohydrates"), "0", "2000");
        BigDecimal fat = num(n.path("fat"), "0", "2000");
        BigDecimal fiber = n.path("fiber").isMissingNode() || n.path("fiber").isNull()
                ? BigDecimal.ZERO : num(n.path("fiber"), "0", "2000");
        if (name == null || unit == null || amount == null || servings == null || cal == null
                || protein == null || carbs == null || fat == null || fiber == null) {
            return null;
        }
        Confidence c;
        try {
            c = Confidence.from(n.path("confidence").asText("low"));
        } catch (IllegalArgumentException e) {
            c = Confidence.LOW;
        }
        return new RawDetectedFood(name, amount, unit, servings, cal, protein, carbs, fat, fiber, c,
                strings(n.path("uncertainty")), strings(n.path("warnings")));
    }

    private static String str(JsonNode n, int max) {
        if (!n.isTextual()) return null;
        String s = n.asText().replaceAll("\\p{Cntrl}", " ").trim();
        if (s.isEmpty()) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }

    private static List<String> strings(JsonNode n) {
        List<String> out = new ArrayList<>();
        if (n.isArray()) {
            for (JsonNode e : n) {
                String s = str(e, 300);
                if (s != null && out.size() < 6) out.add(s);
            }
        }
        return out;
    }

    private static BigDecimal num(JsonNode n, String min, String max) {
        if (!n.isNumber()) return null;
        BigDecimal v = n.decimalValue();
        if (v.compareTo(new BigDecimal(min)) < 0 || v.compareTo(new BigDecimal(max)) > 0) return null;
        return v;
    }
}
