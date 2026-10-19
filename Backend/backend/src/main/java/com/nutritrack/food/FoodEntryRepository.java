package com.nutritrack.food;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FoodEntryRepository extends JpaRepository<FoodEntry, UUID> {
    Optional<FoodEntry> findByIdAndUserId(UUID id, UUID userId);

    Page<FoodEntry> findByUserIdAndEntryDateBetween(UUID userId, LocalDate from, LocalDate to, Pageable pageable);

    boolean existsByUserIdAndEntryDateGreaterThanEqualAndEntryDateLessThan(UUID userId, LocalDate from, LocalDate toExclusive);

    boolean existsByUserIdAndEntryDateGreaterThanEqual(UUID userId, LocalDate from);

    @Query("""
            select new com.nutritrack.food.MealTotalRow(e.entryDate, e.meal, count(e),
                   sum(e.calories), sum(e.protein), sum(e.carbohydrates), sum(e.fat), sum(e.fiber))
            from FoodEntry e
            where e.userId = :userId and e.entryDate between :from and :to
            group by e.entryDate, e.meal
            order by e.entryDate
            """)
    List<MealTotalRow> aggregate(@Param("userId") UUID userId, @Param("from") LocalDate from, @Param("to") LocalDate to);
}
