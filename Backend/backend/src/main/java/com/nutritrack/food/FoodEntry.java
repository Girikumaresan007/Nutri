package com.nutritrack.food;

import com.nutritrack.common.AuditedEntity;
import com.nutritrack.common.FoodSource;
import com.nutritrack.common.Meal;
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

/** A diary entry. The nutrition columns are a SNAPSHOT saved with the entry and are never recomputed. */
@Entity
@Table(name = "food_entries")
@Getter
@Setter
@NoArgsConstructor
public class FoodEntry extends AuditedEntity {
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Meal meal;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal quantity;

    @Column(nullable = false, length = 30)
    private String unit;

    @Column(nullable = false, precision = 8, scale = 2)
    private BigDecimal calories;

    @Column(nullable = false, precision = 8, scale = 2)
    private BigDecimal protein;

    @Column(nullable = false, precision = 8, scale = 2)
    private BigDecimal carbohydrates;

    @Column(nullable = false, precision = 8, scale = 2)
    private BigDecimal fat;

    @Column(nullable = false, precision = 8, scale = 2)
    private BigDecimal fiber;

    @Column(length = 1000)
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private FoodSource source = FoodSource.MANUAL;
}
