package com.nutritrack.analytics;

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
@RequestMapping("/api/v1/analytics")
@Tag(name = "Analytics")
public class AnalyticsController {
    private final AnalyticsService service;

    public AnalyticsController(AnalyticsService service) {
        this.service = service;
    }

    @GetMapping("/daily")
    public DayAnalytics daily(@AuthenticationPrincipal AuthenticatedUser user,
                              @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.daily(user.id(), date);
    }

    @GetMapping("/weekly")
    public PeriodAnalytics weekly(@AuthenticationPrincipal AuthenticatedUser user,
                                  @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                  @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.weekly(user.id(), from, to);
    }

    @GetMapping("/monthly")
    public PeriodAnalytics monthly(@AuthenticationPrincipal AuthenticatedUser user,
                                   @RequestParam int year, @RequestParam int month) {
        return service.monthly(user.id(), year, month);
    }

    @GetMapping("/yearly")
    public PeriodAnalytics yearly(@AuthenticationPrincipal AuthenticatedUser user, @RequestParam int year) {
        return service.yearly(user.id(), year);
    }
}
