package com.nutritrack.scanner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.nutritrack.catalog.FoodCatalogItem;
import com.nutritrack.catalog.FoodCatalogRepository;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class CatalogCandidateRankerTest {

    private FoodCatalogRepository repository;
    private CatalogCandidateRanker ranker;

    @BeforeEach
    void setUp() {
        repository = mock(FoodCatalogRepository.class);
        ranker = new CatalogCandidateRanker(repository);
    }

    private FoodCatalogItem createItem(String code, String name, String aliases, String category, double cal) {
        FoodCatalogItem item = new FoodCatalogItem();
        item.setId(UUID.randomUUID());
        item.setCode(code);
        item.setCanonicalName(name);
        item.setRegionalAliases(aliases);
        item.setCategory(category);
        item.setCaloriesPer100g(BigDecimal.valueOf(cal));
        item.setProteinPer100g(BigDecimal.valueOf(8.5));
        item.setCarbohydratesPer100g(BigDecimal.valueOf(25.0));
        item.setFatPer100g(BigDecimal.valueOf(6.0));
        item.setFiberPer100g(BigDecimal.valueOf(2.0));
        item.setDefaultServingUnit("plate");
        item.setDefaultServingGrams(BigDecimal.valueOf(250.0));
        item.setDataSource("Test Reference");
        return item;
    }

    @Test
    void userExactCanonicalMatchTakesPrecedence() {
        FoodCatalogItem biryani = createItem("B01", "Chicken Biryani", "dum biryani, murgh biryani", "RICE_DISHES", 185.0);
        FoodCatalogItem friedRice = createItem("F01", "Vegetable Fried Rice", "fried rice", "RICE_DISHES", 152.0);
        when(repository.findAll()).thenReturn(List.of(biryani, friedRice));

        List<CatalogCandidateRanker.PredictionInput> preds = List.of(
                new CatalogCandidateRanker.PredictionInput("fried_rice", 0.95)
        );

        List<FoodCandidateDto> candidates = ranker.rankCandidates("Chicken Biryani", preds, 5);

        assertThat(candidates).isNotEmpty();
        assertThat(candidates.get(0).canonicalName()).isEqualTo("Chicken Biryani");
        assertThat(candidates.get(0).matchScore()).isEqualTo(100.0);
        assertThat(candidates.get(0).matchReason()).contains("Exact user match: canonical name");
    }

    @Test
    void userExactAliasMatchTakesHighPrecedence() {
        FoodCatalogItem biryani = createItem("B01", "Chicken Biryani", "dum biryani, murgh biryani", "RICE_DISHES", 185.0);
        when(repository.findAll()).thenReturn(List.of(biryani));

        List<FoodCandidateDto> candidates = ranker.rankCandidates("dum biryani", Collections.emptyList(), 5);

        assertThat(candidates).isNotEmpty();
        assertThat(candidates.get(0).canonicalName()).isEqualTo("Chicken Biryani");
        assertThat(candidates.get(0).matchScore()).isEqualTo(95.0);
        assertThat(candidates.get(0).matchReason()).contains("regional alias ('dum biryani')");
    }

    @Test
    void ambiguousFriedRiceVisionPredictionSurfacesBiryani() {
        FoodCatalogItem biryani = createItem("B01", "Chicken Biryani", "dum biryani", "RICE_DISHES", 185.0);
        FoodCatalogItem curdRice = createItem("R01", "Curd Rice", "thayir sadam", "RICE_DISHES", 125.0);
        FoodCatalogItem samosa = createItem("S01", "Samosa", "singara", "SNACKS_STREETFOOD", 262.0);
        when(repository.findAll()).thenReturn(List.of(biryani, curdRice, samosa));

        List<CatalogCandidateRanker.PredictionInput> preds = List.of(
                new CatalogCandidateRanker.PredictionInput("fried_rice", 0.956)
        );

        List<FoodCandidateDto> candidates = ranker.rankCandidates(null, preds, 5);

        assertThat(candidates).extracting(FoodCandidateDto::canonicalName)
                .contains("Chicken Biryani", "Curd Rice")
                .doesNotContain("Samosa");
        assertThat(candidates.get(0).canonicalName()).isEqualTo("Chicken Biryani");
    }

    @Test
    void ambiguousPizzaVisionPredictionSurfacesRajmaMasala() {
        FoodCatalogItem rajma = createItem("R02", "Rajma Masala", "red kidney bean curry", "CURRIES_GRAVIES", 130.0);
        FoodCatalogItem chole = createItem("C01", "Chole / Chana Masala", "chana masala", "CURRIES_GRAVIES", 145.0);
        FoodCatalogItem chai = createItem("T01", "Masala Chai", "tea", "BEVERAGES", 73.0);
        when(repository.findAll()).thenReturn(List.of(rajma, chole, chai));

        List<CatalogCandidateRanker.PredictionInput> preds = List.of(
                new CatalogCandidateRanker.PredictionInput("pizza", 0.840)
        );

        List<FoodCandidateDto> candidates = ranker.rankCandidates(null, preds, 5);

        assertThat(candidates).extracting(FoodCandidateDto::canonicalName)
                .contains("Rajma Masala", "Chole / Chana Masala")
                .doesNotContain("Masala Chai");
    }

    @Test
    void orderingIsDeterministicAcrossRepeatedInvocations() {
        FoodCatalogItem item1 = createItem("B01", "Chicken Biryani", "dum biryani", "RICE_DISHES", 185.0);
        FoodCatalogItem item2 = createItem("B02", "Vegetable Dum Biryani", "veg biryani", "RICE_DISHES", 160.0);
        FoodCatalogItem item3 = createItem("B03", "Curd Rice", "thayir sadam", "RICE_DISHES", 125.0);
        when(repository.findAll()).thenReturn(List.of(item1, item2, item3));

        List<CatalogCandidateRanker.PredictionInput> preds = List.of(
                new CatalogCandidateRanker.PredictionInput("fried_rice", 0.90)
        );

        List<FoodCandidateDto> run1 = ranker.rankCandidates(null, preds, 5);
        List<FoodCandidateDto> run2 = ranker.rankCandidates(null, preds, 5);

        assertThat(run1).isEqualTo(run2);
    }
}
