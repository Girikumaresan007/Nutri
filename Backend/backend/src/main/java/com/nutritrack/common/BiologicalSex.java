package com.nutritrack.common;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum BiologicalSex {
    MALE, FEMALE, UNSPECIFIED;

    @JsonValue
    public String json() {
        return EnumJson.format(this);
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static BiologicalSex from(String value) {
        return EnumJson.parse(BiologicalSex.class, value);
    }
}
