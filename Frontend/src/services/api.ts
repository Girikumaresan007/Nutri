export interface UserSummary {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
  user: UserSummary;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface DeleteAccountRequest {
  password: string;
}

export interface FieldIssue {
  field: string;
  message: string;
}

export interface ApiErrorPayload {
  timestamp?: string;
  status?: number;
  error?: string;
  message?: string;
  path?: string;
  fieldErrors?: FieldIssue[];
}

export class ApiError extends Error {
  status: number;
  code: string;
  path?: string;
  fieldErrors: FieldIssue[];

  constructor(status: number, code: string, message: string, path?: string, fieldErrors?: FieldIssue[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.path = path;
    this.fieldErrors = fieldErrors ?? [];
  }
}

// In-memory token storage only — never written to localStorage or sessionStorage
let inMemoryAccessToken: string | null = null;

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

// Global hook triggered when session expires and cannot be refreshed
let onSessionExpiredCallback: (() => void) | null = null;
export function setOnSessionExpired(cb: (() => void) | null): void {
  onSessionExpiredCallback = cb;
}

const CSRF_HEADER_NAME = 'X-Requested-With';
const CSRF_HEADER_VALUE = 'NutriTrack';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081').replace(/\/+$/, '');

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuth?: boolean;
  requiresCsrf?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

async function executeRefresh(): Promise<string | null> {
  try {
    const url = `${BASE_URL}/api/v1/auth/refresh`;
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
      },
    });

    if (!response.ok) {
      setAccessToken(null);
      if (onSessionExpiredCallback) {
        onSessionExpiredCallback();
      }
      return null;
    }

    const data = (await response.json()) as AuthResponse;
    setAccessToken(data.accessToken);
    return data.accessToken;
  } catch {
    setAccessToken(null);
    if (onSessionExpiredCallback) {
      onSessionExpiredCallback();
    }
    return null;
  } finally {
    refreshPromise = null;
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = path.startsWith('http://') || path.startsWith('https://')
    ? path
    : `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(options.headers);

  // Set default Accept
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  // Mandatory CSRF header for endpoints that require it (e.g. refresh, logout)
  if (options.requiresCsrf) {
    headers.set(CSRF_HEADER_NAME, CSRF_HEADER_VALUE);
  }

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    if (options.body instanceof FormData) {
      body = options.body;
      // Do NOT set Content-Type header so browser sets multipart boundary correctly
    } else {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }
  }

  // Attach in-memory access token unless explicitly skipped
  if (!options.skipAuth && inMemoryAccessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
  }

  const fetchInit: RequestInit = {
    ...options,
    headers,
    body,
    credentials: 'include', // Always include credentials so cookies flow correctly
  };

  let response: Response;
  try {
    response = await fetch(url, fetchInit);
  } catch (error) {
    throw new ApiError(0, 'NETWORK_ERROR', error instanceof Error ? error.message : 'Network request failed', path);
  }

  // Handle 401 Unauthenticated for authenticated requests (with retry logic)
  const isAuthEndpoint = path.includes('/api/v1/auth/login') || path.includes('/api/v1/auth/register') || path.includes('/api/v1/auth/refresh');
  if (response.status === 401 && !options.skipAuth && !isAuthEndpoint) {
    if (!refreshPromise) {
      refreshPromise = executeRefresh();
    }
    const newToken = await refreshPromise;

    if (newToken) {
      // Retry original request with new token
      headers.set('Authorization', `Bearer ${newToken}`);
      try {
        response = await fetch(url, { ...fetchInit, headers });
      } catch (error) {
        throw new ApiError(0, 'NETWORK_ERROR', error instanceof Error ? error.message : 'Network request failed on retry', path);
      }
    } else {
      // Refresh failed — parse 401 error
      const errPayload = await safeParseJson<ApiErrorPayload>(response);
      throw new ApiError(
        response.status,
        errPayload?.error ?? 'UNAUTHENTICATED',
        errPayload?.message ?? 'Session expired. Please sign in again.',
        errPayload?.path ?? path,
        errPayload?.fieldErrors
      );
    }
  }

  if (!response.ok) {
    const errPayload = await safeParseJson<ApiErrorPayload>(response);
    throw new ApiError(
      response.status,
      errPayload?.error ?? `HTTP_${response.status}`,
      errPayload?.message ?? `Request failed with status ${response.status}`,
      errPayload?.path ?? path,
      errPayload?.fieldErrors
    );
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return safeParseJson<T>(response) as Promise<T>;
}

async function safeParseJson<T>(response: Response): Promise<T | null> {
  try {
    const text = await response.text();
    if (!text || text.trim() === '') return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export const api = {
  request,
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE', body }),
  upload: <T>(path: string, formData: FormData, options?: RequestOptions) => request<T>(path, { ...options, method: 'POST', body: formData }),
};

export const authApi = {
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>('/api/v1/auth/register', data, { skipAuth: true });
    setAccessToken(res.accessToken);
    return res;
  },

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>('/api/v1/auth/login', credentials, { skipAuth: true });
    setAccessToken(res.accessToken);
    return res;
  },

  async refresh(): Promise<AuthResponse | null> {
    try {
      const res = await request<AuthResponse>('/api/v1/auth/refresh', {
        method: 'POST',
        skipAuth: true,
        requiresCsrf: true,
      });
      if (res?.accessToken) {
        setAccessToken(res.accessToken);
        return res;
      }
      return null;
    } catch {
      setAccessToken(null);
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      await request<void>('/api/v1/auth/logout', {
        method: 'POST',
        skipAuth: true,
        requiresCsrf: true,
      });
    } finally {
      setAccessToken(null);
    }
  },

  async me(): Promise<UserSummary> {
    return api.get<UserSummary>('/api/v1/auth/me');
  },

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await api.put<void>('/api/v1/auth/password', data);
    setAccessToken(null);
  },

  async deleteAccount(password: string): Promise<void> {
    await api.delete<void>('/api/v1/auth/account', { password });
    setAccessToken(null);
  },
};

import type { UserProfile, NutritionGoal, GoalType, ActivityLevel, FoodEntry, MealCategory, WorkoutSession, StrengthWorkoutSession, CardioSession, Exercise, WeightLog } from '@/types';

// Profile Backend DTOs & Mappers
export interface BackendProfileResponse {
  name: string;
  email: string;
  dateOfBirth: string | null;
  age: number | null;
  heightCm: number | null;
  currentWeightKg: number | null;
  biologicalSex: 'female' | 'male' | 'unspecified';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  goalType: 'lose_weight' | 'maintain' | 'gain_weight' | 'build_muscle';
  targetWeightKg: number | null;
  weightUnit: 'kg' | 'lbs';
  heightUnit: 'cm' | 'ft_in';
  profileUpdatedAt: string | null;
}

export interface BackendProfileRequest {
  name: string;
  dateOfBirth: string;
  heightCm: number;
  currentWeightKg: number;
  biologicalSex: 'female' | 'male' | 'unspecified';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  goalType: 'lose_weight' | 'maintain' | 'gain_weight' | 'build_muscle';
  targetWeightKg?: number | null;
  weightUnit: 'kg' | 'lbs';
  heightUnit: 'cm' | 'ft_in';
}

export function toFrontendProfile(res: BackendProfileResponse): UserProfile {
  const goalTypeMap: Record<string, GoalType> = {
    lose_weight: 'lose',
    gain_weight: 'gain',
    build_muscle: 'muscle',
    maintain: 'maintain',
  };
  const activityMap: Record<string, ActivityLevel> = {
    very_active: 'very-active',
  };

  return {
    name: res.name || '',
    email: res.email || '',
    dateOfBirth: res.dateOfBirth || '',
    heightCm: res.heightCm != null ? Number(res.heightCm) : 170,
    currentWeightKg: res.currentWeightKg != null ? Number(res.currentWeightKg) : 70,
    biologicalSex: res.biologicalSex === 'female' || res.biologicalSex === 'male' ? res.biologicalSex : 'unspecified',
    activityLevel: activityMap[res.activityLevel] || (res.activityLevel as ActivityLevel) || 'moderate',
    goalType: goalTypeMap[res.goalType] || 'maintain',
    targetWeightKg: res.targetWeightKg != null ? Number(res.targetWeightKg) : (res.currentWeightKg != null ? Number(res.currentWeightKg) : 70),
    weightUnit: res.weightUnit === 'lbs' ? 'lb' : 'kg',
    heightUnit: res.heightUnit === 'ft_in' ? 'ft-in' : 'cm',
    profileUpdatedAt: res.profileUpdatedAt ? res.profileUpdatedAt.split('T')[0] : new Date().toISOString().split('T')[0],
  };
}

export function toBackendProfileRequest(profile: UserProfile): BackendProfileRequest {
  const goalTypeMap: Record<GoalType, BackendProfileRequest['goalType']> = {
    lose: 'lose_weight',
    gain: 'gain_weight',
    muscle: 'build_muscle',
    maintain: 'maintain',
  };

  return {
    name: profile.name.trim(),
    dateOfBirth: profile.dateOfBirth,
    heightCm: Number(profile.heightCm.toFixed(2)),
    currentWeightKg: Number(profile.currentWeightKg.toFixed(2)),
    biologicalSex: profile.biologicalSex === 'female' || profile.biologicalSex === 'male' ? profile.biologicalSex : 'unspecified',
    activityLevel: profile.activityLevel === 'very-active' ? 'very_active' : (profile.activityLevel as BackendProfileRequest['activityLevel']),
    goalType: goalTypeMap[profile.goalType] || 'maintain',
    targetWeightKg: profile.targetWeightKg ? Number(profile.targetWeightKg.toFixed(2)) : null,
    weightUnit: profile.weightUnit === 'lb' ? 'lbs' : 'kg',
    heightUnit: profile.heightUnit === 'ft-in' ? 'ft_in' : 'cm',
  };
}

export const profileApi = {
  get: async (): Promise<BackendProfileResponse> => api.get<BackendProfileResponse>('/api/v1/profile'),
  update: async (data: BackendProfileRequest): Promise<BackendProfileResponse> => api.put<BackendProfileResponse>('/api/v1/profile', data),
};

// Goals Backend DTOs & Mappers
export interface BackendGoalResponse {
  id: string;
  effectiveFrom: string;
  goalType: 'lose_weight' | 'maintain' | 'gain_weight' | 'build_muscle';
  dailyCalories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  targetWeightKg: number | null;
}

export interface BackendGoalRequest {
  effectiveFrom?: string;
  goalType: 'lose_weight' | 'maintain' | 'gain_weight' | 'build_muscle';
  dailyCalories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  targetWeightKg?: number | null;
}

export function toFrontendGoal(res: BackendGoalResponse): NutritionGoal {
  const goalTypeMap: Record<string, GoalType> = {
    lose_weight: 'lose',
    gain_weight: 'gain',
    build_muscle: 'muscle',
    maintain: 'maintain',
  };

  return {
    id: res.id,
    effectiveFrom: res.effectiveFrom,
    goalType: goalTypeMap[res.goalType] || 'maintain',
    dailyCalories: res.dailyCalories,
    protein: Number(res.protein),
    carbohydrates: Number(res.carbohydrates),
    fat: Number(res.fat),
    fiber: Number(res.fiber),
    targetWeightKg: res.targetWeightKg != null ? Number(res.targetWeightKg) : 70,
  };
}

export function toBackendGoalRequest(goal: Omit<NutritionGoal, 'id'>): BackendGoalRequest {
  const goalTypeMap: Record<GoalType, BackendGoalRequest['goalType']> = {
    lose: 'lose_weight',
    gain: 'gain_weight',
    muscle: 'build_muscle',
    maintain: 'maintain',
  };

  return {
    effectiveFrom: goal.effectiveFrom,
    goalType: goalTypeMap[goal.goalType] || 'maintain',
    dailyCalories: Math.round(goal.dailyCalories),
    protein: Number(Number(goal.protein).toFixed(1)),
    carbohydrates: Number(Number(goal.carbohydrates).toFixed(1)),
    fat: Number(Number(goal.fat).toFixed(1)),
    fiber: Number(Number(goal.fiber).toFixed(1)),
    targetWeightKg: goal.targetWeightKg != null ? Number(Number(goal.targetWeightKg).toFixed(2)) : null,
  };
}

export const goalsApi = {
  list: async (): Promise<BackendGoalResponse[]> => api.get<BackendGoalResponse[]>('/api/v1/goals'),
  getActive: async (date?: string): Promise<BackendGoalResponse> => api.get<BackendGoalResponse>(`/api/v1/goals/active${date ? `?date=${date}` : ''}`),
  create: async (data: BackendGoalRequest): Promise<BackendGoalResponse> => api.post<BackendGoalResponse>('/api/v1/goals', data),
  get: async (id: string): Promise<BackendGoalResponse> => api.get<BackendGoalResponse>(`/api/v1/goals/${id}`),
  update: async (id: string, data: BackendGoalRequest): Promise<BackendGoalResponse> => api.put<BackendGoalResponse>(`/api/v1/goals/${id}`, data),
  delete: async (id: string): Promise<void> => api.delete<void>(`/api/v1/goals/${id}`),
};

// Food Diary Backend DTOs & Mappers
export interface BackendNutrition {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
}

export interface BackendFoodEntryResponse {
  id: string;
  date: string;
  meal: MealCategory;
  name: string;
  quantity: number;
  unit: string;
  nutrition: BackendNutrition;
  notes?: string | null;
  source?: 'manual' | 'scanner' | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BackendFoodEntryRequest {
  date: string;
  meal: MealCategory;
  name: string;
  quantity: number;
  unit: string;
  nutrition: BackendNutrition;
  notes?: string;
  source?: 'manual' | 'scanner';
}

export interface BackendDuplicateRequest {
  date?: string;
  meal?: MealCategory;
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface BackendMealSummary {
  meal: MealCategory;
  entryCount: number;
  totals: BackendNutrition;
}

export interface BackendExerciseTotals {
  sessionCount: number;
  durationMinutes: number;
  estimatedCalories: number | null;
}

export interface BackendDailySummaryResponse {
  date: string;
  logged: boolean;
  consumed: BackendNutrition;
  meals: BackendMealSummary[];
  target: BackendGoalResponse | null;
  remaining: BackendNutrition | null;
  exercise: BackendExerciseTotals | null;
}

export interface BackendDaySummary {
  date: string;
  entryCount: number;
  totals: BackendNutrition;
  meals: BackendMealSummary[];
}

export interface BackendFoodSummaryResponse {
  from: string;
  to: string;
  loggedDays: number;
  totals: BackendNutrition;
  days: BackendDaySummary[];
}

export function toFrontendFoodEntry(res: BackendFoodEntryResponse): FoodEntry {
  return {
    id: res.id,
    date: res.date,
    meal: res.meal,
    name: res.name,
    quantity: Number(res.quantity),
    unit: res.unit || 'serving',
    nutrition: {
      calories: Number(Number(res.nutrition?.calories ?? 0).toFixed(1)),
      protein: Number(Number(res.nutrition?.protein ?? 0).toFixed(1)),
      carbohydrates: Number(Number(res.nutrition?.carbohydrates ?? 0).toFixed(1)),
      fat: Number(Number(res.nutrition?.fat ?? 0).toFixed(1)),
      fiber: Number(Number(res.nutrition?.fiber ?? 0).toFixed(1)),
    },
    notes: res.notes ?? undefined,
    source: res.source === 'scanner' ? 'scanner' : 'manual',
  };
}

export function toBackendFoodEntryRequest(entry: Omit<FoodEntry, 'id'>): BackendFoodEntryRequest {
  const safeUnit = entry.unit && /^[A-Za-z][A-Za-z0-9 ._()/-]{0,29}$/.test(entry.unit.trim())
    ? entry.unit.trim()
    : 'serving';

  return {
    date: entry.date,
    meal: entry.meal,
    name: entry.name.trim(),
    quantity: Number(Number(entry.quantity).toFixed(2)),
    unit: safeUnit,
    nutrition: {
      calories: Math.max(0, Number(Number(entry.nutrition.calories).toFixed(1))),
      protein: Math.max(0, Number(Number(entry.nutrition.protein).toFixed(1))),
      carbohydrates: Math.max(0, Number(Number(entry.nutrition.carbohydrates).toFixed(1))),
      fat: Math.max(0, Number(Number(entry.nutrition.fat).toFixed(1))),
      fiber: Math.max(0, Number(Number(entry.nutrition.fiber).toFixed(1))),
    },
    notes: entry.notes?.trim() || undefined,
    source: entry.source === 'scanner' ? 'scanner' : 'manual',
  };
}

export interface FoodListParams {
  date?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export const foodApi = {
  list: async (params?: FoodListParams): Promise<PageResponse<BackendFoodEntryResponse>> => {
    const searchParams = new URLSearchParams();
    if (params?.date) searchParams.set('date', params.date);
    if (params?.from) searchParams.set('from', params.from);
    if (params?.to) searchParams.set('to', params.to);
    if (params?.page !== undefined) searchParams.set('page', String(params.page));
    if (params?.size !== undefined) searchParams.set('size', String(params.size));
    const query = searchParams.toString();
    return api.get<PageResponse<BackendFoodEntryResponse>>(`/api/v1/food-entries${query ? `?${query}` : ''}`);
  },
  get: async (id: string): Promise<BackendFoodEntryResponse> => {
    return api.get<BackendFoodEntryResponse>(`/api/v1/food-entries/${id}`);
  },
  create: async (data: BackendFoodEntryRequest): Promise<BackendFoodEntryResponse> => {
    return api.post<BackendFoodEntryResponse>('/api/v1/food-entries', data);
  },
  update: async (id: string, data: BackendFoodEntryRequest): Promise<BackendFoodEntryResponse> => {
    return api.put<BackendFoodEntryResponse>(`/api/v1/food-entries/${id}`, data);
  },
  delete: async (id: string): Promise<void> => {
    return api.delete<void>(`/api/v1/food-entries/${id}`);
  },
  duplicate: async (id: string, body?: BackendDuplicateRequest): Promise<BackendFoodEntryResponse> => {
    return api.post<BackendFoodEntryResponse>(`/api/v1/food-entries/${id}/duplicate`, body ?? {});
  },
  summary: async (params?: { date?: string; from?: string; to?: string }): Promise<BackendFoodSummaryResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.date) searchParams.set('date', params.date);
    if (params?.from) searchParams.set('from', params.from);
    if (params?.to) searchParams.set('to', params.to);
    const query = searchParams.toString();
    return api.get<BackendFoodSummaryResponse>(`/api/v1/food-entries/summary${query ? `?${query}` : ''}`);
  },
};

export const nutritionApi = {
  getDailySummary: async (date: string): Promise<BackendDailySummaryResponse> => {
    return api.get<BackendDailySummaryResponse>(`/api/v1/nutrition/daily-summary?date=${encodeURIComponent(date)}`);
  },
};

// Scanner Backend DTOs & API
export interface FoodCandidateDto {
  catalogId: string;
  canonicalName: string;
  category: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbohydratesPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  defaultServingUnit: string;
  defaultServingGrams: number;
  dataSource: string;
  matchScore: number;
  matchReason: string;
}

export interface BackendScanItem {
  name: string;
  quantity: number;
  servingUnit: string;
  servingAmount: number;
  servings: number;
  nutritionPerServing: BackendNutrition;
  estimatedNutrition: BackendNutrition;
  confidence: 'low' | 'medium' | 'high';
  uncertainty: string[];
  warnings: string[];
  candidates?: FoodCandidateDto[];
}

export interface BackendScanResponse {
  analysisId: string;
  isEstimate: boolean;
  provider: string;
  disclaimer: string;
  items: BackendScanItem[];
  warnings: string[];
}

export interface BackendTextEstimateRequest {
  description: string;
}

export const scannerApi = {
  analyze: async (image: File, description?: string): Promise<BackendScanResponse> => {
    const formData = new FormData();
    formData.append('image', image);
    if (description && description.trim()) {
      formData.append('description', description.trim());
    }
    return api.post<BackendScanResponse>('/api/v1/scanner/analyze', formData);
  },
  textEstimate: async (description: string): Promise<BackendScanResponse> => {
    return api.post<BackendScanResponse>('/api/v1/scanner/text-estimate', {
      description: description.trim(),
    });
  },
};

// Verified Food Catalog DTOs & API (ICMR-NIN IFCT 2017 & USDA FoodData Central)
export interface FoodCatalogItemDto {
  id: string;
  code: string;
  canonicalName: string;
  regionalAliases: string;
  category: string;
  preparationMethod?: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbohydratesPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  dataSource: string;
  sourceReferenceId?: string;
  recipeType: 'MEASURED_FOOD' | 'STANDARD_RECIPE' | 'APPROXIMATE_RECIPE' | 'BRANDED_PRODUCT' | 'RAW_INGREDIENT';
  defaultServingUnit: string;
  defaultServingGrams: number;
  servingConversions: Record<string, number>;
  defaultWarning?: string;
}

export interface CalculateNutritionRequest {
  catalogId: string;
  quantity: number;
  unit: string;
  customGrams?: number;
}

export interface CalculateNutritionResponse {
  catalogId: string;
  canonicalName: string;
  quantity: number;
  unit: string;
  calculatedGrams: number;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  dataSource: string;
  sourceReferenceId?: string;
  calculationNote: string;
  warning?: string;
}

export const foodCatalogApi = {
  search: (query?: string, category?: string, limit = 20): Promise<FoodCatalogItemDto[]> => {
    const params = new URLSearchParams();
    if (query && query.trim()) params.set('q', query.trim());
    if (category && category.trim()) params.set('category', category.trim());
    params.set('limit', String(limit));
    return api.get<FoodCatalogItemDto[]>(`/api/v1/food-catalog?${params.toString()}`);
  },
  lookup: (query: string, includeExternal = false, limit = 10): Promise<import('@/types').FoodLookupResponse> => {
    const params = new URLSearchParams();
    params.set('q', query.trim());
    if (includeExternal) params.set('includeExternal', 'true');
    params.set('limit', String(limit));
    return api.get<import('@/types').FoodLookupResponse>(`/api/v1/food-catalog/lookup?${params.toString()}`);
  },
  importExternal: (item: import('@/types').ExternalFoodItem): Promise<FoodCatalogItemDto> => {
    return api.post<FoodCatalogItemDto>('/api/v1/food-catalog/import-external', item);
  },
  getById: (id: string): Promise<FoodCatalogItemDto> => {
    return api.get<FoodCatalogItemDto>(`/api/v1/food-catalog/${id}`);
  },
  getByCode: (code: string): Promise<FoodCatalogItemDto> => {
    return api.get<FoodCatalogItemDto>(`/api/v1/food-catalog/code/${code}`);
  },
  calculate: (req: CalculateNutritionRequest): Promise<CalculateNutritionResponse> => {
    return api.post<CalculateNutritionResponse>('/api/v1/food-catalog/calculate', req);
  },
};

// Workouts Backend DTOs & API
export type BackendWorkoutType = 'strength' | 'cardio';
export type BackendStrengthSplit = 'chest_triceps' | 'back_biceps' | 'legs' | 'full_body' | 'custom';
export type BackendCardioType = 'running' | 'walking' | 'cycling' | 'swimming' | 'other';

export interface BackendExerciseRequest {
  id?: string;
  name: string;
  sets: number;
  reps: number;
  weightKg: number;
  notes?: string;
}

export interface BackendExerciseResponse {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weightKg: number;
  notes?: string | null;
}

export interface BackendWorkoutRequest {
  type: BackendWorkoutType;
  date: string;
  name: string;
  durationMinutes: number;
  estimatedCalories?: number;
  notes?: string;
  split?: BackendStrengthSplit;
  exercises?: BackendExerciseRequest[];
  cardioType?: BackendCardioType;
  distanceKm?: number;
}

export interface BackendWorkoutResponse {
  id: string;
  type: BackendWorkoutType;
  date: string;
  name: string;
  durationMinutes: number;
  estimatedCalories: number;
  caloriesAreEstimate?: boolean;
  notes?: string | null;
  split?: BackendStrengthSplit | null;
  exercises?: BackendExerciseResponse[] | null;
  cardioType?: BackendCardioType | null;
  distanceKm?: number | null;
}

export const STRENGTH_SPLIT_MAP_TO_BACKEND: Record<string, BackendStrengthSplit> = {
  'chest / triceps': 'chest_triceps',
  'chest/triceps': 'chest_triceps',
  'chest_triceps': 'chest_triceps',
  'back / biceps': 'back_biceps',
  'back/biceps': 'back_biceps',
  'back_biceps': 'back_biceps',
  'legs': 'legs',
  'full body': 'full_body',
  'full_body': 'full_body',
  'custom': 'custom',
};

export const STRENGTH_SPLIT_MAP_TO_FRONTEND: Record<BackendStrengthSplit, string> = {
  chest_triceps: 'Chest / triceps',
  back_biceps: 'Back / biceps',
  legs: 'Legs',
  full_body: 'Full body',
  custom: 'Custom',
};

export const CARDIO_TYPE_MAP_TO_BACKEND: Record<string, BackendCardioType> = {
  'run': 'running',
  'running': 'running',
  'walk': 'walking',
  'walking': 'walking',
  'cycling': 'cycling',
  'bike': 'cycling',
  'swimming': 'swimming',
  'swim': 'swimming',
  'other cardio': 'other',
  'other': 'other',
};

export const CARDIO_TYPE_MAP_TO_FRONTEND: Record<BackendCardioType, string> = {
  running: 'Run',
  walking: 'Walk',
  cycling: 'Cycling',
  swimming: 'Swimming',
  other: 'Other cardio',
};

export function toFrontendWorkoutSession(res: BackendWorkoutResponse): WorkoutSession {
  const base = {
    id: res.id,
    date: res.date,
    name: res.name,
    durationMinutes: Number(res.durationMinutes),
    estimatedCalories: Number(res.estimatedCalories ?? 0),
    notes: res.notes ?? undefined,
  };

  if (res.type === 'strength') {
    const splitLabel = res.split ? (STRENGTH_SPLIT_MAP_TO_FRONTEND[res.split] || res.split) : 'Custom';
    const exercises: Exercise[] = (res.exercises || []).map((e) => ({
      id: e.id,
      name: e.name,
      sets: Number(e.sets),
      reps: Number(e.reps),
      weightKg: Number(e.weightKg),
      notes: e.notes ?? undefined,
    }));

    return {
      ...base,
      type: 'strength',
      split: splitLabel,
      exercises,
    };
  } else {
    const cardioLabel = res.cardioType ? (CARDIO_TYPE_MAP_TO_FRONTEND[res.cardioType] || res.cardioType) : 'Run';
    return {
      ...base,
      type: 'cardio',
      cardioType: cardioLabel,
      distanceKm: res.distanceKm != null ? Number(res.distanceKm) : undefined,
    };
  }
}

export type WorkoutSessionInput = WorkoutSession | (Omit<StrengthWorkoutSession, 'id'> | Omit<CardioSession, 'id'>);

export function toBackendWorkoutRequest(session: WorkoutSessionInput): BackendWorkoutRequest {
  const base = {
    date: session.date,
    name: session.name.trim(),
    durationMinutes: Math.max(1, Math.min(1440, Math.round(session.durationMinutes))),
    estimatedCalories: Math.max(0, Math.min(20000, Math.round(session.estimatedCalories || 0))),
    notes: session.notes?.trim() || undefined,
  };

  if (session.type === 'strength') {
    const splitKey = session.split.toLowerCase().trim();
    const split = STRENGTH_SPLIT_MAP_TO_BACKEND[splitKey] || 'custom';
    let exercises: BackendExerciseRequest[] = (session.exercises || [])
      .filter((e) => e.name.trim())
      .map((e) => ({
        id: e.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(e.id) ? e.id : undefined,
        name: e.name.trim(),
        sets: Math.max(1, Math.min(100, Math.round(e.sets || 1))),
        reps: Math.max(1, Math.min(1000, Math.round(e.reps || 1))),
        weightKg: Math.max(0, Math.min(1000, Number(Number(e.weightKg || 0).toFixed(2)))),
        notes: e.notes?.trim() || undefined,
      }));

    if (exercises.length === 0) {
      exercises = [{
        name: session.name.trim() || 'General Exercise',
        sets: 3,
        reps: 10,
        weightKg: 0,
      }];
    }

    return {
      ...base,
      type: 'strength',
      split,
      exercises,
    };
  } else {
    const cardioKey = session.cardioType.toLowerCase().trim();
    const cardioType = CARDIO_TYPE_MAP_TO_BACKEND[cardioKey] || 'running';
    return {
      ...base,
      type: 'cardio',
      cardioType,
      distanceKm: session.distanceKm != null ? Math.max(0, Math.min(1000, Number(Number(session.distanceKm).toFixed(2)))) : undefined,
    };
  }
}


export interface WorkoutListParams {
  date?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export const workoutApi = {
  list: async (params?: WorkoutListParams): Promise<PageResponse<BackendWorkoutResponse>> => {
    const searchParams = new URLSearchParams();
    if (params?.date) searchParams.set('date', params.date);
    if (params?.from) searchParams.set('from', params.from);
    if (params?.to) searchParams.set('to', params.to);
    if (params?.page !== undefined) searchParams.set('page', String(params.page));
    if (params?.size !== undefined) searchParams.set('size', String(params.size));
    const query = searchParams.toString();
    return api.get<PageResponse<BackendWorkoutResponse>>(`/api/v1/workouts${query ? `?${query}` : ''}`);
  },
  get: async (id: string): Promise<BackendWorkoutResponse> => {
    return api.get<BackendWorkoutResponse>(`/api/v1/workouts/${id}`);
  },
  create: async (data: BackendWorkoutRequest): Promise<BackendWorkoutResponse> => {
    return api.post<BackendWorkoutResponse>('/api/v1/workouts', data);
  },
  update: async (id: string, data: BackendWorkoutRequest): Promise<BackendWorkoutResponse> => {
    return api.put<BackendWorkoutResponse>(`/api/v1/workouts/${id}`, data);
  },
  delete: async (id: string): Promise<void> => {
    return api.delete<void>(`/api/v1/workouts/${id}`);
  },
};

// Weight Tracking Backend DTOs & Mappers
export interface BackendWeightResponse {
  id: string;
  date: string;
  weightKg: number;
  note?: string | null;
}

export interface BackendWeightRequest {
  date: string;
  weightKg: number;
  note?: string;
}

export interface WeightListParams {
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export function toFrontendWeightLog(res: BackendWeightResponse): WeightLog {
  return {
    id: res.id,
    date: res.date,
    weightKg: Number(res.weightKg),
    note: res.note ?? undefined,
  };
}

export function toBackendWeightRequest(log: Omit<WeightLog, 'id'> | WeightLog): BackendWeightRequest {
  return {
    date: log.date,
    weightKg: Math.max(20, Math.min(500, Number(Number(log.weightKg).toFixed(2)))),
    note: log.note?.trim() ? log.note.trim().slice(0, 500) : undefined,
  };
}

export const weightApi = {
  list: async (params?: WeightListParams): Promise<PageResponse<BackendWeightResponse>> => {
    const searchParams = new URLSearchParams();
    if (params?.from) searchParams.set('from', params.from);
    if (params?.to) searchParams.set('to', params.to);
    if (params?.page !== undefined) searchParams.set('page', String(params.page));
    if (params?.size !== undefined) searchParams.set('size', String(params.size));
    const query = searchParams.toString();
    return api.get<PageResponse<BackendWeightResponse>>(`/api/v1/weights${query ? `?${query}` : ''}`);
  },
  create: async (data: BackendWeightRequest): Promise<BackendWeightResponse> => {
    return api.post<BackendWeightResponse>('/api/v1/weights', data);
  },
  update: async (id: string, data: BackendWeightRequest): Promise<BackendWeightResponse> => {
    return api.put<BackendWeightResponse>(`/api/v1/weights/${id}`, data);
  },
  delete: async (id: string): Promise<void> => {
    return api.delete<void>(`/api/v1/weights/${id}`);
  },
};

// Analytics Backend DTOs & Mappers
export interface BackendWeightPoint {
  date: string;
  weightKg: number;
}

export interface BackendWeightTrend {
  startKg: number | null;
  endKg: number | null;
  changeKg: number | null;
  points: BackendWeightPoint[];
}

export type BackendCalorieStatus = 'over' | 'under' | 'no_target' | 'not_logged';

export interface BackendDayAnalytics {
  date: string;
  logged: boolean;
  entryCount: number;
  intake: BackendNutrition | null;
  meals: BackendMealSummary[] | null;
  target: BackendGoalResponse | null;
  remaining?: BackendNutrition | null;
  calorieStatus: BackendCalorieStatus;
  exercise: BackendExerciseTotals;
  weightKg: number | null;
}

export interface BackendPeriodAnalytics {
  from: string;
  to: string;
  calendarDays: number;
  loggedDays: number;
  missingDays: number;
  missingDates?: string[] | null;
  totalEntries?: number;
  averageIntake: BackendNutrition | null;
  daysOverTarget: number;
  daysUnderTarget: number;
  daysWithoutTarget: number;
  exercise: BackendExerciseTotals;
  weight: BackendWeightTrend;
  days?: BackendDayAnalytics[] | null;
  months?: BackendPeriodAnalytics[] | null;
}

export const analyticsApi = {
  daily: async (date: string): Promise<BackendDayAnalytics> => {
    return api.get<BackendDayAnalytics>(`/api/v1/analytics/daily?date=${date}`);
  },
  weekly: async (from: string, to: string): Promise<BackendPeriodAnalytics> => {
    return api.get<BackendPeriodAnalytics>(`/api/v1/analytics/weekly?from=${from}&to=${to}`);
  },
  monthly: async (year: number, month: number): Promise<BackendPeriodAnalytics> => {
    return api.get<BackendPeriodAnalytics>(`/api/v1/analytics/monthly?year=${year}&month=${month}`);
  },
  yearly: async (year: number): Promise<BackendPeriodAnalytics> => {
    return api.get<BackendPeriodAnalytics>(`/api/v1/analytics/yearly?year=${year}`);
  },
};


