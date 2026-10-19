# NutriTrack AI

A responsive nutrition and wellness tracking frontend built with React, TypeScript, Vite, Tailwind CSS, and Recharts. This is a frontend-first prototype: server and managed database capabilities are intentionally disabled.

## Run locally

```bash
pnpm install
pnpm dev
```

Vite serves the development application on port `3000` by default. To verify the production bundle:

```bash
pnpm build
```

The build runs TypeScript project checks before producing `dist/`.

## Frontend features

- Dashboard with calorie target, consumed/remaining math, macro and fiber progress, meal sections, quick actions, and a seven-day trend.
- Food diary with date navigation, search, manual entry, per-entry nutrition snapshots, edit/duplicate/delete flows, meal subtotals, and daily totals.
- Food scanner interface with camera/file inputs and text descriptions. **There is no connected AI service:** text results are illustrative mock data; selected image bytes are not uploaded or analyzed.
- Nutrition analytics with daily, weekly, monthly, and yearly views, date filters, calorie/goal comparisons, macro trends, weight trends, and labelled demo/empty states.
- Effective-dated nutrition goals, profile and measurement preferences, maintenance/target estimates, weight logs, and workout history.
- Strength and cardio logging with exercises, durations, distances, notes, and estimated exercise calories kept separate from food intake.

## Data and privacy

A replaceable `LocalDevelopmentRepository` stores structured demo/prototype records in browser `localStorage`; it is **not secure production storage**. Saved food entries retain their nutrition snapshot. Scanner image files and object URLs are held only in page memory; temporary object URLs are revoked when replaced, removed, or when the scanner page unmounts. Images are never written to localStorage or IndexedDB.

To clear browser-stored records, use **Profile & Settings → Clear local records**. Demo content is not presented as a user's real history.

## Project structure

- `src/app/` — router, shared application shell, and app state.
- `src/components/` — shared UI primitives and manual food-entry dialog.
- `src/features/` — dashboard, diary, scanner, analytics, workouts, goals, and profile/settings pages.
- `src/services/` — typed repository boundary and future API client.
- `src/types/` — shared domain models.
- `src/utils/` — nutrition calculations, goal effective-date selection, unit conversion, and formatting.
- `src/mocks/` — explicitly labelled development preview data.
- `src/styles.css` — design tokens, components, desktop layouts, and mobile/safe-area rules.
- `public/manus-routes.json` — the website's declared page routes.

## Future backend integration

`src/services/repository.ts` is the replaceable data boundary; page components use typed app state rather than calling storage directly. `VITE_API_BASE_URL` may point to a future backend origin. This variable is a public URL, not a credential. Do not place AI API keys, database credentials, or other secrets in frontend environment variables. A real server/AI service has not been enabled or implemented in this frontend stage.
