package com.nutritrack.workouts;

import com.nutritrack.common.PageParams;
import com.nutritrack.common.PageResponse;
import com.nutritrack.security.AuthenticatedUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.LocalDate;
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
@RequestMapping("/api/v1/workouts")
@Tag(name = "Workouts")
public class WorkoutController {
    private final WorkoutService service;

    public WorkoutController(WorkoutService service) {
        this.service = service;
    }

    @GetMapping
    public PageResponse<WorkoutResponse> list(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + PageParams.DEFAULT_SIZE) int size) {
        return service.list(user.id(), date, from, to, page, size);
    }

    @PostMapping
    public ResponseEntity<WorkoutResponse> create(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody WorkoutRequest request) {
        WorkoutResponse created = service.create(user.id(), request);
        return ResponseEntity.created(URI.create("/api/v1/workouts/" + created.id())).body(created);
    }

    @GetMapping("/{id}")
    public WorkoutResponse get(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        return service.get(user.id(), id);
    }

    @PutMapping("/{id}")
    public WorkoutResponse update(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id,
                                  @Valid @RequestBody WorkoutRequest request) {
        return service.update(user.id(), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        service.delete(user.id(), id);
        return ResponseEntity.noContent().build();
    }
}
