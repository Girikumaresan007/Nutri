package com.nutritrack.auth;

import com.nutritrack.exception.ApiException;
import com.nutritrack.security.AuthenticatedUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication")
public class AuthController {
    /** Cookie-authenticated endpoints require this header; browsers cannot add it cross-site without a CORS preflight. */
    public static final String CSRF_HEADER = "X-Requested-With";
    public static final String CSRF_VALUE = "NutriTrack";

    private final AuthService auth;
    private final RefreshCookieFactory cookies;

    public AuthController(AuthService auth, RefreshCookieFactory cookies) {
        this.auth = auth;
        this.cookies = cookies;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request, HttpServletRequest http) {
        AuthResult result = auth.register(request, http.getRemoteAddr());
        return withCookie(HttpStatus.CREATED, result);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        return withCookie(HttpStatus.OK, auth.login(request, http.getRemoteAddr()));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(HttpServletRequest http) {
        requireCsrfHeader(http);
        AuthResult result = auth.refresh(cookies.read(http).orElse(null), http.getRemoteAddr());
        return withCookie(HttpStatus.OK, result);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest http) {
        requireCsrfHeader(http);
        auth.logout(cookies.read(http).orElse(null));
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookies.clear().toString()).build();
    }

    @GetMapping("/me")
    public UserSummary me(@AuthenticationPrincipal AuthenticatedUser user) {
        return auth.me(user.id());
    }

    @PutMapping("/password")
    public ResponseEntity<Void> changePassword(@AuthenticationPrincipal AuthenticatedUser user,
                                               @Valid @RequestBody ChangePasswordRequest request) {
        auth.changePassword(user.id(), request);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookies.clear().toString()).build();
    }

    @DeleteMapping("/account")
    public ResponseEntity<Void> deleteAccount(@AuthenticationPrincipal AuthenticatedUser user,
                                              @Valid @RequestBody DeleteAccountRequest request) {
        auth.deleteAccount(user.id(), request);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookies.clear().toString()).build();
    }

    private ResponseEntity<AuthResponse> withCookie(HttpStatus status, AuthResult result) {
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, cookies.create(result.refreshToken()).toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(result.response());
    }

    private static void requireCsrfHeader(HttpServletRequest http) {
        if (!CSRF_VALUE.equals(http.getHeader(CSRF_HEADER))) {
            throw ApiException.forbidden("CSRF_HEADER_REQUIRED", "Missing required request header");
        }
    }
}
