package com.nutritrack.nutrition;

import com.nutritrack.security.AuthenticatedUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/nutrition")
@Tag(name = "Nutrition estimates")
public class NutritionController {
    private final NutritionEstimateService estimates;
    private final DailySummaryService daily;

    public NutritionController(NutritionEstimateService estimates, DailySummaryService daily) {
        this.estimates = estimates;
        this.daily = daily;
    }

    @GetMapping("/estimate")
    public EstimateResponse estimate(@AuthenticationPrincipal AuthenticatedUser user) {
        return estimates.estimate(user.id());
    }

    @GetMapping("/daily-summary")
    public DailySummaryResponse dailySummary(@AuthenticationPrincipal AuthenticatedUser user,
                                             @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return daily.summarize(user.id(), date);
    }
}
