package com.nutritrack.common;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum Meal {
    BREAKFAST, LUNCH, SNACKS, DINNER;

    @JsonValue
    public String json() {
        return EnumJson.format(this);
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static Meal from(String value) {
        return EnumJson.parse(Meal.class, value);
    }
}
