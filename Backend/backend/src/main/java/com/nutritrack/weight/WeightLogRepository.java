package com.nutritrack.weight;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WeightLogRepository extends JpaRepository<WeightLog, UUID> {
    Optional<WeightLog> findByIdAndUserId(UUID id, UUID userId);

    Page<WeightLog> findByUserId(UUID userId, Pageable pageable);

    Page<WeightLog> findByUserIdAndLogDateBetween(UUID userId, LocalDate from, LocalDate to, Pageable pageable);

    List<WeightLog> findByUserIdAndLogDateBetweenOrderByLogDateAscCreatedAtAsc(UUID userId, LocalDate from, LocalDate to);
}
