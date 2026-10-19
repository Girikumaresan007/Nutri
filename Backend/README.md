# NutriTrack AI — Backend (Java 17 · Spring Boot 3.5 · PostgreSQL)

```
nutritrack/
  backend/               Spring Boot service (this is the deliverable)
  docs/API_CONTRACT.md   Endpoint + JSON contract, assumptions about the frontend
  frontend-integration/  Drop-in typed REST client + wiring notes for the React app
```

## Verification status (read first)

This project was produced **without access to Maven, the network, or your frontend source**. What was and was not checked:

| Item | Status |
|---|---|
| All 140 Java files parse (syntax) | Checked |
| `mvn clean verify` (compile + unit + Testcontainers tests) | **Not run.** Run it first; expect to fix a few compile or test issues. |
| Frontend inspection (`src/types`, `repository.ts`, pages…) | **Not done.** Not uploaded. Enum values/JSON shapes are inferred from your spec (see `docs/API_CONTRACT.md` §Assumptions). |
| Frontend wiring (`repository.ts`, `AppContext.tsx`) | **Not done.** A typed client is provided in `frontend-integration/` with instructions. |
| Real AI provider call | Not exercised. `AnthropicFoodVisionProvider` is written to the Messages API but untested against the live API. |

Spring Boot `3.5.6`, springdoc `2.8.13`, jjwt `0.12.6` are pinned; confirm they are still current/compatible when you build.

## Requirements
Java 17+ (JDK), Maven 3.9+, PostgreSQL 14+ (or Docker), Docker (only for the integration tests).

## Quick start (local)
```bash
cd backend
docker compose up -d                      # PostgreSQL 16 on :5432 (db/user/password: nutritrack)
mvn spring-boot:run                       # profile "dev" is the default
```
Flyway creates the schema on startup (`src/main/resources/db/migration`). Hibernate only *validates* it (`ddl-auto=validate`).

* Health: `http://localhost:8080/actuator/health`
* Swagger UI (dev only): `http://localhost:8080/swagger-ui.html` → register, copy `accessToken`, click **Authorize**.

Frontend: set `VITE_API_BASE_URL=http://localhost:8080/api/v1` in the frontend `.env`, then `npm run dev` (origin `http://localhost:5173` is CORS-allowed in dev).

## Environment variables
See `backend/.env.example` (all documented). Required in prod: `DB_URL, DB_USERNAME, DB_PASSWORD, JWT_SECRET (>=48 random chars), CORS_ALLOWED_ORIGINS (https only)`. In prod the app **refuses to start** if the JWT secret is short/placeholder, cookies are not `Secure`, CORS is not explicit https, the DB password is a default, or the mock scanner is selected. Secrets are never `VITE_` variables.

## Authentication flow
1. `POST /auth/register` or `/auth/login` → JSON `{accessToken, tokenType, expiresInSeconds, user}` (15-min JWT, kept **in memory** by the SPA) + an **HttpOnly, Secure(in prod), SameSite** `nt_refresh` cookie scoped to `/api/v1/auth`.
2. Send `Authorization: Bearer <accessToken>` on every other call.
3. On 401, `POST /auth/refresh` (cookie + header `X-Requested-With: NutriTrack`) → new access token; the refresh token is **rotated**. Presenting an already-rotated token (outside a 10 s grace for concurrent tabs) revokes all of that user's sessions.
4. `POST /auth/logout` revokes the refresh token. `PUT /auth/password` revokes all sessions. `DELETE /auth/account` (body `{password}`) removes the user and all data via `ON DELETE CASCADE`.

Refresh tokens are random opaque values stored only as SHA-256 hashes. Nothing long-lived is placed in localStorage. CSRF: the API is bearer-token based (CSRF disabled for it); the two cookie-authenticated endpoints require the custom header above, SameSite, and an explicit CORS allow-list. If SPA and API are on different *sites*, set `REFRESH_COOKIE_SAMESITE=None` (requires Secure/HTTPS).

User id always comes from the JWT principal. Records of other users return **404** (indistinguishable from non-existent).

## Policies
* **Timezone**: audit timestamps are UTC `timestamptz`. Diary/goal/weight/workout dates are plain ISO `YYYY-MM-DD` and are never shifted, so the day the user picked is the day stored. Server validation allows dates up to *UTC today + 1 day* so users east of UTC can log their own "today". Age is derived from date of birth at request time (UTC date).
* **Calories**: Mifflin-St Jeor (`10·kg + 6.25·cm − 5·age + s`, s = +5 male, −161 female, **−78 unspecified** = midpoint) × activity multiplier (1.2 / 1.375 / 1.55 / 1.725 / 1.9). Goal adjustments (−500 / 0 / +300 / +250 kcal, minimum 1200) and macro ratios are configurable (`nutritrack.nutrition.*`). Exercise calories are **never** added to the food target; workouts are reported separately as estimates.
* **Goals**: a goal applies from `effectiveFrom` until the next goal starts. One goal per date (unique). A new goal must start after the newest existing one, so history is never rewritten. `effectiveFrom` is immutable (PUT corrects values). A goal governing days with logged food cannot be deleted (409).
* **Nutrition snapshot**: every food entry stores its own calories/macros; nothing recomputes them from reference data. Totals are computed server-side by SQL `GROUP BY` from saved entries only.
* **Analytics**: each day is compared with the goal effective *on that day*. Days without entries are `logged:false` with `intake:null` (missing, **not** zero) and listed in `missingDates`; averages use logged days only.
* **Pagination**: `food-entries`, `workouts`, `weights` return `{items,page,size,totalElements,totalPages}` (`size` ≤ 500, default 100). Date ranges are capped (366 days).

## AI scanner & image privacy
* `POST /scanner/analyze` (multipart: `image`, optional `description`) and `POST /scanner/text-estimate` (`{description}`).
* No provider configured (`SCANNER_PROVIDER=none`, the default) → **503 `SCANNER_UNAVAILABLE`**; nothing is invented. `mock` returns clearly-labelled sample data, dev only, refused in prod. `anthropic` calls the Anthropic Messages API (`AI_API_KEY`, `AI_MODEL`, `AI_ENDPOINT`).
* Validation: declared type (JPEG/PNG/WebP), real file signature, size (`SCANNER_MAX_FILE_SIZE`, default 10 MB; 413/415/400). Images are held in memory (multipart spool threshold is above the limit), never written to PostgreSQL, disk, object storage or logs, and there is **no scan-history table**. Responses carry an `analysisId` only for client correlation. Request bodies are never logged. Model output is treated as untrusted and sanitised/range-checked.
* Results are estimates with `confidence`, `uncertainty` and `warnings`; the scanner **never** saves to the diary. The UI must let the user edit, then `POST /food-entries` with `source:"scanner"`.
* **Limitations**: the image *is* sent to the AI provider. Provider-side retention/training depends on **your agreement and account settings with that provider**; this code cannot enforce or verify it, so don't promise zero retention to users unless you have verified it contractually. The validator checks headers, not full decoding. The rate limiter is in-memory (per instance).
* Swap vendors by implementing `FoodVisionProvider`; plug a food-composition database via `NutritionDataProvider` (default is pass-through).

## Tests
```bash
cd backend
mvn clean verify          # unit tests + Testcontainers/PostgreSQL integration tests (*IT)
mvn test -Dtest='*Test'   # unit tests only, no Docker needed
```
Covers: registration/login/hashing, JWT validation, refresh rotation/reuse, data isolation between users, profile validation + age, calorie maths, effective-dated goals, snapshot preservation, meal/daily totals, food/workout/weight CRUD, daily/weekly/monthly/yearly analytics, bad/oversized uploads, scanner-unavailable, scanner non-persistence (DB), error shapes, CORS, health. **Not covered**: a live AI provider, and files-on-disk non-persistence (checked by design, not by test).

## Example calls
```bash
curl -s -X POST localhost:8080/api/v1/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Ann","email":"ann@example.com","password":"Passw0rdTest1"}'
# -> 201 {"accessToken":"eyJ…","tokenType":"Bearer","expiresInSeconds":900,"user":{"id":"…","email":"ann@example.com","name":"Ann"}}

curl -s -X POST localhost:8080/api/v1/food-entries -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '{"date":"2025-03-01","meal":"lunch","name":"Rice","quantity":150,"unit":"g",
       "nutrition":{"calories":195,"protein":4,"carbohydrates":42,"fat":0.4,"fiber":0.6},"source":"manual"}'
# -> 201 {"id":"…","date":"2025-03-01","meal":"lunch",…,"nutrition":{…},"source":"manual","createdAt":"…"}

curl -s "localhost:8080/api/v1/analytics/weekly?from=2025-03-01&to=2025-03-07" -H "Authorization: Bearer $T"
# -> {"calendarDays":7,"loggedDays":3,"missingDays":4,"missingDates":["2025-03-03",…],"averageIntake":{…},
#     "daysOverTarget":2,"daysUnderTarget":1,"days":[{"date":"…","logged":false,"intake":null,"calorieStatus":"not_logged",…}],…}
```
Error body: `{"timestamp","status","error":"VALIDATION_FAILED","message","path","fieldErrors":[{"field","message"}]}`.

## Deployment checklist
Run behind HTTPS (reverse proxy; `server.forward-headers-strategy=framework` is set in prod). Set `SPRING_PROFILES_ACTIVE=prod` and all required variables from a secret manager. Use a dedicated DB user. Swagger is disabled in prod. For several instances, move rate limiting to a shared store/gateway. Back up PostgreSQL. Review the provider's data-retention terms before enabling the scanner.

## Common errors
* *`Could not resolve placeholder 'JWT_SECRET'`* → in `prod` set it; in `dev` it has a default.
* *Flyway/Hibernate "missing column/wrong type"* → schema is Flyway-owned; add a new `V2__…sql`, never edit V1 after release.
* *Testcontainers can't start* → Docker must be running; use `-Dtest='*Test'` to skip ITs.
* *CORS error in browser* → add the exact origin to `CORS_ALLOWED_ORIGINS`; cookies need `credentials:'include'`.
* *Refresh cookie not sent* → check `SameSite`/`Secure` and that the request includes the `X-Requested-With: NutriTrack` header.
