package com.nutritrack.common;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum StrengthSplit {
    CHEST_TRICEPS, BACK_BICEPS, LEGS, FULL_BODY, CUSTOM;

    @JsonValue
    public String json() {
        return EnumJson.format(this);
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static StrengthSplit from(String value) {
        return EnumJson.parse(StrengthSplit.class, value);
    }
}
