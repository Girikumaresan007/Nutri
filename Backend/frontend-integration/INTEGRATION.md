# Wiring the React app to the backend

The frontend source was not available when this was generated, so **no existing frontend file was modified**.
Do these steps against your real code (they follow section 13 of your spec):

1. Copy `apiClient.ts` to `src/services/`. Add to `.env`: `VITE_API_BASE_URL=http://localhost:8080/api/v1` and `VITE_DATA_MODE=api` (`local` for the existing demo repository). Add both to `.env.example`.
2. Create `RestRepository` implementing the same interface as `LocalDevelopmentRepository` in `src/services/repository.ts`, delegating to `api.*`. Select the repository from `VITE_DATA_MODE`; keep `LocalDevelopmentRepository` and demo seed data only when it is explicitly `local`. In `api` mode never catch an API error and substitute demo data; surface it (`ApiError.isNetwork`, `.fieldErrors`, `.code`).
3. Auth: on app start call `refreshSession()` then `authApi.me()`; show login/register when it fails. `session.onExpired(() => navigate('/login'))`. Keep the token in memory only (the client does).
4. Mappings to check against `src/types/index.ts`: enum strings (see `docs/API_CONTRACT.md`), paged list envelopes (`.items`), workout `type: 'strength' | 'cardio'`, `estimatedCalories` is an estimate shown separately from food, weights are always kg (convert for display with `weightUnit`).
5. Scanner (`ScannerPage.tsx`): replace the mock with `api.scanner.analyze(file)`. On 503 `SCANNER_UNAVAILABLE` show the message and offer manual entry (no fake results). Show `disclaimer`, `confidence`, `uncertainty`, `warnings`; let the user edit quantities; on confirm call `api.food.create({... source: 'scanner'})` per item. Do not keep the File/URL after the request.
6. Update state from the **server response** after each mutation (use the returned entity/refetch) rather than optimistic local totals; compute no totals client-side that the server already returns (`/food-entries/summary`, `/nutrition/daily-summary`, `/analytics/*`). Ignore out-of-order responses (e.g. an AbortController per page/date).
7. Dashboard/analytics: missing days arrive as `logged:false, intake:null` — render as gaps, not zeros.
8. Optional local→account migration: only on an explicit user confirmation; upload via `POST` per record, skip duplicates by (date, meal, name, quantity), never upload scanner images.
9. Smoke test: register → profile → goal → add food → add workout → weigh-in → dashboard → analytics → delete account.
