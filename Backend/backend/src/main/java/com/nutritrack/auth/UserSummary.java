package com.nutritrack.auth;

import java.util.UUID;

public record UserSummary(UUID id, String email, String name) {}
