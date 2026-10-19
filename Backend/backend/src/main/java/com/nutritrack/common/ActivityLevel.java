package com.nutritrack.common;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum ActivityLevel {
    SEDENTARY, LIGHT, MODERATE, ACTIVE, VERY_ACTIVE;

    @JsonValue
    public String json() {
        return EnumJson.format(this);
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static ActivityLevel from(String value) {
        return EnumJson.parse(ActivityLevel.class, value);
    }
}
