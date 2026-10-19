package com.nutritrack.goals;

import com.nutritrack.common.DateRules;
import com.nutritrack.exception.ApiException;
import com.nutritrack.food.FoodEntryRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Effective-date policy (documented in README):
 *  - A goal applies from its effectiveFrom date until the next goal's effectiveFrom (exclusive).
 *  - At most one goal per effectiveFrom date (database unique constraint) so history is never ambiguous.
 *  - A new goal must start AFTER the newest existing goal, so creating a goal never rewrites past reporting.
 *  - effectiveFrom is immutable; PUT corrects the values of an existing goal.
 *  - A goal that governs days with logged food cannot be deleted.
 */
@Service
public class GoalService {
    private final GoalRepository goals;
    private final FoodEntryRepository foodEntries;
    private final Clock clock;

    public GoalService(GoalRepository goals, FoodEntryRepository foodEntries, Clock clock) {
        this.goals = goals;
        this.foodEntries = foodEntries;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<GoalResponse> list(UUID userId) {
        return goals.findByUserIdOrderByEffectiveFromDesc(userId).stream().map(GoalResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public GoalResponse get(UUID userId, UUID id) {
        return GoalResponse.from(require(userId, id));
    }

    @Transactional(readOnly = true)
    public GoalResponse active(UUID userId, LocalDate date) {
        return findActive(userId, date).map(GoalResponse::from)
                .orElseThrow(() -> ApiException.notFound("NO_ACTIVE_GOAL", "No goal is effective on " + date));
    }

    @Transactional(readOnly = true)
    public Optional<NutritionGoal> findActive(UUID userId, LocalDate date) {
        return goals.findFirstByUserIdAndEffectiveFromLessThanEqualOrderByEffectiveFromDesc(userId, date);
    }

    @Transactional
    public GoalResponse create(UUID userId, GoalRequest r) {
        LocalDate today = DateRules.today(clock);
        LocalDate effective = r.effectiveFrom() == null ? today : r.effectiveFrom();
        if (effective.isBefore(DateRules.EARLIEST_DATE) || effective.isAfter(today.plusDays(366))) {
            throw ApiException.validation("effectiveFrom", "effective date is outside the supported range");
        }
        Optional<NutritionGoal> latest = goals.findFirstByUserIdOrderByEffectiveFromDesc(userId);
        if (latest.isPresent()) {
            LocalDate latestDate = latest.get().getEffectiveFrom();
            if (effective.equals(latestDate) || goals.findByUserIdOrderByEffectiveFromDesc(userId).stream()
                    .anyMatch(g -> g.getEffectiveFrom().equals(effective))) {
                throw ApiException.conflict("GOAL_EFFECTIVE_DATE_EXISTS",
                        "A goal already starts on " + effective + "; update it instead");
            }
            if (effective.isBefore(latestDate)) {
                throw ApiException.conflict("GOAL_DATE_NOT_LATEST",
                        "A new goal must start after the most recent goal (" + latestDate + ") to preserve history");
            }
        }
        NutritionGoal g = new NutritionGoal();
        g.setUserId(userId);
        g.setEffectiveFrom(effective);
        apply(g, r);
        return GoalResponse.from(goals.saveAndFlush(g));
    }

    @Transactional
    public GoalResponse update(UUID userId, UUID id, GoalRequest r) {
        NutritionGoal g = require(userId, id);
        if (r.effectiveFrom() != null && !r.effectiveFrom().equals(g.getEffectiveFrom())) {
            throw ApiException.validation("effectiveFrom", "effectiveFrom cannot be changed; create a new goal instead");
        }
        apply(g, r);
        return GoalResponse.from(goals.save(g));
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        NutritionGoal g = require(userId, id);
        LocalDate from = g.getEffectiveFrom();
        Optional<NutritionGoal> next = goals.findFirstByUserIdAndEffectiveFromGreaterThanOrderByEffectiveFromAsc(userId, from);
        boolean hasHistory = next.isPresent()
                ? foodEntries.existsByUserIdAndEntryDateGreaterThanEqualAndEntryDateLessThan(userId, from, next.get().getEffectiveFrom())
                : foodEntries.existsByUserIdAndEntryDateGreaterThanEqual(userId, from);
        if (hasHistory) {
            throw ApiException.conflict("GOAL_REQUIRED_FOR_HISTORY",
                    "This goal applies to days with logged food and cannot be deleted");
        }
        goals.delete(g);
    }

    private NutritionGoal require(UUID userId, UUID id) {
        return goals.findByIdAndUserId(id, userId)
                .orElseThrow(() -> ApiException.notFound("GOAL_NOT_FOUND", "Goal not found"));
    }

    private static void apply(NutritionGoal g, GoalRequest r) {
        g.setGoalType(r.goalType());
        g.setDailyCalories(r.dailyCalories());
        g.setProtein(r.protein());
        g.setCarbohydrates(r.carbohydrates());
        g.setFat(r.fat());
        g.setFiber(r.fiber());
        g.setTargetWeightKg(r.targetWeightKg());
    }
}
