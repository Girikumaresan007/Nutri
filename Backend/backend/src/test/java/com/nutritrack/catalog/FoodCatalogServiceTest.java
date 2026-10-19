package com.nutritrack.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class FoodCatalogServiceTest {

    private FoodCatalogRepository repository;
    private ObjectMapper mapper;
    private FoodCatalogService service;

    @BeforeEach
    void setUp() {
        repository = mock(FoodCatalogRepository.class);
        mapper = new ObjectMapper();
        service = new FoodCatalogService(repository, mapper);
    }

    @Test
    @DisplayName("calculateNutrition prioritizes exact unit match over substring containment")
    void testExactUnitMatchPrioritized() {
        UUID id = UUID.randomUUID();
        FoodCatalogItem item = new FoodCatalogItem();
        item.setId(id);
        item.setCode("IFCT_IDLI");
        item.setCanonicalName("Idli");
        item.setCaloriesPer100g(new BigDecimal("132.0"));
        item.setProteinPer100g(new BigDecimal("5.2"));
        item.setCarbohydratesPer100g(new BigDecimal("26.5"));
        item.setFatPer100g(new BigDecimal("0.5"));
        item.setFiberPer100g(new BigDecimal("2.1"));
        item.setDataSource("ICMR-NIN IFCT 2017");
        item.setSourceReferenceId("IFCT-2017-B004");
        item.setRecipeType("STANDARD_RECIPE");
        item.setDefaultServingUnit("piece");
        item.setDefaultServingGrams(new BigDecimal("50.0"));
        // Notice "plate (2 pieces)" comes first, but user requested "piece"
        item.setServingConversions("{\"plate (2 pieces)\": 100, \"piece\": 50, \"g\": 1}");

        when(repository.findById(id)).thenReturn(Optional.of(item));

        CalculateNutritionRequest request = new CalculateNutritionRequest(id, new BigDecimal("3"), "piece");
        CalculateNutritionResponse resp = service.calculateNutrition(request);

        assertThat(resp).isNotNull();
        // 3 pieces @ 50g each = 150g total (NOT 300g from plate)
        assertThat(resp.calculatedGrams()).isEqualByComparingTo("150.00");
        assertThat(resp.calories()).isEqualByComparingTo("198.0");
        assertThat(resp.protein()).isEqualByComparingTo("7.8");
        assertThat(resp.carbohydrates()).isEqualByComparingTo("39.8");
        assertThat(resp.fat()).isEqualByComparingTo("0.8");
        assertThat(resp.fiber()).isEqualByComparingTo("3.2");
        assertThat(resp.dataSource()).isEqualTo("ICMR-NIN IFCT 2017");
    }

    @Test
    @DisplayName("calculateNutrition handles grams directly")
    void testGramsDirectly() {
        UUID id = UUID.randomUUID();
        FoodCatalogItem item = new FoodCatalogItem();
        item.setId(id);
        item.setCode("IFCT_RICE");
        item.setCanonicalName("Steamed White Rice");
        item.setCaloriesPer100g(new BigDecimal("130.0"));
        item.setProteinPer100g(new BigDecimal("2.7"));
        item.setCarbohydratesPer100g(new BigDecimal("28.2"));
        item.setFatPer100g(new BigDecimal("0.3"));
        item.setFiberPer100g(new BigDecimal("0.4"));
        item.setDataSource("ICMR-NIN IFCT 2017");
        item.setDefaultServingUnit("bowl");
        item.setDefaultServingGrams(new BigDecimal("150.0"));
        item.setServingConversions("{\"bowl\": 150, \"g\": 1}");

        when(repository.findById(id)).thenReturn(Optional.of(item));

        CalculateNutritionRequest request = new CalculateNutritionRequest(id, new BigDecimal("200"), "g");
        CalculateNutritionResponse resp = service.calculateNutrition(request);

        assertThat(resp.calculatedGrams()).isEqualByComparingTo("200.00");
        assertThat(resp.calories()).isEqualByComparingTo("260.0"); // 130 * 2
        assertThat(resp.protein()).isEqualByComparingTo("5.4");
        assertThat(resp.carbohydrates()).isEqualByComparingTo("56.4");
    }

    @Test
    @DisplayName("calculateNutrition handles fractional quantities accurately without rounding loss")
    void testFractionalQuantities() {
        UUID id = UUID.randomUUID();
        FoodCatalogItem item = new FoodCatalogItem();
        item.setId(id);
        item.setCode("IFCT_PONGAL");
        item.setCanonicalName("Ven Pongal");
        item.setCaloriesPer100g(new BigDecimal("165.0"));
        item.setProteinPer100g(new BigDecimal("4.5"));
        item.setCarbohydratesPer100g(new BigDecimal("26.0"));
        item.setFatPer100g(new BigDecimal("4.8"));
        item.setFiberPer100g(new BigDecimal("2.2"));
        item.setDataSource("ICMR-NIN IFCT 2017");
        item.setDefaultServingUnit("bowl");
        item.setDefaultServingGrams(new BigDecimal("200.0"));
        item.setServingConversions("{\"bowl\": 200, \"g\": 1}");

        when(repository.findById(id)).thenReturn(Optional.of(item));

        // 0.5 bowl = 100g -> exactly 165.0 kcal
        CalculateNutritionRequest request = new CalculateNutritionRequest(id, new BigDecimal("0.5"), "bowl");
        CalculateNutritionResponse resp = service.calculateNutrition(request);

        assertThat(resp.calculatedGrams()).isEqualByComparingTo("100.00");
        assertThat(resp.calories()).isEqualByComparingTo("165.0");
        assertThat(resp.protein()).isEqualByComparingTo("4.5");
        assertThat(resp.carbohydrates()).isEqualByComparingTo("26.0");
    }

    @Test
    @DisplayName("calculateNutrition rejects zero or negative quantity safely")
    void testZeroAndNegativeQuantityRejected() {
        UUID id = UUID.randomUUID();
        org.junit.jupiter.api.Assertions.assertThrows(com.nutritrack.exception.ApiException.class, () ->
                service.calculateNutrition(new CalculateNutritionRequest(id, BigDecimal.ZERO, "piece"))
        );
        org.junit.jupiter.api.Assertions.assertThrows(com.nutritrack.exception.ApiException.class, () ->
                service.calculateNutrition(new CalculateNutritionRequest(id, new BigDecimal("-2.5"), "piece"))
        );
    }

    @Test
    @DisplayName("calculateNutrition rejects excessively large quantity safely")
    void testExcessiveQuantityRejected() {
        UUID id = UUID.randomUUID();
        org.junit.jupiter.api.Assertions.assertThrows(com.nutritrack.exception.ApiException.class, () ->
                service.calculateNutrition(new CalculateNutritionRequest(id, new BigDecimal("100001"), "piece"))
        );
    }

    @Test
    @DisplayName("calculateNutrition uses custom grams accurately when provided")
    void testCustomGramsUsedAccurately() {
        UUID id = UUID.randomUUID();
        FoodCatalogItem item = new FoodCatalogItem();
        item.setId(id);
        item.setCode("IFCT_IDLI");
        item.setCanonicalName("Idli");
        item.setCaloriesPer100g(new BigDecimal("132.0"));
        item.setProteinPer100g(new BigDecimal("5.2"));
        item.setCarbohydratesPer100g(new BigDecimal("26.5"));
        item.setFatPer100g(new BigDecimal("0.5"));
        item.setFiberPer100g(new BigDecimal("2.1"));
        item.setDataSource("ICMR-NIN IFCT 2017");
        item.setDefaultServingUnit("piece");
        item.setDefaultServingGrams(new BigDecimal("50.0"));
        item.setServingConversions("{\"piece\": 50, \"g\": 1}");

        when(repository.findById(id)).thenReturn(Optional.of(item));

        // User enters custom 75g per piece (large idli) for 2 pieces = 150g total
        CalculateNutritionRequest request = new CalculateNutritionRequest(id, new BigDecimal("2"), "piece", new BigDecimal("75.0"));
        CalculateNutritionResponse resp = service.calculateNutrition(request);

        assertThat(resp.calculatedGrams()).isEqualByComparingTo("150.00");
        assertThat(resp.calories()).isEqualByComparingTo("198.0"); // 132 * 1.5
        assertThat(resp.protein()).isEqualByComparingTo("7.8");
        assertThat(resp.calculationNote()).contains("user-adjusted weight (75g/unit");
    }

    @Test
    @DisplayName("importExternalFood saves and maps external product correctly")
    void testImportExternalFood() {
        ExternalFoodItem external = new ExternalFoodItem(
                "OFF_8901262010054",
                "Amul Taaza Toned Milk (Amul)",
                "Amul",
                "PACKAGED_STAPLES",
                new BigDecimal("58.0"),
                new BigDecimal("3.0"),
                new BigDecimal("4.7"),
                new BigDecimal("3.0"),
                BigDecimal.ZERO,
                "per 100g",
                "serving",
                new BigDecimal("200.0"),
                Map.of("g", BigDecimal.ONE, "serving", new BigDecimal("200.0")),
                "Open Food Facts",
                "8901262010054",
                "BRANDED_PRODUCT",
                "Packaging label"
        );

        when(repository.findByCode("OFF_8901262010054")).thenReturn(Optional.empty());
        when(repository.save(any(FoodCatalogItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        FoodCatalogResponse res = service.importExternalFood(external);

        assertThat(res).isNotNull();
        assertThat(res.code()).isEqualTo("OFF_8901262010054");
        assertThat(res.canonicalName()).isEqualTo("Amul Taaza Toned Milk (Amul)");
        assertThat(res.recipeType()).isEqualTo("BRANDED_PRODUCT");
        assertThat(res.caloriesPer100g()).isEqualByComparingTo("58.0");
    }
}

