export type MealCategory = 'breakfast' | 'lunch' | 'snacks' | 'dinner';
export type GoalType = 'lose' | 'maintain' | 'gain' | 'muscle';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active';
export type BiologicalSex = 'female' | 'male' | 'other' | 'unspecified';
export type WeightUnit = 'kg' | 'lb';
export type HeightUnit = 'cm' | 'ft-in';

export interface NutritionSnapshot {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
}

export interface FoodEntry {
  id: string;
  date: string;
  meal: MealCategory;
  name: string;
  quantity: number;
  unit: string;
  nutrition: NutritionSnapshot;
  notes?: string;
  source: 'manual' | 'scanner';
}

export interface Meal {
  date: string;
  category: MealCategory;
  entries: FoodEntry[];
  nutrition: NutritionSnapshot;
}

export interface NutritionGoal {
  id: string;
  effectiveFrom: string;
  goalType: GoalType;
  dailyCalories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  targetWeightKg: number;
}

export interface UserProfile {
  name: string;
  email: string;
  dateOfBirth: string;
  heightCm: number;
  currentWeightKg: number;
  biologicalSex: BiologicalSex;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  targetWeightKg: number;
  weightUnit: WeightUnit;
  heightUnit: HeightUnit;
  profileUpdatedAt: string;
}

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weightKg: number;
  notes?: string;
}

export interface WorkoutBase {
  id: string;
  date: string;
  name: string;
  durationMinutes: number;
  estimatedCalories: number;
  notes?: string;
}

export interface StrengthWorkoutSession extends WorkoutBase {
  type: 'strength';
  split: string;
  exercises: Exercise[];
}

export interface CardioSession extends WorkoutBase {
  type: 'cardio';
  cardioType: string;
  distanceKm?: number;
}

export type WorkoutSession = StrengthWorkoutSession | CardioSession;

export interface WeightLog {
  id: string;
  date: string;
  weightKg: number;
  note?: string;
}

export type RecipeType = 'MEASURED_FOOD' | 'STANDARD_RECIPE' | 'APPROXIMATE_RECIPE' | 'BRANDED_PRODUCT' | 'RAW_INGREDIENT';

export interface ExternalFoodItem {
  code: string;
  canonicalName: string;
  brand?: string;
  category: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbohydratesPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  servingBasis: string;
  defaultServingUnit: string;
  defaultServingGrams: number;
  servingConversions?: Record<string, number>;
  dataSource: string;
  sourceReferenceId?: string;
  recipeType: RecipeType;
  uncertaintyNote?: string;
}

export interface FoodLookupResponse {
  query: string;
  localMatches: any[];
  externalMatches: ExternalFoodItem[];
  lookupStatus: 'LOCAL_MATCH' | 'EXTERNAL_MATCH' | 'LOCAL_AND_EXTERNAL_MATCH' | 'NO_MATCH' | 'EXTERNAL_DEGRADED';
  attributionNote: string;
}

export interface FoodAnalysis {
  id: string;
  description: string;
  provider?: string;
  disclaimer?: string;
  isEstimate?: boolean;
  warnings?: string[];
  foods: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
    nutrition: NutritionSnapshot;
    nutritionPerUnit: NutritionSnapshot;
    confidence: 'high' | 'medium' | 'low';
    uncertainty?: string;
    warnings?: string[];
    servingAmount?: number;
    servings?: number;
    catalogId?: string;
    dataSource?: string;
    sourceReferenceId?: string;
    recipeType?: RecipeType;
    calculatedGrams?: number;
    availableUnits?: string[];
    candidates?: Array<{
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
    }>;
  }>;
  meal: MealCategory;
}

export interface DailyNutritionSummary extends NutritionSnapshot {
  date: string;
  targetCalories: number;
}

export interface AppData {
  entries: FoodEntry[];
  goals: NutritionGoal[];
  workouts: WorkoutSession[];
  weights: WeightLog[];
  profile: UserProfile | null;
}

export const MEAL_CATEGORIES: MealCategory[] = ['breakfast', 'lunch', 'snacks', 'dinner'];

export const MEAL_LABELS: Record<MealCategory, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snacks: 'Snacks',
  dinner: 'Dinner',
};
