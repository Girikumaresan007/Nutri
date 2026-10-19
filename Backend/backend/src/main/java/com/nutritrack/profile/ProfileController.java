package com.nutritrack.profile;

import com.nutritrack.security.AuthenticatedUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/profile")
@Tag(name = "Profile")
public class ProfileController {
    private final ProfileService service;

    public ProfileController(ProfileService service) {
        this.service = service;
    }

    @GetMapping
    public ProfileResponse get(@AuthenticationPrincipal AuthenticatedUser user) {
        return service.get(user.id());
    }

    @PutMapping
    public ProfileResponse update(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody ProfileRequest request) {
        return service.update(user.id(), request);
    }
}
