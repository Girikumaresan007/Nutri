package com.nutritrack.food;

import com.nutritrack.common.FoodSource;
import com.nutritrack.common.Meal;
import com.nutritrack.common.Nutrition;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record FoodEntryResponse(UUID id, LocalDate date, Meal meal, String name, BigDecimal quantity, String unit,
                                Nutrition nutrition, String notes, FoodSource source,
                                Instant createdAt, Instant updatedAt) {}
