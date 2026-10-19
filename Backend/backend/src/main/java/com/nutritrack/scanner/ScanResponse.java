package com.nutritrack.scanner;

import java.util.List;
import java.util.UUID;

/** Stateless: nothing here is stored, and the user must review and confirm before anything reaches the diary. */
public record ScanResponse(UUID analysisId, boolean isEstimate, String provider, String disclaimer,
                           List<DetectedFood> items, List<String> warnings) {}
