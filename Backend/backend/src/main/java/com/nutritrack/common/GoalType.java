package com.nutritrack.common;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum GoalType {
    LOSE_WEIGHT, MAINTAIN, GAIN_WEIGHT, BUILD_MUSCLE;

    @JsonValue
    public String json() {
        return EnumJson.format(this);
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static GoalType from(String value) {
        return EnumJson.parse(GoalType.class, value);
    }
}
