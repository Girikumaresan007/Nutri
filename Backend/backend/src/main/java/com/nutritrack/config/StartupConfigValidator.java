package com.nutritrack.config;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** Fails startup in production when secrets or transport settings are missing or insecure. */
@Component
@Profile("prod")
public class StartupConfigValidator {

    public StartupConfigValidator(JwtProperties jwt, RefreshTokenProperties refresh, CorsProperties cors,
                                  ScannerProperties scanner,
                                  @Value("${spring.datasource.password:}") String dbPassword) {
        String secret = jwt.secret() == null ? "" : jwt.secret();
        String lower = secret.toLowerCase(Locale.ROOT);
        if (secret.getBytes(StandardCharsets.UTF_8).length < 48 || lower.contains("change-me")
                || lower.contains("dev-only") || lower.contains("secret-secret")) {
            throw new IllegalStateException("JWT_SECRET must be a random value of at least 48 characters in prod");
        }
        if (!refresh.cookieSecure()) {
            throw new IllegalStateException("REFRESH_COOKIE_SECURE must be true in prod");
        }
        if (cors.allowedOrigins() == null || cors.allowedOrigins().isEmpty()
                || cors.allowedOrigins().stream().anyMatch(o -> !o.startsWith("https://"))) {
            throw new IllegalStateException("CORS_ALLOWED_ORIGINS must list explicit https:// origins in prod");
        }
        if (dbPassword.isBlank() || dbPassword.equalsIgnoreCase("nutritrack") || dbPassword.equalsIgnoreCase("change-me")) {
            throw new IllegalStateException("DB_PASSWORD must be set to a non-default value in prod");
        }
        String provider = scanner.provider() == null ? "none" : scanner.provider();
        if (provider.equalsIgnoreCase("mock")) {
            throw new IllegalStateException("The mock scanner provider is development-only and cannot run in prod");
        }
        if (provider.equalsIgnoreCase("anthropic")
                && (scanner.anthropic().apiKey() == null || scanner.anthropic().apiKey().isBlank())) {
            throw new IllegalStateException("AI_API_KEY is required when SCANNER_PROVIDER=anthropic");
        }
    }
}
