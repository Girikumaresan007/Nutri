package com.nutritrack.common;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum Confidence {
    LOW, MEDIUM, HIGH;

    @JsonValue
    public String json() {
        return EnumJson.format(this);
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static Confidence from(String value) {
        return EnumJson.parse(Confidence.class, value);
    }
}
