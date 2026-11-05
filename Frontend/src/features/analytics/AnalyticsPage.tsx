import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  ChartNoAxesColumnIncreasing,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  Dumbbell,
  Flame,
  Leaf,
  Loader2,
  Moon,
  RotateCcw,
  Scale,
  Sun,
  Target,
  Utensils,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button, Card, EmptyState, PageHeader, ProgressBar, StatusPill } from '@/components/ui';
import { useApp } from '@/app/AppContext';
import { fallbackGoal, formatNumber, getGoalForDate, sumNutrition, todayISO } from '@/utils/nutrition';
import {
  analyticsApi,
  type BackendDayAnalytics,
  type BackendMealSummary,
  type BackendPeriodAnalytics,
} from '@/services/api';
import type { MealCategory } from '@/types';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';
const periods: { key: Period; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
];

export interface ChartRow {
  date: string;
  displayLabel: string;
  fullLabel: string;
  calories: number;        // Food intake
  workoutCalories: number; // Workout calories burned
  netCalories: number;     // Food intake - workoutCalories
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  targetCalories: number;
  logged: boolean;
  entryCount: number;
  workoutCount: number;
  workoutMinutes: number;
  loggedDays?: number;
  calendarDays?: number;
  missingDays?: number;
}

const MEAL_ORDER: MealCategory[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
const MEAL_ICONS: Record<MealCategory, ReactNode> = {
  breakfast: <Coffee size={15} style={{ color: '#d97706' }} />,
  lunch: <Sun size={15} style={{ color: '#059669' }} />,
  dinner: <Moon size={15} style={{ color: '#4f46e5' }} />,
  snacks: <Utensils size={15} style={{ color: '#db2777' }} />,
};
const MEAL_LABELS: Record<MealCategory, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

// Helper to compute standard Monday-to-Sunday ISO boundary
function getWeekBoundary(date: Date) {
  const from = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const to = format(endOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  return { from, to };
}

export function AnalyticsPage() {
  const { data, isAuthenticated } = useApp();
  const [period, setPeriod] = useState<Period>('daily');

  // Date selection states
  const [selectedDay, setSelectedDay] = useState<string>(todayISO());
  const [range, setRange] = useState(() => getWeekBoundary(new Date()));
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Data fetching states
  const [dailyData, setDailyData] = useState<BackendDayAnalytics | null>(null);
  const [periodData, setPeriodData] = useState<BackendPeriodAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Daily audit table pagination
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditPageSize, setAuditPageSize] = useState<number>(7);

  const rangeValid = Boolean(range.from && range.to && range.from <= range.to);

  // Fetch analytics from backend
  const fetchAnalytics = useCallback(async () => {
    if (!isAuthenticated) {
      setDailyData(null);
      setPeriodData(null);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      if (period === 'daily') {
        const res = await analyticsApi.daily(selectedDay);
        setDailyData(res);
        setPeriodData(null);
      } else if (period === 'weekly') {
        if (!rangeValid) {
          setLoadError('Please select a valid date range (From ≤ To).');
          setIsLoading(false);
          return;
        }
        const diffDays =
          Math.round(
            (parseISO(`${range.to}T12:00:00`).getTime() - parseISO(`${range.from}T12:00:00`).getTime()) / 86_400_000
          ) + 1;
        if (diffDays > 31) {
          setLoadError('Custom date range for weekly view cannot exceed 31 days.');
          setIsLoading(false);
          return;
        }
        const res = await analyticsApi.weekly(range.from, range.to);
        setPeriodData(res);
        setDailyData(null);
      } else if (period === 'monthly') {
        const parsed = parseISO(`${selectedMonth}-01T12:00:00`);
        const yr = parsed.getFullYear();
        const mo = parsed.getMonth() + 1;
        const res = await analyticsApi.monthly(yr, mo);
        setPeriodData(res);
        setDailyData(null);
      } else if (period === 'yearly') {
        const res = await analyticsApi.yearly(selectedYear);
        setPeriodData(res);
        setDailyData(null);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load analytics.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, period, range.from, range.to, rangeValid, selectedDay, selectedMonth, selectedYear]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  // Reset audit table pagination when switching periods or changing dates
  useEffect(() => {
    setAuditPage(1);
  }, [period, range.from, range.to, selectedMonth, selectedYear]);

  // Navigation helpers
  const shiftDay = (days: number) => {
    const current = parseISO(`${selectedDay}T12:00:00`);
    const next = addDays(current, days);
    setSelectedDay(format(next, 'yyyy-MM-dd'));
  };

  const shiftWeek = (weeks: number) => {
    const current = parseISO(`${range.from}T12:00:00`);
    const target = weeks > 0 ? addWeeks(current, weeks) : subWeeks(current, Math.abs(weeks));
    setRange(getWeekBoundary(target));
  };

  const setThisWeek = () => {
    setRange(getWeekBoundary(new Date()));
  };

  const shiftMonth = (months: number) => {
    const current = parseISO(`${selectedMonth}-01T12:00:00`);
    const next = months > 0 ? addMonths(current, months) : subMonths(current, Math.abs(months));
    setSelectedMonth(format(next, 'yyyy-MM'));
  };

  const shiftYear = (years: number) => {
    setSelectedYear((y) => y + years);
  };

  // -------------------------------------------------------------
  // DAILY DATA COMPUTATION (Authenticated & Guest Fallback)
  // -------------------------------------------------------------
  const daySummary = useMemo(() => {
    if (isAuthenticated && dailyData) {
      const intake = dailyData.intake ?? { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 };
      const targetCals = dailyData.target?.dailyCalories ?? fallbackGoal.dailyCalories;
      const targetProtein = dailyData.target?.protein ?? fallbackGoal.protein;
      const targetCarbs = dailyData.target?.carbohydrates ?? fallbackGoal.carbohydrates;
      const targetFat = dailyData.target?.fat ?? fallbackGoal.fat;
      const targetFiber = dailyData.target?.fiber ?? fallbackGoal.fiber;

      const burnedCals = dailyData.exercise?.estimatedCalories ? Math.round(dailyData.exercise.estimatedCalories) : 0;
      const netCals = Math.round(intake.calories) - burnedCals;
      const foodVsTarget = Math.round(intake.calories) - targetCals;
      const netVsTarget = netCals - targetCals;

      return {
        logged: dailyData.logged,
        entryCount: dailyData.entryCount,
        intake,
        burnedCalories: burnedCals,
        netCalories: netCals,
        foodVsTarget,
        netVsTarget,
        meals: dailyData.meals ?? [],
        targetCalories: targetCals,
        targetProtein,
        targetCarbs,
        targetFat,
        targetFiber,
        calorieStatus: dailyData.calorieStatus,
        exercise: dailyData.exercise,
        weightKg: dailyData.weightKg,
      };
    }

    // Guest / Local mode calculation
    const dayEntries = data.entries.filter((entry) => entry.date === selectedDay);
    const dayNutrition = dayEntries.length
      ? sumNutrition(dayEntries)
      : { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 };
    const goal = getGoalForDate(data.goals, selectedDay) ?? fallbackGoal;

    const meals: BackendMealSummary[] = MEAL_ORDER.map((mealCat) => {
      const items = dayEntries.filter((e) => e.meal === mealCat);
      return {
        meal: mealCat,
        entryCount: items.length,
        totals: sumNutrition(items),
      };
    });

    const dayWorkouts = data.workouts.filter((w) => w.date === selectedDay);
    const workoutSessions = dayWorkouts.length;
    const workoutMins = dayWorkouts.reduce((s, w) => s + w.durationMinutes, 0);
    const workoutKcal = dayWorkouts.reduce((s, w) => s + (w.estimatedCalories ?? 0), 0);

    const weightLog = data.weights.find((w) => w.date === selectedDay);

    const burnedCals = workoutKcal;
    const foodCals = Math.round(dayNutrition.calories);
    const netCals = foodCals - burnedCals;
    const foodVsTarget = foodCals - goal.dailyCalories;
    const netVsTarget = netCals - goal.dailyCalories;

    return {
      logged: dayEntries.length > 0,
      entryCount: dayEntries.length,
      intake: dayNutrition,
      burnedCalories: burnedCals,
      netCalories: netCals,
      foodVsTarget,
      netVsTarget,
      meals,
      targetCalories: goal.dailyCalories,
      targetProtein: goal.protein,
      targetCarbs: goal.carbohydrates,
      targetFat: goal.fat,
      targetFiber: goal.fiber,
      calorieStatus:
        dayEntries.length === 0
          ? 'not_logged'
          : foodCals > goal.dailyCalories
            ? 'over'
            : 'under',
      exercise: {
        sessionCount: workoutSessions,
        durationMinutes: workoutMins,
        estimatedCalories: workoutKcal > 0 ? workoutKcal : null,
      },
      weightKg: weightLog?.weightKg ?? null,
    };
  }, [dailyData, data.entries, data.goals, data.weights, data.workouts, isAuthenticated, selectedDay]);

  // -------------------------------------------------------------
  // PERIOD CHART ROWS (Weekly, Monthly, Yearly)
  // -------------------------------------------------------------
  const actualEntries = useMemo(() => {
    if (period === 'weekly') {
      return data.entries.filter((e) => e.date >= range.from && e.date <= range.to);
    }
    if (period === 'monthly') {
      return data.entries.filter((e) => e.date.startsWith(selectedMonth));
    }
    return data.entries.filter((e) => e.date.startsWith(`${selectedYear}-`));
  }, [data.entries, period, range.from, range.to, selectedMonth, selectedYear]);

  const chartRows = useMemo<ChartRow[]>(() => {
    // 1. Authenticated Period Data
    if (isAuthenticated && periodData) {
      if (period === 'yearly' && periodData.months) {
        return periodData.months.map((m) => {
          const dt = parseISO(`${m.from}T12:00:00`);
          return {
            date: m.from,
            displayLabel: format(dt, 'MMM'),
            fullLabel: format(dt, 'MMMM yyyy'),
            calories: m.averageIntake?.calories ? Math.round(m.averageIntake.calories) : 0,
            workoutCalories: m.exercise?.estimatedCalories ? Math.round(m.exercise.estimatedCalories) : 0,
            netCalories:
              (m.averageIntake?.calories ? Math.round(m.averageIntake.calories) : 0) -
              (m.exercise?.estimatedCalories ? Math.round(m.exercise.estimatedCalories) : 0),
            protein: m.averageIntake?.protein ? Math.round(m.averageIntake.protein) : 0,
            carbohydrates: m.averageIntake?.carbohydrates ? Math.round(m.averageIntake.carbohydrates) : 0,
            fat: m.averageIntake?.fat ? Math.round(m.averageIntake.fat) : 0,
            fiber: m.averageIntake?.fiber ? Math.round(m.averageIntake.fiber) : 0,
            targetCalories: (getGoalForDate(data.goals, m.from) ?? fallbackGoal).dailyCalories,
            logged: (m.loggedDays ?? 0) > 0,
            entryCount: Number(m.totalEntries ?? 0),
            workoutCount: m.exercise?.sessionCount ?? 0,
            workoutMinutes: m.exercise?.durationMinutes ?? 0,
            loggedDays: m.loggedDays,
            calendarDays: m.calendarDays,
            missingDays: m.missingDays,
          };
        });
      }

      if (periodData.days && periodData.days.length > 0) {
        return periodData.days.map((d) => {
          const dt = parseISO(`${d.date}T12:00:00`);
          const foodCals = d.intake?.calories ? Math.round(d.intake.calories) : 0;
          const burnedCals = d.exercise?.estimatedCalories ? Math.round(d.exercise.estimatedCalories) : 0;
          const netCals = foodCals - burnedCals;
          const targetCals = d.target?.dailyCalories ?? (getGoalForDate(data.goals, d.date) ?? fallbackGoal).dailyCalories;

          return {
            date: d.date,
            displayLabel: period === 'weekly' ? format(dt, 'EEE') : format(dt, 'd'),
            fullLabel: format(dt, 'EEE, MMM d, yyyy'),
            calories: foodCals,
            workoutCalories: burnedCals,
            netCalories: netCals,
            protein: d.intake?.protein ? Math.round(d.intake.protein) : 0,
            carbohydrates: d.intake?.carbohydrates ? Math.round(d.intake.carbohydrates) : 0,
            fat: d.intake?.fat ? Math.round(d.intake.fat) : 0,
            fiber: d.intake?.fiber ? Math.round(d.intake.fiber) : 0,
            targetCalories: targetCals,
            logged: d.logged,
            entryCount: d.entryCount,
            workoutCount: d.exercise?.sessionCount ?? 0,
            workoutMinutes: d.exercise?.durationMinutes ?? 0,
          };
        });
      }
    }

    // 2. Local Guest Mode / Fallback Calculation
    if (period === 'monthly') {
      const monthStart = startOfMonth(parseISO(`${selectedMonth}-01T12:00:00`));
      const monthEnd = endOfMonth(monthStart);
      const daysCount = monthEnd.getDate();

      return Array.from({ length: daysCount }, (_, i) => {
        const d = addDays(monthStart, i);
        const iso = format(d, 'yyyy-MM-dd');
        const items = actualEntries.filter((e) => e.date === iso);
        const nut = sumNutrition(items);
        const goal = getGoalForDate(data.goals, iso) ?? fallbackGoal;
        const workouts = data.workouts.filter((w) => w.date === iso);
        const burnedCals = workouts.reduce((s, w) => s + (w.estimatedCalories ?? 0), 0);
        const foodCals = items.length ? Math.round(nut.calories) : 0;

        return {
          date: iso,
          displayLabel: String(i + 1),
          fullLabel: format(d, 'EEE, MMM d, yyyy'),
          calories: foodCals,
          workoutCalories: burnedCals,
          netCalories: foodCals - burnedCals,
          protein: items.length ? Math.round(nut.protein) : 0,
          carbohydrates: items.length ? Math.round(nut.carbohydrates) : 0,
          fat: items.length ? Math.round(nut.fat) : 0,
          fiber: items.length ? Math.round(nut.fiber) : 0,
          targetCalories: goal.dailyCalories,
          logged: items.length > 0,
          entryCount: items.length,
          workoutCount: workouts.length,
          workoutMinutes: workouts.reduce((s, w) => s + w.durationMinutes, 0),
        };
      });
    }

    if (period === 'yearly') {
      return Array.from({ length: 12 }, (_, m) => {
        const mDate = new Date(selectedYear, m, 1);
        const mPrefix = format(mDate, 'yyyy-MM');
        const mEntries = actualEntries.filter((e) => e.date.startsWith(mPrefix));
        const loggedDates = new Set(mEntries.map((e) => e.date));
        const loggedCount = loggedDates.size;
        const totalDays = endOfMonth(mDate).getDate();
        const nut = sumNutrition(mEntries);
        const goal = getGoalForDate(data.goals, format(mDate, 'yyyy-MM-dd')) ?? fallbackGoal;
        const avgCals = loggedCount > 0 ? Math.round(nut.calories / loggedCount) : 0;
        const mWorkouts = data.workouts.filter((w) => w.date.startsWith(mPrefix));
        const burnedCals = mWorkouts.reduce((s, w) => s + (w.estimatedCalories ?? 0), 0);

        return {
          date: mPrefix,
          displayLabel: format(mDate, 'MMM'),
          fullLabel: format(mDate, 'MMMM yyyy'),
          calories: avgCals,
          workoutCalories: burnedCals,
          netCalories: avgCals - (loggedCount > 0 ? Math.round(burnedCals / loggedCount) : 0),
          protein: loggedCount > 0 ? Math.round(nut.protein / loggedCount) : 0,
          carbohydrates: loggedCount > 0 ? Math.round(nut.carbohydrates / loggedCount) : 0,
          fat: loggedCount > 0 ? Math.round(nut.fat / loggedCount) : 0,
          fiber: loggedCount > 0 ? Math.round(nut.fiber / loggedCount) : 0,
          targetCalories: goal.dailyCalories,
          logged: loggedCount > 0,
          entryCount: mEntries.length,
          workoutCount: mWorkouts.length,
          workoutMinutes: mWorkouts.reduce((s, w) => s + w.durationMinutes, 0),
          loggedDays: loggedCount,
          calendarDays: totalDays,
          missingDays: totalDays - loggedCount,
        };
      });
    }

    // Weekly local
    const from = parseISO(`${range.from}T12:00:00`);
    const to = parseISO(`${range.to}T12:00:00`);
    const diff = Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
    return Array.from({ length: diff + 1 }, (_, i) => {
      const d = addDays(from, i);
      const iso = format(d, 'yyyy-MM-dd');
      const items = actualEntries.filter((e) => e.date === iso);
      const nut = sumNutrition(items);
      const goal = getGoalForDate(data.goals, iso) ?? fallbackGoal;
      const workouts = data.workouts.filter((w) => w.date === iso);
      const burnedCals = workouts.reduce((s, w) => s + (w.estimatedCalories ?? 0), 0);
      const foodCals = items.length ? Math.round(nut.calories) : 0;

      return {
        date: iso,
        displayLabel: format(d, 'EEE'),
        fullLabel: format(d, 'EEE, MMM d, yyyy'),
        calories: foodCals,
        workoutCalories: burnedCals,
        netCalories: foodCals - burnedCals,
        protein: items.length ? Math.round(nut.protein) : 0,
        carbohydrates: items.length ? Math.round(nut.carbohydrates) : 0,
        fat: items.length ? Math.round(nut.fat) : 0,
        fiber: items.length ? Math.round(nut.fiber) : 0,
        targetCalories: goal.dailyCalories,
        logged: items.length > 0,
        entryCount: items.length,
        workoutCount: workouts.length,
        workoutMinutes: workouts.reduce((s, w) => s + w.durationMinutes, 0),
      };
    });
  }, [actualEntries, data.goals, data.workouts, isAuthenticated, period, periodData, range.from, range.to, selectedMonth, selectedYear]);

  // -------------------------------------------------------------
  // PERIOD AGGREGATES & METRICS
  // -------------------------------------------------------------
  const periodTotalCalories = chartRows.reduce((sum, r) => sum + r.calories, 0);
  const periodTotalBurned = chartRows.reduce((sum, r) => sum + r.workoutCalories, 0);
  const periodTotalNet = periodTotalCalories - periodTotalBurned;
  const periodTotalProtein = chartRows.reduce((sum, r) => sum + r.protein, 0);
  const periodTotalCarbs = chartRows.reduce((sum, r) => sum + r.carbohydrates, 0);
  const periodTotalFat = chartRows.reduce((sum, r) => sum + r.fat, 0);
  const periodTotalFiber = chartRows.reduce((sum, r) => sum + r.fiber, 0);

  const loggedRows = chartRows.filter((r) => r.logged);
  const loggedDays = loggedRows.length;
  const rangeDays = chartRows.length;

  const averageDailyIntake = loggedDays > 0 ? Math.round(periodTotalCalories / loggedDays) : 0;
  const averageDailyNet = loggedDays > 0 ? Math.round(periodTotalNet / loggedDays) : 0;
  const avgDailyProtein = loggedDays > 0 ? Math.round(periodTotalProtein / loggedDays) : 0;
  const avgDailyCarbs = loggedDays > 0 ? Math.round(periodTotalCarbs / loggedDays) : 0;
  const avgDailyFat = loggedDays > 0 ? Math.round(periodTotalFat / loggedDays) : 0;
  const avgDailyFiber = loggedDays > 0 ? Math.round(periodTotalFiber / loggedDays) : 0;

  // Monthly breakdown metrics
  const isCurrentMonth = period === 'monthly' && selectedMonth === format(new Date(), 'yyyy-MM');
  const monthCalendarDays = period === 'monthly' ? endOfMonth(parseISO(`${selectedMonth}-01T12:00:00`)).getDate() : rangeDays;
  const daysElapsedInMonth = isCurrentMonth ? new Date().getDate() : monthCalendarDays;
  const avgAcrossAllCalendarDays = daysElapsedInMonth > 0 ? Math.round(periodTotalCalories / daysElapsedInMonth) : 0;

  // Highest and lowest intake days
  const loggedOnlyIntake = loggedRows.filter((r) => r.calories > 0);
  const highestIntakeDay = loggedOnlyIntake.length
    ? loggedOnlyIntake.reduce((max, r) => (r.calories > max.calories ? r : max), loggedOnlyIntake[0])
    : null;
  const lowestIntakeDay = loggedOnlyIntake.length
    ? loggedOnlyIntake.reduce((min, r) => (r.calories < min.calories ? r : min), loggedOnlyIntake[0])
    : null;

  // Target adherence & period budget totals
  const periodTotalTargetCalories = chartRows.reduce((sum, r) => sum + r.targetCalories, 0);
  const calorieBudgetDifference = periodTotalCalories - periodTotalTargetCalories;
  const daysOnOrUnder = loggedRows.filter((r) => r.calories <= r.targetCalories).length;
  const daysAboveTarget = loggedRows.filter((r) => r.calories > r.targetCalories).length;
  const targetAdherencePct = loggedDays > 0 ? Math.round((daysOnOrUnder / loggedDays) * 100) : 0;

  // Workouts in period
  const totalWorkoutsCount = chartRows.reduce((sum, r) => sum + (r.workoutCount ?? 0), 0);
  const totalWorkoutMinutes = chartRows.reduce((sum, r) => sum + (r.workoutMinutes ?? 0), 0);

  // Weight rows for chart (unconditional hook)
  const weightRows = useMemo(() => {
    if (isAuthenticated && periodData?.weight?.points && periodData.weight.points.length > 0) {
      return periodData.weight.points.map((pt) => ({
        date: pt.date,
        weight: Number(pt.weightKg),
      }));
    }
    const currentWeights = data.weights
      .filter((w) => {
        if (period === 'weekly') return w.date >= range.from && w.date <= range.to;
        if (period === 'monthly') return w.date.startsWith(selectedMonth);
        return w.date.startsWith(`${selectedYear}-`);
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((w) => ({ date: w.date, weight: w.weightKg }));

    if (currentWeights.length) return currentWeights;
    return [];
  }, [data.weights, isAuthenticated, period, periodData, range.from, range.to, selectedMonth, selectedYear]);

  // Exercise totals for period (unconditional hook)
  const exerciseTotals = useMemo(() => {
    if (isAuthenticated && periodData?.exercise) {
      return periodData.exercise;
    }
    const relevantWorkouts = data.workouts.filter((w) => {
      if (period === 'weekly') return w.date >= range.from && w.date <= range.to;
      if (period === 'monthly') return w.date.startsWith(selectedMonth);
      return w.date.startsWith(`${selectedYear}-`);
    });
    return {
      sessionCount: relevantWorkouts.length,
      durationMinutes: relevantWorkouts.reduce((s, w) => s + w.durationMinutes, 0),
      estimatedCalories: relevantWorkouts.reduce((s, w) => s + (w.estimatedCalories ?? 0), 0) || null,
    };
  }, [data.workouts, isAuthenticated, period, periodData, range.from, range.to, selectedMonth, selectedYear]);

  // Weekly breakdown chunks within a month (Weeks 1 to 5)
  const monthlyWeeksBreakdown = useMemo(() => {
    if (period !== 'monthly' || chartRows.length === 0) return [];
    const chunks: { label: string; days: ChartRow[]; food: number; burned: number; net: number; workouts: number }[] = [];
    const chunkSize = 7;
    for (let i = 0; i < chartRows.length; i += chunkSize) {
      const slice = chartRows.slice(i, i + chunkSize);
      const weekNum = Math.floor(i / chunkSize) + 1;
      const startDay = i + 1;
      const endDay = Math.min(i + chunkSize, chartRows.length);
      const food = slice.reduce((s, r) => s + r.calories, 0);
      const burned = slice.reduce((s, r) => s + r.workoutCalories, 0);
      chunks.push({
        label: `Week ${weekNum} (Days ${startDay}–${endDay})`,
        days: slice,
        food,
        burned,
        net: food - burned,
        workouts: slice.reduce((s, r) => s + r.workoutCount, 0),
      });
    }
    return chunks;
  }, [chartRows, period]);

  const hasTrend = chartRows.some((row) => row.calories > 0 || row.workoutCalories > 0);

  // Pagination calculations for Daily Audit Table
  const totalAuditRows = chartRows.length;
  const totalAuditPages = Math.max(1, Math.ceil(totalAuditRows / auditPageSize));
  const currentAuditPage = Math.min(Math.max(1, auditPage), totalAuditPages);
  const auditStartIndex = (currentAuditPage - 1) * auditPageSize;
  const auditEndIndex = Math.min(auditStartIndex + auditPageSize, totalAuditRows);
  const paginatedAuditRows = useMemo(() => {
    return chartRows.slice(auditStartIndex, auditEndIndex);
  }, [chartRows, auditStartIndex, auditEndIndex]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="METABOLIC & NUTRITION INTELLIGENCE"
        title="Analytics & balance"
        subtitle="Track your food intake, workout expenditure, net calorie balance, and long-term health trends."
        action={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isLoading && <Loader2 size={14} className="animate-spin text-muted" />}
            {isAuthenticated ? (
              <StatusPill tone="success">Synced with backend</StatusPill>
            ) : (
              <StatusPill tone="neutral">Local guest data</StatusPill>
            )}
          </div>
        }
      />

      {/* Period Selection & Context Navigation Bar */}
      <Card className="analytics-filters">
        <div className="period-tabs" role="tablist" aria-label="Analytics time period">
          {periods.map(({ key, label }) => (
            <button
              type="button"
              role="tab"
              aria-selected={period === key}
              className={period === key ? 'active' : ''}
              key={key}
              onClick={() => {
                setPeriod(key);
                setLoadError(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Dynamic Navigation Toolbar per Period */}
        <div className="analytics-nav-bar">
          {period === 'daily' && (
            <div className="analytics-nav-group">
              <div className="nav-controls-row">
                <button
                  type="button"
                  className="nav-arrow-btn"
                  onClick={() => shiftDay(-1)}
                  aria-label="Previous day"
                  title="Previous day"
                >
                  <ChevronLeft size={16} />
                </button>
                <input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  aria-label="Select date"
                  className="analytics-date-input"
                />
                <button
                  type="button"
                  className="nav-arrow-btn"
                  onClick={() => shiftDay(1)}
                  aria-label="Next day"
                  title="Next day"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  className="today-badge-btn"
                  onClick={() => setSelectedDay(todayISO())}
                >
                  Today
                </button>
              </div>
              <span className="period-indicator">
                {format(parseISO(`${selectedDay}T12:00:00`), 'EEEE, MMM d, yyyy')}
              </span>
            </div>
          )}

          {period === 'weekly' && (
            <div className="analytics-nav-group">
              <div className="nav-controls-row">
                <button
                  type="button"
                  className="nav-arrow-btn"
                  onClick={() => shiftWeek(-1)}
                  aria-label="Previous week"
                  title="Previous week"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  className="today-badge-btn"
                  onClick={setThisWeek}
                  title="Return to current week"
                >
                  This week
                </button>
                <button
                  type="button"
                  className="nav-arrow-btn"
                  onClick={() => shiftWeek(1)}
                  aria-label="Next week"
                  title="Next week"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <span className="period-indicator" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CalendarRange size={14} style={{ color: '#244c3a' }} />
                <span>
                  {format(parseISO(`${range.from}T12:00:00`), 'EEE, MMM d')} –{' '}
                  {format(parseISO(`${range.to}T12:00:00`), 'EEE, MMM d, yyyy')}
                </span>
              </span>
            </div>
          )}

          {period === 'monthly' && (
            <div className="analytics-nav-group">
              <div className="nav-controls-row">
                <button
                  type="button"
                  className="nav-arrow-btn"
                  onClick={() => shiftMonth(-1)}
                  aria-label="Previous month"
                  title="Previous month"
                >
                  <ChevronLeft size={16} />
                </button>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  aria-label="Select month"
                  className="analytics-date-input"
                />
                <button
                  type="button"
                  className="nav-arrow-btn"
                  onClick={() => shiftMonth(1)}
                  aria-label="Next month"
                  title="Next month"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  className="today-badge-btn"
                  onClick={() => setSelectedMonth(format(new Date(), 'yyyy-MM'))}
                >
                  This month
                </button>
              </div>
              <span className="period-indicator">
                {format(parseISO(`${selectedMonth}-01T12:00:00`), 'MMMM yyyy')}{' '}
                <small style={{ fontWeight: 600, color: isCurrentMonth ? '#b45309' : '#15803d' }}>
                  ({isCurrentMonth ? `Month-to-date: ${daysElapsedInMonth} of ${monthCalendarDays} days` : `Full month: ${monthCalendarDays} days`})
                </small>
              </span>
            </div>
          )}

          {period === 'yearly' && (
            <div className="analytics-nav-group">
              <div className="nav-controls-row">
                <button
                  type="button"
                  className="nav-arrow-btn"
                  onClick={() => shiftYear(-1)}
                  aria-label="Previous year"
                  title="Previous year"
                >
                  <ChevronLeft size={16} />
                </button>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  aria-label="Select year"
                  className="analytics-date-input"
                >
                  {Array.from({ length: 7 }, (_, i) => 2023 + i).map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="nav-arrow-btn"
                  onClick={() => shiftYear(1)}
                  aria-label="Next year"
                  title="Next year"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  className="today-badge-btn"
                  onClick={() => setSelectedYear(new Date().getFullYear())}
                >
                  This year
                </button>
              </div>
              <span className="period-indicator">Year {selectedYear}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Error state */}
      {loadError && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '12px 16px', background: '#fff3f1', border: '1px solid #f8d7da', borderRadius: '12px', color: '#b54842' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{loadError}</span>
          </div>
          <Button size="sm" tone="secondary" onClick={() => void fetchAnalytics()}>
            <RotateCcw size={13} /> Retry
          </Button>
        </div>
      )}

      {/* ============================================================= */}
      {/* 1. DAILY VIEW                                                 */}
      {/* ============================================================= */}
      {period === 'daily' && (
        <div style={{ display: 'grid', gap: '16px' }}>
          {/* Daily 4-Metric Hero Cards */}
          <div className="analytics-stat-grid">
            <StatCard
              icon={<Utensils size={18} />}
              label="Food intake"
              value={`${formatNumber(daySummary.intake.calories)} kcal`}
              detail={`${daySummary.entryCount} ${daySummary.entryCount === 1 ? 'meal logged' : 'meals logged'}`}
              tone="green"
            />
            <StatCard
              icon={<Flame size={18} />}
              label="Workouts burned"
              value={`${formatNumber(daySummary.burnedCalories)} kcal`}
              detail={`${daySummary.exercise?.sessionCount ?? 0} ${daySummary.exercise?.sessionCount === 1 ? 'workout' : 'workouts'} (${daySummary.exercise?.durationMinutes ?? 0} min)`}
              tone="coral"
            />
            <StatCard
              icon={<Zap size={18} />}
              label="Net calorie intake"
              value={`${formatNumber(daySummary.netCalories)} kcal`}
              detail="Food intake − Workout burned"
              tone="sage"
            />
            <StatCard
              icon={<Target size={18} />}
              label="Daily food target"
              value={`${formatNumber(daySummary.targetCalories)} kcal`}
              detail={`Effective goal on ${format(parseISO(`${selectedDay}T12:00:00`), 'MMM d')}`}
              tone="gold"
            />
          </div>

          {/* Calorie Check-In & Dual Target Comparisons */}
          <div className="dashboard-hero-grid">
            <Card className="calorie-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">CLEAR TARGET ACCOUNTING</p>
                  <h2>Food vs Net comparisons</h2>
                </div>
                <span className="soft-icon green-soft">
                  <Flame size={18} />
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginTop: '8px' }}>
                {/* 1. Food Intake vs Target */}
                <div style={{ padding: '14px', background: '#f8faf7', borderRadius: '12px', border: '1px solid #e5ede3' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', color: '#657363' }}>
                      FOOD INTAKE VS TARGET
                    </span>
                    <span className={`remaining-badge ${daySummary.foodVsTarget > 0 ? 'over' : ''}`} style={{ margin: 0 }}>
                      {daySummary.foodVsTarget > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      <span>{Math.abs(daySummary.foodVsTarget)} kcal {daySummary.foodVsTarget > 0 ? 'above' : 'below'}</span>
                    </span>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#244c3a', fontFamily: 'Manrope' }}>
                    {formatNumber(daySummary.intake.calories)}{' '}
                    <small style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#738073' }}>
                      / {formatNumber(daySummary.targetCalories)} kcal target
                    </small>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#657363', marginTop: '6px', lineHeight: 1.4 }}>
                    {daySummary.foodVsTarget > 0
                      ? `Food intake is ${formatNumber(daySummary.foodVsTarget)} kcal above your configured target.`
                      : `Food intake is ${formatNumber(Math.abs(daySummary.foodVsTarget))} kcal within your food allowance.`}
                  </p>
                </div>

                {/* 2. Net Intake vs Target */}
                <div style={{ padding: '14px', background: '#f8faf7', borderRadius: '12px', border: '1px solid #e5ede3' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', color: '#657363' }}>
                      NET INTAKE VS TARGET
                    </span>
                    <span className={`remaining-badge ${daySummary.netVsTarget > 0 ? 'over' : ''}`} style={{ margin: 0 }}>
                      {daySummary.netVsTarget > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      <span>{Math.abs(daySummary.netVsTarget)} kcal {daySummary.netVsTarget > 0 ? 'above' : 'below'}</span>
                    </span>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#244c3a', fontFamily: 'Manrope' }}>
                    {formatNumber(daySummary.netCalories)}{' '}
                    <small style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#738073' }}>
                      / {formatNumber(daySummary.targetCalories)} kcal target
                    </small>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#657363', marginTop: '6px', lineHeight: 1.4 }}>
                    {daySummary.burnedCalories > 0
                      ? `After accounting for ${formatNumber(daySummary.burnedCalories)} kcal of exercise, net intake is ${formatNumber(Math.abs(daySummary.netVsTarget))} kcal ${daySummary.netVsTarget > 0 ? 'above' : 'below'} target.`
                      : 'No workouts recorded yet today. Net calories currently equal food intake.'}
                  </p>
                </div>
              </div>

              <div className="formula-callout" style={{ marginTop: '14px' }}>
                <strong>Accounting Rule:</strong> Food intake ({formatNumber(daySummary.intake.calories)} kcal) − Workout burned ({formatNumber(daySummary.burnedCalories)} kcal) = Net intake ({formatNumber(daySummary.netCalories)} kcal). Both metrics are preserved distinctly so you never lose visibility into raw meal consumption.
              </div>
            </Card>

            {/* Daily Macronutrients */}
            <Card className="macro-panel">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">NUTRIENT TARGETS</p>
                  <h2>Macros &amp; fiber</h2>
                </div>
                <span className="quiet-note">Grams</span>
              </div>
              <div className="macro-list">
                <div className="macro-row">
                  <span className="macro-mark macro-green">P</span>
                  <div className="macro-content">
                    <div className="macro-label-line">
                      <strong>Protein</strong>
                      <span>{formatNumber(daySummary.intake.protein)}<small> / {formatNumber(daySummary.targetProtein)} g</small></span>
                    </div>
                    <ProgressBar value={daySummary.intake.protein} target={daySummary.targetProtein} tone="green" />
                  </div>
                </div>
                <div className="macro-row">
                  <span className="macro-mark macro-coral">C</span>
                  <div className="macro-content">
                    <div className="macro-label-line">
                      <strong>Carbohydrates</strong>
                      <span>{formatNumber(daySummary.intake.carbohydrates)}<small> / {formatNumber(daySummary.targetCarbs)} g</small></span>
                    </div>
                    <ProgressBar value={daySummary.intake.carbohydrates} target={daySummary.targetCarbs} tone="coral" />
                  </div>
                </div>
                <div className="macro-row">
                  <span className="macro-mark macro-gold">F</span>
                  <div className="macro-content">
                    <div className="macro-label-line">
                      <strong>Fat</strong>
                      <span>{formatNumber(daySummary.intake.fat)}<small> / {formatNumber(daySummary.targetFat)} g</small></span>
                    </div>
                    <ProgressBar value={daySummary.intake.fat} target={daySummary.targetFat} tone="gold" />
                  </div>
                </div>
                <div className="macro-row">
                  <span className="macro-mark macro-blue">Fi</span>
                  <div className="macro-content">
                    <div className="macro-label-line">
                      <strong>Fiber</strong>
                      <span>{formatNumber(daySummary.intake.fiber)}<small> / {formatNumber(daySummary.targetFiber)} g</small></span>
                    </div>
                    <ProgressBar value={daySummary.intake.fiber} target={daySummary.targetFiber} tone="blue" />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Meal Breakdown for Breakfast, Lunch, Dinner, Snacks */}
          <div className="section-title-row">
            <div>
              <p className="eyebrow">CONFIRMED MEALS</p>
              <h2>Meal category breakdown</h2>
            </div>
            <span className="quiet-note">
              {daySummary.entryCount} total {daySummary.entryCount === 1 ? 'food entry' : 'food entries'}
            </span>
          </div>

          <div className="daily-meals-grid">
            {MEAL_ORDER.map((mealCat) => {
              const mealInfo = daySummary.meals.find((m) => m.meal === mealCat);
              const count = mealInfo?.entryCount ?? 0;
              const totals = mealInfo?.totals ?? { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 };
              const hasEntries = count > 0;

              return (
                <div className="daily-meal-card" key={mealCat}>
                  <div className="daily-meal-header">
                    <span className="daily-meal-title">
                      {MEAL_ICONS[mealCat]} {MEAL_LABELS[mealCat]}
                    </span>
                    <span className="daily-meal-count">
                      {count} {count === 1 ? 'food' : 'foods'}
                    </span>
                  </div>
                  {hasEntries ? (
                    <>
                      <div className="daily-meal-calories">
                        {formatNumber(totals.calories)} <small style={{ fontSize: '11px', color: '#7a8579' }}>kcal</small>
                      </div>
                      <div className="daily-meal-macros">
                        <span><strong>{formatNumber(totals.protein)}g</strong> P</span>
                        <span>·</span>
                        <span><strong>{formatNumber(totals.carbohydrates)}g</strong> C</span>
                        <span>·</span>
                        <span><strong>{formatNumber(totals.fat)}g</strong> F</span>
                        <span>·</span>
                        <span><strong>{formatNumber(totals.fiber)}g</strong> Fi</span>
                      </div>
                    </>
                  ) : (
                    <div className="daily-meal-empty">No food logged for {MEAL_LABELS[mealCat].toLowerCase()}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Daily Movement & Weight Check */}
          <div className="analytics-two-col">
            <Card className="activity-summary-card">
              <span className="activity-summary-icon">
                <Dumbbell size={18} />
              </span>
              <div className="activity-summary-copy">
                <p className="eyebrow">TODAY’S EXERCISE</p>
                <strong>
                  {daySummary.exercise?.sessionCount
                    ? `${daySummary.exercise.sessionCount} ${daySummary.exercise.sessionCount === 1 ? 'session' : 'sessions'} completed`
                    : 'No workouts recorded'}
                </strong>
                <span>
                  {daySummary.exercise?.sessionCount
                    ? 'Exercise calories are recorded distinctly; they do not overwrite food records.'
                    : 'Log movement in Workouts to record completed sets and cardio.'}
                </span>
              </div>
              <div className="activity-summary-stats">
                <span>
                  <Clock3 size={14} /> <strong>{formatNumber(daySummary.exercise?.durationMinutes ?? 0)}</strong>
                  <small>min</small>
                </span>
                {daySummary.exercise?.estimatedCalories != null && (
                  <span>
                    <Flame size={14} /> <strong>~{formatNumber(daySummary.exercise.estimatedCalories)}</strong>
                    <small>kcal burned</small>
                  </span>
                )}
              </div>
            </Card>

            <Card className="activity-summary-card">
              <span className="activity-summary-icon" style={{ color: '#987540', background: '#fbf2df' }}>
                <Scale size={18} />
              </span>
              <div className="activity-summary-copy">
                <p className="eyebrow">RECORDED BODY WEIGHT</p>
                <strong>
                  {daySummary.weightKg != null
                    ? `${Number(daySummary.weightKg).toFixed(1)} kg`
                    : 'No weigh-in recorded'}
                </strong>
                <span>
                  {daySummary.weightKg != null
                    ? 'Logged on this date. Weight is user-entered and never inferred.'
                    : 'Add a dated weigh-in in Weight & Goals whenever you are ready.'}
                </span>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 2. WEEKLY & MONTHLY & YEARLY VIEWS                            */}
      {/* ============================================================= */}
      {period !== 'daily' && (
        <>
          {/* Exercise Activity Banner */}
          {exerciseTotals && (exerciseTotals.sessionCount > 0 || exerciseTotals.durationMinutes > 0) && (
            <Card className="activity-summary-card">
              <div className="activity-summary-icon">
                <Flame size={18} />
              </div>
              <div className="activity-summary-copy">
                <strong>
                  Workouts in this {period === 'weekly' ? 'week' : period === 'monthly' ? 'month' : 'period'} ({exerciseTotals.sessionCount} {exerciseTotals.sessionCount === 1 ? 'session' : 'sessions'})
                </strong>
                <span>Exercise calories burned (~{formatNumber(exerciseTotals.estimatedCalories ?? 0)} kcal) are recorded separately from food intake.</span>
              </div>
              <div className="activity-summary-stats">
                <span>
                  <strong>{exerciseTotals.sessionCount}</strong>{' '}
                  <small>{exerciseTotals.sessionCount === 1 ? 'workout' : 'workouts'}</small>
                </span>
                <span>
                  <strong>{exerciseTotals.durationMinutes}</strong> <small>mins</small>
                </span>
                {exerciseTotals.estimatedCalories != null && (
                  <span>
                    <strong>~{formatNumber(exerciseTotals.estimatedCalories)}</strong>{' '}
                    <small>kcal burned</small>
                  </span>
                )}
              </div>
            </Card>
          )}

          {/* Summary Stat Grid */}
          <div className="analytics-stat-grid">
            <StatCard
              icon={<Utensils size={18} />}
              label={period === 'weekly' ? 'Weekly food intake' : period === 'monthly' ? 'Monthly food intake' : 'Annual food intake'}
              value={`${formatNumber(periodTotalCalories)} kcal`}
              detail={
                period === 'monthly'
                  ? `Goal: ${formatNumber(periodTotalTargetCalories)} kcal (${rangeDays} days) · Avg: ${formatNumber(averageDailyIntake)} kcal/logged day (${formatNumber(avgAcrossAllCalendarDays)} kcal/day)`
                  : period === 'weekly'
                    ? `Goal: ${formatNumber(periodTotalTargetCalories)} kcal (7 days) · Avg: ${formatNumber(averageDailyIntake)} kcal/day`
                    : `Goal: ${formatNumber(periodTotalTargetCalories)} kcal · Intake: ${formatNumber(periodTotalCalories)} kcal`
              }
              tone="green"
            />
            <StatCard
              icon={<Flame size={18} />}
              label={period === 'weekly' ? 'Weekly workout burned' : period === 'monthly' ? 'Monthly workout burned' : 'Annual workout burned'}
              value={`${formatNumber(periodTotalBurned)} kcal`}
              detail={`${totalWorkoutsCount} ${totalWorkoutsCount === 1 ? 'workout' : 'workouts'} (${formatNumber(totalWorkoutMinutes)} mins total)`}
              tone="coral"
            />
            <StatCard
              icon={<Zap size={18} />}
              label="Net calorie intake"
              value={`${formatNumber(periodTotalNet)} kcal`}
              detail={
                loggedDays > 0
                  ? `Avg net ${formatNumber(averageDailyNet)} kcal/day (${formatNumber(periodTotalCalories)} food − ${formatNumber(periodTotalBurned)} burned)`
                  : 'Food intake − Workout burned'
              }
              tone="sage"
            />
            <StatCard
              icon={<Target size={18} />}
              label="Target adherence"
              value={loggedDays > 0 ? `${targetAdherencePct}%` : '—'}
              detail={
                loggedDays > 0
                  ? `${daysOnOrUnder} on/under target · ${daysAboveTarget} above target`
                  : 'No logged days to evaluate'
              }
              tone="gold"
            />
          </div>

          {/* Period Calorie Budget & Adherence Banner */}
          <Card className="calorie-budget-card">
            <div className="calorie-budget-header">
              <div className="calorie-budget-title">
                <span className="calorie-budget-icon">
                  <Target size={18} />
                </span>
                <div>
                  <p className="eyebrow">
                    {period === 'weekly' ? 'WEEKLY CALORIE BUDGET' : period === 'monthly' ? 'MONTHLY CALORIE BUDGET' : 'ANNUAL CALORIE BUDGET'}
                  </p>
                  <h3>
                    Target: <strong>{formatNumber(periodTotalTargetCalories)} kcal</strong> for this {period === 'weekly' ? 'week' : period === 'monthly' ? 'month' : 'period'}
                  </h3>
                </div>
              </div>
              <span className={`budget-status-pill ${calorieBudgetDifference <= 0 ? 'budget-under' : 'budget-over'}`}>
                {calorieBudgetDifference <= 0
                  ? `${formatNumber(Math.abs(calorieBudgetDifference))} kcal under budget`
                  : `+${formatNumber(calorieBudgetDifference)} kcal over budget`}
              </span>
            </div>

            <div className="calorie-budget-metrics">
              <div className="budget-metric">
                <span className="budget-metric-label">Food Intake</span>
                <strong className="budget-metric-val">{formatNumber(periodTotalCalories)} kcal</strong>
                <small className="budget-metric-sub">
                  {periodTotalTargetCalories > 0
                    ? `${Math.round((periodTotalCalories / periodTotalTargetCalories) * 100)}% of total budget`
                    : '—'}
                </small>
              </div>

              <div className="budget-metric">
                <span className="budget-metric-label">Workout Burned</span>
                <strong className="budget-metric-val" style={{ color: '#aa634f' }}>
                  −{formatNumber(periodTotalBurned)} kcal
                </strong>
                <small className="budget-metric-sub">{totalWorkoutsCount} exercise sessions</small>
              </div>

              <div className="budget-metric">
                <span className="budget-metric-label">Net Calorie Total</span>
                <strong className="budget-metric-val" style={{ color: '#244c3a' }}>
                  {formatNumber(periodTotalNet)} kcal
                </strong>
                <small className="budget-metric-sub">
                  {formatNumber(periodTotalNet - periodTotalTargetCalories)} vs budget
                </small>
              </div>

              <div className="budget-metric">
                <span className="budget-metric-label">Daily Target Basis</span>
                <strong className="budget-metric-val" style={{ color: '#657363' }}>
                  ~{formatNumber(Math.round(periodTotalTargetCalories / (rangeDays || 1)))} kcal/day
                </strong>
                <small className="budget-metric-sub">
                  Calculated from your active Goal plan
                </small>
              </div>
            </div>

            <p className="budget-explanation">
              💡 <strong>Automatic Goal Adjustment:</strong> Whenever you change your goal from <em>Weight loss</em> to <em>Weight gain</em> or <em>Maintenance</em> in <strong>Goals</strong>, the target adapts instantly across all calendar days (e.g. 7 days × {formatNumber(Math.round(periodTotalTargetCalories / (rangeDays || 1)))} kcal/day for Weekly, or {rangeDays} days × daily target for Monthly).
            </p>
          </Card>

          {/* Highlights Banner: Highs & Lows & Averages */}
          {loggedDays > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '12px',
                padding: '14px 16px',
                background: '#ffffff',
                border: '1px solid #e7ece4',
                borderRadius: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ padding: '6px', borderRadius: '8px', background: '#f0fdf4', color: '#15803d' }}>
                  <Leaf size={16} />
                </span>
                <div>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#657363', textTransform: 'uppercase' }}>
                    Average Daily Macros
                  </span>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#244c3a', marginTop: '2px' }}>
                    {avgDailyProtein}g P · {avgDailyCarbs}g C · {avgDailyFat}g F · {avgDailyFiber}g Fi
                  </div>
                </div>
              </div>

              {highestIntakeDay && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ padding: '6px', borderRadius: '8px', background: '#fff1f2', color: '#e11d48' }}>
                    <ArrowUpRight size={16} />
                  </span>
                  <div>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#657363', textTransform: 'uppercase' }}>
                      Highest Intake Day
                    </span>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#244c3a', marginTop: '2px' }}>
                      {highestIntakeDay.fullLabel}: {formatNumber(highestIntakeDay.calories)} kcal
                    </div>
                  </div>
                </div>
              )}

              {lowestIntakeDay && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ padding: '6px', borderRadius: '8px', background: '#ecfdf5', color: '#059669' }}>
                    <ArrowDownRight size={16} />
                  </span>
                  <div>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#657363', textTransform: 'uppercase' }}>
                      Lowest Intake Day
                    </span>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#244c3a', marginTop: '2px' }}>
                      {lowestIntakeDay.fullLabel}: {formatNumber(lowestIntakeDay.calories)} kcal
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Interactive Multi-Metric Calorie Comparison Chart */}
          <Card className="analytics-chart-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">
                  {period === 'weekly' ? '7-DAY COMPARISON' : period === 'monthly' ? 'MONTHLY CALORIE DYNAMICS' : 'ANNUAL TRENDS'}
                </p>
                <h2>Food intake, burned &amp; net calories</h2>
                <p className="card-subtitle">
                  Compare total calories consumed from meals, workout energy burned, and resulting net intake against daily targets.
                </p>
              </div>
              <span className="chart-legend">
                <i className="legend-dot" style={{ background: '#244c3a' }} /> Food{' '}
                <i className="legend-dot" style={{ background: '#f08a70' }} /> Burned{' '}
                <i className="legend-dot" style={{ background: '#059669' }} /> Net{' '}
                <i className="legend-line" style={{ borderTop: '2px dashed #b91c1c' }} /> Target
              </span>
            </div>
            {hasTrend ? (
              <div className="chart-wrap chart-tall" role="img" aria-label="Calorie dynamics chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartRows} margin={{ top: 16, right: 6, bottom: 4, left: -12 }}>
                    <CartesianGrid stroke="#edf0e9" vertical={false} />
                    <XAxis
                      dataKey="displayLabel"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#8b918a', fontSize: 11 }}
                    />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#8b918a', fontSize: 11 }} width={42} />
                    <Tooltip
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ''}
                      formatter={(val, name) => [`${formatNumber(Number(val))} kcal`, name]}
                      contentStyle={{
                        border: '1px solid #e5e8df',
                        borderRadius: 12,
                        background: 'rgba(255, 255, 255, 0.96)',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                        padding: '10px 14px',
                        fontSize: '12px',
                        lineHeight: '1.4',
                        maxWidth: '260px',
                      }}
                      wrapperStyle={{ zIndex: 100 }}
                    />
                    <Legend />
                    <Bar dataKey="calories" name="Food intake" fill="#244c3a" radius={[6, 6, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="workoutCalories" name="Workouts burned" fill="#f08a70" radius={[6, 6, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="netCalories" name="Net intake" fill="#059669" radius={[6, 6, 0, 0]} maxBarSize={32} />
                    <Line dataKey="targetCalories" name="Daily target" stroke="#b91c1c" strokeDasharray="5 5" dot={false} strokeWidth={2} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                icon={<ChartNoAxesColumnIncreasing size={20} />}
                title="No nutrition or workout records in this period"
                detail={
                  isAuthenticated
                    ? 'No confirmed entries found. Log meals in Diary or movement in Workouts to populate your chart.'
                    : 'Log meals or workouts to visualize your calorie trends.'
                }
              />
            )}
            <p className="chart-footnote">
              Net calories = Food intake − Workout calories burned. Targets follow the historical goal effective on each date.
            </p>
          </Card>

          {/* Macro Balance & Weight Progress Charts */}
          <div className="analytics-two-col">
            <Card className="analytics-chart-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">MACRONUTRIENT BALANCE</p>
                  <h2>Daily nutrients</h2>
                </div>
                <span className="quiet-note">grams</span>
              </div>
              {hasTrend ? (
                <div className="chart-wrap" role="img" aria-label="Macronutrient trends">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartRows} margin={{ top: 10, right: 0, bottom: 0, left: -18 }}>
                      <CartesianGrid stroke="#edf0e9" vertical={false} />
                      <XAxis
                        dataKey="displayLabel"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#8b918a', fontSize: 10 }}
                      />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: '#8b918a', fontSize: 10 }} width={36} />
                      <Tooltip
                        formatter={(value) => [`${formatNumber(Number(value))} g`, '']}
                        contentStyle={{
                          border: '1px solid #e5e8df',
                          borderRadius: 12,
                          background: 'rgba(255, 255, 255, 0.96)',
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                          padding: '8px 12px',
                          fontSize: '12px',
                        }}
                      />
                      <Line dataKey="protein" name="Protein" stroke="#244c3a" strokeWidth={2.4} dot={false} />
                      <Line dataKey="carbohydrates" name="Carbohydrates" stroke="#f08a70" strokeWidth={2.4} dot={false} />
                      <Line dataKey="fat" name="Fat" stroke="#e4a34a" strokeWidth={2.4} dot={false} />
                      <Line dataKey="fiber" name="Fiber" stroke="#7396ad" strokeWidth={2.4} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  title="Macro trends will grow here"
                  detail="Log meals in your Diary to see your macro balance."
                />
              )}
              <div className="chart-legend macro-legend">
                <span><i className="legend-dot" /> Protein</span>
                <span><i className="legend-dot legend-coral" /> Carbs</span>
                <span><i className="legend-dot legend-gold" /> Fat</span>
                <span><i className="legend-dot legend-blue" /> Fiber</span>
              </div>
            </Card>

            <Card className="analytics-chart-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">WEIGHT OVER TIME</p>
                  <h2>Weight progress</h2>
                </div>
                <StatusPill tone="neutral">
                  {weightRows.length ? 'Recorded logs' : 'No weigh-ins'}
                </StatusPill>
              </div>
              {weightRows.length ? (
                <div className="chart-wrap" role="img" aria-label="Weight trend chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weightRows} margin={{ top: 10, right: 4, bottom: 0, left: -18 }}>
                      <CartesianGrid stroke="#edf0e9" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(val: string) => format(parseISO(`${val}T12:00:00`), 'MMM d')}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#8b918a', fontSize: 10 }}
                      />
                      <YAxis
                        domain={['dataMin - 1', 'dataMax + 1']}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#8b918a', fontSize: 10 }}
                        width={40}
                      />
                      <Tooltip
                        labelFormatter={(val) => format(parseISO(`${String(val)}T12:00:00`), 'MMM d, yyyy')}
                        formatter={(val) => [`${Number(val).toFixed(1)} kg`, 'Weight']}
                        contentStyle={{
                          border: '1px solid #e5e8df',
                          borderRadius: 12,
                          background: 'rgba(255, 255, 255, 0.96)',
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                          padding: '8px 12px',
                          fontSize: '12px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="#7396ad"
                        strokeWidth={2.6}
                        dot={{ r: 3, fill: '#7396ad', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  icon={<Scale size={20} />}
                  title="No weigh-ins in this period"
                  detail="Add weigh-ins in Weight & Goals to trace your progress."
                />
              )}
              <p className="chart-footnote">
                Weight measurements are user-entered and never inferred from calorie deficit or workouts.
              </p>
            </Card>
          </div>

          {/* ============================================================= */}
          {/* WEEKLY BREAKDOWN TABLE (When viewing Month)                    */}
          {/* ============================================================= */}
          {period === 'monthly' && monthlyWeeksBreakdown.length > 0 && (
            <Card className="analytics-chart-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">MONTHLY BREAKDOWN</p>
                  <h2>Weekly progression in {format(parseISO(`${selectedMonth}-01T12:00:00`), 'MMMM yyyy')}</h2>
                </div>
                <span className="quiet-note">{monthlyWeeksBreakdown.length} weekly segments</span>
              </div>
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Segment</th>
                      <th>Food Intake</th>
                      <th>Workout Burned</th>
                      <th>Net Intake</th>
                      <th>Workouts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyWeeksBreakdown.map((wb) => (
                      <tr key={wb.label}>
                        <td><strong>{wb.label}</strong></td>
                        <td>{formatNumber(wb.food)} kcal</td>
                        <td>{formatNumber(wb.burned)} kcal</td>
                        <td>
                          <span style={{ color: wb.net > 0 ? '#244c3a' : '#15803d', fontWeight: 600 }}>
                            {formatNumber(wb.net)} kcal
                          </span>
                        </td>
                        <td>{wb.workouts} {wb.workouts === 1 ? 'session' : 'sessions'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Day-by-Day Adherence Table for Weekly & Monthly */}
          {(period === 'weekly' || period === 'monthly') && (
            <Card className="analytics-chart-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">DAILY AUDIT TABLE</p>
                  <h2>Detailed day-by-day record</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="quiet-note">
                    {loggedDays} of {rangeDays} days logged
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#657363', fontWeight: 600 }}>Show:</span>
                    <select
                      className="audit-page-size-select"
                      value={auditPageSize}
                      onChange={(e) => {
                        setAuditPageSize(Number(e.target.value));
                        setAuditPage(1);
                      }}
                      aria-label="Daily audit rows per page"
                    >
                      <option value={7}>7 days</option>
                      <option value={14}>14 days</option>
                      <option value={31}>All days</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Food Intake</th>
                      <th>Workout Burned</th>
                      <th>Net Intake</th>
                      <th>Target</th>
                      <th>Food vs Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAuditRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#657363' }}>
                          No records found for this period.
                        </td>
                      </tr>
                    ) : (
                      paginatedAuditRows.map((row) => {
                        const isLogged = row.logged;
                        const foodDiff = isLogged ? row.calories - row.targetCalories : null;
                        return (
                          <tr key={row.date}>
                            <td><strong>{row.fullLabel}</strong></td>
                            <td>
                              {!isLogged ? (
                                <StatusPill tone="neutral">Not logged</StatusPill>
                              ) : foodDiff !== null && foodDiff <= 0 ? (
                                <StatusPill tone="success">Under target</StatusPill>
                              ) : (
                                <StatusPill tone="warning">Above target</StatusPill>
                              )}
                            </td>
                            <td>{isLogged ? `${formatNumber(row.calories)} kcal` : '—'}</td>
                            <td>{row.workoutCalories > 0 ? `${formatNumber(row.workoutCalories)} kcal` : '—'}</td>
                            <td>
                              {isLogged ? (
                                <span style={{ fontWeight: 600, color: '#244c3a' }}>
                                  {formatNumber(row.netCalories)} kcal
                                </span>
                              ) : '—'}
                            </td>
                            <td>{formatNumber(row.targetCalories)} kcal</td>
                            <td>
                              {foodDiff !== null ? (
                                <span style={{ color: foodDiff <= 0 ? '#15803d' : '#b54842', fontWeight: 600 }}>
                                  {foodDiff <= 0 ? '' : '+'}{formatNumber(foodDiff)} kcal
                                </span>
                              ) : '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalAuditPages > 1 && (
                <div className="audit-pagination-bar">
                  <span className="audit-pagination-info">
                    Showing <strong>{auditStartIndex + 1}–{auditEndIndex}</strong> of <strong>{totalAuditRows}</strong> days
                  </span>
                  <div className="audit-pagination-actions">
                    <button
                      type="button"
                      className="nav-arrow-btn"
                      onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                      disabled={currentAuditPage <= 1}
                      title="Previous page"
                      aria-label="Previous page"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="audit-page-number">
                      Page <strong>{currentAuditPage}</strong> of <strong>{totalAuditPages}</strong>
                    </span>
                    <button
                      type="button"
                      className="nav-arrow-btn"
                      onClick={() => setAuditPage((p) => Math.min(totalAuditPages, p + 1))}
                      disabled={currentAuditPage >= totalAuditPages}
                      title="Next page"
                      aria-label="Next page"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: 'green' | 'coral' | 'sage' | 'gold';
}) {
  return (
    <Card className="analytics-stat-card">
      <span className={`stat-icon stat-${tone}`}>{icon}</span>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </Card>
  );
}
