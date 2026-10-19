package com.nutritrack.catalog;

import java.util.List;

/**
 * Unified food lookup response returning verified local catalog items first,
 * and validated external matches when local results are exhausted or external search is requested.
 */
public record FoodLookupResponse(
        String query,
        List<FoodCatalogResponse> localMatches,
        List<ExternalFoodItem> externalMatches,
        String lookupStatus, // LOCAL_MATCH, EXTERNAL_MATCH, NO_MATCH, EXTERNAL_DEGRADED
        String attributionNote
) {}
