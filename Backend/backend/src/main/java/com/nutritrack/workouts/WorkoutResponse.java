package com.nutritrack.workouts;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.nutritrack.common.CardioType;
import com.nutritrack.common.StrengthSplit;
import com.nutritrack.common.WorkoutType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Variant-specific fields that do not apply are omitted from the JSON. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WorkoutResponse(
        UUID id, WorkoutType type, LocalDate date, String name, Integer durationMinutes,
        Integer estimatedCalories, boolean caloriesAreEstimate, String notes,
        StrengthSplit split, List<ExerciseResponse> exercises,
        CardioType cardioType, BigDecimal distanceKm) {}
