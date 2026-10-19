# NutriTrack AI — System Architecture & Design Specification

**Document Version:** 1.0.0  
**Target Release:** Stage 20 Portfolio Release  
**System Status:** Fully Integrated & Verified  

---

## 1. System Overview & Component Responsibilities

NutriTrack AI is architected as a decoupled, multi-tiered microservices platform designed for high nutritional accuracy, low inference latency, and uncompromising user data privacy.

```mermaid
graph TD
    User["Client Browser (React 19 / TypeScript)"]
    
    subgraph FrontendTier["Frontend Tier (:5173 / :80)"]
        UI["SPA View Layer (Vite + Tailwind CSS)"]
        AppContext["State Management & Memory Auth Store"]
        ZodValidators["Client-side Zod Schema Validation"]
    end

    subgraph BackendTier["Core Backend Tier (:8081)"]
        SecurityFilter["Spring Security Filter Chain"]
        RateLimiter["IP-Level Sliding-Window Rate Limiter"]
        Controllers["REST Controllers (/api/v1/*)"]
        SafetyPolicy["Prediction Safety & Candidate Ranker"]
        NutritionEngine["Nutrition & Mifflin-St Jeor Engine"]
        AnalyticsAggregator["Period Analytics Engine"]
    end

    subgraph AITier["AI Inference Tier (:5001)"]
        FastAPIApp["FastAPI Service"]
        ViTModel["DrishtiSharma ViT Indian Food Model"]
        PreProcessor["In-Memory Pillow Image Pipeline"]
    end

    subgraph DataTier["Data Persistence Tier (:5432)"]
        PostgresDB[(PostgreSQL 17 Database)]
        Flyway["Flyway Migration Engine (V1, V2, V3)"]
    end

    subgraph ExternalServices["External APIs"]
        OpenFoodFacts["Open Food Facts API"]
    end

    User --> UI
    UI --> AppContext
    AppContext --> ZodValidators
    ZodValidators --> SecurityFilter
    SecurityFilter --> RateLimiter
    RateLimiter --> Controllers
    Controllers --> SafetyPolicy
    Controllers --> NutritionEngine
    Controllers --> AnalyticsAggregator
    SafetyPolicy --> FastAPIApp
    FastAPIApp --> PreProcessor
    PreProcessor --> ViTModel
    Controllers --> PostgresDB
    NutritionEngine --> OpenFoodFacts
    Flyway --> PostgresDB
```

### Component Responsibilities Matrix

| Tier | Technology | Primary Responsibilities | Privacy & Security Guarantees |
|---|---|---|---|
| **Frontend** | React 19, TypeScript, Vite | User interface, responsive layout, form validation, client-side optimistic updates, accessible charting | Zero token persistence in `localStorage`/`sessionStorage`; in-flight double-submit guards |
| **Core Backend** | Java 17, Spring Boot 3.5.6 | Authentication, session lifecycle, authorization checks, catalog search, nutrition scaling, analytics aggregation | Sliding-window rate limiting; multi-tenant IDOR defense; zero image disk writes |
| **AI Inference** | Python 3.11, PyTorch, Transformers | Vision Transformer food classification, logits generation, fallback heuristic management | Images received as byte buffers in RAM; discarded immediately after forward pass |
| **Data Tier** | PostgreSQL 17, Flyway | Persistent relational data, foreign key cascade constraints, composite indexing for time-series queries | Strict database isolation; version-controlled schema migrations |
| **External Tier** | Open Food Facts REST API | Secondary fallback for uncataloged packaged foods | Read-only lookup; external results tagged with `BRANDED_PRODUCT` source attribution |

---

## 2. Authentication & Refresh Token Architecture

NutriTrack AI implements an industry-standard short-lived access token + HttpOnly refresh cookie session model.

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant App as React App (Memory Store)
    participant Auth as Spring Boot AuthController
    participant DB as PostgreSQL Database

    User->>App: Submits login form (email, password)
    App->>Auth: POST /api/v1/auth/login {email, password}
    Note over Auth: RateLimiter checks IP attempts
    Auth->>DB: Query user by email
    DB-->>Auth: User record (BCrypt hash)
    Note over Auth: BCrypt.checkpw(password, hash)
    Note over Auth: Generate 15-min JWT & 14-day Refresh Token
    Auth-->>App: HTTP 200 OK<br/>Body: {accessToken, user}<br/>Set-Cookie: nt_refresh (HttpOnly, SameSite=Strict)
    Note over App: Store accessToken in React Memory (AppContext)

    alt Access Token Expires (After 15 minutes)
        App->>Auth: POST /api/v1/auth/refresh<br/>Header: X-Requested-With: NutriTrack<br/>Cookie: nt_refresh
        Note over Auth: Validate CSRF header & cookie signature
        Auth-->>App: HTTP 200 OK<br/>Body: {newAccessToken}
        Note over App: Update memory token without interrupting user
    else Invalid CSRF Header
        App->>Auth: POST /api/v1/auth/refresh (Missing header)
        Auth-->>App: HTTP 403 Forbidden (CSRF_HEADER_REQUIRED)
    end
```

### Key Security Invariants:
1. **Memory-Only Access Tokens:** Even if a malicious script executes, it cannot access tokens from `localStorage` because none exist there.
2. **SameSite=Strict & Path Scoped:** The `nt_refresh` cookie is scoped specifically to `/api/v1/auth` and marked `SameSite=Strict`, preventing cross-site transmission.
3. **CSRF Header Enforcement:** All state-changing session requests require `X-Requested-With: NutriTrack`. Cross-origin browsers cannot send custom headers without passing a CORS preflight options check.

---

## 3. AI Food-Image Inference & Prediction Safety Flow

The food image scanning pipeline incorporates a six-state prediction safety policy to prevent closed-set AI hallucinations and ensure explicit user review.

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant App as Frontend Scanner
    participant Back as Spring Boot Backend
    participant ML as Python ViT Microservice
    participant DB as PostgreSQL Catalog

    User->>App: Selects food photo
    App->>Back: POST /api/v1/scanner/analyze (Multipart image buffer)
    Note over Back: Enforce 10MB limit (stored in RAM only)
    Back->>ML: POST /classify (Stream bytes)
    Note over ML: Pillow loads in RAM -> ViT model inference
    ML-->>Back: JSON: {predictions: [{label: "samosa", score: 0.94}, ...]}
    
    Note over Back: Apply Six-State Prediction Safety Policy
    Back->>DB: Query verified catalog by canonical name & aliases
    DB-->>Back: Matching catalog candidates with 100g baselines
    Note over Back: Rank candidates deterministically
    Back-->>App: HTTP 200 OK<br/>{items: [{name: "Samosa", confidence: "high", candidates: [...]}]}
    
    Note over App: Render Review Modal with Nutrition Breakdown
    alt User Adjusts Quantity & Confirms
        User->>App: Sets quantity to 2 pieces -> Clicks "Confirm & save"
        App->>Back: POST /api/v1/food-entries {name, meal, quantity, nutrition}
        Back->>DB: INSERT into food_entries
        DB-->>Back: Entry created (UUID)
        Back-->>App: HTTP 201 Created
        Note over App: Diary reflects confirmed meal
    else User Cancels Review
        User->>App: Clicks "Discard" or navigates away
        Note over App: Zero database calls made; diary untouched
    end
```

### The Six-State Prediction Safety Policy

1. **`SUPPORTED_ACCEPTABLE`:** ViT confidence $\ge 0.50$ and top prediction matches a verified catalog item. Displayed with high confidence.
2. **`SUPPORTED_UNCERTAIN`:** ViT confidence between $0.25$ and $0.50$. Displayed with a warning badge and suggestions to review portion weight.
3. **`UNSUPPORTED_OOD`:** Image features do not correlate with any of the 20 Indian food classes. Flagged as out-of-distribution; user prompted to search verified catalog.
4. **`AMBIGUOUS_MIXED_DISH`:** Visual conflations (e.g., Chicken Biryani vs Fried Rice) are caught by disambiguation rules that surface ranked catalog alternatives.
5. **`DEGRADED_FALLBACK`:** If the PyTorch sidecar is unreachable or running in resource-constrained environments, heuristic estimation kicks in with clear user disclosure.
6. **`NO_VALID_PREDICTION`:** Zero-byte files, non-image MIME types, or corrupted buffers are rejected before reaching model weights.

---

## 4. Nutrition Calculation & Analytics Aggregation Flow

```mermaid
sequenceDiagram
    autonumber
    participant Client as React Dashboard / Analytics
    participant Controller as AnalyticsController
    participant Service as AnalyticsService
    participant Calc as NutritionCalculator
    participant DB as PostgreSQL Database

    Client->>Controller: GET /api/v1/analytics/daily?date=2026-10-16
    Controller->>Service: daily(userId, 2026-10-16)
    
    Service->>DB: SELECT * FROM food_entries WHERE user_id = ? AND date = ?
    DB-->>Service: List<FoodEntry>
    Service->>DB: SELECT * FROM workouts WHERE user_id = ? AND date = ?
    DB-->>Service: List<WorkoutSession>
    Service->>DB: SELECT target for date from goals
    DB-->>Service: Active NutritionGoal
    
    Note over Service: Sum food nutrition (Calories, P, C, F, Fiber)
    Note over Service: Sum exercise minutes & estimated calories
    Note over Calc: Calculate remaining = Target - Food Intake
    Note over Calc: Exercise calories are NOT subtracted from intake!
    
    Service-->>Controller: DayAnalytics DTO
    Controller-->>Client: HTTP 200 OK<br/>{logged: true, intake: {...}, exercise: {...}, remaining: {...}}
```

### Analytics Period Aggregation Rules:
- **Logged Days vs Calendar Days:** Period averages divide total consumed nutrients strictly by `loggedDays` ($\sum \text{Calories} / \text{loggedDays}$). Unrecorded days do not depress the average.
- **Empty Period Representation:** If a user views a month with 0 logged days, `loggedDays` is reported as `0` and average intake is `null`, rather than displaying false `0 kcal/day` progress.
- **Workout Decoupling:** Exercise energy is tracked in an independent `ExerciseTotals` object. The daily nutritional calorie balance remains `Remaining = Target - Food Intake`.

---

## 5. Security Boundaries & Multi-Tenant Isolation

```
                   ┌──────────────────────────────────────┐
                   │           Public Internet            │
                   └──────────────────┬───────────────────┘
                                      │
                         HTTPS / TLS (Port 443 / 8081)
                                      │
                   ┌──────────────────▼───────────────────┐
                   │    Spring Security Boundary          │
                   │  • JwtAuthenticationFilter           │
                   │  • RateLimiter (10 req/15m on login) │
                   │  • CsrfProtectionFilter              │
                   └──────────────────┬───────────────────┘
                                      │ Authenticated Principal
                   ┌──────────────────▼───────────────────┐
                   │     Multi-Tenant Ownership Layer     │
                   │  • All queries filtered by user_id   │
                   │  • Foreign IDOR access -> 404        │
                   │  • Cascade deletion on account purge │
                   └──────────────────┬───────────────────┘
                                      │
                   ┌──────────────────▼───────────────────┐
                   │       PostgreSQL Data Isolation      │
                   │  • user_id FK on all child entities  │
                   │  • Composite index (user_id, date)   │
                   └──────────────────────────────────────┘
```

All SQL queries and JPA repository lookups require the authenticated `user_id` as part of the query predicate:
```java
// Example multi-tenant lookup in FoodEntryRepository
Optional<FoodEntry> findByIdAndUserId(UUID id, UUID userId);
```
Attempts by an authenticated user to access a foreign resource ID return `404 NOT_FOUND` rather than `403 FORBIDDEN`, ensuring zero disclosure of object existence across tenants.
