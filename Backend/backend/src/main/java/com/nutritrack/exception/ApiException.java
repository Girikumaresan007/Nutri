package com.nutritrack.exception;

import java.util.List;
import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final List<FieldIssue> fieldErrors;

    public ApiException(HttpStatus status, String code, String message, List<FieldIssue> fieldErrors) {
        super(message);
        this.status = status;
        this.code = code;
        this.fieldErrors = fieldErrors == null ? List.of() : fieldErrors;
    }

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, List.of());
    }

    public HttpStatus status() { return status; }
    public String code() { return code; }
    public List<FieldIssue> fieldErrors() { return fieldErrors; }

    public static ApiException validation(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Validation failed",
                List.of(new FieldIssue(field, message)));
    }
    public static ApiException badRequest(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }
    public static ApiException unauthorized(String code, String message) {
        return new ApiException(HttpStatus.UNAUTHORIZED, code, message);
    }
    public static ApiException forbidden(String code, String message) {
        return new ApiException(HttpStatus.FORBIDDEN, code, message);
    }
    /** Used for both "does not exist" and "belongs to someone else" so ownership is never revealed. */
    public static ApiException notFound(String code, String message) {
        return new ApiException(HttpStatus.NOT_FOUND, code, message);
    }
    public static ApiException conflict(String code, String message) {
        return new ApiException(HttpStatus.CONFLICT, code, message);
    }
    public static ApiException tooManyRequests() {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "Too many requests. Please try again later.");
    }
    public static ApiException unavailable(String code, String message) {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, code, message);
    }
}
