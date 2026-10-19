package com.nutritrack.security;

import java.util.UUID;

/** The authenticated principal. Controllers receive this via @AuthenticationPrincipal; user ids are never read from request bodies. */
public record AuthenticatedUser(UUID id, String email) {}
