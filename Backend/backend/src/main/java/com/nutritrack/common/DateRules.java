package com.nutritrack.common;

import com.nutritrack.exception.ApiException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.Period;

public final class DateRules {
    public static final LocalDate EARLIEST_DATE = LocalDate.of(2000, 1, 1);
    public static final int MIN_AGE = 13;
    public static final int MAX_AGE = 120;

    private DateRules() {}

    /** Server "today" in UTC. Used only for validation; stored dates are never shifted. */
    public static LocalDate today(Clock clock) {
        return LocalDate.now(clock);
    }

    /**
     * Diary-type dates may be up to one day ahead of UTC today so that users east of UTC
     * (whose local date can already be "tomorrow") can log their own today.
     */
    public static void requireLoggableDate(LocalDate date, Clock clock, String field) {
        if (date.isBefore(EARLIEST_DATE) || date.isAfter(today(clock).plusDays(1))) {
            throw ApiException.validation(field, "date is outside the supported range");
        }
    }

    public static int ageOn(LocalDate dateOfBirth, LocalDate today) {
        return Period.between(dateOfBirth, today).getYears();
    }

    public static void requirePlausibleBirthDate(LocalDate dob, Clock clock, String field) {
        LocalDate today = today(clock);
        if (dob.isAfter(today)) {
            throw ApiException.validation(field, "date of birth cannot be in the future");
        }
        int age = ageOn(dob, today);
        if (age < MIN_AGE || age > MAX_AGE) {
            throw ApiException.validation(field, "age must be between " + MIN_AGE + " and " + MAX_AGE);
        }
    }
}
