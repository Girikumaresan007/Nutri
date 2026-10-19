package com.nutritrack.common;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum HeightUnit {
    CM, FT_IN;

    @JsonValue
    public String json() {
        return EnumJson.format(this);
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static HeightUnit from(String value) {
        return EnumJson.parse(HeightUnit.class, value);
    }
}
