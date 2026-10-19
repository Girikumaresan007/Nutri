package com.nutritrack.weight;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record WeightResponse(UUID id, LocalDate date, BigDecimal weightKg, String note) {
    public static WeightResponse from(WeightLog w) {
        return new WeightResponse(w.getId(), w.getLogDate(), w.getWeightKg(), w.getNote());
    }
}
