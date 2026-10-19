package com.nutritrack.goals;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GoalRepository extends JpaRepository<NutritionGoal, UUID> {
    Optional<NutritionGoal> findByIdAndUserId(UUID id, UUID userId);

    List<NutritionGoal> findByUserIdOrderByEffectiveFromDesc(UUID userId);

    Optional<NutritionGoal> findFirstByUserIdAndEffectiveFromLessThanEqualOrderByEffectiveFromDesc(UUID userId, LocalDate date);

    Optional<NutritionGoal> findFirstByUserIdAndEffectiveFromGreaterThanOrderByEffectiveFromAsc(UUID userId, LocalDate date);

    Optional<NutritionGoal> findFirstByUserIdOrderByEffectiveFromDesc(UUID userId);

    List<NutritionGoal> findByUserIdAndEffectiveFromLessThanEqualOrderByEffectiveFromAsc(UUID userId, LocalDate date);
}
