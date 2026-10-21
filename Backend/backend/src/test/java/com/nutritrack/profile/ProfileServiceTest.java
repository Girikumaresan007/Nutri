package com.nutritrack.profile;

import com.nutritrack.common.ActivityLevel;
import com.nutritrack.common.BiologicalSex;
import com.nutritrack.common.GoalType;
import com.nutritrack.common.HeightUnit;
import com.nutritrack.common.WeightUnit;
import com.nutritrack.exception.ApiException;
import com.nutritrack.user.User;
import com.nutritrack.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("ProfileService Unit Tests")
class ProfileServiceTest {

    private ProfileRepository profiles;
    private UserRepository users;
    private Clock clock;
    private ProfileService service;
    private final Instant now = Instant.parse("2026-10-21T10:00:00Z");

    @BeforeEach
    void setUp() {
        profiles = mock(ProfileRepository.class);
        users = mock(UserRepository.class);
        clock = Clock.fixed(now, ZoneId.of("UTC"));
        service = new ProfileService(profiles, users, clock);
    }

    @Test
    @DisplayName("get() returns profile response with calculated age and user email")
    void getReturnsProfileWithCalculatedAge() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setEmail("ann@example.com");

        UserProfile profile = new UserProfile();
        profile.setUserId(userId);
        profile.setName("Ann Lee");
        profile.setDateOfBirth(LocalDate.of(1996, 5, 15));
        profile.setHeightCm(new BigDecimal("168.00"));
        profile.setCurrentWeightKg(new BigDecimal("62.50"));
        profile.setBiologicalSex(BiologicalSex.FEMALE);
        profile.setActivityLevel(ActivityLevel.MODERATE);
        profile.setGoalType(GoalType.MAINTAIN);
        profile.setTargetWeightKg(new BigDecimal("62.00"));
        profile.setWeightUnit(WeightUnit.KG);
        profile.setHeightUnit(HeightUnit.CM);

        when(profiles.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(users.findById(userId)).thenReturn(Optional.of(user));

        ProfileResponse res = service.get(userId);

        assertThat(res.name()).isEqualTo("Ann Lee");
        assertThat(res.email()).isEqualTo("ann@example.com");
        assertThat(res.age()).isEqualTo(30);
        assertThat(res.heightCm()).isEqualByComparingTo("168.00");
        assertThat(res.currentWeightKg()).isEqualByComparingTo("62.50");
    }

    @Test
    @DisplayName("update() updates user name, metrics, and timestamps, returning updated response")
    void updatePersistsChangesAndReturnsUpdatedProfile() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setEmail("ann@example.com");

        UserProfile existing = new UserProfile();
        existing.setUserId(userId);
        existing.setName("Old Name");
        existing.setDateOfBirth(LocalDate.of(1995, 1, 1));

        when(profiles.findByUserId(userId)).thenReturn(Optional.of(existing));
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(profiles.save(any(UserProfile.class))).thenAnswer(inv -> inv.getArgument(0));

        ProfileRequest req = new ProfileRequest(
                "New Synchronized Name",
                LocalDate.of(1996, 6, 20),
                new BigDecimal("172.50"),
                new BigDecimal("68.00"),
                BiologicalSex.FEMALE,
                ActivityLevel.ACTIVE,
                GoalType.LOSE_WEIGHT,
                new BigDecimal("65.00"),
                WeightUnit.KG,
                HeightUnit.CM
        );

        ProfileResponse res = service.update(userId, req);

        assertThat(res.name()).isEqualTo("New Synchronized Name");
        assertThat(res.email()).isEqualTo("ann@example.com");
        assertThat(res.profileUpdatedAt()).isEqualTo(now);
        assertThat(res.currentWeightKg()).isEqualByComparingTo("68.00");
        assertThat(res.targetWeightKg()).isEqualByComparingTo("65.00");

        ArgumentCaptor<UserProfile> captor = ArgumentCaptor.forClass(UserProfile.class);
        verify(profiles).save(captor.capture());
        UserProfile saved = captor.getValue();
        assertThat(saved.getName()).isEqualTo("New Synchronized Name");
        assertThat(saved.getProfileUpdatedAt()).isEqualTo(now);
    }

    @Test
    @DisplayName("update() with future dateOfBirth throws ApiException")
    void updateWithFutureBirthDateFails() {
        UUID userId = UUID.randomUUID();
        ProfileRequest req = new ProfileRequest(
                "Test User",
                LocalDate.of(2027, 1, 1),
                new BigDecimal("170.00"),
                new BigDecimal("70.00"),
                BiologicalSex.MALE,
                ActivityLevel.SEDENTARY,
                GoalType.MAINTAIN,
                new BigDecimal("70.00"),
                WeightUnit.KG,
                HeightUnit.CM
        );

        assertThatThrownBy(() -> service.update(userId, req))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Validation failed");
    }

    @Test
    @DisplayName("get() throws PROFILE_NOT_FOUND when user profile does not exist")
    void getThrowsWhenNotFound() {
        UUID userId = UUID.randomUUID();
        when(profiles.findByUserId(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(userId))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Profile not found");
    }
}
