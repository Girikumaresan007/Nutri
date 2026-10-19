package com.nutritrack.catalog;

import com.nutritrack.exception.ApiException;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/food-catalog")
@Tag(name = "Verified Food Catalog")
public class FoodCatalogController {

    private final FoodCatalogService service;

    public FoodCatalogController(FoodCatalogService service) {
        this.service = service;
    }

    @GetMapping
    public List<FoodCatalogResponse> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "20") int limit) {
        return service.search(q, category, limit);
    }

    @GetMapping("/lookup")
    public FoodLookupResponse lookup(
            @RequestParam String q,
            @RequestParam(defaultValue = "false") boolean includeExternal,
            @RequestParam(defaultValue = "10") int limit) {
        return service.lookup(q, includeExternal, limit);
    }

    @GetMapping("/{id}")
    public FoodCatalogResponse getById(@PathVariable UUID id) {
        return service.getById(id)
                .orElseThrow(() -> ApiException.notFound("FOOD_NOT_FOUND", "Food catalog entry not found"));
    }

    @GetMapping("/code/{code}")
    public FoodCatalogResponse getByCode(@PathVariable String code) {
        return service.getByCode(code)
                .orElseThrow(() -> ApiException.notFound("FOOD_NOT_FOUND", "Food catalog entry with code " + code + " not found"));
    }

    @PostMapping("/calculate")
    public CalculateNutritionResponse calculate(@Valid @RequestBody CalculateNutritionRequest request) {
        return service.calculateNutrition(request);
    }

    @PostMapping("/import-external")
    public FoodCatalogResponse importExternal(@Valid @RequestBody ExternalFoodItem item) {
        return service.importExternalFood(item);
    }
}
