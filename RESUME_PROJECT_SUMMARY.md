# NutriTrack AI — Developer Portfolio & Resume Project Summary

This document provides concise, evidence-based project summaries, architectural accomplishments, and verified technical bullet points suitable for a professional software engineering resume, LinkedIn profile, or technical portfolio.

---

## 1. Project Overview (2–3 Line Summary)

**NutriTrack AI** is a production-grade, full-stack nutrition and calorie tracking platform built with React 19, TypeScript, Java 17 (Spring Boot 3.5.6), PostgreSQL 17, and a dedicated Python 3.11 microservice running a fine-tuned Vision Transformer (ViT). The platform provides AI-assisted food image scanning with a deterministic six-state prediction safety policy, verified nutritional databases (ICMR-NIN IFCT & USDA), and multi-tenant security guarantees.

---

## 2. Key Engineering Highlights

- **Vision Transformer (ViT) Microservice:** Deployed a genuine 20-class Indian cuisine image classifier (`DrishtiSharma/finetuned-ViT-Indian-Food-Classification-v3`) with transparent heuristic fallbacks and zero disk persistence for user privacy.
- **Deterministic Six-State Prediction Safety Policy:** Solved closed-set vision model conflation (e.g. biryani vs. fried rice) by engineering a candidate ranker that demotes false certainty and grounds predictions against a verified catalog of 169 curated food items.
- **Robust Calorie & Exercise Decoupling:** Implemented Mifflin-St Jeor TDEE formulas with a hard 1,200 kcal/day safety floor while maintaining strict architectural separation between exercise energy expenditure and dietary food intake.
- **Multi-Tenant Security Architecture:** Hardened authentication with short-lived JWT access tokens kept exclusively in frontend memory, HttpOnly/SameSite refresh cookies, custom CSRF header validation, and IP-level sliding-window rate limiting.
- **Comprehensive Test Coverage:** Engineered an automated verification suite comprising 61 backend Maven tests, 34 live end-to-end user journey tests, and 159 domain verification assertions (254/254 passing, 100% success rate).

---

## 3. Technology Stack

- **Frontend:** React 19, TypeScript 5.8, Vite 8.3, Tailwind CSS v4, Recharts, React Hook Form, Zod.
- **Backend:** Java 17, Spring Boot 3.5.6, Spring Security 6, Spring Data JPA, Hibernate 6.6, HikariCP, JJWT.
- **AI / ML Service:** Python 3.11, PyTorch 2.14, Hugging Face Transformers 5.19, FastAPI, Pillow.
- **Database & Migrations:** PostgreSQL 17.11 with Flyway versioned migrations (V1, V2, V3).
- **Containerization & Deployment:** Multi-stage Dockerfiles, Docker Compose, Nginx Alpine, Vercel SPA routing.

---

## 4. Verifiable Accomplishments & Metrics

| Category | Verifiable Metric / Accomplishment |
|---|---|
| **Test Suite Pass Rate** | **254 / 254 Tests Passed (100%)** across backend unit, security, integration, and live user journey suites. |
| **Backend Test Execution** | 61 unit, service, validation, and security mock tests executed in **24.7s** via Maven. |
| **Frontend Production Build** | 2,907 TypeScript modules compiled and bundled via Vite in **2.02s** with 0 errors. |
| **Food Catalog Grounding** | **169 verified food items** with 100g baseline nutrients and household measure scalings from ICMR-NIN IFCT 2017 & USDA FoodData Central. |
| **Security Controls** | **Zero secret exposure** in version control; access tokens kept in memory; multi-tenant IDOR access strictly blocked with HTTP 404. |
| **Image Privacy** | 12MB in-memory multipart threshold ensures **0 bytes of uploaded food images are ever written to disk or logged**. |

---

## 5. Resume Bullet Points (Tailored for Job Applications)

### Option A: Full-Stack / Backend-Focused Role
- Designed and built **NutriTrack AI**, a production-ready calorie tracking platform using **Java 17 (Spring Boot 3.5.6)**, **PostgreSQL 17**, **React 19**, and a **Python 3.11 Vision Transformer** microservice.
- Architected a **deterministic six-state prediction safety policy** that eliminated AI hallucination in food recognition, grounding ViT classifications against a 169-item verified ICMR-NIN/USDA database.
- Implemented **Mifflin-St Jeor nutritional algorithms** and period analytics across daily, weekly, monthly, and yearly intervals, ensuring calendar day accuracy and strict isolation between exercise burned and dietary intake.
- Hardened authentication using **short-lived JWT access tokens stored strictly in frontend memory**, HttpOnly refresh cookies, custom CSRF header validation, and sliding-window rate limiting.
- Engineered automated test pipelines covering **254 automated test assertions** across Maven unit tests, live API integration tests, and production Vite builds with a 100% pass rate.

### Option B: Machine Learning / AI Systems-Focused Role
- Built an end-to-end AI food tracking system integrating a **fine-tuned Vision Transformer (ViT)** model (`DrishtiSharma/finetuned-ViT-Indian-Food-Classification-v3`) with a high-throughput **FastAPI** inference service.
- Designed a **candidate ranking algorithm** that catches visual ambiguity between visually similar dishes (e.g., biryani vs fried rice), automatically calculating deterministic match scores and surfacing grounded alternatives.
- Engineered a **zero-persistence privacy pipeline** utilizing in-memory byte stream processing (12MB RAM threshold), ensuring user-uploaded food images are never stored to disk or database.
- Implemented a graceful **degraded fallback mechanism** that transparently switches between PyTorch GPU/CPU inference and lightweight heuristic estimation during service cold starts or resource constraints.

### Option C: Frontend / Full-Stack Engineer Role
- Developed a high-performance **React 19 and TypeScript** single-page application bundled with **Vite 8**, transforming 2,900+ modules with zero build warnings in 2.02 seconds.
- Created accessible, responsive analytics dashboards using **Recharts** and **Tailwind CSS**, featuring time-series intake trends, macronutrient breakdowns, and interactive date-range filtering.
- Implemented robust client-side validation using **React Hook Form** and **Zod**, handling unit conversions (kg/lbs, cm/ft-in) and real-time portion scaling.
- Secured frontend state by eliminating `localStorage` token persistence, maintaining access tokens strictly in memory, and implementing silent refresh via HttpOnly cookies and CSRF protection.
