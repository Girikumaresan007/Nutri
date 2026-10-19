package com.nutritrack.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "food_catalog")
public class FoodCatalogItem {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(name = "canonical_name", nullable = false, length = 150)
    private String canonicalName;

    @Column(name = "regional_aliases", nullable = false, columnDefinition = "text")
    private String regionalAliases = "";

    @Column(nullable = false, length = 50)
    private String category;

    @Column(name = "preparation_method", length = 100)
    private String preparationMethod;

    @Column(name = "calories_per_100g", nullable = false, precision = 8, scale = 2)
    private BigDecimal caloriesPer100g;

    @Column(name = "protein_per_100g", nullable = false, precision = 8, scale = 2)
    private BigDecimal proteinPer100g;

    @Column(name = "carbohydrates_per_100g", nullable = false, precision = 8, scale = 2)
    private BigDecimal carbohydratesPer100g;

    @Column(name = "fat_per_100g", nullable = false, precision = 8, scale = 2)
    private BigDecimal fatPer100g;

    @Column(name = "fiber_per_100g", nullable = false, precision = 8, scale = 2)
    private BigDecimal fiberPer100g;

    @Column(name = "data_source", nullable = false, length = 100)
    private String dataSource;

    @Column(name = "source_reference_id", length = 100)
    private String sourceReferenceId;

    @Column(name = "recipe_type", nullable = false, length = 30)
    private String recipeType;

    @Column(name = "default_serving_unit", nullable = false, length = 30)
    private String defaultServingUnit;

    @Column(name = "default_serving_grams", nullable = false, precision = 8, scale = 2)
    private BigDecimal defaultServingGrams;

    @Column(name = "serving_conversions", nullable = false, columnDefinition = "text")
    private String servingConversions;

    @Column(name = "default_warning", length = 500)
    private String defaultWarning;

    @Column(nullable = false)
    private Integer version = 1;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public FoodCatalogItem() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getCanonicalName() { return canonicalName; }
    public void setCanonicalName(String canonicalName) { this.canonicalName = canonicalName; }

    public String getRegionalAliases() { return regionalAliases; }
    public void setRegionalAliases(String regionalAliases) { this.regionalAliases = regionalAliases; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getPreparationMethod() { return preparationMethod; }
    public void setPreparationMethod(String preparationMethod) { this.preparationMethod = preparationMethod; }

    public BigDecimal getCaloriesPer100g() { return caloriesPer100g; }
    public void setCaloriesPer100g(BigDecimal caloriesPer100g) { this.caloriesPer100g = caloriesPer100g; }

    public BigDecimal getProteinPer100g() { return proteinPer100g; }
    public void setProteinPer100g(BigDecimal proteinPer100g) { this.proteinPer100g = proteinPer100g; }

    public BigDecimal getCarbohydratesPer100g() { return carbohydratesPer100g; }
    public void setCarbohydratesPer100g(BigDecimal carbohydratesPer100g) { this.carbohydratesPer100g = carbohydratesPer100g; }

    public BigDecimal getFatPer100g() { return fatPer100g; }
    public void setFatPer100g(BigDecimal fatPer100g) { this.fatPer100g = fatPer100g; }

    public BigDecimal getFiberPer100g() { return fiberPer100g; }
    public void setFiberPer100g(BigDecimal fiberPer100g) { this.fiberPer100g = fiberPer100g; }

    public String getDataSource() { return dataSource; }
    public void setDataSource(String dataSource) { this.dataSource = dataSource; }

    public String getSourceReferenceId() { return sourceReferenceId; }
    public void setSourceReferenceId(String sourceReferenceId) { this.sourceReferenceId = sourceReferenceId; }

    public String getRecipeType() { return recipeType; }
    public void setRecipeType(String recipeType) { this.recipeType = recipeType; }

    public String getDefaultServingUnit() { return defaultServingUnit; }
    public void setDefaultServingUnit(String defaultServingUnit) { this.defaultServingUnit = defaultServingUnit; }

    public BigDecimal getDefaultServingGrams() { return defaultServingGrams; }
    public void setDefaultServingGrams(BigDecimal defaultServingGrams) { this.defaultServingGrams = defaultServingGrams; }

    public String getServingConversions() { return servingConversions; }
    public void setServingConversions(String servingConversions) { this.servingConversions = servingConversions; }

    public String getDefaultWarning() { return defaultWarning; }
    public void setDefaultWarning(String defaultWarning) { this.defaultWarning = defaultWarning; }

    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
