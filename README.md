# NutriTrack AI

> An intelligent, full-stack nutrition and calorie tracking platform featuring Vision Transformer (ViT) food image recognition, verifiable ICMR-NIN/USDA nutritional databases, and privacy-preserving multi-tenant security.

[![Spring Boot 3.5.6](https://img.shields.io/badge/Backend-Spring%20Boot%203.5.6-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![React 19](https://img.shields.io/badge/Frontend-React%2019%20%2B%20TypeScript-blue.svg)](https://react.dev/)
[![PyTorch](https://img.shields.io/badge/AI%20Inference-Vision%20Transformer-orange.svg)](https://huggingface.co/)
[![PostgreSQL 17](https://img.shields.io/badge/Database-PostgreSQL%2017-blue.svg)](https://www.postgresql.org/)
[![Flyway](https://img.shields.io/badge/Migrations-Flyway-red.svg)](https://flywaydb.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 1. The Real-World Problem

Most conventional calorie-tracking applications suffer from three critical shortcomings:
1. **Manual Entry Friction:** Logging Indian dishes and regional home-cooked meals is tedious and error-prone due to massive recipe variability.
2. **Opaque & Hallucinatory AI Estimates:** Generative AI food recognizers frequently hallucinate portion sizes, invent non-existent ingredients, or confuse visually similar dishes (e.g., confusing biryani with fried rice) without explaining visual uncertainty.
3. **Double-Counting & Exercise Conflation:** Many fitness apps subtract exercise calories directly from daily food intake, encouraging dangerous compensatory overeating or obscuring true nutritional deficits.

**NutriTrack AI solves this through:**
- A **fine-tuned Vision Transformer (ViT)** microservice trained on Indian cuisine that outputs structured prediction candidates rather than black-box guesses.
- A **deterministic six-state prediction safety policy** that explicitly flags visual ambiguity and grounds predictions against a curated catalog of 169 verified foods (sourced from ICMR-NIN IFCT 2017 and USDA FoodData Central).
- **Mandatory explicit meal review:** AI estimates are never saved automatically; users review and adjust portion weights before committing records.
- **Strict energy separation:** Workouts and cardio calories burned are reported in separate analytics panels and are never subtracted from food intake.
- **Zero image persistence:** Food photos are processed strictly in-memory and discarded immediately after classification.

---

## 2. Key Features

- **AI-Assisted Food Scanner:** Vision Transformer model classifies Indian foods into 20 cuisine categories with confidence scores and ranked alternatives.
- **Curated & Verified Food Catalog:** 169 verified foods with nutritional breakdowns per 100g, household measure conversions (bowls, rotis, plates), and regional alias mapping (e.g., "phulka" -> Chapati).
- **External Nutrition Lookup Fallback:** Seamless fallback to the Open Food Facts API for uncataloged packaged goods, complete with ingredient and data-source attribution.
- **Interactive Food Diary:** Daily meal categories (Breakfast, Lunch, Dinner, Snacks) with search filtering, entry duplication, and macronutrient totals.
- **Workout & Cardio Tracker:** Log strength splits (Chest/Triceps, Back/Biceps, Legs, Full Body, Custom) with sets/reps/weight and cardio sessions (running, cycling, swimming, walking) with duration and distance.
- **Comprehensive Health Analytics:** Daily, weekly, monthly, and yearly aggregations with true calendar mapping. Calculates intake averages strictly across logged days to avoid skewing data with missing days.
- **Body Weight & Progress Tracking:** Track weigh-ins chronologically with automated net change calculations across active periods.
- **Multi-Tenant Security:** Memory-only access tokens, HttpOnly/SameSite refresh cookies, CSRF protection, IP brute-force rate limiting, and IDOR authorization defenses.

---

## 3. Technology Stack

### Frontend Client
- **Framework:** React 19 with TypeScript 5.8
- **Build Tool:** Vite 8.3
- **Styling:** Tailwind CSS v4 & custom modern design tokens
- **Data Visualization:** Recharts & Lucide React
- **Forms & Validation:** React Hook Form with Zod schemas

### Backend Core
- **Framework:** Java 17 with Spring Boot 3.5.6
- **Persistence:** Spring Data JPA / Hibernate 6.6 with HikariCP connection pooling
- **Database Migrations:** Flyway (Versioned SQL migrations V1, V2, V3)
- **Security:** Spring Security 6 with JJWT (HMAC-SHA256 tokens) and BCrypt password hashing
- **API Documentation:** Springdoc OpenAPI / Swagger UI

### AI Inference Microservice
- **Language & Engine:** Python 3.11 with FastAPI / Uvicorn
- **Model Architecture:** Vision Transformer (`DrishtiSharma/finetuned-ViT-Indian-Food-Classification-v3`)
- **Deep Learning Libraries:** PyTorch 2.14, Hugging Face Transformers 5.19, Pillow

### Database & Infrastructure
- **Database:** PostgreSQL 17
- **Containerization:** Multi-stage Dockerfiles for all 3 tiers with `docker-compose.yml`

---

## 4. Architecture Overview

```
                        ┌────────────────────────────────────────┐
                        │        React 19 / TypeScript UI        │
                        │    (Memory JWT / HttpOnly Cookie)      │
                        └──────────────────┬─────────────────────┘
                                           │
                                  HTTP REST / JSON
                                           │
                        ┌──────────────────▼─────────────────────┐
                        │     Spring Boot 3.5.6 Core Backend     │
                        │  • Authentication & Rate Limiting      │
                        │  • Prediction Safety & Candidate Ranker│
                        │  • Nutrition Scaling & Analytics Engine│
                        └───────┬─────────────────────────┬──────┘
                                │                         │
                        Internal HTTP               JDBC / SQL
                                │                         │
             ┌──────────────────▼──────┐           ┌──────▼──────────────────┐
             │  Python 3.11 ViT Model  │           │  PostgreSQL 17 Database │
             │  • 20-Class Indian Food │           │  • Flyway Migrations    │
             │  • In-Memory Stream     │           │  • Relational Schema    │
             └─────────────────────────┘           └─────────────────────────┘
```

---

## 5. Prerequisites

Before running NutriTrack AI locally, ensure you have the following installed:
- **Java Development Kit (JDK):** Version 17 or higher
- **Node.js:** Version 20.x or 22.x with npm / pnpm
- **PostgreSQL:** Version 16 or 17 (Running on port 5432)
- **Python:** Version 3.11 with `pip`
- **Docker & Docker Compose:** Optional for containerized execution

---

## 6. Local Setup & Installation

### Step 1: Clone Repository
```powershell
git clone <repository-url>
cd Calorietrack
```

### Step 2: Database Setup
Create the PostgreSQL database and user:
```sql
CREATE USER nutritrack WITH PASSWORD 'nutritrack';
CREATE DATABASE nutritrack OWNER nutritrack;
GRANT ALL PRIVILEGES ON DATABASE nutritrack TO nutritrack;
```
*(Flyway will automatically execute migrations `V1`, `V2`, and `V3` on backend startup).*

### Step 3: Python Inference Service Setup
Navigate to the inference directory and install dependencies:
```powershell
cd Backend\inference
py -3.11 -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Step 4: Frontend Setup
Navigate to the frontend directory and install dependencies:
```powershell
cd ..\..\Frontend
npm install
```

---

## 7. Starting the Services

You can launch all services using the provided PowerShell script or start each manually:

### Option A: Automated Starter
From the project root:
```powershell
.\start_services.ps1
```

### Option B: Manual Startup

**1. Start Python Inference Microservice (Port 5001):**
```powershell
cd Backend\inference
py -3.11 hf_inference_service.py
```
*Health Check:* `http://127.0.0.1:5001/health`

**2. Start Spring Boot Backend (Port 8081):**
```powershell
cd Backend\backend
.\mvnw.cmd spring-boot:run
```
*API Base:* `http://localhost:8081/api/v1`  
*Swagger UI:* `http://localhost:8081/swagger-ui.html`

**3. Start Frontend Client (Port 5173):**
```powershell
cd Frontend
npm run dev
```
*Web Application:* `http://localhost:5173`

---

## 8. Verification & Testing

NutriTrack AI includes a comprehensive test suite covering all layers:

### Run Backend Unit & Security Tests (61 Tests)
```powershell
cd Backend\backend
.\mvnw.cmd test "-Dtest=RateLimiterTest,SecurityAuditTest,AnalyticsCalculatorTest,AnalyticsServiceTest,FoodCatalogServiceTest,NutritionCalculatorTest,CatalogCandidateRankerTest,ImageValidatorTest,ProviderJsonParserTest,JwtServiceTest"
```

### Run Frontend TypeScript Validation & Production Build
```powershell
cd Frontend
npm run build
```

### Run Stage 20 Live End-to-End User Journey Tests (34 Tests)
```powershell
node Backend\inference\verify_stage20_e2e_journey.cjs
```

### Run Individual Domain Verifications
- **Stage 14 Prediction Safety:** `node Backend\inference\verify_stage14_smart_matching.cjs`
- **Stage 16 Nutrition & Catalog:** `node Backend\inference\verify_stage16_nutrition_and_lookup.cjs`
- **Stage 17 Health Analytics:** `node Backend\inference\verify_stage17_health_analytics.cjs`
- **Stage 18 Security Audit:** `node Backend\inference\verify_stage18_security_audit.cjs`
- **Stage 19 Deployment Readiness:** `node Backend\inference\verify_stage19_deployment_readiness.cjs`

---

## 9. Security & Privacy Architecture

- **Token Storage:** Access tokens are stored exclusively in JavaScript application memory. Refresh tokens are stored in an HttpOnly cookie with `SameSite=Strict`.
- **CSRF Defense:** State-changing authentication endpoints mandate the `X-Requested-With: NutriTrack` header.
- **Temporary Uploads:** Uploaded photos are received as in-memory byte arrays (12MB memory threshold). They are never written to disk, never logged, and destroyed immediately after tensor generation.
- **Mandatory Review:** The application enforces that no scan estimate can become a saved diary record without an explicit user confirmation action.
- **Production Secret Guard:** `StartupConfigValidator` verifies at startup that production deployments do not use default dev secrets or open CORS origins.

---

## 10. Deployment Reference

For containerized or cloud deployment instructions, refer to:
- [`STAGE19_DEPLOYMENT_GUIDE.md`](./STAGE19_DEPLOYMENT_GUIDE.md) — Comprehensive guide covering Render, Vercel, Docker Compose, and environment variables.
- [`docker-compose.yml`](./docker-compose.yml) — Standard development orchestration.
- [`docker-compose.prod.yml`](./docker-compose.prod.yml) — Hardened multi-container production configuration with health checks.

---

## 11. User Interface & Demonstration

*(Interface screenshots captured during Stage 20 local verification)*

| Dashboard & Daily Rhythm | AI Food Vision Scanner |
|---|---|
| *[Screenshot Placeholder: Dashboard view with ring progress, calorie check-in, macro breakdown, and recent trend]* | *[Screenshot Placeholder: AI Scanner preview showing classified Samosa with confidence pill and candidate alternatives]* |

| Interactive Food Diary | Health Analytics & Aggregations |
|---|---|
| *[Screenshot Placeholder: Diary view with meal sections, portion scaling, and macronutrient badges]* | *[Screenshot Placeholder: Analytics view showing weekly calorie rhythm chart and weight trend]* |

---

## 12. Current Limitations

- **Docker Desktop Local Limitation:** Local execution tested directly against native PostgreSQL and Python runtimes due to host Docker daemon availability. Container definitions are verified syntactically.
- **Single-Dish Vision Focus:** The current Vision Transformer classifier performs single-frame classification. Multi-dish segmentation (e.g. thali plates) requires logging dishes individually or selecting from suggested candidates.
- **Cloud Deployment Notice:** The application is architecturally production-ready, but has not yet been deployed to paid cloud infrastructure.
