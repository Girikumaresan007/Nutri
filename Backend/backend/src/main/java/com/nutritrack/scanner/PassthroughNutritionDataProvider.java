package com.nutritrack.scanner;

import org.springframework.stereotype.Component;

@Component
public class PassthroughNutritionDataProvider implements NutritionDataProvider {
    @Override
    public String name() {
        return "none";
    }

    @Override
    public RawDetectedFood refine(RawDetectedFood detected) {
        return detected;
    }
}
