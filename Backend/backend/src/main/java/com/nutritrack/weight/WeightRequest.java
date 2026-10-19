package com.nutritrack.weight;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record WeightRequest(
        @NotNull LocalDate date,
        @NotNull @DecimalMin("20") @DecimalMax("500") BigDecimal weightKg,
        @Size(max = 500) String note) {}
