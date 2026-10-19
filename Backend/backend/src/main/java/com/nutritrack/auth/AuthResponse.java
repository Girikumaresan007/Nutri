package com.nutritrack.auth;

public record AuthResponse(String accessToken, String tokenType, long expiresInSeconds, UserSummary user) {}
