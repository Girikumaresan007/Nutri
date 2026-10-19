package com.nutritrack.workouts;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;

/** {@code id} is accepted for client convenience but ignored; the server assigns exercise ids. */
public record ExerciseRequest(
        UUID id,
        @NotBlank @Size(max = 120) String name,
        @NotNull @Min(1) @Max(100) Integer sets,
        @NotNull @Min(1) @Max(1000) Integer reps,
        @NotNull @DecimalMin("0") @DecimalMax("1000") BigDecimal weightKg,
        @Size(max = 500) String notes) {}
