import { format } from 'date-fns';
import type { AppData, DailyNutritionSummary, FoodEntry, NutritionGoal, NutritionSnapshot, UserProfile } from '@/types';

export const todayISO = () => format(new Date(), 'yyyy-MM-dd');
export const makeId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const fallbackGoal: NutritionGoal = {
  id: 'baseline-goal',
  effectiveFrom: '2020-01-01',
  goalType: 'maintain',
  dailyCalories: 2000,
  protein: 120,
  carbohydrates: 220,
  fat: 65,
  fiber: 28,
  targetWeightKg: 70,
};

export const zeroNutrition = (): NutritionSnapshot => ({ calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 });

export function sumNutrition(entries: FoodEntry[]): NutritionSnapshot {
  return entries.reduce((total, entry) => ({
    calories: total.calories + entry.nutrition.calories,
    protein: total.protein + entry.nutrition.protein,
    carbohydrates: total.carbohydrates + entry.nutrition.carbohydrates,
    fat: total.fat + entry.nutrition.fat,
    fiber: total.fiber + entry.nutrition.fiber,
  }), zeroNutrition());
}

export function getGoalForDate(goals: NutritionGoal[], date: string): NutritionGoal | undefined {
  return [...goals]
    .filter((goal) => goal.effectiveFrom <= date)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}

export function getDailySummary(data: AppData, date: string, fallbackGoal: NutritionGoal): DailyNutritionSummary {
  const target = getGoalForDate(data.goals, date) ?? fallbackGoal;
  const nutrition = sumNutrition(data.entries.filter((entry) => entry.date === date));
  return { date, targetCalories: target.dailyCalories, ...nutrition };
}

export function ageFromBirthDate(dateOfBirth: string): number | null {
  if (!dateOfBirth) return null;
  const today = todayISO();
  if (dateOfBirth > today) return null;
  const parts = dateOfBirth.split('-').map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  const [bYear, bMonth, bDay] = parts;
  const now = new Date();
  const cYear = now.getFullYear();
  const cMonth = now.getMonth() + 1;
  const cDay = now.getDate();

  let age = cYear - bYear;
  // Exact birthday boundary check: has the birthday occurred yet this year?
  if (cMonth < bMonth || (cMonth === bMonth && cDay < bDay)) {
    age -= 1;
  }
  return age >= 0 && age <= 125 ? age : null;
}

/**
 * BMR via recognized Mifflin–St Jeor equation:
 * Men: BMR = 10 × weight (kg) + 6.25 × height (cm) − 5 × age (y) + 5
 * Women: BMR = 10 × weight (kg) + 6.25 × height (cm) − 5 × age (y) − 161
 * Non-binary / unspecified: midpoint offset ((5 + (-161)) / 2 = -78)
 */
export function calculateBmr(profile: Partial<UserProfile>): number | null {
  const { dateOfBirth, heightCm, currentWeightKg, biologicalSex } = profile;
  const age = dateOfBirth ? ageFromBirthDate(dateOfBirth) : null;
  if (!heightCm || !currentWeightKg || age === null) return null;
  const sexAdjustment = biologicalSex === 'male' ? 5 : biologicalSex === 'female' ? -161 : -78;
  const bmr = 10 * currentWeightKg + 6.25 * heightCm - 5 * age + sexAdjustment;
  return Math.round(bmr);
}

/**
 * Maintenance calories (TDEE): BMR × documented activity multiplier.
 */
export function estimateMaintenanceCalories(profile: Partial<UserProfile>): number | null {
  const bmr = calculateBmr(profile);
  if (bmr === null) return null;
  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    'very-active': 1.9,
  };
  const multiplier = activityMultipliers[profile.activityLevel ?? 'moderate'] ?? 1.55;
  return Math.round(bmr * multiplier);
}

/**
 * Recommended target calories based on goal:
 * - Weight loss: conservative deficit of 350-400 kcal below maintenance (safe floor: 1200 kcal).
 * - Weight gain / muscle: conservative surplus of 250-300 kcal above maintenance.
 * - Maintenance: maintenance calories.
 */
export function suggestedTargetCalories(maintenance: number, goal: UserProfile['goalType']): number {
  if (goal === 'lose') return Math.max(1200, maintenance - 350);
  if (goal === 'gain' || goal === 'muscle') return maintenance + 300;
  return maintenance;
}

/**
 * Calculate personalized macronutrient distribution:
 * - Protein: 1.8-2.0 g per kg body weight (higher for weight loss & muscle building)
 * - Fat: 25-30% of daily calories (divided by 9 kcal/g)
 * - Carbohydrates: remainder of daily calories (divided by 4 kcal/g)
 * - Fiber: ~14 g per 1000 kcal intake
 */
export function calculateMacrosForCalories(
  targetCalories: number,
  weightKg: number,
  goal: UserProfile['goalType']
) {
  const safeWeight = Math.max(30, Math.min(250, weightKg || 70));
  const proteinFactor = goal === 'lose' || goal === 'muscle' ? 2.0 : 1.8;
  const protein = Math.round(Math.min(250, Math.max(50, safeWeight * proteinFactor)));
  const fat = Math.round(Math.max(30, (targetCalories * 0.25) / 9));
  const remainingCal = Math.max(200, targetCalories - protein * 4 - fat * 9);
  const carbohydrates = Math.round(remainingCal / 4);
  const fiber = Math.round(Math.min(45, Math.max(25, (targetCalories / 1000) * 14)));
  return { protein, carbohydrates, fat, fiber };
}

/**
 * Standard MET (Metabolic Equivalent of Task) values for explainable calorie expenditure:
 * Estimated kcal/min = (MET × 3.5 × weightKg) ÷ 200
 * Estimated session kcal = kcal/min × active duration in minutes
 */
export const MET_ACTIVITIES: Record<string, { label: string; met: number }> = {
  Walk: { label: 'Walking (brisk, 5 km/h)', met: 3.5 },
  Run: { label: 'Running (steady 8 km/h)', met: 8.0 },
  Cycling: { label: 'Cycling (moderate, 15-20 km/h)', met: 6.0 },
  Swimming: { label: 'Swimming (laps, moderate)', met: 7.0 },
  'Other cardio': { label: 'General cardio / aerobics', met: 5.5 },
  'Chest / triceps': { label: 'Strength: Push (moderate rest)', met: 4.5 },
  'Back / biceps': { label: 'Strength: Pull (moderate rest)', met: 4.5 },
  Legs: { label: 'Strength: Lower body (moderate rest)', met: 4.5 },
  'Full body': { label: 'Strength: Full body / compound', met: 5.0 },
  Custom: { label: 'General resistance training', met: 4.5 },
};

export function calculateWorkoutCalories(
  weightKg: number,
  durationMinutes: number,
  activityTypeOrSplit: string
): { calories: number; met: number; formula: string } {
  const safeWeight = Math.max(30, Math.min(300, weightKg || 70));
  const safeDuration = Math.max(1, durationMinutes || 1);
  const met = MET_ACTIVITIES[activityTypeOrSplit]?.met ?? 4.5;
  const kcalPerMin = (met * 3.5 * safeWeight) / 200;
  const calories = Math.round(kcalPerMin * safeDuration);
  const formula = `(${met} MET × 3.5 × ${safeWeight.toFixed(1)} kg ÷ 200) × ${safeDuration} min`;
  return { calories, met, formula };
}

export function kgToDisplay(weightKg: number, unit: UserProfile['weightUnit']): number {
  return unit === 'lb' ? weightKg * 2.20462 : weightKg;
}

export function displayToKg(weight: number, unit: UserProfile['weightUnit']): number {
  return unit === 'lb' ? weight / 2.20462 : weight;
}

export function clampProgress(value: number, target: number): number {
  return target <= 0 ? 0 : Math.min(100, Math.max(0, (value / target) * 100));
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}
