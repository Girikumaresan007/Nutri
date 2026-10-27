package com.nutritrack.workouts;

import com.nutritrack.common.DateRange;
import com.nutritrack.common.DateRules;
import com.nutritrack.common.PageParams;
import com.nutritrack.common.PageResponse;
import com.nutritrack.common.WorkoutType;
import com.nutritrack.exception.ApiException;
import com.nutritrack.exception.FieldIssue;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkoutService {
    private static final int MAX_RANGE_DAYS = 366;

    private final WorkoutRepository repo;
    private final Clock clock;

    public WorkoutService(WorkoutRepository repo, Clock clock) {
        this.repo = repo;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PageResponse<WorkoutResponse> list(UUID userId, LocalDate date, LocalDate from, LocalDate to, int page, int size) {
        DateRange range = DateRange.resolve(date, from, to, MAX_RANGE_DAYS);
        Sort sort = Sort.by("sessionDate").and(Sort.by("createdAt"));
        Page<WorkoutSession> result = repo.findByUserIdAndSessionDateBetween(userId, range.from(), range.to(),
                PageParams.of(page, size, sort));
        return PageResponse.from(result, WorkoutService::toResponse);
    }

    @Transactional(readOnly = true)
    public WorkoutResponse get(UUID userId, UUID id) {
        return toResponse(require(userId, id));
    }

    @Transactional(readOnly = true)
    public WorkoutDayRow totalsFor(UUID userId, LocalDate date) {
        return repo.aggregate(userId, date, date).stream().findFirst().orElse(new WorkoutDayRow(date, 0L, 0L, null));
    }

    @Transactional
    public WorkoutResponse create(UUID userId, WorkoutRequest r) {
        validate(r);
        WorkoutSession s = new WorkoutSession();
        s.setUserId(userId);
        apply(s, r);
        return toResponse(repo.save(s));
    }

    @Transactional
    public WorkoutResponse update(UUID userId, UUID id, WorkoutRequest r) {
        validate(r);
        WorkoutSession s = require(userId, id);
        apply(s, r);
        return toResponse(repo.save(s));
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        repo.delete(require(userId, id));
    }

    private WorkoutSession require(UUID userId, UUID id) {
        return repo.findByIdAndUserId(id, userId)
                .orElseThrow(() -> ApiException.notFound("WORKOUT_NOT_FOUND", "Workout not found"));
    }

    private void validate(WorkoutRequest r) {
        DateRules.requireLoggableDate(r.date(), clock, "date");
        List<FieldIssue> issues = new ArrayList<>();
        if (r.type() == WorkoutType.STRENGTH) {
            if (r.split() == null) issues.add(new FieldIssue("split", "split is required for strength workouts"));
            if (r.cardioType() != null) issues.add(new FieldIssue("cardioType", "not allowed for strength workouts"));
            if (r.distanceKm() != null) issues.add(new FieldIssue("distanceKm", "not allowed for strength workouts"));
        } else {
            if (r.cardioType() == null) issues.add(new FieldIssue("cardioType", "cardioType is required for cardio sessions"));
            if (r.split() != null) issues.add(new FieldIssue("split", "not allowed for cardio sessions"));
            if (r.exercises() != null && !r.exercises().isEmpty()) {
                issues.add(new FieldIssue("exercises", "not allowed for cardio sessions"));
            }
        }
        if (!issues.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Validation failed", issues);
        }
    }

    private void apply(WorkoutSession s, WorkoutRequest r) {
        s.setWorkoutType(r.type());
        s.setSessionDate(r.date());
        s.setName(r.name().trim());
        s.setDurationMinutes(r.durationMinutes());
        s.setEstimatedCalories(r.estimatedCalories());
        s.setNotes(r.notes() == null || r.notes().isBlank() ? null : r.notes().trim());
        s.getExercises().clear();
        if (r.type() == WorkoutType.STRENGTH) {
            s.setSplit(r.split());
            s.setCardioType(null);
            s.setDistanceKm(null);
            int order = 0;
            if (r.exercises() != null) {
                for (ExerciseRequest er : r.exercises()) {
                    WorkoutExercise e = new WorkoutExercise();
                    e.setSession(s);
                    e.setSortOrder(order++);
                    e.setName(er.name().trim());
                    e.setSets(er.sets());
                    e.setReps(er.reps());
                    e.setWeightKg(er.weightKg());
                    e.setNotes(er.notes() == null || er.notes().isBlank() ? null : er.notes().trim());
                    s.getExercises().add(e);
                }
            }
        } else {
            s.setSplit(null);
            s.setCardioType(r.cardioType());
            s.setDistanceKm(r.distanceKm());
        }
    }

    static WorkoutResponse toResponse(WorkoutSession s) {
        boolean strength = s.getWorkoutType() == WorkoutType.STRENGTH;
        List<ExerciseResponse> exercises = strength
                ? s.getExercises().stream().map(e -> new ExerciseResponse(e.getId(), e.getName(), e.getSets(),
                        e.getReps(), e.getWeightKg(), e.getNotes())).toList()
                : null;
        return new WorkoutResponse(s.getId(), s.getWorkoutType(), s.getSessionDate(), s.getName(), s.getDurationMinutes(),
                s.getEstimatedCalories(), true, s.getNotes(), strength ? s.getSplit() : null, exercises,
                strength ? null : s.getCardioType(), strength ? null : s.getDistanceKm());
    }
}
