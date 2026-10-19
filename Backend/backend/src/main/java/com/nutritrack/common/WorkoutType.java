package com.nutritrack.common;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum WorkoutType {
    STRENGTH, CARDIO;

    @JsonValue
    public String json() {
        return EnumJson.format(this);
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static WorkoutType from(String value) {
        return EnumJson.parse(WorkoutType.class, value);
    }
}
