package com.nutritrack.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.nutritrack.exception.ApiException;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class RateLimiterTest {

    private RateLimiter limiter;

    @BeforeEach
    void setUp() {
        limiter = new RateLimiter();
    }

    @Test
    void allowsRequestsWithinLimit() {
        assertThatCode(() -> {
            limiter.check("test-key", 3, Duration.ofSeconds(10));
            limiter.check("test-key", 3, Duration.ofSeconds(10));
            limiter.check("test-key", 3, Duration.ofSeconds(10));
        }).doesNotThrowAnyException();
    }

    @Test
    void rejectsRequestsExceedingLimit() {
        limiter.check("test-key", 2, Duration.ofSeconds(10));
        limiter.check("test-key", 2, Duration.ofSeconds(10));

        assertThatThrownBy(() -> limiter.check("test-key", 2, Duration.ofSeconds(10)))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> {
                    ApiException apiEx = (ApiException) ex;
                    assertThat(apiEx.status()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                    assertThat(apiEx.code()).isEqualTo("RATE_LIMITED");
                });
    }

    @Test
    void isolatesDifferentKeys() {
        limiter.check("user-1", 1, Duration.ofSeconds(10));
        // user-2 should still be allowed even though user-1 hit limit
        assertThatCode(() -> limiter.check("user-2", 1, Duration.ofSeconds(10)))
                .doesNotThrowAnyException();
    }

    @Test
    void clearResetsBuckets() {
        limiter.check("test-key", 1, Duration.ofSeconds(10));
        assertThatThrownBy(() -> limiter.check("test-key", 1, Duration.ofSeconds(10)))
                .isInstanceOf(ApiException.class);

        limiter.clear();

        assertThatCode(() -> limiter.check("test-key", 1, Duration.ofSeconds(10)))
                .doesNotThrowAnyException();
    }
}
