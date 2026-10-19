package com.nutritrack.weight;

import com.nutritrack.common.DateRange;
import com.nutritrack.common.DateRules;
import com.nutritrack.common.PageParams;
import com.nutritrack.common.PageResponse;
import com.nutritrack.exception.ApiException;
import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WeightService {
    private final WeightLogRepository repo;
    private final Clock clock;

    public WeightService(WeightLogRepository repo, Clock clock) {
        this.repo = repo;
        this.clock = clock;
    }

    /** Ordered oldest-first so the response can feed a chart directly. Multiple measurements per day are kept. */
    @Transactional(readOnly = true)
    public PageResponse<WeightResponse> list(UUID userId, LocalDate from, LocalDate to, int page, int size) {
        Sort sort = Sort.by("logDate").and(Sort.by("createdAt"));
        Page<WeightLog> result;
        if (from == null && to == null) {
            result = repo.findByUserId(userId, PageParams.of(page, size, sort));
        } else {
            DateRange range = DateRange.of(from, to, 366 * 20);
            result = repo.findByUserIdAndLogDateBetween(userId, range.from(), range.to(), PageParams.of(page, size, sort));
        }
        return PageResponse.from(result, WeightResponse::from);
    }

    @Transactional
    public WeightResponse create(UUID userId, WeightRequest r) {
        DateRules.requireLoggableDate(r.date(), clock, "date");
        WeightLog w = new WeightLog();
        w.setUserId(userId);
        apply(w, r);
        return WeightResponse.from(repo.save(w));
    }

    @Transactional
    public WeightResponse update(UUID userId, UUID id, WeightRequest r) {
        DateRules.requireLoggableDate(r.date(), clock, "date");
        WeightLog w = require(userId, id);
        apply(w, r);
        return WeightResponse.from(repo.save(w));
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        repo.delete(require(userId, id));
    }

    private WeightLog require(UUID userId, UUID id) {
        return repo.findByIdAndUserId(id, userId)
                .orElseThrow(() -> ApiException.notFound("WEIGHT_LOG_NOT_FOUND", "Weight log not found"));
    }

    private static void apply(WeightLog w, WeightRequest r) {
        w.setLogDate(r.date());
        w.setWeightKg(r.weightKg());
        w.setNote(r.note() == null || r.note().isBlank() ? null : r.note().trim());
    }
}
