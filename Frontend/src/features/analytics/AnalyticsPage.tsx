import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { addDays, addMonths, endOfMonth, format, parseISO, startOfMonth, subDays, subMonths } from 'date-fns';
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
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
const periods: Period[] = ['daily', 'weekly', 'monthly', 'yearly'];

interface ChartRow {
  date: string;
  displayLabel: string;
  fullLabel: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  targetCalories: number;
  logged: boolean;
  entryCount?: number;
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

export function AnalyticsPage() {
  const { data, isAuthenticated } = useApp();
  const [period, setPeriod] = useState<Period>('daily');

  // Date selection states
  const [selectedDay, setSelectedDay] = useState<string>(todayISO());
  const [range, setRange] = useState({
    from: format(subDays(new Date(), 6), 'yyyy-MM-dd'),
    to: todayISO(),
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Data fetching states
  const [dailyData, setDailyData] = useState<BackendDayAnalytics | null>(null);
  const [periodData, setPeriodData] = useState<BackendPeriodAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        const diffDays = Math.round(
          (parseISO(`${range.to}T12:00:00`).getTime() - parseISO(`${range.from}T12:00:00`).getTime()) / 86_400_000
        ) + 1;
        if (diffDays > 31) {
          setLoadError('Custom date range for weekly view cannot exceed 31 days. Please select up to 31 days or switch to Monthly / Yearly.');
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

  // Daily Navigation helpers
  const shiftDay = (days: number) => {
    const current = parseISO(`${selectedDay}T12:00:00`);
    const next = addDays(current, days);
    setSelectedDay(format(next, 'yyyy-MM-dd'));
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

      // Remaining allowance is defined as target minus food intake
      const remainingCals = targetCals - intake.calories;

      return {
        logged: dailyData.logged,
        entryCount: dailyData.entryCount,
        intake,
        meals: dailyData.meals ?? [],
        targetCalories: targetCals,
        targetProtein,
        targetCarbs,
        targetFat,
        targetFiber,
        remainingCalories: remainingCals,
        calorieStatus: dailyData.calorieStatus,
        exercise: dailyData.exercise,
        weightKg: dailyData.weightKg,
      };
    }

    // Guest / Local mode calculation
    const dayEntries = data.entries.filter((entry) => entry.date === selectedDay);
    const dayNutrition = dayEntries.length ? sumNutrition(dayEntries) : { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 };
    const goal = getGoalForDate(data.goals, selectedDay) ?? fallbackGoal;
    const remaining = goal.dailyCalories - dayNutrition.calories;

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

    return {
      logged: dayEntries.length > 0,
      entryCount: dayEntries.length,
      intake: dayNutrition,
      meals,
      targetCalories: goal.dailyCalories,
      targetProtein: goal.protein,
      targetCarbs: goal.carbohydrates,
      targetFat: goal.fat,
      targetFiber: goal.fiber,
      remainingCalories: remaining,
      calorieStatus: dayEntries.length === 0 ? 'not_logged' : (dayNutrition.calories > goal.dailyCalories ? 'over' : 'under'),
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
    if (isAuthenticated && periodData) {
      if (period === 'yearly' && periodData.months) {
        return periodData.months.map((m) => {
          const monthDate = parseISO(`${m.from}T12:00:00`);
          const target = getGoalForDate(data.goals, m.from) ?? fallbackGoal;
          return {
            date: format(monthDate, 'yyyy-MM'),
            displayLabel: format(monthDate, 'MMM'),
            fullLabel: format(monthDate, 'MMMM yyyy'),
            calories: m.averageIntake ? Math.round(m.averageIntake.calories) : 0,
            protein: m.averageIntake ? Math.round(m.averageIntake.protein) : 0,
            carbohydrates: m.averageIntake ? Math.round(m.averageIntake.carbohydrates) : 0,
            fat: m.averageIntake ? Math.round(m.averageIntake.fat) : 0,
            fiber: m.averageIntake ? Math.round(m.averageIntake.fiber) : 0,
            targetCalories: target.dailyCalories,
            logged: m.loggedDays > 0,
            loggedDays: m.loggedDays,
            calendarDays: m.calendarDays,
            missingDays: m.missingDays,
          };
        });
      }

      if (periodData.days) {
        return periodData.days.map((d) => {
          const target = d.target
            ? Math.round(d.target.dailyCalories)
            : (getGoalForDate(data.goals, d.date) ?? fallbackGoal).dailyCalories;
          const dt = parseISO(`${d.date}T12:00:00`);
          return {
            date: d.date,
            displayLabel: format(dt, period === 'monthly' ? 'd' : 'EEE'),
            fullLabel: format(dt, 'EEE, MMM d'),
            calories: d.logged && d.intake ? Math.round(d.intake.calories) : 0,
            protein: d.logged && d.intake ? Math.round(d.intake.protein) : 0,
            carbohydrates: d.logged && d.intake ? Math.round(d.intake.carbohydrates) : 0,
            fat: d.logged && d.intake ? Math.round(d.intake.fat) : 0,
            fiber: d.logged && d.intake ? Math.round(d.intake.fiber) : 0,
            targetCalories: target,
            logged: d.logged,
            entryCount: d.entryCount,
          };
        });
      }
    }

    // Local mode row generation
    if (period === 'monthly') {
      const parsedMonth = parseISO(`${selectedMonth}-01T12:00:00`);
      const monthStart = startOfMonth(parsedMonth);
      const monthEnd = endOfMonth(parsedMonth);
      const daysCount = monthEnd.getDate();

      return Array.from({ length: daysCount }, (_, i) => {
        const d = addDays(monthStart, i);
        const iso = format(d, 'yyyy-MM-dd');
        const items = actualEntries.filter((e) => e.date === iso);
        const nut = sumNutrition(items);
        const goal = getGoalForDate(data.goals, iso) ?? fallbackGoal;
        return {
          date: iso,
          displayLabel: String(i + 1),
          fullLabel: format(d, 'EEE, MMM d'),
          calories: items.length ? Math.round(nut.calories) : 0,
          protein: items.length ? Math.round(nut.protein) : 0,
          carbohydrates: items.length ? Math.round(nut.carbohydrates) : 0,
          fat: items.length ? Math.round(nut.fat) : 0,
          fiber: items.length ? Math.round(nut.fiber) : 0,
          targetCalories: goal.dailyCalories,
          logged: items.length > 0,
          entryCount: items.length,
        };
      });
    }

    if (period === 'yearly') {
      return Array.from({ length: 12 }, (_, m) => {
        const monthDate = new Date(selectedYear, m, 1);
        const monthKey = format(monthDate, 'yyyy-MM');
        const monthEntries = actualEntries.filter((e) => e.date.startsWith(monthKey));
        const nut = sumNutrition(monthEntries);
        const loggedDates = new Set(monthEntries.map((e) => e.date));
        const loggedCount = loggedDates.size;
        const totalDays = endOfMonth(monthDate).getDate();
        const goal = getGoalForDate(data.goals, `${monthKey}-01`) ?? fallbackGoal;
        return {
          date: monthKey,
          displayLabel: format(monthDate, 'MMM'),
          fullLabel: format(monthDate, 'MMMM yyyy'),
          calories: loggedCount ? Math.round(nut.calories / loggedCount) : 0,
          protein: loggedCount ? Math.round(nut.protein / loggedCount) : 0,
          carbohydrates: loggedCount ? Math.round(nut.carbohydrates / loggedCount) : 0,
          fat: loggedCount ? Math.round(nut.fat) / loggedCount : 0,
          fiber: loggedCount ? Math.round(nut.fiber / loggedCount) : 0,
          targetCalories: goal.dailyCalories,
          logged: loggedCount > 0,
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
      return {
        date: iso,
        displayLabel: format(d, 'EEE'),
        fullLabel: format(d, 'EEE, MMM d'),
        calories: items.length ? Math.round(nut.calories) : 0,
        protein: items.length ? Math.round(nut.protein) : 0,
        carbohydrates: items.length ? Math.round(nut.carbohydrates) : 0,
        fat: items.length ? Math.round(nut.fat) : 0,
        fiber: items.length ? Math.round(nut.fiber) : 0,
        targetCalories: goal.dailyCalories,
        logged: items.length > 0,
        entryCount: items.length,
      };
    });
  }, [actualEntries, data.goals, isAuthenticated, period, periodData, range.from, range.to, selectedMonth, selectedYear]);

  // Stat metrics for period view
  let average = 0;
  let above = 0;
  let below = 0;
  let logDays = 0;
  let rangeDays = 0;
  let consistency = 0;
  let totalEntriesCount = 0;

  if (isAuthenticated && periodData) {
    average = periodData.averageIntake?.calories ? Math.round(periodData.averageIntake.calories) : 0;
    above = periodData.daysOverTarget;
    below = periodData.daysUnderTarget;
    logDays = periodData.loggedDays;
    rangeDays = periodData.calendarDays;
    consistency = rangeDays > 0 ? Math.round((logDays / rangeDays) * 100) : 0;
    totalEntriesCount = periodData.totalEntries ?? (periodData.days ? periodData.days.reduce((s, d) => s + d.entryCount, 0) : 0);
  } else {
    logDays = new Set(actualEntries.map((e) => e.date)).size;
    const totals = actualEntries.length ? sumNutrition(actualEntries) : { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 };
    average = logDays ? Math.round(totals.calories / logDays) : 0;
    const dayComparisons = Array.from(new Set(actualEntries.map((e) => e.date))).map((d) => {
      const items = actualEntries.filter((e) => e.date === d);
      return {
        calories: sumNutrition(items).calories,
        target: (getGoalForDate(data.goals, d) ?? fallbackGoal).dailyCalories,
      };
    });
    above = dayComparisons.filter((d) => d.calories > d.target).length;
    below = dayComparisons.filter((d) => d.calories <= d.target).length;
    rangeDays = chartRows.length;
    consistency = rangeDays && logDays ? Math.round((logDays / rangeDays) * 100) : 0;
    totalEntriesCount = actualEntries.length;
  }

  // Monthly breakdown metrics (Priority 2)
  const isCurrentMonth = period === 'monthly' && selectedMonth === format(new Date(), 'yyyy-MM');
  const monthCalendarDays = period === 'monthly' ? endOfMonth(parseISO(`${selectedMonth}-01T12:00:00`)).getDate() : rangeDays;
  const daysElapsedInMonth = isCurrentMonth ? new Date().getDate() : monthCalendarDays;
  const periodTotalCalories = chartRows.reduce((sum, r) => sum + r.calories, 0);
  const periodTotalProtein = chartRows.reduce((sum, r) => sum + r.protein, 0);
  const periodTotalCarbs = chartRows.reduce((sum, r) => sum + r.carbohydrates, 0);
  const periodTotalFat = chartRows.reduce((sum, r) => sum + r.fat, 0);
  const periodTotalFiber = chartRows.reduce((sum, r) => sum + r.fiber, 0);
  const avgAcrossAllCalendarDays = daysElapsedInMonth > 0 ? Math.round(periodTotalCalories / daysElapsedInMonth) : 0;

  // Weight rows for chart
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

  const hasTrend = chartRows.some((row) => row.calories > 0);

  // Exercise totals for period
  const exerciseTotals = isAuthenticated && periodData
    ? periodData.exercise
    : useMemo(() => {
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
    }, [data.workouts, period, range.from, range.to, selectedMonth, selectedYear]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="PATTERNS OVER PERFECTION"
        title="Health & nutrition analytics"
        subtitle="Unbiased tracking of your daily meals, targets, activity, and long-term progress."
        action={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isLoading && <Loader2 size={14} className="animate-spin text-muted" />}
            {isAuthenticated ? (
              <StatusPill tone="success">Synced with backend</StatusPill>
            ) : (
              <StatusPill tone="neutral">Local data</StatusPill>
            )}
          </div>
        }
      />

      {/* Period Selection & Context Navigation Bar */}
      <Card className="analytics-filters">
        <div className="period-tabs" role="tablist" aria-label="Analytics time period">
          {periods.map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={period === item}
              className={period === item ? 'active' : ''}
              key={item}
              onClick={() => {
                setPeriod(item);
                setLoadError(null);
              }}
            >
              {item[0]?.toUpperCase()}{item.slice(1)}
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
            <div className="range-controls">
              <CalendarRange size={16} />
              <label>
                <span>From</span>
                <input
                  type="date"
                  value={range.from}
                  onChange={(e) => setRange((cur) => ({ ...cur, from: e.target.value }))}
                  aria-label="Start date"
                />
              </label>
              <span className="range-separator">to</span>
              <label>
                <span>To</span>
                <input
                  type="date"
                  value={range.to}
                  onChange={(e) => setRange((cur) => ({ ...cur, to: e.target.value }))}
                  aria-label="End date"
                />
              </label>
              <button
                type="button"
                className="today-badge-btn"
                onClick={() =>
                  setRange({
                    from: format(subDays(new Date(), 6), 'yyyy-MM-dd'),
                    to: todayISO(),
                  })
                }
              >
                Past 7 days
              </button>
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
                  ({isCurrentMonth ? `Month-to-date: ${daysElapsedInMonth} of ${monthCalendarDays} days` : `Completed month: ${monthCalendarDays} days`})
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
            <span style={{ fontSize: '11px', fontWeight: 500 }}>{loadError}</span>
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
          {/* Calorie Check-In & Remaining Allowance */}
          <div className="dashboard-hero-grid">
            <Card className="calorie-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">DAILY CALORIE BALANCE</p>
                  <h2>Intake & allowance</h2>
                </div>
                <span className="soft-icon green-soft">
                  <Flame size={18} />
                </span>
              </div>
              <div className="calorie-main">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span className="summary-label">TOTAL CONFIRMED INTAKE</span>
                  <strong style={{ fontSize: '32px', fontFamily: 'Manrope', color: '#244c3a' }}>
                    {formatNumber(daySummary.intake.calories)}{' '}
                    <small style={{ fontSize: '14px', color: '#657363' }}>kcal</small>
                  </strong>
                  <span style={{ fontSize: '11px', color: '#818b80', marginTop: '4px' }}>
                    {daySummary.entryCount} {daySummary.entryCount === 1 ? 'confirmed entry' : 'confirmed entries'}
                  </span>
                </div>
                <div className="calorie-summary">
                  <span className="summary-label">DAILY TARGET</span>
                  <strong>{formatNumber(daySummary.targetCalories)} <small>kcal</small></strong>
                  <div className={`remaining-badge ${daySummary.remainingCalories < 0 ? 'over' : ''}`}>
                    {daySummary.remainingCalories >= 0 ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                    <span>
                      {formatNumber(Math.abs(daySummary.remainingCalories))} kcal{' '}
                      {daySummary.remainingCalories >= 0 ? 'remaining' : 'over target'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="formula-callout">
                <strong>Accounting Rule:</strong> Remaining allowance is calculated strictly as{' '}
                <em>Daily target ({formatNumber(daySummary.targetCalories)} kcal) − Confirmed food intake ({formatNumber(daySummary.intake.calories)} kcal)</em>.{' '}
                Exercise expenditure is tracked separately and is never added to your food allowance.
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
                    ? 'Exercise calories are estimated and kept separate from food intake.'
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
                    <small>kcal est.</small>
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
                    ? 'Logged on this date. Weight is never inferred from calories or exercise.'
                    : 'Add a dated weigh-in in Weight & Goals whenever you are ready.'}
                </span>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 2. WEEKLY, MONTHLY & YEARLY PERIOD VIEWS                      */}
      {/* ============================================================= */}
      {period !== 'daily' && (
        <>
          {/* Activity Totals Banner */}
          {exerciseTotals && (exerciseTotals.sessionCount > 0 || exerciseTotals.durationMinutes > 0) && (
            <Card className="activity-summary-card">
              <div className="activity-summary-icon">
                <Flame size={18} />
              </div>
              <div className="activity-summary-copy">
                <strong>
                  Workouts in period ({exerciseTotals.sessionCount} {exerciseTotals.sessionCount === 1 ? 'session' : 'sessions'})
                </strong>
                <span>Exercise is reported separately from calorie intake; energy burned is an estimate.</span>
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
                    <small>kcal burned (est.)</small>
                  </span>
                )}
              </div>
            </Card>
          )}

          {/* Stat Grid */}
          <div className="analytics-stat-grid">
            <StatCard
              icon={<ChartNoAxesColumnIncreasing size={18} />}
              label={period === 'monthly' ? 'Total monthly intake' : period === 'yearly' ? 'Monthly avg intake' : 'Average daily intake'}
              value={
                period === 'monthly'
                  ? `${formatNumber(periodTotalCalories)} kcal`
                  : average ? `${formatNumber(average)} kcal` : '—'
              }
              detail={
                period === 'monthly'
                  ? `${totalEntriesCount} logged meals · ${logDays} active days`
                  : logDays
                    ? `across ${logDays} logged ${logDays === 1 ? 'day' : 'days'} (unlogged days excluded)`
                    : 'No logged days in this range'
              }
              tone="green"
            />
            <StatCard
              icon={<Target size={18} />}
              label={period === 'monthly' ? 'Avg per logged day' : 'Target adherence'}
              value={
                period === 'monthly'
                  ? `${formatNumber(average)} kcal`
                  : logDays > 0 ? `${Math.round((below / logDays) * 100)}%` : '—'
              }
              detail={
                period === 'monthly'
                  ? `÷ ${logDays} logged ${logDays === 1 ? 'day' : 'days'} (excludes zero/unlogged days)`
                  : logDays > 0
                    ? `${below} on/under target · ${above} above target`
                    : 'No data to evaluate targets'
              }
              tone="coral"
            />
            <StatCard
              icon={<Leaf size={18} />}
              label={period === 'monthly' ? 'Avg per calendar day' : 'Logging consistency'}
              value={
                period === 'monthly'
                  ? `${formatNumber(avgAcrossAllCalendarDays)} kcal`
                  : consistency ? `${consistency}%` : '—'
              }
              detail={
                period === 'monthly'
                  ? `÷ ${daysElapsedInMonth} calendar days (${isCurrentMonth ? 'month-to-date' : 'completed month'})`
                  : rangeDays
                    ? `${logDays} of ${rangeDays} days logged`
                    : 'Choose a valid period'
              }
              tone="sage"
            />
            <StatCard
              icon={<Scale size={18} />}
              label="Weight trend"
              value={
                periodData?.weight?.endKg != null
                  ? `${Number(periodData.weight.endKg).toFixed(1)} kg`
                  : weightRows.length
                    ? `${weightRows[weightRows.length - 1]?.weight.toFixed(1)} kg`
                    : '—'
              }
              detail={
                periodData?.weight?.changeKg != null
                  ? `${periodData.weight.changeKg > 0 ? '+' : ''}${Number(periodData.weight.changeKg).toFixed(1)} kg net change (${periodData.weight.points?.length ?? 0} weigh-ins)`
                  : weightRows.length
                    ? `${weightRows.length} ${weightRows.length === 1 ? 'weigh-in' : 'weigh-ins'} in period`
                    : 'No weigh-ins in this period'
              }
              tone="gold"
            />
          </div>

          {/* Monthly Nutrient Totals Banner (Priority 2) */}
          {period === 'monthly' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '10px 14px',
                background: '#ffffff',
                border: '1px solid #e7ece4',
                borderRadius: '12px',
                fontSize: '11px',
                color: '#374151',
              }}
            >
              <span style={{ fontWeight: 600, color: '#1f2937' }}>
                Accumulated Nutrients ({isCurrentMonth ? `Month-to-date: ${daysElapsedInMonth} days` : 'Full month'}):
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <span>Protein: <b>{formatNumber(periodTotalProtein)}g</b></span>
                <span>Carbs: <b>{formatNumber(periodTotalCarbs)}g</b></span>
                <span>Fat: <b>{formatNumber(periodTotalFat)}g</b></span>
                <span>Fiber: <b>{formatNumber(periodTotalFiber)}g</b></span>
              </div>
            </div>
          )}

          {/* Calorie & Target Chart */}
          <Card className="analytics-chart-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">CALORIES &amp; TARGET</p>
                <h2>Intake by {period === 'yearly' ? 'month' : 'day'}</h2>
                <p className="card-subtitle">
                  {period === 'yearly'
                    ? 'Averaged over recorded days only. Months with missing data are clearly distinguished.'
                    : 'The target line follows the goal that was effective on each date.'}
                </p>
              </div>
              <span className="chart-legend">
                <i className="legend-dot" /> Intake <i className="legend-line" /> Target
              </span>
            </div>
            {hasTrend ? (
              <div className="chart-wrap chart-tall" role="img" aria-label="Calorie intake chart">
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
                      formatter={(val) => [`${formatNumber(Number(val))} kcal`, '']}
                      contentStyle={{ border: '1px solid #e5e8df', borderRadius: 12 }}
                    />
                    <Legend />
                    <Bar dataKey="calories" name="Intake" fill="#244c3a" radius={[7, 7, 0, 0]} maxBarSize={36} />
                    <Line dataKey="targetCalories" name="Target" stroke="#f08a70" strokeDasharray="5 5" dot={false} strokeWidth={2} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                icon={<ChartNoAxesColumnIncreasing size={20} />}
                title="No nutrition records in this range"
                detail={
                  isAuthenticated
                    ? 'No confirmed meals found in this period. Log food entries in your Diary to see your trend.'
                    : 'Log a few meals to see your personal intake trends.'
                }
              />
            )}
            <p className="chart-footnote">
              Historical targets use effective dates. Empty dates remain unfilled rather than fabricated.
            </p>
          </Card>

          {/* Macro Balance & Weight Charts */}
          <div className="analytics-two-col">
            <Card className="analytics-chart-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">MACRO BALANCE</p>
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
                      <Tooltip formatter={(value) => [`${formatNumber(Number(value))} g`, '']} />
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
                  detail="A few diary entries will make your personal nutrition patterns easier to see."
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
                  {weightRows.length ? 'Your logs' : 'No records'}
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
                        labelFormatter={(val) => format(parseISO(`${String(val)}T12:00:00`), 'MMM d')}
                        formatter={(val) => [`${Number(val).toFixed(1)} kg`, 'Weight']}
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
                  title="No weight logs in this period"
                  detail="Add weigh-ins in Weight & Goals to see your trend line."
                />
              )}
              <p className="chart-footnote">
                Weight measurements are user-entered and never inferred from calorie deficit or workouts.
              </p>
            </Card>
          </div>

          {/* ============================================================= */}
          {/* 3. DETAILED PROGRESS & MISSING-DATA TABLES                     */}
          {/* ============================================================= */}
          {period === 'monthly' && (
            <Card className="analytics-chart-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">DAILY ADHERENCE BREAKDOWN</p>
                  <h2>Days of {format(parseISO(`${selectedMonth}-01T12:00:00`), 'MMMM yyyy')}</h2>
                </div>
                <span className="quiet-note">
                  {totalEntriesCount} {totalEntriesCount === 1 ? 'confirmed meal' : 'confirmed meals'} logged
                </span>
              </div>
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Intake</th>
                      <th>Target</th>
                      <th>Difference</th>
                      <th>Confirmed Foods</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartRows.map((row) => {
                      const isLogged = row.logged;
                      const diff = isLogged ? row.calories - row.targetCalories : null;
                      return (
                        <tr key={row.date}>
                          <td><strong>{row.fullLabel}</strong></td>
                          <td>
                            {!isLogged ? (
                              <StatusPill tone="neutral">Not logged</StatusPill>
                            ) : diff !== null && diff <= 0 ? (
                              <StatusPill tone="success">Under target</StatusPill>
                            ) : (
                              <StatusPill tone="warning">Above target</StatusPill>
                            )}
                          </td>
                          <td>{isLogged ? `${formatNumber(row.calories)} kcal` : '—'}</td>
                          <td>{formatNumber(row.targetCalories)} kcal</td>
                          <td>
                            {diff !== null ? (
                              <span style={{ color: diff <= 0 ? '#244c3a' : '#b54842', fontWeight: 600 }}>
                                {diff <= 0 ? '' : '+'}{formatNumber(diff)} kcal
                              </span>
                            ) : '—'}
                          </td>
                          <td>{row.entryCount ? `${row.entryCount} entries` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {period === 'yearly' && (
            <Card className="analytics-chart-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">ANNUAL 12-MONTH OVERVIEW</p>
                  <h2>Progress &amp; consistency across {selectedYear}</h2>
                </div>
                <span className="quiet-note">{logDays} of 365 days logged</span>
              </div>
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Logging Consistency</th>
                      <th>Missing Data Indicator</th>
                      <th>Avg Daily Calories</th>
                      <th>Daily Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartRows.map((m) => {
                      const loggedPct = m.calendarDays ? Math.round(((m.loggedDays ?? 0) / m.calendarDays) * 100) : 0;
                      const isUnlogged = (m.loggedDays ?? 0) === 0;

                      return (
                        <tr key={m.date}>
                          <td><strong>{m.fullLabel}</strong></td>
                          <td>
                            <div className="table-bar-track">
                              <div
                                className="table-bar-fill"
                                style={{
                                  width: `${loggedPct}%`,
                                  background: loggedPct > 60 ? '#244c3a' : loggedPct > 0 ? '#e4a34a' : '#eef2eb',
                                }}
                              />
                            </div>
                            <span style={{ fontSize: '11px', color: '#6d776b' }}>
                              {m.loggedDays ?? 0} / {m.calendarDays} days ({loggedPct}%)
                            </span>
                          </td>
                          <td>
                            {isUnlogged ? (
                              <StatusPill tone="neutral">No records</StatusPill>
                            ) : m.missingDays && m.missingDays > 0 ? (
                              <StatusPill tone="warning">{m.missingDays} unlogged days</StatusPill>
                            ) : (
                              <StatusPill tone="success">Fully logged</StatusPill>
                            )}
                          </td>
                          <td>{m.calories > 0 ? `${formatNumber(m.calories)} kcal/day` : '—'}</td>
                          <td>{formatNumber(m.targetCalories)} kcal</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
