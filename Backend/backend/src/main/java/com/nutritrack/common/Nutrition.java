package com.nutritrack.common;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.math.RoundingMode;

/** Nutrition values in kcal / grams. Used for entry snapshots, totals and estimates. */
public record Nutrition(
        @NotNull @DecimalMin("0") @DecimalMax("10000") BigDecimal calories,
        @NotNull @DecimalMin("0") @DecimalMax("2000") BigDecimal protein,
        @NotNull @DecimalMin("0") @DecimalMax("2000") BigDecimal carbohydrates,
        @NotNull @DecimalMin("0") @DecimalMax("2000") BigDecimal fat,
        @DecimalMin("0") @DecimalMax("2000") BigDecimal fiber) {

    public static final Nutrition ZERO =
            new Nutrition(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);

    public Nutrition {
        if (fiber == null) {
            fiber = BigDecimal.ZERO;
        }
    }

    public Nutrition plus(Nutrition o) {
        return new Nutrition(calories.add(o.calories), protein.add(o.protein),
                carbohydrates.add(o.carbohydrates), fat.add(o.fat), fiber.add(o.fiber));
    }

    public Nutrition times(BigDecimal factor) {
        return new Nutrition(scale(calories.multiply(factor)), scale(protein.multiply(factor)),
                scale(carbohydrates.multiply(factor)), scale(fat.multiply(factor)), scale(fiber.multiply(factor)));
    }

    /** Average over n days (n > 0), 2 decimal places. */
    public Nutrition dividedBy(int n) {
        BigDecimal d = BigDecimal.valueOf(n);
        return new Nutrition(div(calories, d), div(protein, d), div(carbohydrates, d), div(fat, d), div(fiber, d));
    }

    private static BigDecimal scale(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal div(BigDecimal v, BigDecimal d) {
        return v.divide(d, 2, RoundingMode.HALF_UP);
    }
}
