package com.nutritrack.common;

import java.util.Locale;

/** Case-insensitive enum parsing; JSON uses lower-case snake_case values (e.g. "lose_weight"). */
public final class EnumJson {
    private EnumJson() {}

    public static <E extends Enum<E>> E parse(Class<E> type, String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim().replace('-', '_').toUpperCase(Locale.ROOT);
        for (E constant : type.getEnumConstants()) {
            if (constant.name().equals(normalized)) {
                return constant;
            }
        }
        throw new IllegalArgumentException("Unsupported value for " + type.getSimpleName());
    }

    public static String format(Enum<?> value) {
        return value.name().toLowerCase(Locale.ROOT);
    }
}
