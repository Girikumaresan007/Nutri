package com.nutritrack.food;

import com.nutritrack.common.Meal;
import java.time.LocalDate;

/** Optional body for POST /food-entries/{id}/duplicate; omitted fields keep the source entry's date/meal. */
public record DuplicateRequest(LocalDate date, Meal meal) {}
