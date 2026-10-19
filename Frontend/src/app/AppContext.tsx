import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { addDays, format, parseISO, subDays } from 'date-fns';
import type { AppData, FoodEntry, MealCategory, WorkoutSession, WeightLog, UserProfile, NutritionGoal } from '@/types';
import { emptyAppData, repository } from '@/services/repository';
import {
  authApi,
  profileApi,
  goalsApi,
  foodApi,
  nutritionApi,
  workoutApi,
  weightApi,
  toFrontendProfile,
  toBackendProfileRequest,
  toFrontendGoal,
  toBackendGoalRequest,
  toFrontendFoodEntry,
  toBackendFoodEntryRequest,
  toFrontendWorkoutSession,
  toBackendWorkoutRequest,
  toFrontendWeightLog,
  toBackendWeightRequest,
  setOnSessionExpired,
  type LoginRequest,
  type RegisterRequest,
  type UserSummary,
  type BackendDailySummaryResponse,
} from '@/services/api';
import { makeId, todayISO } from '@/utils/nutrition';

interface AddFoodModalState { open: boolean; date: string; meal: MealCategory; entry?: FoodEntry | null }
interface AuthModalState { open: boolean; mode: 'login' | 'register' }
interface ConfirmState { title: string; message: string; confirmLabel?: string; onConfirm: () => void }
interface ToastMessage { id: string; title: string; detail?: string; tone: 'success' | 'error' | 'info' }

interface AppContextValue {
  data: AppData;
  setData: (value: AppData | ((current: AppData) => AppData)) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  dailySummary: BackendDailySummaryResponse | null;
  isFoodLoading: boolean;
  isWorkoutsLoading: boolean;
  isWeightsLoading: boolean;
  addFoodModal: AddFoodModalState;
  openFoodModal: (date?: string, meal?: MealCategory, entry?: FoodEntry | null) => void;
  closeFoodModal: () => void;
  authModal: AuthModalState;
  openAuthModal: (mode?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  currentUser: UserSummary | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  saveProfile: (profile: UserProfile) => Promise<UserProfile>;
  saveGoal: (goal: Omit<NutritionGoal, 'id'>, existingId?: string) => Promise<NutritionGoal>;
  deleteGoal: (id: string) => Promise<void>;
  refreshProfileAndGoals: () => Promise<void>;
  refreshFoodAndSummary: (date?: string) => Promise<void>;
  refreshWorkouts: () => Promise<void>;
  refreshWeights: () => Promise<void>;
  saveFoodEntry: (entry: Omit<FoodEntry, 'id'>, existingId?: string) => Promise<FoodEntry>;
  duplicateFood: (id: string, date?: string, meal?: MealCategory) => Promise<FoodEntry>;
  removeFood: (id: string) => Promise<void>;
  addFood: (entry: FoodEntry) => void;
  confirm: ConfirmState | null;
  askConfirm: (value: ConfirmState) => void;
  closeConfirm: () => void;
  toasts: ToastMessage[];
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  saveWorkout: (workout: WorkoutSession) => Promise<WorkoutSession>;
  removeWorkout: (id: string) => Promise<void>;
  saveWeight: (weight: Omit<WeightLog, 'id'>, existingId?: string) => Promise<WeightLog>;
  removeWeight: (id: string) => Promise<void>;
  addWeight: (weight: WeightLog) => void;
}

const Context = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => repository.load() ?? emptyAppData);
  const [currentUser, setCurrentUser] = useState<UserSummary | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [dailySummary, setDailySummary] = useState<BackendDailySummaryResponse | null>(null);
  const [isFoodLoading, setIsFoodLoading] = useState(false);
  const [isWorkoutsLoading, setIsWorkoutsLoading] = useState(false);
  const [isWeightsLoading, setIsWeightsLoading] = useState(false);
  const [addFoodModal, setAddFoodModal] = useState<AddFoodModalState>({ open: false, date: todayISO(), meal: 'breakfast', entry: null });
  const [authModal, setAuthModal] = useState<AuthModalState>({ open: false, mode: 'login' });
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Preserve guest data in local storage only when unauthenticated and initial auth restoration has completed
  useEffect(() => {
    if (!currentUser && !isAuthLoading) {
      repository.save(data);
    }
  }, [data, currentUser, isAuthLoading]);

  const pushToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = makeId();
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3600);
  }, []);

  const removeToast = useCallback((id: string) => setToasts((current) => current.filter((item) => item.id !== id)), []);

  // Synchronize Profile & Goals whenever user is authenticated
  const refreshProfileAndGoals = useCallback(async () => {
    try {
      const [profRes, goalsRes] = await Promise.allSettled([
        profileApi.get(),
        goalsApi.list(),
      ]);

      setData((current) => {
        let profile = current.profile;
        if (profRes.status === 'fulfilled' && profRes.value) {
          profile = toFrontendProfile(profRes.value);
        }

        let goals = current.goals;
        if (goalsRes.status === 'fulfilled' && goalsRes.value) {
          goals = goalsRes.value.map(toFrontendGoal);
        }

        return { ...current, profile, goals };
      });
    } catch {
      // Keep existing state on error
    }
  }, []);

  // Attempt session restoration on initial mount using silent refresh
  useEffect(() => {
    let active = true;
    authApi.refresh()
      .then(async (res) => {
        if (active && res?.user) {
          setCurrentUser(res.user);
          // Eagerly prefetch profile and goals so user sees them immediately upon session restoration
          await refreshProfileAndGoals();
        }
      })
      .catch(() => {
        // Guest mode continues
      })
      .finally(() => {
        if (active) setIsAuthLoading(false);
      });

    setOnSessionExpired(() => {
      if (active) {
        setCurrentUser(null);
        setDailySummary(null);
        pushToast({ tone: 'info', title: 'Session expired', detail: 'Please sign in again to sync with your account.' });
      }
    });

    return () => {
      active = false;
      setOnSessionExpired(null);
    };
  }, [pushToast, refreshProfileAndGoals]);

  // Synchronize Food Entries and Daily Nutrition Summary
  const refreshFoodAndSummary = useCallback(async (targetDate?: string) => {
    if (!currentUser) {
      setDailySummary(null);
      return;
    }

    const date = targetDate ?? selectedDate;
    setIsFoodLoading(true);

    try {
      const weekStart = format(subDays(parseISO(`${date}T12:00:00`), 6), 'yyyy-MM-dd');
      const weekEnd = format(addDays(parseISO(`${date}T12:00:00`), 1), 'yyyy-MM-dd');

      const [listRes, sumRes] = await Promise.allSettled([
        foodApi.list({ from: weekStart, to: weekEnd, size: 100 }),
        nutritionApi.getDailySummary(date),
      ]);

      if (listRes.status === 'fulfilled' && listRes.value?.items) {
        const serverEntries = listRes.value.items.map(toFrontendFoodEntry);
        setData((current) => {
          const preserved = current.entries.filter((entry) => entry.date < weekStart || entry.date > weekEnd);
          return {
            ...current,
            entries: [...serverEntries, ...preserved],
          };
        });
      }

      if (sumRes.status === 'fulfilled' && sumRes.value) {
        setDailySummary(sumRes.value);
      }
    } catch {
      // Keep existing state on error
    } finally {
      setIsFoodLoading(false);
    }
  }, [currentUser, selectedDate]);

  // Synchronize Workouts from backend
  const refreshWorkouts = useCallback(async () => {
    if (!currentUser) return;
    setIsWorkoutsLoading(true);

    try {
      // Load recent workouts within maximum 366-day boundary allowed by backend
      const from = format(subDays(new Date(), 90), 'yyyy-MM-dd');
      const to = format(addDays(new Date(), 30), 'yyyy-MM-dd');

      const res = await workoutApi.list({ from, to, size: 500 });
      if (res?.items) {
        const workouts = res.items.map(toFrontendWorkoutSession);
        setData((current) => ({
          ...current,
          workouts,
        }));
      }
    } catch {
      // Preserve local state on error
    } finally {
      setIsWorkoutsLoading(false);
    }
  }, [currentUser]);

  // Synchronize Weights from backend
  const refreshWeights = useCallback(async () => {
    if (!currentUser) return;
    setIsWeightsLoading(true);

    try {
      const res = await weightApi.list({ size: 500 });
      if (res?.items) {
        const weights = res.items.map(toFrontendWeightLog);
        setData((current) => ({
          ...current,
          weights,
        }));
      }
    } catch {
      // Preserve local state on error
    } finally {
      setIsWeightsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      void refreshProfileAndGoals();
      void refreshFoodAndSummary(selectedDate);
      void refreshWorkouts();
      void refreshWeights();
    } else {
      setDailySummary(null);
    }
  }, [currentUser, selectedDate, refreshProfileAndGoals, refreshFoodAndSummary, refreshWorkouts, refreshWeights]);

  const saveProfile = useCallback(async (profile: UserProfile): Promise<UserProfile> => {
    if (currentUser) {
      const req = toBackendProfileRequest(profile);
      const res = await profileApi.update(req);
      const updated = toFrontendProfile(res);
      setData((current) => ({ ...current, profile: updated }));
      return updated;
    } else {
      setData((current) => ({ ...current, profile }));
      return profile;
    }
  }, [currentUser]);

  const saveGoal = useCallback(async (goal: Omit<NutritionGoal, 'id'>, existingId?: string): Promise<NutritionGoal> => {
    if (currentUser) {
      const req = toBackendGoalRequest(goal);
      let res;
      if (existingId) {
        res = await goalsApi.update(existingId, req);
      } else {
        const found = data.goals.find((item) => item.effectiveFrom === goal.effectiveFrom);
        if (found) {
          res = await goalsApi.update(found.id, req);
        } else {
          res = await goalsApi.create(req);
        }
      }
      const savedGoal = toFrontendGoal(res);
      setData((current) => {
        const goals = [...current.goals.filter((item) => item.id !== savedGoal.id), savedGoal]
          .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
        return { ...current, goals };
      });
      return savedGoal;
    } else {
      const savedGoal: NutritionGoal = { ...goal, id: existingId || makeId() };
      setData((current) => {
        const goals = [...current.goals.filter((item) => item.id !== savedGoal.id), savedGoal]
          .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
        return { ...current, goals };
      });
      return savedGoal;
    }
  }, [currentUser, data.goals]);

  const deleteGoal = useCallback(async (id: string): Promise<void> => {
    if (currentUser) {
      await goalsApi.delete(id);
    }
    setData((current) => ({
      ...current,
      goals: current.goals.filter((item) => item.id !== id),
    }));
  }, [currentUser]);

  const saveFoodEntry = useCallback(async (entry: Omit<FoodEntry, 'id'>, existingId?: string): Promise<FoodEntry> => {
    if (currentUser) {
      const req = toBackendFoodEntryRequest(entry);
      const res = existingId
        ? await foodApi.update(existingId, req)
        : await foodApi.create(req);
      const saved = toFrontendFoodEntry(res);

      setData((current) => ({
        ...current,
        entries: [saved, ...current.entries.filter((item) => item.id !== saved.id)],
      }));

      try {
        const summaryRes = await nutritionApi.getDailySummary(saved.date);
        if (saved.date === selectedDate) {
          setDailySummary(summaryRes);
        }
      } catch {
        // Silently preserve local state
      }

      return saved;
    } else {
      const saved: FoodEntry = { ...entry, id: existingId || makeId() };
      setData((current) => ({
        ...current,
        entries: [saved, ...current.entries.filter((item) => item.id !== saved.id)],
      }));
      return saved;
    }
  }, [currentUser, selectedDate]);

  const duplicateFood = useCallback(async (id: string, date?: string, meal?: MealCategory): Promise<FoodEntry> => {
    if (currentUser) {
      const res = await foodApi.duplicate(id, { date, meal });
      const duplicated = toFrontendFoodEntry(res);

      setData((current) => ({
        ...current,
        entries: [duplicated, ...current.entries.filter((item) => item.id !== duplicated.id)],
      }));

      try {
        const summaryRes = await nutritionApi.getDailySummary(duplicated.date);
        if (duplicated.date === selectedDate) {
          setDailySummary(summaryRes);
        }
      } catch {
        // Silently preserve local state
      }

      return duplicated;
    } else {
      const target = data.entries.find((item) => item.id === id);
      const duplicated: FoodEntry = {
        ...(target ?? {
          date: date ?? selectedDate,
          meal: meal ?? 'breakfast',
          name: 'Food',
          quantity: 1,
          unit: 'serving',
          nutrition: { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 },
          source: 'manual',
        }),
        id: makeId(),
        date: date ?? target?.date ?? selectedDate,
        meal: meal ?? target?.meal ?? 'breakfast',
        name: target ? `${target.name} (copy)` : 'Food (copy)',
        notes: target?.notes ? `Copied: ${target.notes}` : undefined,
      };

      setData((current) => ({
        ...current,
        entries: [duplicated, ...current.entries],
      }));
      return duplicated;
    }
  }, [currentUser, data.entries, selectedDate]);

  const removeFood = useCallback(async (id: string): Promise<void> => {
    const entry = data.entries.find((item) => item.id === id);
    if (currentUser) {
      await foodApi.delete(id);
    }
    setData((current) => ({
      ...current,
      entries: current.entries.filter((item) => item.id !== id),
    }));
    if (currentUser && entry?.date) {
      try {
        const summaryRes = await nutritionApi.getDailySummary(entry.date);
        if (entry.date === selectedDate) {
          setDailySummary(summaryRes);
        }
      } catch {
        // Silently preserve local state
      }
    }
  }, [currentUser, data.entries, selectedDate]);

  const addFood = useCallback((entry: FoodEntry) => {
    void saveFoodEntry(entry, entry.id);
  }, [saveFoodEntry]);

  const login = useCallback(async (credentials: LoginRequest) => {
    const res = await authApi.login(credentials);
    setData(emptyAppData);
    setCurrentUser(res.user);
    pushToast({ tone: 'success', title: `Welcome back, ${res.user.name.split(' ')[0]}` });
  }, [pushToast]);

  const registerUser = useCallback(async (req: RegisterRequest) => {
    const res = await authApi.register(req);
    setData(emptyAppData);
    setCurrentUser(res.user);
    pushToast({ tone: 'success', title: `Welcome to NutriTrack, ${res.user.name.split(' ')[0]}` });
  }, [pushToast]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setCurrentUser(null);
      setDailySummary(null);
      repository.clear();
      setData(emptyAppData);
      pushToast({ tone: 'info', title: 'Signed out', detail: 'Switched to clean guest mode.' });
    }
  }, [pushToast]);

  const openAuthModal = useCallback((mode: 'login' | 'register' = 'login') => {
    setAuthModal({ open: true, mode });
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModal((current) => ({ ...current, open: false }));
  }, []);

  const openFoodModal = useCallback((date = selectedDate, meal: MealCategory = 'breakfast', entry: FoodEntry | null = null) => {
    setAddFoodModal({ open: true, date, meal, entry });
  }, [selectedDate]);

  const closeFoodModal = useCallback(() => setAddFoodModal((current) => ({ ...current, open: false, entry: null })), []);

  const saveWorkout = useCallback(async (workout: WorkoutSession): Promise<WorkoutSession> => {
    if (currentUser) {
      const req = toBackendWorkoutRequest(workout);
      const exists = data.workouts.some((w) => w.id === workout.id);
      const res = exists
        ? await workoutApi.update(workout.id, req)
        : await workoutApi.create(req);
      const saved = toFrontendWorkoutSession(res);

      setData((current) => ({
        ...current,
        workouts: [saved, ...current.workouts.filter((item) => item.id !== saved.id)],
      }));

      try {
        const summaryRes = await nutritionApi.getDailySummary(saved.date);
        if (saved.date === selectedDate) {
          setDailySummary(summaryRes);
        }
      } catch {
        // Silently preserve local state
      }

      return saved;
    } else {
      const saved: WorkoutSession = { ...workout, id: workout.id || makeId() };
      setData((current) => ({
        ...current,
        workouts: [saved, ...current.workouts.filter((item) => item.id !== saved.id)],
      }));
      return saved;
    }
  }, [currentUser, data.workouts, selectedDate]);

  const removeWorkout = useCallback(async (id: string): Promise<void> => {
    const target = data.workouts.find((w) => w.id === id);
    if (currentUser) {
      await workoutApi.delete(id);
    }
    setData((current) => ({
      ...current,
      workouts: current.workouts.filter((item) => item.id !== id),
    }));
    if (currentUser && target?.date) {
      try {
        const summaryRes = await nutritionApi.getDailySummary(target.date);
        if (target.date === selectedDate) {
          setDailySummary(summaryRes);
        }
      } catch {
        // Silently preserve local state
      }
    }
  }, [currentUser, data.workouts, selectedDate]);

  const saveWeight = useCallback(async (weight: Omit<WeightLog, 'id'>, existingId?: string): Promise<WeightLog> => {
    if (currentUser) {
      const req = toBackendWeightRequest(weight);
      const res = existingId
        ? await weightApi.update(existingId, req)
        : await weightApi.create(req);
      const saved = toFrontendWeightLog(res);

      setData((current) => ({
        ...current,
        weights: [saved, ...current.weights.filter((item) => item.id !== saved.id)],
        profile: current.profile
          ? { ...current.profile, currentWeightKg: saved.weightKg, profileUpdatedAt: todayISO() }
          : current.profile,
      }));
      return saved;
    } else {
      const saved: WeightLog = { ...weight, id: existingId || makeId() };
      setData((current) => ({
        ...current,
        weights: [saved, ...current.weights.filter((item) => item.id !== saved.id)],
        profile: current.profile
          ? { ...current.profile, currentWeightKg: saved.weightKg, profileUpdatedAt: todayISO() }
          : current.profile,
      }));
      return saved;
    }
  }, [currentUser]);

  const removeWeight = useCallback(async (id: string): Promise<void> => {
    if (currentUser) {
      await weightApi.delete(id);
    }
    setData((current) => ({
      ...current,
      weights: current.weights.filter((item) => item.id !== id),
    }));
  }, [currentUser]);

  const addWeight = useCallback((weight: WeightLog) => {
    void saveWeight(weight, weight.id);
  }, [saveWeight]);

  const value = useMemo<AppContextValue>(() => ({
    data, setData, selectedDate, setSelectedDate,
    dailySummary, isFoodLoading, isWorkoutsLoading, isWeightsLoading,
    addFoodModal, openFoodModal, closeFoodModal,
    authModal, openAuthModal, closeAuthModal,
    currentUser, isAuthenticated: Boolean(currentUser), isAuthLoading,
    login, register: registerUser, logout,
    saveProfile, saveGoal, deleteGoal, refreshProfileAndGoals,
    refreshFoodAndSummary, refreshWorkouts, refreshWeights,
    saveFoodEntry, duplicateFood, removeFood, addFood,
    confirm, askConfirm: setConfirm, closeConfirm: () => setConfirm(null),
    toasts, pushToast, removeToast,
    saveWorkout, removeWorkout, saveWeight, removeWeight, addWeight,
  }), [
    data, selectedDate, dailySummary, isFoodLoading, isWorkoutsLoading, isWeightsLoading,
    addFoodModal, openFoodModal, closeFoodModal,
    authModal, openAuthModal, closeAuthModal,
    currentUser, isAuthLoading, login, registerUser, logout,
    saveProfile, saveGoal, deleteGoal, refreshProfileAndGoals,
    refreshFoodAndSummary, refreshWorkouts, refreshWeights,
    saveFoodEntry, duplicateFood, removeFood, addFood,
    confirm, toasts, pushToast, removeToast,
    saveWorkout, removeWorkout, saveWeight, removeWeight, addWeight,
  ]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(Context);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
