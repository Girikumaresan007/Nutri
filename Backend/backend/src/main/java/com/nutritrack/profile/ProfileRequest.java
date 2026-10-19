package com.nutritrack.profile;

import com.nutritrack.common.ActivityLevel;
import com.nutritrack.common.BiologicalSex;
import com.nutritrack.common.GoalType;
import com.nutritrack.common.HeightUnit;
import com.nutritrack.common.WeightUnit;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/** Email is read-only here (it is the login identity) and is ignored if sent. Age is never accepted; it is derived. */
public record ProfileRequest(
        @NotBlank @Size(max = 100) String name,
        @NotNull @Past LocalDate dateOfBirth,
        @NotNull @DecimalMin("50") @DecimalMax("272") BigDecimal heightCm,
        @NotNull @DecimalMin("20") @DecimalMax("500") BigDecimal currentWeightKg,
        @NotNull BiologicalSex biologicalSex,
        @NotNull ActivityLevel activityLevel,
        @NotNull GoalType goalType,
        @DecimalMin("20") @DecimalMax("500") BigDecimal targetWeightKg,
        @NotNull WeightUnit weightUnit,
        @NotNull HeightUnit heightUnit) {}
