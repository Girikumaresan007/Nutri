package com.nutritrack.workouts;

import com.nutritrack.common.AuditedEntity;
import com.nutritrack.common.CardioType;
import com.nutritrack.common.StrengthSplit;
import com.nutritrack.common.WorkoutType;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.BatchSize;

@Entity
@Table(name = "workout_sessions")
@Getter
@Setter
@NoArgsConstructor
public class WorkoutSession extends AuditedEntity {
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "session_date", nullable = false)
    private LocalDate sessionDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "workout_type", nullable = false, length = 10)
    private WorkoutType workoutType;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "duration_minutes", nullable = false)
    private Integer durationMinutes;

    /** An ESTIMATE supplied by the client; never added to food targets. */
    @Column(name = "estimated_calories")
    private Integer estimatedCalories;

    @Column(length = 1000)
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private StrengthSplit split;

    @Enumerated(EnumType.STRING)
    @Column(name = "cardio_type", length = 20)
    private CardioType cardioType;

    @Column(name = "distance_km", precision = 8, scale = 2)
    private BigDecimal distanceKm;

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    @BatchSize(size = 50)
    private List<WorkoutExercise> exercises = new ArrayList<>();
}
