package com.nutritrack.workouts;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkoutRepository extends JpaRepository<WorkoutSession, UUID> {
    Optional<WorkoutSession> findByIdAndUserId(UUID id, UUID userId);

    Page<WorkoutSession> findByUserIdAndSessionDateBetween(UUID userId, LocalDate from, LocalDate to, Pageable pageable);

    @Query("""
            select new com.nutritrack.workouts.WorkoutDayRow(w.sessionDate, count(w), sum(w.durationMinutes), sum(w.estimatedCalories))
            from WorkoutSession w
            where w.userId = :userId and w.sessionDate between :from and :to
            group by w.sessionDate
            order by w.sessionDate
            """)
    List<WorkoutDayRow> aggregate(@Param("userId") UUID userId, @Param("from") LocalDate from, @Param("to") LocalDate to);
}
