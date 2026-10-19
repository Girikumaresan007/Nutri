package com.nutritrack.food;

import com.nutritrack.common.FoodSource;
import com.nutritrack.common.Nutrition;
import org.springframework.stereotype.Component;

@Component
public class FoodEntryMapper {

    public FoodEntryResponse toResponse(FoodEntry e) {
        return new FoodEntryResponse(e.getId(), e.getEntryDate(), e.getMeal(), e.getName(), e.getQuantity(), e.getUnit(),
                new Nutrition(e.getCalories(), e.getProtein(), e.getCarbohydrates(), e.getFat(), e.getFiber()),
                e.getNotes(), e.getSource(), e.getCreatedAt(), e.getUpdatedAt());
    }

    /** Copies request values (including the nutrition snapshot) onto the entity. */
    public void apply(FoodEntry e, FoodEntryRequest r) {
        e.setEntryDate(r.date());
        e.setMeal(r.meal());
        e.setName(r.name().trim());
        e.setQuantity(r.quantity());
        e.setUnit(r.unit().trim());
        e.setCalories(r.nutrition().calories());
        e.setProtein(r.nutrition().protein());
        e.setCarbohydrates(r.nutrition().carbohydrates());
        e.setFat(r.nutrition().fat());
        e.setFiber(r.nutrition().fiber());
        e.setNotes(r.notes() == null || r.notes().isBlank() ? null : r.notes().trim());
        e.setSource(r.source() == null ? FoodSource.MANUAL : r.source());
    }
}
