package com.nutritrack.food;

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
public class FoodEntryService {
    static final int MAX_RANGE_DAYS = 366;

    private final FoodEntryRepository repo;
    private final FoodEntryMapper mapper;
    private final Clock clock;

    public FoodEntryService(FoodEntryRepository repo, FoodEntryMapper mapper, Clock clock) {
        this.repo = repo;
        this.mapper = mapper;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PageResponse<FoodEntryResponse> list(UUID userId, LocalDate date, LocalDate from, LocalDate to, int page, int size) {
        DateRange range = DateRange.resolve(date, from, to, MAX_RANGE_DAYS);
        Sort sort = Sort.by("entryDate").and(Sort.by("createdAt"));
        Page<FoodEntry> result = repo.findByUserIdAndEntryDateBetween(userId, range.from(), range.to(),
                PageParams.of(page, size, sort));
        return PageResponse.from(result, mapper::toResponse);
    }

    @Transactional(readOnly = true)
    public FoodEntryResponse get(UUID userId, UUID id) {
        return mapper.toResponse(require(userId, id));
    }

    @Transactional
    public FoodEntryResponse create(UUID userId, FoodEntryRequest r) {
        DateRules.requireLoggableDate(r.date(), clock, "date");
        FoodEntry e = new FoodEntry();
        e.setUserId(userId);   // always the authenticated user, never a client-supplied id
        mapper.apply(e, r);
        return mapper.toResponse(repo.save(e));
    }

    /** Explicit edit: replaces the stored snapshot with the submitted values. */
    @Transactional
    public FoodEntryResponse update(UUID userId, UUID id, FoodEntryRequest r) {
        DateRules.requireLoggableDate(r.date(), clock, "date");
        FoodEntry e = require(userId, id);
        mapper.apply(e, r);
        return mapper.toResponse(repo.save(e));
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        repo.delete(require(userId, id));
    }

    @Transactional
    public FoodEntryResponse duplicate(UUID userId, UUID id, DuplicateRequest req) {
        FoodEntry src = require(userId, id);
        LocalDate date = req != null && req.date() != null ? req.date() : src.getEntryDate();
        DateRules.requireLoggableDate(date, clock, "date");
        FoodEntry copy = new FoodEntry();
        copy.setUserId(userId);
        copy.setEntryDate(date);
        copy.setMeal(req != null && req.meal() != null ? req.meal() : src.getMeal());
        copy.setName(src.getName());
        copy.setQuantity(src.getQuantity());
        copy.setUnit(src.getUnit());
        copy.setCalories(src.getCalories());
        copy.setProtein(src.getProtein());
        copy.setCarbohydrates(src.getCarbohydrates());
        copy.setFat(src.getFat());
        copy.setFiber(src.getFiber());
        copy.setNotes(src.getNotes());
        copy.setSource(src.getSource());
        return mapper.toResponse(repo.save(copy));
    }

    private FoodEntry require(UUID userId, UUID id) {
        // Same 404 for "missing" and "someone else's" so entry ids cannot be probed.
        return repo.findByIdAndUserId(id, userId)
                .orElseThrow(() -> ApiException.notFound("FOOD_ENTRY_NOT_FOUND", "Food entry not found"));
    }
}
