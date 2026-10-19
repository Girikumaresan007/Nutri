package com.nutritrack.config;

import java.time.Duration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

import static org.assertj.core.api.Assertions.assertThat;

class RefreshTokenPropertiesBindingTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(TestConfig.class);

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(RefreshTokenProperties.class)
    static class TestConfig {
    }

    @Test
    @DisplayName("Should successfully bind production properties into RefreshTokenProperties bean")
    void shouldBindProductionProperties() {
        contextRunner
                .withPropertyValues(
                        "nutritrack.refresh-token.ttl=14d",
                        "nutritrack.refresh-token.cookie-name=nt_refresh",
                        "nutritrack.refresh-token.cookie-secure=true",
                        "nutritrack.refresh-token.cookie-same-site=None",
                        "nutritrack.refresh-token.cookie-path=/api/v1/auth",
                        "nutritrack.refresh-token.cookie-domain=",
                        "nutritrack.refresh-token.cookie-partitioned=true"
                )
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    RefreshTokenProperties props = context.getBean(RefreshTokenProperties.class);
                    assertThat(props).isNotNull();
                    assertThat(props.ttl()).isEqualTo(Duration.ofDays(14));
                    assertThat(props.cookieName()).isEqualTo("nt_refresh");
                    assertThat(props.cookieSecure()).isTrue();
                    assertThat(props.cookieSameSite()).isEqualTo("None");
                    assertThat(props.cookiePath()).isEqualTo("/api/v1/auth");
                    assertThat(props.cookieDomain()).isEmpty();
                    assertThat(props.cookiePartitioned()).isTrue();
                });
    }

    @Test
    @DisplayName("Should successfully bind development properties with Lax and plain HTTP")
    void shouldBindDevelopmentProperties() {
        contextRunner
                .withPropertyValues(
                        "nutritrack.refresh-token.ttl=7d",
                        "nutritrack.refresh-token.cookie-name=nt_refresh",
                        "nutritrack.refresh-token.cookie-secure=false",
                        "nutritrack.refresh-token.cookie-same-site=Lax",
                        "nutritrack.refresh-token.cookie-path=/api/v1/auth",
                        "nutritrack.refresh-token.cookie-domain=",
                        "nutritrack.refresh-token.cookie-partitioned=false"
                )
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    RefreshTokenProperties props = context.getBean(RefreshTokenProperties.class);
                    assertThat(props).isNotNull();
                    assertThat(props.cookieSecure()).isFalse();
                    assertThat(props.cookieSameSite()).isEqualTo("Lax");
                    assertThat(props.cookiePartitioned()).isFalse();
                });
    }

    @Test
    @DisplayName("Should fall back to default cookiePartitioned=true when property is omitted")
    void shouldDefaultCookiePartitionedToTrueWhenOmitted() {
        contextRunner
                .withPropertyValues(
                        "nutritrack.refresh-token.ttl=14d",
                        "nutritrack.refresh-token.cookie-name=nt_refresh",
                        "nutritrack.refresh-token.cookie-secure=true",
                        "nutritrack.refresh-token.cookie-same-site=None",
                        "nutritrack.refresh-token.cookie-path=/api/v1/auth",
                        "nutritrack.refresh-token.cookie-domain="
                )
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    RefreshTokenProperties props = context.getBean(RefreshTokenProperties.class);
                    assertThat(props).isNotNull();
                    assertThat(props.cookiePartitioned()).isTrue();
                });
    }
}
