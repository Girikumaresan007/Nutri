package com.nutritrack.workouts;

import java.math.BigDecimal;
import java.util.UUID;

public record ExerciseResponse(UUID id, String name, Integer sets, Integer reps, BigDecimal weightKg, String notes) {}
