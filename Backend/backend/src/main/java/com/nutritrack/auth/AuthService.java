package com.nutritrack.auth;

import com.nutritrack.common.RateLimiter;
import com.nutritrack.config.RateLimitProperties;
import com.nutritrack.exception.ApiException;
import com.nutritrack.profile.ProfileRepository;
import com.nutritrack.profile.UserProfile;
import com.nutritrack.security.JwtService;
import com.nutritrack.user.User;
import com.nutritrack.user.UserRepository;
import java.util.Locale;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final UserRepository users;
    private final ProfileRepository profiles;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final RefreshTokenService refreshTokens;
    private final RateLimiter limiter;
    private final RateLimitProperties limits;
    /** Used to spend equal time on unknown emails so login timing does not reveal which emails exist. */
    private final String dummyHash;

    public AuthService(UserRepository users, ProfileRepository profiles, PasswordEncoder encoder, JwtService jwt,
                       RefreshTokenService refreshTokens, RateLimiter limiter, RateLimitProperties limits) {
        this.users = users;
        this.profiles = profiles;
        this.encoder = encoder;
        this.jwt = jwt;
        this.refreshTokens = refreshTokens;
        this.limiter = limiter;
        this.limits = limits;
        this.dummyHash = encoder.encode("dummy-password-for-timing");
    }

    @Transactional
    public AuthResult register(RegisterRequest req, String clientKey) {
        limiter.check("register:" + clientKey, limits.authAttempts(), limits.authWindow());
        String email = normalize(req.email());
        if (users.existsByEmail(email)) {
            throw emailTaken();
        }
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(encoder.encode(req.password()));
        try {
            users.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            throw emailTaken();
        }
        UserProfile profile = new UserProfile();
        profile.setUserId(user.getId());
        profile.setName(req.name().trim());
        profiles.save(profile);
        return issue(user, profile.getName());
    }

    @Transactional
    public AuthResult login(LoginRequest req, String clientKey) {
        String email = normalize(req.email());
        if (clientKey != null && !clientKey.isBlank()) {
            limiter.check("login:ip:" + clientKey, limits.authAttempts() * 5, limits.authWindow());
        }
        limiter.check("login:" + clientKey + ":" + email, limits.authAttempts(), limits.authWindow());
        User user = users.findByEmail(email).orElse(null);
        boolean ok = encoder.matches(req.password(), user != null ? user.getPasswordHash() : dummyHash);
        if (user == null || !ok) {
            throw ApiException.unauthorized("INVALID_CREDENTIALS", "Invalid email or password");
        }
        return issue(user, nameOf(user.getId()));
    }

    /** noRollbackFor keeps the reuse-detection revocation committed even though a 401 is thrown. */
    @Transactional(noRollbackFor = ApiException.class)
    public AuthResult refresh(String rawRefreshToken) {
        return refresh(rawRefreshToken, null);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public AuthResult refresh(String rawRefreshToken, String clientKey) {
        if (clientKey != null && !clientKey.isBlank()) {
            limiter.check("refresh:" + clientKey, limits.authAttempts() * 3, limits.authWindow());
        }
        RefreshTokenService.Rotation rotation = refreshTokens.rotate(rawRefreshToken, clientKey);
        User user = users.findById(rotation.userId())
                .orElseThrow(() -> ApiException.unauthorized("INVALID_REFRESH_TOKEN", "Session expired. Please sign in again."));
        return new AuthResult(response(user, nameOf(user.getId())), rotation.newToken());
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        refreshTokens.revoke(rawRefreshToken);
    }

    @Transactional(readOnly = true)
    public UserSummary me(UUID userId) {
        User user = users.findById(userId).orElseThrow(() -> ApiException.unauthorized("UNAUTHENTICATED", "Authentication required"));
        return new UserSummary(user.getId(), user.getEmail(), nameOf(userId));
    }

    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest req) {
        User user = users.findById(userId).orElseThrow(() -> ApiException.unauthorized("UNAUTHENTICATED", "Authentication required"));
        if (!encoder.matches(req.currentPassword(), user.getPasswordHash())) {
            throw ApiException.badRequest("INVALID_CURRENT_PASSWORD", "Current password is incorrect");
        }
        user.setPasswordHash(encoder.encode(req.newPassword()));
        refreshTokens.revokeAll(userId);   // every other session must sign in again
    }

    /** All user-owned rows are removed by ON DELETE CASCADE foreign keys. */
    @Transactional
    public void deleteAccount(UUID userId, DeleteAccountRequest req) {
        User user = users.findById(userId).orElseThrow(() -> ApiException.unauthorized("UNAUTHENTICATED", "Authentication required"));
        if (!encoder.matches(req.password(), user.getPasswordHash())) {
            throw ApiException.badRequest("INVALID_CURRENT_PASSWORD", "Password is incorrect");
        }
        users.delete(user);
    }

    private AuthResult issue(User user, String name) {
        return new AuthResult(response(user, name), refreshTokens.issue(user.getId()));
    }

    private AuthResponse response(User user, String name) {
        return new AuthResponse(jwt.generateAccessToken(user.getId(), user.getEmail()), "Bearer",
                jwt.accessTokenTtlSeconds(), new UserSummary(user.getId(), user.getEmail(), name));
    }

    private String nameOf(UUID userId) {
        return profiles.findByUserId(userId).map(UserProfile::getName).orElse("");
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static ApiException emailTaken() {
        return ApiException.conflict("EMAIL_ALREADY_REGISTERED", "An account with this email already exists");
    }
}
