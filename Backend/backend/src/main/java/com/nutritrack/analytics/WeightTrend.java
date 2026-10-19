package com.nutritrack.analytics;

import java.math.BigDecimal;
import java.util.List;

public record WeightTrend(BigDecimal startKg, BigDecimal endKg, BigDecimal changeKg, List<WeightPoint> points) {}
