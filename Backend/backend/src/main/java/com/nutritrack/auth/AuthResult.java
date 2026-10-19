package com.nutritrack.auth;

/** Service-level result: the JSON body plus the refresh token that the controller puts in an HttpOnly cookie. */
public record AuthResult(AuthResponse response, String refreshToken) {}
