package com.nutritrack.scanner;

/**
 * Stage 14 explicit prediction policy state separating prediction confidence
 * from semantic food support and handling visual confusion safely.
 */
public enum PredictionPolicyState {
    /** Genuine ViT model prediction for a supported class with acceptable confidence and low entropy. */
    SUPPORTED_ACCEPTABLE,

    /** Genuine ViT model prediction for a supported class, but with elevated entropy or borderline confidence. */
    SUPPORTED_UNCERTAIN,

    /** Model output indicates an out-of-distribution food or unsupported dish outside the 20 classes. */
    UNSUPPORTED_OOD,

    /** Visual appearance resembles a mixed dish or composite texture prone to cross-dish misclassification. */
    AMBIGUOUS_MIXED_DISH,

    /** Vision service is offline or operating in degraded heuristic fallback mode. */
    DEGRADED_FALLBACK,

    /** No valid food prediction returned or image contains no recognizable food. */
    NO_VALID_PREDICTION
}
