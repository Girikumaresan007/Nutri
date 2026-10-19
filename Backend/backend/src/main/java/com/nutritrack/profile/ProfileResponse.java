package com.nutritrack.profile;

import com.nutritrack.common.ActivityLevel;
import com.nutritrack.common.BiologicalSex;
import com.nutritrack.common.GoalType;
import com.nutritrack.common.HeightUnit;
import com.nutritrack.common.WeightUnit;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record ProfileResponse(
        String name, String email, LocalDate dateOfBirth, Integer age,
        BigDecimal heightCm, BigDecimal currentWeightKg,
        BiologicalSex biologicalSex, ActivityLevel activityLevel, GoalType goalType,
        BigDecimal targetWeightKg, WeightUnit weightUnit, HeightUnit heightUnit,
        Instant profileUpdatedAt) {}
