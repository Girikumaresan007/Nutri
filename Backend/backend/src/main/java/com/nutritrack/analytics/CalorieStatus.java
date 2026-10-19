package com.nutritrack.analytics;

import com.fasterxml.jackson.annotation.JsonValue;

public enum CalorieStatus {
    OVER, UNDER, NO_TARGET, NOT_LOGGED;

    @JsonValue
    public String json() {
        return name().toLowerCase(java.util.Locale.ROOT);
    }
}
