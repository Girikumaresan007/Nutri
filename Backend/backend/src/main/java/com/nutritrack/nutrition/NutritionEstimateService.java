package com.nutritrack.nutrition;

import com.nutritrack.common.DateRules;
import com.nutritrack.exception.ApiException;
import com.nutritrack.profile.ProfileService;
import com.nutritrack.profile.UserProfile;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NutritionEstimateService {
    private final ProfileService profiles;
    private final NutritionCalculator calculator;
    private final Clock clock;

    public NutritionEstimateService(ProfileService profiles, NutritionCalculator calculator, Clock clock) {
        this.profiles = profiles;
        this.calculator = calculator;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public EstimateResponse estimate(UUID userId) {
        UserProfile p = profiles.requireProfile(userId);
        if (p.getDateOfBirth() == null || p.getHeightCm() == null || p.getCurrentWeightKg() == null) {
            throw ApiException.badRequest("PROFILE_INCOMPLETE",
                    "Date of birth, height and current weight are required to estimate calories");
        }
        int age = DateRules.ageOn(p.getDateOfBirth(), DateRules.today(clock));
        NutritionCalculator.Estimate e = calculator.calculate(age, p.getCurrentWeightKg(), p.getHeightCm(),
                p.getBiologicalSex(), p.getActivityLevel(), p.getGoalType());
        return new EstimateResponse(e.age(), e.bmr(), e.activityMultiplier(), e.maintenanceCalories(), e.goalType(),
                e.suggestedCalorieTarget(), e.suggestedMacros(), e.formula(), e.biologicalSexHandling(), true, e.notes());
    }
}
