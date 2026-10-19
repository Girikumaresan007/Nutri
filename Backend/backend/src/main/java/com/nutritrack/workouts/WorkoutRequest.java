package com.nutritrack.workouts;

import com.nutritrack.common.CardioType;
import com.nutritrack.common.StrengthSplit;
import com.nutritrack.common.WorkoutType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * One request shape for both variants of the frontend's WorkoutSession union, discriminated by {@code type}.
 * Strength: split + exercises required. Cardio: cardioType required, distanceKm optional, no exercises.
 * estimatedCalories is an ESTIMATE of exercise energy and is kept separate from food intake and targets.
 */
public record WorkoutRequest(
        @NotNull WorkoutType type,
        @NotNull LocalDate date,
        @NotBlank @Size(max = 120) String name,
        @NotNull @Min(1) @Max(1440) Integer durationMinutes,
        @Min(0) @Max(20000) Integer estimatedCalories,
        @Size(max = 1000) String notes,
        StrengthSplit split,
        @Valid @Size(max = 100) List<ExerciseRequest> exercises,
        CardioType cardioType,
        @DecimalMin("0") @DecimalMax("1000") BigDecimal distanceKm) {}
