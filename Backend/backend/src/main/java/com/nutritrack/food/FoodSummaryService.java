package com.nutritrack.food;

import com.nutritrack.common.DateRange;
import com.nutritrack.common.Meal;
import com.nutritrack.common.Nutrition;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Totals are always computed from saved entries (database aggregation); client-submitted totals are never trusted. */
@Service
public class FoodSummaryService {
    private final FoodEntryRepository repo;

    public FoodSummaryService(FoodEntryRepository repo) {
        this.repo = repo;
    }

    @Transactional(readOnly = true)
    public FoodSummaryResponse summarize(UUID userId, LocalDate date, LocalDate from, LocalDate to) {
        DateRange range = DateRange.resolve(date, from, to, FoodEntryService.MAX_RANGE_DAYS);
        TreeMap<LocalDate, DaySummary> days = byDay(userId, range.from(), range.to());
        Nutrition total = Nutrition.ZERO;
        for (DaySummary d : days.values()) {
            total = total.plus(d.totals());
        }
        return new FoodSummaryResponse(range.from(), range.to(), days.size(), total, new ArrayList<>(days.values()));
    }

    @Transactional(readOnly = true)
    public TreeMap<LocalDate, DaySummary> byDay(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, List<MealTotalRow>> grouped = repo.aggregate(userId, from, to).stream()
                .collect(Collectors.groupingBy(MealTotalRow::date));
        TreeMap<LocalDate, DaySummary> result = new TreeMap<>();
        grouped.forEach((d, rows) -> result.put(d, buildDay(d, rows)));
        return result;
    }

    static DaySummary buildDay(LocalDate date, List<MealTotalRow> rows) {
        List<MealSummary> meals = new ArrayList<>();
        Nutrition total = Nutrition.ZERO;
        long count = 0;
        for (Meal meal : Meal.values()) {
            MealTotalRow row = rows.stream().filter(r -> r.meal() == meal).findFirst().orElse(null);
            Nutrition n = row == null ? Nutrition.ZERO : row.toNutrition();
            long c = row == null ? 0 : row.entryCount();
            meals.add(new MealSummary(meal, c, n));
            total = total.plus(n);
            count += c;
        }
        return new DaySummary(date, count, total, meals);
    }
}
