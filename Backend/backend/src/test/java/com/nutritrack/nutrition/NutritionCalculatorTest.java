package com.nutritrack.nutrition;

import static org.assertj.core.api.Assertions.assertThat;

import com.nutritrack.common.ActivityLevel;
import com.nutritrack.common.BiologicalSex;
import com.nutritrack.common.DateRules;
import com.nutritrack.common.GoalType;
import com.nutritrack.config.NutritionProperties;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class NutritionCalculatorTest {
    private final NutritionCalculator calc = new NutritionCalculator(new NutritionProperties(
            -500, 300, 250, 1200, new BigDecimal("0.28"), new BigDecimal("1.8"), new BigDecimal("1.4"),
            new BigDecimal("1.6"), new BigDecimal("2.0"), new BigDecimal("14")));

    private NutritionCalculator.Estimate est(BiologicalSex sex, ActivityLevel a, GoalType g, String kg, String cm, int age) {
        return calc.calculate(age, new BigDecimal(kg), new BigDecimal(cm), sex, a, g);
    }

    @Test
    void mifflinStJeorMale() {
        // 10*80 + 6.25*180 - 5*30 + 5 = 1780 ; *1.55 = 2759
        var e = est(BiologicalSex.MALE, ActivityLevel.MODERATE, GoalType.MAINTAIN, "80", "180", 30);
        assertThat(e.bmr()).isEqualTo(1780);
        assertThat(e.maintenanceCalories()).isEqualTo(2759);
        assertThat(e.suggestedCalorieTarget()).isEqualTo(2759);
        assertThat(e.formula()).isEqualTo("mifflin-st-jeor-1990");
    }

    @Test
    void femaleAndUnspecifiedConstants() {
        assertThat(est(BiologicalSex.FEMALE, ActivityLevel.SEDENTARY, GoalType.MAINTAIN, "80", "180", 30).bmr()).isEqualTo(1614);
        var u = est(BiologicalSex.UNSPECIFIED, ActivityLevel.SEDENTARY, GoalType.MAINTAIN, "80", "180", 30);
        assertThat(u.bmr()).isEqualTo(1697);
        assertThat(u.notes()).anyMatch(n -> n.contains("unspecified"));
    }

    @Test
    void goalAdjustmentsAreApplied() {
        assertThat(est(BiologicalSex.MALE, ActivityLevel.MODERATE, GoalType.LOSE_WEIGHT, "80", "180", 30).suggestedCalorieTarget()).isEqualTo(2259);
        assertThat(est(BiologicalSex.MALE, ActivityLevel.MODERATE, GoalType.GAIN_WEIGHT, "80", "180", 30).suggestedCalorieTarget()).isEqualTo(3059);
        assertThat(est(BiologicalSex.MALE, ActivityLevel.MODERATE, GoalType.BUILD_MUSCLE, "80", "180", 30).suggestedCalorieTarget()).isEqualTo(3009);
    }

    @Test
    void minimumFloorAppliesAndIsExplained() {
        var e = est(BiologicalSex.FEMALE, ActivityLevel.SEDENTARY, GoalType.LOSE_WEIGHT, "45", "150", 60);
        assertThat(e.suggestedCalorieTarget()).isEqualTo(1200);
        assertThat(e.notes()).anyMatch(n -> n.contains("minimum"));
    }

    @Test
    void exerciseCaloriesAreNotAddedAndNoteSaysSo() {
        assertThat(est(BiologicalSex.MALE, ActivityLevel.ACTIVE, GoalType.MAINTAIN, "80", "180", 30).notes())
                .anyMatch(n -> n.contains("not added"));
    }

    @Test
    void macrosAreNonNegativeAndFiberScalesWithCalories() {
        var m = est(BiologicalSex.MALE, ActivityLevel.MODERATE, GoalType.MAINTAIN, "80", "180", 30).suggestedMacros();
        assertThat(m.protein()).isEqualByComparingTo("112");
        assertThat(m.carbohydrates().signum()).isPositive();
        assertThat(m.fiber()).isEqualByComparingTo("39");
    }

    @Test
    void ageIsDerivedFromBirthDate() {
        LocalDate today = LocalDate.of(2026, 6, 15);
        assertThat(DateRules.ageOn(LocalDate.of(1996, 6, 15), today)).isEqualTo(30);
        assertThat(DateRules.ageOn(LocalDate.of(1996, 6, 16), today)).isEqualTo(29);
    }
}
