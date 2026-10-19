package com.nutritrack.goals;

import com.nutritrack.security.AuthenticatedUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/goals")
@Tag(name = "Nutrition goals")
public class GoalController {
    private final GoalService service;
    private final Clock clock;

    public GoalController(GoalService service, Clock clock) {
        this.service = service;
        this.clock = clock;
    }

    @GetMapping
    public List<GoalResponse> list(@AuthenticationPrincipal AuthenticatedUser user) {
        return service.list(user.id());
    }

    @GetMapping("/active")
    public GoalResponse active(@AuthenticationPrincipal AuthenticatedUser user,
                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.active(user.id(), date == null ? LocalDate.now(clock) : date);
    }

    @PostMapping
    public ResponseEntity<GoalResponse> create(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody GoalRequest request) {
        GoalResponse created = service.create(user.id(), request);
        return ResponseEntity.created(URI.create("/api/v1/goals/" + created.id())).body(created);
    }

    @GetMapping("/{id}")
    public GoalResponse get(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        return service.get(user.id(), id);
    }

    @PutMapping("/{id}")
    public GoalResponse update(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id,
                               @Valid @RequestBody GoalRequest request) {
        return service.update(user.id(), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        service.delete(user.id(), id);
        return ResponseEntity.noContent().build();
    }
}
