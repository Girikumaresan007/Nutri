package com.nutritrack.weight;

import com.nutritrack.common.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Weight is always stored in kilograms; the frontend converts to the user's display unit. */
@Entity
@Table(name = "weight_logs")
@Getter
@Setter
@NoArgsConstructor
public class WeightLog extends AuditedEntity {
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "log_date", nullable = false)
    private LocalDate logDate;

    @Column(name = "weight_kg", nullable = false, precision = 6, scale = 2)
    private BigDecimal weightKg;

    @Column(length = 500)
    private String note;
}
