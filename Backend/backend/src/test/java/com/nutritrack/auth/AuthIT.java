package com.nutritrack.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.nutritrack.IntegrationTestBase;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

class AuthIT extends IntegrationTestBase {

    @Test
    void registerStoresBcryptHashOnlyAndSetsHttpOnlyRefreshCookie() throws Exception {
        String email = uniqueEmail();
        MvcResult r = mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "Ann", "email", email.toUpperCase(), "password", PASSWORD))))
                .andExpect(status().isCreated())
                .andExpect(header().string("Set-Cookie", containsString("HttpOnly")))
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.user.email").value(email))   // normalised to lower-case
                .andReturn();
        String hash = jdbc.queryForObject("select password_hash from users where email = ?", String.class, email);
        assertThat(hash).startsWith("$2").isNotEqualTo(PASSWORD);
        assertThat(r.getResponse().getContentAsString()).doesNotContain("password");
    }

    @Test
    void duplicateEmailIs409() throws Exception {
        String email = uniqueEmail();
        registerUser(email);
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "B", "email", email, "password", PASSWORD))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("EMAIL_ALREADY_REGISTERED"));
    }

    @Test
    void weakPasswordAndBadEmailReturnFieldErrors() throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "B", "email", "not-an-email", "password", "short"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors").isNotEmpty())
                .andExpect(jsonPath("$.path").value("/api/v1/auth/register"))
                .andExpect(jsonPath("$.timestamp").isNotEmpty());
    }

    @Test
    void loginSucceedsAndFailsGenerically() throws Exception {
        String email = uniqueEmail();
        registerUser(email);
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.tokenType").value("Bearer"));
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", "WrongPassw0rd"))))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error").value("INVALID_CREDENTIALS"));
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", "nobody@example.com", "password", PASSWORD))))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error").value("INVALID_CREDENTIALS"));
    }

    @Test
    void protectedEndpointsReturnConsistent401() throws Exception {
        mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
        mvc.perform(get("/api/v1/food-entries?date=2025-03-01").header("Authorization", "Bearer garbage"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void meReturnsCurrentUser() throws Exception {
        String email = uniqueEmail();
        String token = registerUser(email);
        getAs(token, "/api/v1/auth/me").andExpect(status().isOk()).andExpect(jsonPath("$.email").value(email));
    }

    @Test
    void refreshRequiresHeaderRotatesAndDetectsReuse() throws Exception {
        String email = uniqueEmail();
        MvcResult reg = mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "R", "email", email, "password", PASSWORD))))
                .andExpect(status().isCreated()).andReturn();
        Cookie first = reg.getResponse().getCookie("nt_refresh");
        assertThat(first).isNotNull();

        mvc.perform(post("/api/v1/auth/refresh").cookie(first)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("CSRF_HEADER_REQUIRED"));

        MvcResult ok = mvc.perform(post("/api/v1/auth/refresh").cookie(first).header("X-Requested-With", "NutriTrack"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.accessToken").isNotEmpty()).andReturn();
        Cookie second = ok.getResponse().getCookie("nt_refresh");
        assertThat(second.getValue()).isNotEqualTo(first.getValue());

        // The old token was rotated: presenting it again must fail.
        mvc.perform(post("/api/v1/auth/refresh").cookie(first).header("X-Requested-With", "NutriTrack"))
                .andExpect(status().isUnauthorized());
        // Raw tokens are never stored.
        Integer raw = jdbc.queryForObject("select count(*) from refresh_tokens where token_hash = ?", Integer.class, second.getValue());
        assertThat(raw).isZero();
    }

    @Test
    void logoutRevokesRefreshToken() throws Exception {
        MvcResult reg = mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "L", "email", uniqueEmail(), "password", PASSWORD))))
                .andReturn();
        Cookie c = reg.getResponse().getCookie("nt_refresh");
        mvc.perform(post("/api/v1/auth/logout").cookie(c).header("X-Requested-With", "NutriTrack"))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/v1/auth/refresh").cookie(c).header("X-Requested-With", "NutriTrack"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void changePasswordThenOldPasswordFails() throws Exception {
        String email = uniqueEmail();
        String token = registerUser(email);
        putAs(token, "/api/v1/auth/password", Map.of("currentPassword", PASSWORD, "newPassword", "NewPassw0rd99"))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", PASSWORD)))).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", "NewPassw0rd99")))).andExpect(status().isOk());
    }

    @Test
    void deleteAccountRemovesUserAndAllOwnedData() throws Exception {
        String email = uniqueEmail();
        String token = registerUser(email);
        postAs(token, "/api/v1/food-entries", foodEntry("2025-03-01", "lunch", "Rice", 130, 2.7, 28, 0.3, 0.4)).andExpect(status().isCreated());
        mvc.perform(delete("/api/v1/auth/account").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("password", PASSWORD))))
                .andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("select count(*) from users where email = ?", Integer.class, email)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from food_entries f where not exists (select 1 from users u where u.id = f.user_id)", Integer.class)).isZero();
        getAs(token, "/api/v1/auth/me").andExpect(status().isUnauthorized());
    }
}
