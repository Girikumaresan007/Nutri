package com.nutritrack;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.containers.PostgreSQLContainer;

/** Real PostgreSQL via Testcontainers (requires Docker). One shared container for the whole test run. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class IntegrationTestBase {
    static final PostgreSQLContainer<?> PG = new PostgreSQLContainer<>("postgres:16-alpine");

    static {
        PG.start();
    }

    @DynamicPropertySource
    static void dbProps(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", PG::getJdbcUrl);
        r.add("spring.datasource.username", PG::getUsername);
        r.add("spring.datasource.password", PG::getPassword);
    }

    @Autowired protected MockMvc mvc;
    @Autowired protected ObjectMapper json;
    @Autowired protected JdbcTemplate jdbc;

    protected static final String PASSWORD = "Passw0rdTest1";

    protected String uniqueEmail() {
        return "user-" + UUID.randomUUID() + "@example.com";
    }

    /** Registers a fresh user and returns its access token. */
    protected String registerUser() throws Exception {
        return registerUser(uniqueEmail());
    }

    protected String registerUser(String email) throws Exception {
        MvcResult r = mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "Test User", "email", email, "password", PASSWORD))))
                .andExpect(status().isCreated()).andReturn();
        return body(r).get("accessToken").asText();
    }

    protected JsonNode body(MvcResult r) throws Exception {
        return json.readTree(r.getResponse().getContentAsString());
    }

    protected ResultActions getAs(String token, String url) throws Exception {
        return mvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, "Bearer " + token));
    }

    protected ResultActions postAs(String token, String url, Object payload) throws Exception {
        return mvc.perform(post(url).header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(payload)));
    }

    protected ResultActions putAs(String token, String url, Object payload) throws Exception {
        return mvc.perform(put(url).header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(payload)));
    }

    protected ResultActions deleteAs(String token, String url) throws Exception {
        return mvc.perform(delete(url).header(HttpHeaders.AUTHORIZATION, "Bearer " + token));
    }

    protected Map<String, Object> foodEntry(String date, String meal, String name, double cal, double p, double c, double f, double fiber) {
        return Map.of("date", date, "meal", meal, "name", name, "quantity", 100, "unit", "g",
                "nutrition", Map.of("calories", cal, "protein", p, "carbohydrates", c, "fat", f, "fiber", fiber),
                "source", "manual");
    }

    protected Map<String, Object> goal(String effectiveFrom, int calories) {
        return Map.of("effectiveFrom", effectiveFrom, "goalType", "maintain", "dailyCalories", calories,
                "protein", 120, "carbohydrates", 250, "fat", 70, "fiber", 30);
    }
}
