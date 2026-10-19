package com.nutritrack.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.nutritrack.auth.AuthResult;
import com.nutritrack.auth.AuthService;
import com.nutritrack.auth.LoginRequest;
import com.nutritrack.auth.RefreshTokenService;
import com.nutritrack.common.RateLimiter;
import com.nutritrack.config.JwtProperties;
import com.nutritrack.config.RateLimitProperties;
import com.nutritrack.config.ScannerProperties;
import com.nutritrack.exception.ApiError;
import com.nutritrack.exception.ApiException;
import com.nutritrack.exception.FieldIssue;
import com.nutritrack.food.FoodEntryMapper;
import com.nutritrack.food.FoodEntryRepository;
import com.nutritrack.food.FoodEntryService;
import com.nutritrack.goals.GoalRepository;
import com.nutritrack.goals.GoalService;
import com.nutritrack.profile.ProfileRepository;
import com.nutritrack.scanner.ImageValidator;
import com.nutritrack.user.UserRepository;
import com.nutritrack.weight.WeightLogRepository;
import com.nutritrack.weight.WeightService;
import com.nutritrack.workouts.WorkoutRepository;
import com.nutritrack.workouts.WorkoutService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.util.unit.DataSize;

@DisplayName("Stage 18: Security, Reliability & Performance Audit Tests")
class SecurityAuditTest {

    private static final String SECRET = "this-is-a-test-secret-key-of-sufficient-length-32-bytes!";
    private Clock fixedClock;
    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        fixedClock = Clock.fixed(Instant.parse("2026-10-16T10:00:00Z"), ZoneOffset.UTC);
        jwtService = new JwtService(new JwtProperties(SECRET, Duration.ofMinutes(15), "nutritrack-ai"), fixedClock);
    }

    @Nested
    @DisplayName("1. Authentication, JWT & Session Security")
    class AuthenticationSecurityTests {

        @Test
        @DisplayName("Valid JWT resolves correct AuthenticatedUser claims")
        void validJwtResolvesClaims() {
            UUID userId = UUID.randomUUID();
            String token = jwtService.generateAccessToken(userId, "test@example.com");

            Optional<AuthenticatedUser> parsed = jwtService.parse(token);
            assertThat(parsed).isPresent();
            assertThat(parsed.get().id()).isEqualTo(userId);
            assertThat(parsed.get().email()).isEqualTo("test@example.com");
        }

        @Test
        @DisplayName("Expired JWT is safely rejected")
        void expiredJwtIsRejected() {
            UUID userId = UUID.randomUUID();
            String token = jwtService.generateAccessToken(userId, "test@example.com");

            // Move clock 20 minutes forward (TTL is 15 minutes)
            Clock futureClock = Clock.fixed(Instant.parse("2026-10-16T10:20:00Z"), ZoneOffset.UTC);
            JwtService futureJwt = new JwtService(new JwtProperties(SECRET, Duration.ofMinutes(15), "nutritrack-ai"), futureClock);

            Optional<AuthenticatedUser> parsed = futureJwt.parse(token);
            assertThat(parsed).isEmpty();
        }

        @Test
        @DisplayName("Tampered JWT signature is rejected")
        void tamperedJwtIsRejected() {
            UUID userId = UUID.randomUUID();
            String token = jwtService.generateAccessToken(userId, "test@example.com");
            String tampered = token.substring(0, token.length() - 5) + "ABCDE";

            Optional<AuthenticatedUser> parsed = jwtService.parse(tampered);
            assertThat(parsed).isEmpty();
        }

        @Test
        @DisplayName("Token with foreign/unexpected issuer is rejected")
        void tokenWithForeignIssuerIsRejected() {
            JwtService rogueJwt = new JwtService(new JwtProperties(SECRET, Duration.ofMinutes(15), "attacker-issuer"), fixedClock);
            String rogueToken = rogueJwt.generateAccessToken(UUID.randomUUID(), "hacker@example.com");

            Optional<AuthenticatedUser> parsed = jwtService.parse(rogueToken);
            assertThat(parsed).isEmpty();
        }

        @Test
        @DisplayName("Malformed and non-JWT strings fail safely without exceptions")
        void malformedTokensFailSafely() {
            assertThat(jwtService.parse("not.a.valid.jwt")).isEmpty();
            assertThat(jwtService.parse("")).isEmpty();
            assertThat(jwtService.parse("   ")).isEmpty();
            assertThat(jwtService.parse("Bearer eyJhbGciOiJIUzI1NiJ9.abc.xyz")).isEmpty();
        }
    }

    @Nested
    @DisplayName("2. Image Upload, Validation & Privacy Audit")
    class ImageUploadPrivacyTests {

        private ImageValidator validator;

        @BeforeEach
        void initValidator() {
            ScannerProperties props = mock(ScannerProperties.class);
            when(props.maxFileSize()).thenReturn(DataSize.ofMegabytes(10));
            validator = new ImageValidator(props);
        }

        @Test
        @DisplayName("Valid JPEG image magic bytes (FF D8 FF) are accepted")
        void validJpegAccepted() {
            byte[] jpegBytes = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0x00, 0x10};
            MockMultipartFile file = new MockMultipartFile("file", "test.jpg", "image/jpeg", jpegBytes);

            assertThat(validator.validate(file).mimeType()).isEqualTo("image/jpeg");
        }

        @Test
        @DisplayName("Valid PNG image magic bytes (89 50 4E 47 0D 0A 1A 0A) are accepted")
        void validPngAccepted() {
            byte[] pngBytes = new byte[]{(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0x00};
            MockMultipartFile file = new MockMultipartFile("file", "test.png", "image/png", pngBytes);

            assertThat(validator.validate(file).mimeType()).isEqualTo("image/png");
        }

        @Test
        @DisplayName("Executable file disguised as JPG is detected and rejected")
        void executableRenamedToJpgRejected() {
            // MZ header (Windows executable) disguised as image/jpeg
            byte[] exeBytes = new byte[]{'M', 'Z', (byte) 0x90, 0x00, 0x03, 0x00};
            MockMultipartFile file = new MockMultipartFile("file", "exploit.jpg", "image/jpeg", exeBytes);

            assertThatThrownBy(() -> validator.validate(file))
                    .isInstanceOf(ApiException.class)
                    .satisfies(ex -> assertThat(((ApiException) ex).code()).isEqualTo("INVALID_IMAGE"));
        }

        @Test
        @DisplayName("Empty file is rejected")
        void emptyFileRejected() {
            MockMultipartFile file = new MockMultipartFile("file", "empty.jpg", "image/jpeg", new byte[0]);

            assertThatThrownBy(() -> validator.validate(file))
                    .isInstanceOf(ApiException.class)
                    .satisfies(ex -> assertThat(((ApiException) ex).code()).isEqualTo("EMPTY_FILE"));
        }

        @Test
        @DisplayName("File exceeding 10MB limit is rejected with PAYLOAD_TOO_LARGE")
        void oversizedFileRejected() {
            byte[] largeBytes = new byte[11 * 1024 * 1024]; // 11MB
            largeBytes[0] = (byte) 0xFF;
            largeBytes[1] = (byte) 0xD8;
            largeBytes[2] = (byte) 0xFF;
            MockMultipartFile file = new MockMultipartFile("file", "huge.jpg", "image/jpeg", largeBytes);

            assertThatThrownBy(() -> validator.validate(file))
                    .isInstanceOf(ApiException.class)
                    .satisfies(ex -> {
                        ApiException apiEx = (ApiException) ex;
                        assertThat(apiEx.status()).isEqualTo(HttpStatus.PAYLOAD_TOO_LARGE);
                        assertThat(apiEx.code()).isEqualTo("PAYLOAD_TOO_LARGE");
                    });
        }
    }

    @Nested
    @DisplayName("3. Data Isolation & Authorization Ownership Checks")
    class DataIsolationTests {

        @Test
        @DisplayName("Accessing another user's food entry returns 404 (ID enumeration resistance)")
        void crossUserFoodEntryReturns404() {
            FoodEntryRepository repo = mock(FoodEntryRepository.class);
            FoodEntryMapper mapper = mock(FoodEntryMapper.class);
            FoodEntryService service = new FoodEntryService(repo, mapper, Clock.systemUTC());

            UUID userA = UUID.randomUUID();
            UUID userBEntryId = UUID.randomUUID();

            when(repo.findByIdAndUserId(userBEntryId, userA)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.get(userA, userBEntryId))
                    .isInstanceOf(ApiException.class)
                    .satisfies(ex -> {
                        ApiException apiEx = (ApiException) ex;
                        assertThat(apiEx.status()).isEqualTo(HttpStatus.NOT_FOUND);
                        assertThat(apiEx.code()).isEqualTo("FOOD_ENTRY_NOT_FOUND");
                    });
        }

        @Test
        @DisplayName("Accessing another user's workout session returns 404")
        void crossUserWorkoutReturns404() {
            WorkoutRepository repo = mock(WorkoutRepository.class);
            WorkoutService service = new WorkoutService(repo, Clock.systemUTC());

            UUID userA = UUID.randomUUID();
            UUID otherWorkoutId = UUID.randomUUID();

            when(repo.findByIdAndUserId(otherWorkoutId, userA)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.get(userA, otherWorkoutId))
                    .isInstanceOf(ApiException.class)
                    .satisfies(ex -> assertThat(((ApiException) ex).status()).isEqualTo(HttpStatus.NOT_FOUND));
        }

        @Test
        @DisplayName("Accessing another user's goal returns 404")
        void crossUserGoalReturns404() {
            GoalRepository repo = mock(GoalRepository.class);
            GoalService service = new GoalService(repo, mock(FoodEntryRepository.class), Clock.systemUTC());

            UUID userA = UUID.randomUUID();
            UUID otherGoalId = UUID.randomUUID();

            when(repo.findByIdAndUserId(otherGoalId, userA)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.get(userA, otherGoalId))
                    .isInstanceOf(ApiException.class)
                    .satisfies(ex -> assertThat(((ApiException) ex).status()).isEqualTo(HttpStatus.NOT_FOUND));
        }
    }

    @Nested
    @DisplayName("4. Rate Limiting Protection on Sensitive Endpoints")
    class RateLimitingTests {

        @Test
        @DisplayName("Brute-force login attempts trigger rate limiting")
        void bruteForceLoginRateLimited() {
            UserRepository users = mock(UserRepository.class);
            ProfileRepository profiles = mock(ProfileRepository.class);
            RefreshTokenService refreshTokens = mock(RefreshTokenService.class);
            RateLimiter limiter = new RateLimiter();
            RateLimitProperties limits = new RateLimitProperties(3, Duration.ofSeconds(10), 5, Duration.ofSeconds(10));

            AuthService auth = new AuthService(users, profiles, new BCryptPasswordEncoder(), jwtService, refreshTokens, limiter, limits);

            LoginRequest req = new LoginRequest("victim@example.com", "wrong-password-1");

            // First 3 attempts permitted (limit is 3)
            for (int i = 0; i < 3; i++) {
                try {
                    auth.login(req, "192.168.1.100");
                } catch (ApiException e) {
                    assertThat(e.code()).isEqualTo("INVALID_CREDENTIALS");
                }
            }

            // 4th attempt must be RATE_LIMITED (HTTP 429)
            assertThatThrownBy(() -> auth.login(req, "192.168.1.100"))
                    .isInstanceOf(ApiException.class)
                    .satisfies(ex -> {
                        ApiException apiEx = (ApiException) ex;
                        assertThat(apiEx.status()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                        assertThat(apiEx.code()).isEqualTo("RATE_LIMITED");
                    });
        }

        @Test
        @DisplayName("Repeated refresh requests trigger rate limiting")
        void repeatedRefreshRateLimited() {
            UserRepository users = mock(UserRepository.class);
            ProfileRepository profiles = mock(ProfileRepository.class);
            RefreshTokenService refreshTokens = mock(RefreshTokenService.class);
            RateLimiter limiter = new RateLimiter();
            RateLimitProperties limits = new RateLimitProperties(2, Duration.ofSeconds(10), 5, Duration.ofSeconds(10));

            AuthService auth = new AuthService(users, profiles, new BCryptPasswordEncoder(), jwtService, refreshTokens, limiter, limits);

            // First 2 * 3 = 6 attempts permitted
            for (int i = 0; i < 6; i++) {
                try {
                    auth.refresh("some-token", "192.168.1.50");
                } catch (Exception ignored) {}
            }

            // Next attempt must be rate limited
            assertThatThrownBy(() -> auth.refresh("some-token", "192.168.1.50"))
                    .isInstanceOf(ApiException.class)
                    .satisfies(ex -> assertThat(((ApiException) ex).status()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS));
        }
    }

    @Nested
    @DisplayName("5. Standardized Error Response Contract")
    class ApiErrorContractTests {

        @Test
        @DisplayName("ApiError satisfies required contract: timestamp, status, error, message, path, fieldErrors")
        void apiErrorConformsToContract() {
            List<FieldIssue> fieldIssues = List.of(new FieldIssue("email", "must be a well-formed email address"));
            ApiError err = ApiError.of(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Validation failed", "/api/v1/auth/register", fieldIssues);

            assertThat(err.timestamp()).isNotNull();
            assertThat(err.status()).isEqualTo(400);
            assertThat(err.error()).isEqualTo("VALIDATION_FAILED");
            assertThat(err.message()).isEqualTo("Validation failed");
            assertThat(err.path()).isEqualTo("/api/v1/auth/register");
            assertThat(err.fieldErrors()).hasSize(1);
            assertThat(err.fieldErrors().get(0).field()).isEqualTo("email");
        }
    }
}
