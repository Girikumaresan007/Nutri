package com.nutritrack.common;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum CardioType {
    RUNNING, WALKING, CYCLING, SWIMMING, OTHER;

    @JsonValue
    public String json() {
        return EnumJson.format(this);
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static CardioType from(String value) {
        return EnumJson.parse(CardioType.class, value);
    }
}
