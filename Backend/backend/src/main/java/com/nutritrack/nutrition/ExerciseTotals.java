package com.nutritrack.nutrition;

/** Exercise is reported separately from intake; estimatedCalories is an estimate and is null if none was recorded. */
public record ExerciseTotals(long sessionCount, long durationMinutes, Long estimatedCalories) {}
