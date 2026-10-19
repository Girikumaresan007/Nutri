package com.nutritrack.common;

import com.nutritrack.exception.ApiException;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/** Inclusive calendar-date range. Dates are plain calendar dates; no timezone conversion is ever applied. */
public record DateRange(LocalDate from, LocalDate to) {

    public static DateRange of(LocalDate from, LocalDate to, int maxDays) {
        if (from == null || to == null) {
            throw ApiException.validation("from", "from and to are required");
        }
        if (to.isBefore(from)) {
            throw ApiException.validation("to", "to must not be before from");
        }
        if (ChronoUnit.DAYS.between(from, to) + 1 > maxDays) {
            throw ApiException.validation("to", "range must not exceed " + maxDays + " days");
        }
        return new DateRange(from, to);
    }

    /** Either a single {@code date}, or {@code from}+{@code to}; never both. */
    public static DateRange resolve(LocalDate date, LocalDate from, LocalDate to, int maxDays) {
        if (date != null) {
            if (from != null || to != null) {
                throw ApiException.validation("date", "use either date or from/to, not both");
            }
            return new DateRange(date, date);
        }
        if (from == null && to == null) {
            throw ApiException.validation("date", "date or from/to is required");
        }
        return of(from, to, maxDays);
    }

    public long days() {
        return ChronoUnit.DAYS.between(from, to) + 1;
    }
}
