package com.nutritrack.analytics;

import java.math.BigDecimal;
import java.time.LocalDate;

public record WeightPoint(LocalDate date, BigDecimal weightKg) {}
