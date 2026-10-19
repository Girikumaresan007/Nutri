package com.nutritrack.profile;

import com.nutritrack.common.DateRules;
import com.nutritrack.exception.ApiException;
import com.nutritrack.user.User;
import com.nutritrack.user.UserRepository;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfileService {
    private final ProfileRepository profiles;
    private final UserRepository users;
    private final Clock clock;

    public ProfileService(ProfileRepository profiles, UserRepository users, Clock clock) {
        this.profiles = profiles;
        this.users = users;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public ProfileResponse get(UUID userId) {
        return toResponse(requireProfile(userId), requireUser(userId));
    }

    @Transactional
    public ProfileResponse update(UUID userId, ProfileRequest r) {
        DateRules.requirePlausibleBirthDate(r.dateOfBirth(), clock, "dateOfBirth");
        UserProfile p = requireProfile(userId);
        p.setName(r.name().trim());
        p.setDateOfBirth(r.dateOfBirth());
        p.setHeightCm(r.heightCm());
        p.setCurrentWeightKg(r.currentWeightKg());
        p.setBiologicalSex(r.biologicalSex());
        p.setActivityLevel(r.activityLevel());
        p.setGoalType(r.goalType());
        p.setTargetWeightKg(r.targetWeightKg());
        p.setWeightUnit(r.weightUnit());
        p.setHeightUnit(r.heightUnit());
        p.setProfileUpdatedAt(clock.instant());
        return toResponse(profiles.save(p), requireUser(userId));
    }

    public UserProfile requireProfile(UUID userId) {
        return profiles.findByUserId(userId)
                .orElseThrow(() -> ApiException.notFound("PROFILE_NOT_FOUND", "Profile not found"));
    }

    private User requireUser(UUID userId) {
        return users.findById(userId).orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "User not found"));
    }

    private ProfileResponse toResponse(UserProfile p, User u) {
        Integer age = p.getDateOfBirth() == null ? null : DateRules.ageOn(p.getDateOfBirth(), DateRules.today(clock));
        return new ProfileResponse(p.getName(), u.getEmail(), p.getDateOfBirth(), age, p.getHeightCm(),
                p.getCurrentWeightKg(), p.getBiologicalSex(), p.getActivityLevel(), p.getGoalType(),
                p.getTargetWeightKg(), p.getWeightUnit(), p.getHeightUnit(), p.getProfileUpdatedAt());
    }
}
