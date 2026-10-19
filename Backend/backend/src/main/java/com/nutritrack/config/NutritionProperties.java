package com.nutritrack.config;

import java.math.BigDecimal;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configurable assumptions behind calorie/macro estimates. These are estimates, not medical prescriptions. */
@ConfigurationProperties("nutritrack.nutrition")
public record NutritionProperties(int loseAdjustment, int gainAdjustment, int muscleAdjustment,
                                  int minimumDailyCalories, BigDecimal fatPercent,
                                  BigDecimal proteinPerKgLose, BigDecimal proteinPerKgMaintain,
                                  BigDecimal proteinPerKgGain, BigDecimal proteinPerKgMuscle,
                                  BigDecimal fiberPer1000Kcal) {}
