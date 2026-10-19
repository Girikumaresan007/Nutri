package com.nutritrack.workouts;

import java.time.LocalDate;

/** Per-day exercise aggregate. calories may be null when no session on that day recorded an estimate. */
public record WorkoutDayRow(LocalDate date, Long sessions, Long minutes, Long calories) {}
