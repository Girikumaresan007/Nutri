package com.nutritrack.common;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum FoodSource {
    MANUAL, SCANNER;

    @JsonValue
    public String json() {
        return EnumJson.format(this);
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static FoodSource from(String value) {
        return EnumJson.parse(FoodSource.class, value);
    }
}
