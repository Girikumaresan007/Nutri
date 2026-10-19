package com.nutritrack.auth;

import com.nutritrack.config.RefreshTokenProperties;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseCookie;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("RefreshCookieFactory Unit Tests")
class RefreshCookieFactoryTest {

    @Test
    @DisplayName("Production cross-site configuration sets SameSite=None, Secure, and Partitioned")
    void productionConfigurationGeneratesCrossSiteCookie() {
        RefreshTokenProperties prodProps = new RefreshTokenProperties(
                Duration.ofDays(14),
                "nt_refresh",
                true,
                "None",
                "/api/v1/auth",
                "",
                true
        );
        RefreshCookieFactory factory = new RefreshCookieFactory(prodProps);

        ResponseCookie cookie = factory.create("sample-refresh-token-value");
        String cookieHeader = cookie.toString();

        assertThat(cookie.getName()).isEqualTo("nt_refresh");
        assertThat(cookie.getValue()).isEqualTo("sample-refresh-token-value");
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.isSecure()).isTrue();
        assertThat(cookie.getSameSite()).isEqualTo("None");
        assertThat(cookie.getPath()).isEqualTo("/api/v1/auth");
        assertThat(cookie.getMaxAge()).isEqualTo(Duration.ofDays(14));
        assertThat(cookie.isPartitioned()).isTrue();

        // The serialized Set-Cookie header must contain the flags for cross-site browser delivery
        assertThat(cookieHeader).contains("HttpOnly");
        assertThat(cookieHeader).contains("Secure");
        assertThat(cookieHeader).contains("SameSite=None");
        assertThat(cookieHeader).contains("Partitioned");
    }

    @Test
    @DisplayName("Logout clear() sets Max-Age=0 with matching cross-site attributes")
    void clearSetsMaxAgeZeroWithMatchingAttributes() {
        RefreshTokenProperties prodProps = new RefreshTokenProperties(
                Duration.ofDays(14),
                "nt_refresh",
                true,
                "None",
                "/api/v1/auth",
                "",
                true
        );
        RefreshCookieFactory factory = new RefreshCookieFactory(prodProps);

        ResponseCookie clearCookie = factory.clear();
        String cookieHeader = clearCookie.toString();

        assertThat(clearCookie.getName()).isEqualTo("nt_refresh");
        assertThat(clearCookie.getValue()).isEmpty();
        assertThat(clearCookie.getMaxAge()).isEqualTo(Duration.ZERO);
        assertThat(clearCookie.isHttpOnly()).isTrue();
        assertThat(clearCookie.isSecure()).isTrue();
        assertThat(clearCookie.getSameSite()).isEqualTo("None");
        assertThat(clearCookie.getPath()).isEqualTo("/api/v1/auth");
        assertThat(cookieHeader).contains("Max-Age=0");
    }

    @Test
    @DisplayName("Development local configuration does not enforce Secure or Partitioned on plain HTTP")
    void devConfigurationForPlainHttpLocalhost() {
        RefreshTokenProperties devProps = new RefreshTokenProperties(
                Duration.ofDays(14),
                "nt_refresh",
                false,
                "Lax",
                "/api/v1/auth",
                "",
                false
        );
        RefreshCookieFactory factory = new RefreshCookieFactory(devProps);

        ResponseCookie cookie = factory.create("dev-token");
        String cookieHeader = cookie.toString();

        assertThat(cookie.isSecure()).isFalse();
        assertThat(cookie.getSameSite()).isEqualTo("Lax");
        assertThat(cookie.isPartitioned()).isFalse();
        assertThat(cookieHeader).doesNotContain("Partitioned");
    }

    @Test
    @DisplayName("read() extracts cookie when present and ignores blank or missing cookies")
    void readExtractsValidCookieOnly() {
        RefreshTokenProperties props = new RefreshTokenProperties(
                Duration.ofDays(14),
                "nt_refresh",
                true,
                "None",
                "/api/v1/auth",
                "",
                true
        );
        RefreshCookieFactory factory = new RefreshCookieFactory(props);

        // 1. Request with null cookies
        MockHttpServletRequest req1 = new MockHttpServletRequest();
        assertThat(factory.read(req1)).isEmpty();

        // 2. Request with matching cookie
        MockHttpServletRequest req2 = new MockHttpServletRequest();
        req2.setCookies(new Cookie("nt_refresh", "valid-token-123"));
        assertThat(factory.read(req2)).contains("valid-token-123");

        // 3. Request with blank cookie
        MockHttpServletRequest req3 = new MockHttpServletRequest();
        req3.setCookies(new Cookie("nt_refresh", "   "));
        assertThat(factory.read(req3)).isEmpty();

        // 4. Request with unrelated cookie
        MockHttpServletRequest req4 = new MockHttpServletRequest();
        req4.setCookies(new Cookie("other_cookie", "some-value"));
        assertThat(factory.read(req4)).isEmpty();
    }
}
