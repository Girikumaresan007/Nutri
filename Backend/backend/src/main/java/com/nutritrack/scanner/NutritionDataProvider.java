package com.nutritrack.scanner;

/**
 * Optional food-composition source (e.g. USDA FoodData Central) used to replace or cross-check AI-estimated values.
 * The default implementation is a pass-through; plug a real catalogue in here without touching controllers.
 */
public interface NutritionDataProvider {
    String name();

    RawDetectedFood refine(RawDetectedFood detected);
}
