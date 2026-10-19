package com.nutritrack.exception;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;

/** Consistent error body. {@code error} is a stable machine-readable code; {@code message} is always safe to show. */
public record ApiError(
        Instant timestamp,
        int status,
        String error,
        String message,
        String path,
        @JsonInclude(JsonInclude.Include.NON_EMPTY) List<FieldIssue> fieldErrors) {

    public static ApiError of(HttpStatus status, String code, String message, String path, List<FieldIssue> issues) {
        return new ApiError(Instant.now(), status.value(), code, message, path, issues == null ? List.of() : issues);
    }
}
