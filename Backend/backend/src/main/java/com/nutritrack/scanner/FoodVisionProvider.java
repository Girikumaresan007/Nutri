package com.nutritrack.scanner;

import java.util.List;

/**
 * Abstraction over the AI vendor. Implementations MUST NOT persist or log image bytes or descriptions.
 * Swap vendors by adding an implementation and selecting it with nutritrack.scanner.provider.
 */
public interface FoodVisionProvider {
    String name();

    /** False means the scanner endpoints answer 503 instead of inventing results. */
    boolean isAvailable();

    List<RawDetectedFood> analyzeImage(byte[] image, String mimeType, String description);

    List<RawDetectedFood> analyzeText(String description);
}
