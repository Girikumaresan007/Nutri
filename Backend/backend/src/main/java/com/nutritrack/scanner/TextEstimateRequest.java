package com.nutritrack.scanner;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TextEstimateRequest(@NotBlank @Size(max = 1000) String description) {}
