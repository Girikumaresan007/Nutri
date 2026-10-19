/**
 * Typed REST client for the NutriTrack backend. Drop into src/services/ and use it from a RestRepository that
 * implements the same interface as your LocalDevelopmentRepository. The access token lives in memory only;
 * the refresh token is an HttpOnly cookie managed by the browser.
 *
 * Env: VITE_API_BASE_URL (e.g. http://localhost:8080/api/v1)
 */
const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '');

export interface FieldIssue { field: string; message: string }
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fieldErrors: FieldIssue[] = []) {
    super(message);
  }
  get isNetwork() { return this.status === 0; }
}
export interface Page<T> { items: T[]; page: number; size: number; totalElements: number; totalPages: number }

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionExpired: () => void = () => {};

export const session = {
  setToken(t: string | null) { accessToken = t; },
  hasToken: () => accessToken !== null,
  onExpired(cb: () => void) { onSessionExpired = cb; },
};

function requireBase(): string {
  if (!BASE) throw new ApiError(0, 'CONFIG', 'VITE_API_BASE_URL is not set');
  return BASE;
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const b = await res.json();
    return new ApiError(res.status, b.error ?? 'ERROR', b.message ?? res.statusText, b.fieldErrors ?? []);
  } catch {
    return new ApiError(res.status, 'ERROR', res.statusText || 'Request failed');
  }
}

async function raw(path: string, init: RequestInit = {}, auth = true): Promise<Response> {
  const headers = new Headers(init.headers);
  if (auth && accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  try {
    return await fetch(`${requireBase()}${path}`, { ...init, headers, credentials: 'include' });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection and try again.');
  }
}

/** Single-flight refresh so concurrent 401s do not rotate the cookie twice. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await raw('/auth/refresh', { method: 'POST', headers: { 'X-Requested-With': 'NutriTrack' } }, false);
      if (!res.ok) { accessToken = null; return false; }
      accessToken = (await res.json()).accessToken;
      return true;
    } finally { refreshing = null; }
  })();
  return refreshing;
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await raw(path, init);
  if (res.status === 401 && await refreshSession()) res = await raw(path, init);
  if (res.status === 401) { onSessionExpired(); throw await parseError(res); }
  if (!res.ok) throw await parseError(res);   // never silently falls back to demo data
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });
const qs = (p: Record<string, string | number | undefined>) =>
  '?' + Object.entries(p).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');

// ---- Types (align with src/types/index.ts; adjust enum unions to your app) ----
export type Meal = 'breakfast' | 'lunch' | 'snacks' | 'dinner';
export interface Nutrition { calories: number; protein: number; carbohydrates: number; fat: number; fiber: number }
export interface FoodEntry { id: string; date: string; meal: Meal; name: string; quantity: number; unit: string; nutrition: Nutrition; notes?: string; source: 'manual' | 'scanner' }
export type FoodEntryInput = Omit<FoodEntry, 'id'>;
export interface NutritionGoal { id: string; effectiveFrom: string; goalType: string; dailyCalories: number; protein: number; carbohydrates: number; fat: number; fiber: number; targetWeightKg?: number }
export interface WeightLog { id: string; date: string; weightKg: number; note?: string }
export interface ScanItem { name: string; quantity: number; servingUnit: string; servingAmount: number; servings: number; nutritionPerServing: Nutrition; estimatedNutrition: Nutrition; confidence: 'low' | 'medium' | 'high'; uncertainty: string[]; warnings: string[] }
export interface ScanResult { analysisId: string; isEstimate: true; provider: string; disclaimer: string; items: ScanItem[]; warnings: string[] }

// ---- Auth ----
export const authApi = {
  async register(name: string, email: string, password: string) {
    const r = await request<{ accessToken: string; user: { id: string; email: string; name: string } }>('/auth/register', { method: 'POST', ...json({ name, email, password }) });
    accessToken = r.accessToken; return r.user;
  },
  async login(email: string, password: string) {
    const r = await request<{ accessToken: string; user: { id: string; email: string; name: string } }>('/auth/login', { method: 'POST', ...json({ email, password }) });
    accessToken = r.accessToken; return r.user;
  },
  async logout() { try { await raw('/auth/logout', { method: 'POST', headers: { 'X-Requested-With': 'NutriTrack' } }, false); } finally { accessToken = null; } },
  me: () => request<{ id: string; email: string; name: string }>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) => request<void>('/auth/password', { method: 'PUT', ...json({ currentPassword, newPassword }) }),
  deleteAccount: (password: string) => request<void>('/auth/account', { method: 'DELETE', ...json({ password }) }),
};

// ---- Data ----
export const api = {
  profile: { get: () => request<any>('/profile'), put: (p: unknown) => request<any>('/profile', { method: 'PUT', ...json(p) }) },
  estimate: () => request<any>('/nutrition/estimate'),
  dailySummary: (date: string) => request<any>(`/nutrition/daily-summary${qs({ date })}`),
  goals: {
    list: () => request<NutritionGoal[]>('/goals'),
    active: (date: string) => request<NutritionGoal>(`/goals/active${qs({ date })}`),
    create: (g: Omit<NutritionGoal, 'id'>) => request<NutritionGoal>('/goals', { method: 'POST', ...json(g) }),
    update: (id: string, g: Omit<NutritionGoal, 'id'>) => request<NutritionGoal>(`/goals/${id}`, { method: 'PUT', ...json(g) }),
    remove: (id: string) => request<void>(`/goals/${id}`, { method: 'DELETE' }),
  },
  food: {
    byDate: (date: string) => request<Page<FoodEntry>>(`/food-entries${qs({ date, size: 500 })}`),
    range: (from: string, to: string, page = 0) => request<Page<FoodEntry>>(`/food-entries${qs({ from, to, page })}`),
    create: (e: FoodEntryInput) => request<FoodEntry>('/food-entries', { method: 'POST', ...json(e) }),
    update: (id: string, e: FoodEntryInput) => request<FoodEntry>(`/food-entries/${id}`, { method: 'PUT', ...json(e) }),
    remove: (id: string) => request<void>(`/food-entries/${id}`, { method: 'DELETE' }),
    duplicate: (id: string, body?: { date?: string; meal?: Meal }) => request<FoodEntry>(`/food-entries/${id}/duplicate`, { method: 'POST', ...json(body ?? {}) }),
    summary: (from: string, to: string) => request<any>(`/food-entries/summary${qs({ from, to })}`),
  },
  workouts: {
    byDate: (date: string) => request<Page<any>>(`/workouts${qs({ date })}`),
    range: (from: string, to: string) => request<Page<any>>(`/workouts${qs({ from, to, size: 500 })}`),
    create: (w: unknown) => request<any>('/workouts', { method: 'POST', ...json(w) }),
    update: (id: string, w: unknown) => request<any>(`/workouts/${id}`, { method: 'PUT', ...json(w) }),
    remove: (id: string) => request<void>(`/workouts/${id}`, { method: 'DELETE' }),
  },
  weights: {
    list: (from?: string, to?: string) => request<Page<WeightLog>>(`/weights${qs({ from, to, size: 500 })}`),
    create: (w: Omit<WeightLog, 'id'>) => request<WeightLog>('/weights', { method: 'POST', ...json(w) }),
    update: (id: string, w: Omit<WeightLog, 'id'>) => request<WeightLog>(`/weights/${id}`, { method: 'PUT', ...json(w) }),
    remove: (id: string) => request<void>(`/weights/${id}`, { method: 'DELETE' }),
  },
  analytics: {
    daily: (date: string) => request<any>(`/analytics/daily${qs({ date })}`),
    weekly: (from: string, to: string) => request<any>(`/analytics/weekly${qs({ from, to })}`),
    monthly: (year: number, month: number) => request<any>(`/analytics/monthly${qs({ year, month })}`),
    yearly: (year: number) => request<any>(`/analytics/yearly${qs({ year })}`),
  },
  scanner: {
    /** Image is sent once and never stored by this app. Result is an estimate; the user must review before saving. */
    analyze: (image: File, description?: string) => {
      const f = new FormData(); f.append('image', image); if (description) f.append('description', description);
      return request<ScanResult>('/scanner/analyze', { method: 'POST', body: f });
    },
    textEstimate: (description: string) => request<ScanResult>('/scanner/text-estimate', { method: 'POST', ...json({ description }) }),
  },
};
