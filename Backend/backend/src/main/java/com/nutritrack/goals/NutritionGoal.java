package com.nutritrack.goals;

import com.nutritrack.common.AuditedEntity;
import com.nutritrack.common.GoalType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "nutrition_goals")
@Getter
@Setter
@NoArgsConstructor
public class NutritionGoal extends AuditedEntity {
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    @Enumerated(EnumType.STRING)
    @Column(name = "goal_type", nullable = false, length = 20)
    private GoalType goalType;

    @Column(name = "daily_calories", nullable = false)
    private Integer dailyCalories;

    @Column(nullable = false, precision = 8, scale = 2)
    private BigDecimal protein;

    @Column(nullable = false, precision = 8, scale = 2)
    private BigDecimal carbohydrates;

    @Column(nullable = false, precision = 8, scale = 2)
    private BigDecimal fat;

    @Column(nullable = false, precision = 8, scale = 2)
    private BigDecimal fiber;

    @Column(name = "target_weight_kg", precision = 6, scale = 2)
    private BigDecimal targetWeightKg;
}
