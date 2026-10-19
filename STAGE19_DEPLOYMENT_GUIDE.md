# NutriTrack AI — Stage 19 Production Deployment Guide

**Date:** 2026-10-16  
**Auditor / Engineer:** Senior Full-Stack Engineer, Security Architect & Cloud Infrastructure Engineer  
**Stage:** Stage 19 — Production Deployment Guide  

This guide provides step-by-step, actionable deployment instructions for deploying NutriTrack AI using the lowest-cost practical hosting options (including 100% free-tier options) as well as Docker container options.

---

## Deployment Architecture Overview

```
Frontend (React 19 / Vite)        ──> Vercel (Free Edge CDN)
Backend (Java 17 / Spring Boot)    ──> Render (Free Web Service) or Railway
Database (PostgreSQL 17)           ──> Neon (Free Serverless Postgres) or Supabase
Vision AI Sidecar (Python 3.11 ViT)──> Hugging Face Spaces (Free 16GB Docker Space) or Railway
```

---

## Step 1: Preparing the PostgreSQL Database

We recommend **Neon** (`https://neon.tech`) or **Supabase** (`https://supabase.com`) for a permanent free PostgreSQL database with automated backups and connection pooling.

1. **Sign Up / Log In** to Neon or Supabase.
2. **Create a New Project:**
   - Name: `nutritrack`
   - Region: Choose a region geographically close to your backend hosting region (e.g., `us-east-1` or `eu-central-1`).
   - Database Version: PostgreSQL 16 or 17.
3. **Retrieve Your Connection Parameters:**
   - Copy the connection string. Neon/Supabase provides connection details in standard URI format:
     `postgresql://<user>:<password>@<host>/<database>?sslmode=require`
4. **Format for Spring Boot JDBC:**
   - Spring Boot requires the `jdbc:` prefix.
   - Example `DB_URL`: `jdbc:postgresql://<host>:5432/<database>?sslmode=require`
   - Example `DB_USERNAME`: `<user>`
   - Example `DB_PASSWORD`: `<password>`
5. **Migration Initialization:**
   - Flyway will automatically run on Spring Boot startup to execute `V1__initial_schema.sql`, `V2__food_catalog.sql`, and `V3__nutrition_data_expansion.sql`. No manual SQL table creation is needed.

---

## Step 2: Deploying the Python Vision Transformer Sidecar

The genuine Indian Food Vision Transformer (`DrishtiSharma/finetuned-ViT-Indian-Food-Classification-v3`) requires ~600MB RAM. The best 100% free hosting platform is a **Hugging Face Space (Docker)**, which provides **16 GB RAM and 2 vCPUs for free**.

### Option A: Free Hugging Face Space (Recommended)
1. Go to `https://huggingface.co/spaces` and click **Create new Space**.
2. Settings:
   - Space Name: `nutritrack-vision-api`
   - License: `mit`
   - Space SDK: **Docker** (Blank)
   - Space Hardware: **CPU Basic (Free - 2 vCPU, 16 GB RAM)**
   - Visibility: **Public** (or Private with token)
3. Upload the contents of `Backend/inference/`:
   - `Dockerfile`
   - `requirements.txt`
   - `hf_inference_service.py`
4. Hugging Face will automatically build the image, pre-warm the ViT weights, and start the service.
5. Once built, note your public Space URL:
   `https://<username>-nutritrack-vision-api.hf.space`
   - Health Check: `https://<username>-nutritrack-vision-api.hf.space/health`
   - Inference Endpoint: `https://<username>-nutritrack-vision-api.hf.space/classify`

### Option B: Railway or Render Web Service
1. Create a new service from your Git repository targeting the directory `Backend/inference`.
2. Select Docker as the build strategy.
3. Port is detected automatically via `PORT`.

---

## Step 3: Deploying the Spring Boot Backend

We recommend **Render** (`https://render.com`) or **Railway** (`https://railway.app`).

### Deploying on Render:
1. Log in to Render and click **New > Web Service**.
2. Connect your Git repository.
3. Configure the service:
   - **Name:** `nutritrack-backend`
   - **Root Directory:** `Backend/backend`
   - **Runtime:** **Docker** (Render will automatically detect `Backend/backend/Dockerfile`)
   - **Instance Type:** **Free** (0.1 CPU, 512 MB RAM)
4. Add the following **Environment Variables** in the Render Dashboard:
   | Variable | Value / Description |
   |---|---|
   | `SPRING_PROFILES_ACTIVE` | `prod` |
   | `DB_URL` | `jdbc:postgresql://<your-neon-host>:5432/nutritrack?sslmode=require` |
   | `DB_USERNAME` | `<your-neon-username>` |
   | `DB_PASSWORD` | `<your-neon-password>` |
   | `DB_POOL_MAX_SIZE` | `10` |
   | `JWT_SECRET` | Run `openssl rand -base64 48` locally and paste the 48+ character result |
   | `JWT_ACCESS_TTL` | `15m` |
   | `REFRESH_TOKEN_TTL` | `14d` |
   | `REFRESH_COOKIE_SECURE` | `true` |
   | `REFRESH_COOKIE_SAMESITE` | `None` *(if using split domains, e.g. vercel.app and onrender.com)* |
   | `SCANNER_PROVIDER` | `huggingface` |
   | `HF_INFERENCE_ENDPOINT` | `https://<username>-nutritrack-vision-api.hf.space/classify` |
   | `CORS_ALLOWED_ORIGINS` | `https://nutritrack-app.vercel.app` *(update with your frontend URL)* |
5. Click **Create Web Service**.
6. Render builds the multi-stage Docker container and launches Spring Boot.
7. Verify health: `https://<your-service>.onrender.com/actuator/health` should return `{"status":"UP"}`.

---

## Step 4: Deploying the Frontend on Vercel

**Vercel** (`https://vercel.com`) provides free edge CDN deployment with instant global caching.

1. Log in to Vercel and click **Add New > Project**.
2. Import your Git repository.
3. Set the **Root Directory** to `Frontend`.
4. Build and Output Settings:
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm ci`
5. Configure Environment Variables:
   - Add `VITE_API_BASE_URL` with your Render backend URL:
     `https://<your-backend>.onrender.com`
6. Click **Deploy**.
7. Vercel compiles the TypeScript and Vite assets, applies `vercel.json` SPA routing, and deploys to `https://<your-project>.vercel.app`.
8. Copy the deployed Vercel domain and update `CORS_ALLOWED_ORIGINS` in your Render backend settings.

---

## Step 5: CORS, Cookies, and HTTPS Verification

### Understanding Cross-Domain vs Same-Site Cookie Rules
Modern browsers (Chrome, Safari, Firefox) restrict third-party cookies by default:

- **Case 1: Same Apex Domain (Recommended for Custom Domains)**
  - Frontend: `https://app.yourdomain.com`
  - Backend: `https://api.yourdomain.com`
  - Both share the eTLD+1 (`yourdomain.com`).
  - Configure `REFRESH_COOKIE_SAMESITE=Strict` or `Lax` and `REFRESH_COOKIE_DOMAIN=.yourdomain.com`.
  - Cookies are treated as first-party and work seamlessly in all browsers.

- **Case 2: Split Third-Party Free Domains**
  - Frontend: `https://nutritrack.vercel.app`
  - Backend: `https://nutritrack-backend.onrender.com`
  - Because `vercel.app` and `onrender.com` are distinct public suffixes, the `nt_refresh` cookie is cross-site.
  - Set `REFRESH_COOKIE_SAMESITE=None` and `REFRESH_COOKIE_SECURE=true`.
  - In Safari (ITP), ensure the user interacts with the site.
  - *Zero-Friction Alternative:* Configure a Vercel path rewrite in `Frontend/vercel.json` (`/api/v1/:path*` -> `https://nutritrack-backend.onrender.com/api/v1/:path*`) and set `VITE_API_BASE_URL=` (empty). All requests flow through the Vercel domain, making cookies 100% first-party!

---

## Step 6: Full-Stack Docker Deployment (Alternative Local or VPS Route)

If you prefer deploying the entire stack to a single VPS (e.g. Hetzner, DigitalOcean, or Oracle Cloud Always Free VM):

1. Clone repository to server.
2. Create production `.env` file in project root:
   ```bash
   POSTGRES_DB=nutritrack
   POSTGRES_USER=nutritrack_user
   POSTGRES_PASSWORD=your_strong_postgres_password
   JWT_SECRET=$(openssl rand -base64 48)
   CORS_ALLOWED_ORIGINS=https://nutritrack.yourdomain.com
   VITE_API_BASE_URL=https://nutritrack.yourdomain.com/api/v1
   ```
3. Run with Docker Compose:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
4. Verify all four containers are healthy:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```

---

## Step 7: Verifying Authentication and Food Scanning in Production

Once deployed, complete the end-to-end verification checklist:

1. **User Registration:**
   - Navigate to your frontend URL.
   - Click **Sign in / Register** and register a new account (`testuser@example.com`, password >= 10 chars with letter + digit).
   - Verify you are immediately signed in with an in-memory token.
2. **Session Persistence via Refresh:**
   - Refresh the browser on `/diary`.
   - Verify the session restores smoothly via `/api/v1/auth/refresh` without prompting to log in again.
3. **Manual Food Logging:**
   - Click **Add Food**, search for "Idli", select 2 pieces (100g), and click **Add to diary**.
   - Verify the entry appears with 132 kcal and accurate macros.
4. **Food Image Recognition:**
   - Go to `/scanner`, upload a food photo (e.g. Samosa or Dosa).
   - Verify inference returns detected candidates with calibrated confidence scores and portion choices.
   - Click **Confirm & Save to Diary** and verify the entry appears in `/diary`.
5. **Analytics:**
   - Go to `/analytics` and verify Daily, Weekly, and Monthly charts render intake progress accurately.

---

## Step 8: Database Backup and Restore Procedures

### Backing Up PostgreSQL:
To create a complete snapshot of your database:
```bash
pg_dump -h <host> -U <user> -d nutritrack -F c -b -v -f nutritrack_backup_$(date +%Y%m%d).dump
```

### Restoring from Backup:
To restore into an empty database:
```bash
pg_restore -h <host> -U <user> -d nutritrack -v -c nutritrack_backup_20261016.dump
```

---

## Step 9: Rolling Back a Deployment

If a production issue occurs:
1. **Frontend:** In Vercel, click **Deployments**, locate the previous successful build, and click **Promote to Production** (instant 0-second rollback).
2. **Backend:** In Render or Railway, select **Deploys** and click **Rollback** to revert container images immediately.
3. **Database:** Flyway migrations are designed to be forward-compatible. Never delete Flyway history rows manually; apply a compensating migration if necessary.
