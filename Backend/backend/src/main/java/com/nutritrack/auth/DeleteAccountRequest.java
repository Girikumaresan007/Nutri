package com.nutritrack.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DeleteAccountRequest(@NotBlank @Size(max = 128) String password) {}
