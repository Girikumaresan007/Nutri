package com.nutritrack.profile;

import com.nutritrack.common.ActivityLevel;
import com.nutritrack.common.AuditedEntity;
import com.nutritrack.common.BiologicalSex;
import com.nutritrack.common.GoalType;
import com.nutritrack.common.HeightUnit;
import com.nutritrack.common.WeightUnit;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "user_profiles")
@Getter
@Setter
@NoArgsConstructor
public class UserProfile extends AuditedEntity {

    @Column(name = "user_id", nullable = false, unique = true)
    private UUID userId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(name = "height_cm", precision = 6, scale = 2)
    private BigDecimal heightCm;

    @Column(name = "current_weight_kg", precision = 6, scale = 2)
    private BigDecimal currentWeightKg;

    @Enumerated(EnumType.STRING)
    @Column(name = "biological_sex", nullable = false, length = 20)
    private BiologicalSex biologicalSex = BiologicalSex.UNSPECIFIED;

    @Enumerated(EnumType.STRING)
    @Column(name = "activity_level", nullable = false, length = 20)
    private ActivityLevel activityLevel = ActivityLevel.MODERATE;

    @Enumerated(EnumType.STRING)
    @Column(name = "goal_type", nullable = false, length = 20)
    private GoalType goalType = GoalType.MAINTAIN;

    @Column(name = "target_weight_kg", precision = 6, scale = 2)
    private BigDecimal targetWeightKg;

    @Enumerated(EnumType.STRING)
    @Column(name = "weight_unit", nullable = false, length = 5)
    private WeightUnit weightUnit = WeightUnit.KG;

    @Enumerated(EnumType.STRING)
    @Column(name = "height_unit", nullable = false, length = 10)
    private HeightUnit heightUnit = HeightUnit.CM;

    @Column(name = "profile_updated_at")
    private Instant profileUpdatedAt;
}
