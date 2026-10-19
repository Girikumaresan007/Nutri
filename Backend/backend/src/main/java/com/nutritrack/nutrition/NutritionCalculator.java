package com.nutritrack.nutrition;

import com.nutritrack.common.ActivityLevel;
import com.nutritrack.common.BiologicalSex;
import com.nutritrack.common.GoalType;
import com.nutritrack.config.NutritionProperties;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Pure calculation logic (no I/O) so it is easy to test.
 *
 * Formula: Mifflin-St Jeor (1990). BMR = 10*kg + 6.25*cm - 5*age + s, where s = +5 (male), -161 (female).
 * For UNSPECIFIED sex we use the midpoint, s = -78 ((5 + -161) / 2), and say so in the response notes.
 * Maintenance = BMR * activity multiplier. Multipliers already include normal daily activity, so workout calories
 * are NEVER added to the food target. All outputs are estimates, not medical prescriptions.
 */
@Component
public class NutritionCalculator {
    public static final String FORMULA_ID = "mifflin-st-jeor-1990";

    private final NutritionProperties props;

    public NutritionCalculator(NutritionProperties props) {
        this.props = props;
    }

    public record Macros(BigDecimal protein, BigDecimal carbohydrates, BigDecimal fat, BigDecimal fiber) {}

    public record Estimate(int age, int bmr, BigDecimal activityMultiplier, int maintenanceCalories, GoalType goalType,
                           int suggestedCalorieTarget, Macros suggestedMacros, String formula,
                           String biologicalSexHandling, List<String> notes) {}

    public static BigDecimal multiplier(ActivityLevel level) {
        return switch (level) {
            case SEDENTARY -> new BigDecimal("1.2");
            case LIGHT -> new BigDecimal("1.375");
            case MODERATE -> new BigDecimal("1.55");
            case ACTIVE -> new BigDecimal("1.725");
            case VERY_ACTIVE -> new BigDecimal("1.9");
        };
    }

    public Estimate calculate(int age, BigDecimal weightKg, BigDecimal heightCm, BiologicalSex sex,
                              ActivityLevel level, GoalType goal) {
        int sexOffset = switch (sex) {
            case MALE -> 5;
            case FEMALE -> -161;
            case UNSPECIFIED -> -78;
        };
        BigDecimal bmrExact = weightKg.multiply(BigDecimal.TEN)
                .add(heightCm.multiply(new BigDecimal("6.25")))
                .subtract(BigDecimal.valueOf(5L * age))
                .add(BigDecimal.valueOf(sexOffset));
        int bmr = bmrExact.setScale(0, RoundingMode.HALF_UP).intValue();
        BigDecimal mult = multiplier(level);
        int maintenance = bmrExact.multiply(mult).setScale(0, RoundingMode.HALF_UP).intValue();

        int adjusted = maintenance + switch (goal) {
            case LOSE_WEIGHT -> props.loseAdjustment();
            case MAINTAIN -> 0;
            case GAIN_WEIGHT -> props.gainAdjustment();
            case BUILD_MUSCLE -> props.muscleAdjustment();
        };
        List<String> notes = new ArrayList<>();
        notes.add("These figures are estimates based on population averages, not medical advice. Individual needs vary; "
                + "consult a qualified professional before making significant dietary changes.");
        notes.add("Maintenance calories already include normal daily activity (activity multiplier " + mult
                + "). Logged workout calories are not added to the food target.");
        int target = adjusted;
        if (adjusted < props.minimumDailyCalories()) {
            target = props.minimumDailyCalories();
            notes.add("The suggested target was raised to the configured minimum of " + props.minimumDailyCalories()
                    + " kcal/day. Very low targets should only be followed under professional supervision.");
        }
        String sexNote = switch (sex) {
            case MALE -> "Male constant (+5) used.";
            case FEMALE -> "Female constant (-161) used.";
            case UNSPECIFIED -> "Biological sex unspecified: the average of the male and female constants (-78) was used, "
                    + "so the result may be off by roughly 80 kcal/day either way.";
        };
        notes.add(sexNote);
        if (age < 18) {
            notes.add("This formula is not validated for people under 18; seek guidance from a clinician.");
        }
        return new Estimate(age, bmr, mult, maintenance, goal, target, macros(target, weightKg, goal),
                FORMULA_ID, sexNote, notes);
    }

    private Macros macros(int targetCalories, BigDecimal weightKg, GoalType goal) {
        BigDecimal perKg = switch (goal) {
            case LOSE_WEIGHT -> props.proteinPerKgLose();
            case MAINTAIN -> props.proteinPerKgMaintain();
            case GAIN_WEIGHT -> props.proteinPerKgGain();
            case BUILD_MUSCLE -> props.proteinPerKgMuscle();
        };
        BigDecimal calories = BigDecimal.valueOf(targetCalories);
        BigDecimal protein = weightKg.multiply(perKg).setScale(0, RoundingMode.HALF_UP);
        BigDecimal fat = calories.multiply(props.fatPercent()).divide(BigDecimal.valueOf(9), 0, RoundingMode.HALF_UP);
        BigDecimal carbCalories = calories.subtract(protein.multiply(BigDecimal.valueOf(4)))
                .subtract(fat.multiply(BigDecimal.valueOf(9)));
        BigDecimal carbs = carbCalories.max(BigDecimal.ZERO).divide(BigDecimal.valueOf(4), 0, RoundingMode.HALF_UP);
        BigDecimal fiber = calories.multiply(props.fiberPer1000Kcal()).divide(BigDecimal.valueOf(1000), 0, RoundingMode.HALF_UP);
        return new Macros(protein, carbs, fat, fiber);
    }
}
