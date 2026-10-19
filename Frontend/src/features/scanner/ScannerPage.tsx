import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  CircleHelp,
  Database,
  FileImage,
  ImagePlus,
  Info,
  Loader2,
  LockKeyhole,
  LogIn,
  Pencil,
  Plus,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { CameraCaptureModal } from './CameraCaptureModal';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/app/AppContext';
import { Button, Card, Modal, PageHeader, ProgressBar, StatusPill } from '@/components/ui';
import type { FoodAnalysis, MealCategory } from '@/types';
import { MEAL_CATEGORIES, MEAL_LABELS } from '@/types';
import { makeId, todayISO, formatNumber } from '@/utils/nutrition';
import {
  scannerApi,
  foodCatalogApi,
  ApiError,
  type BackendScanResponse,
  type FoodCatalogItemDto,
} from '@/services/api';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per backend restrictions
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

const scaleNutrition = (perUnit: FoodAnalysis['foods'][number]['nutritionPerUnit'], quantity: number) => {
  const scale = (value: number) => Math.round(value * quantity * 10) / 10;
  return {
    calories: scale(perUnit.calories),
    protein: scale(perUnit.protein),
    carbohydrates: scale(perUnit.carbohydrates),
    fat: scale(perUnit.fat),
    fiber: scale(perUnit.fiber),
  };
};

function mapScanResponseToAnalysis(
  res: BackendScanResponse,
  description: string,
  meal: MealCategory
): FoodAnalysis {
  return {
    id: res.analysisId || makeId(),
    description: description || 'Scanned meal',
    provider: res.provider,
    disclaimer: res.disclaimer,
    isEstimate: res.isEstimate,
    warnings: res.warnings || [],
    meal,
    foods: (res.items || []).map((item, idx) => {
      const quantity = Number(item.quantity) || 1;
      const unit = item.servingUnit || 'serving';
      const perServing = item.nutritionPerServing || { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 };
      const estimated = item.estimatedNutrition || perServing;

      const nutritionPerUnit = {
        calories: quantity > 0 ? Number((estimated.calories / quantity).toFixed(2)) : perServing.calories,
        protein: quantity > 0 ? Number((estimated.protein / quantity).toFixed(2)) : perServing.protein,
        carbohydrates: quantity > 0 ? Number((estimated.carbohydrates / quantity).toFixed(2)) : perServing.carbohydrates,
        fat: quantity > 0 ? Number((estimated.fat / quantity).toFixed(2)) : perServing.fat,
        fiber: quantity > 0 ? Number((estimated.fiber / quantity).toFixed(2)) : perServing.fiber,
      };

      return {
        id: `${res.analysisId || makeId()}-${idx}`,
        name: item.name,
        quantity,
        unit,
        nutrition: {
          calories: Number(Number(estimated.calories).toFixed(1)),
          protein: Number(Number(estimated.protein).toFixed(1)),
          carbohydrates: Number(Number(estimated.carbohydrates).toFixed(1)),
          fat: Number(Number(estimated.fat).toFixed(1)),
          fiber: Number(Number(estimated.fiber).toFixed(1)),
        },
        nutritionPerUnit,
        confidence: item.confidence || 'medium',
        uncertainty: item.uncertainty?.length ? item.uncertainty.join('; ') : undefined,
        warnings: item.warnings || [],
        servingAmount: item.servingAmount,
        servings: item.servings,
        candidates: (item.candidates || []).map((c) => ({
          catalogId: c.catalogId,
          canonicalName: c.canonicalName,
          category: c.category,
          caloriesPer100g: Number(c.caloriesPer100g),
          proteinPer100g: Number(c.proteinPer100g),
          carbohydratesPer100g: Number(c.carbohydratesPer100g),
          fatPer100g: Number(c.fatPer100g),
          fiberPer100g: Number(c.fiberPer100g),
          defaultServingUnit: c.defaultServingUnit,
          defaultServingGrams: Number(c.defaultServingGrams),
          dataSource: c.dataSource,
          matchScore: Number(c.matchScore),
          matchReason: c.matchReason,
        })),
      };
    }),
  };
}

export function ScannerPage() {
  const { saveFoodEntry, pushToast, isAuthenticated, openAuthModal, openFoodModal } = useApp();
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [meal, setMeal] = useState<MealCategory>('lunch');
  const [date, setDate] = useState(todayISO());
  const [progress, setProgress] = useState(0);
  const [fileError, setFileError] = useState('');
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Separate Camera & Gallery Modal State (Priority 1)
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [expandedNutrientsFoodId, setExpandedNutrientsFoodId] = useState<string | null>(null);

  // Verified Catalog Search Modal States (Stage 10)
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [targetFoodIdForCatalog, setTargetFoodIdForCatalog] = useState<string | null>(null);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [catalogCategory, setCatalogCategory] = useState<string>('ALL');
  const [catalogResults, setCatalogResults] = useState<FoodCatalogItemDto[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Load catalog items whenever modal opens or search parameters change
  useEffect(() => {
    if (!catalogModalOpen) return;
    let active = true;
    const fetchCatalog = async () => {
      setCatalogLoading(true);
      try {
        const cat = catalogCategory === 'ALL' ? undefined : catalogCategory;
        const res = await foodCatalogApi.search(catalogSearchQuery.trim() || undefined, cat, 30);
        if (active) setCatalogResults(res);
      } catch (e) {
        console.warn('Failed to load food catalog:', e);
      } finally {
        if (active) setCatalogLoading(false);
      }
    };
    fetchCatalog();
    return () => {
      active = false;
    };
  }, [catalogModalOpen, catalogSearchQuery, catalogCategory]);

  // Enrich detected foods with verified catalog entries where available
  const enrichFoodsWithCatalog = async (foods: FoodAnalysis['foods']): Promise<FoodAnalysis['foods']> => {
    return Promise.all(
      foods.map(async (food) => {
        try {
          const cleanName = food.name
            .replace(/\(Uncertain match\)|\(sample estimate\)|\(Review suggested candidates\)|\(Ambiguous visual match\)|\(Degraded heuristic estimate\)/gi, '')
            .trim();
          const matches = await foodCatalogApi.search(cleanName, undefined, 1);
          if (matches && matches.length > 0) {
            const cat = matches[0];
            const availableUnits = Object.keys(cat.servingConversions || {});
            if (!availableUnits.includes('g')) availableUnits.push('g');
            const grams = cat.servingConversions[food.unit]
              ? food.quantity * cat.servingConversions[food.unit]
              : (food.unit === 'g' ? food.quantity : food.quantity * cat.defaultServingGrams);

            return {
              ...food,
              catalogId: cat.id,
              dataSource: cat.dataSource,
              sourceReferenceId: cat.sourceReferenceId,
              recipeType: cat.recipeType,
              calculatedGrams: Math.round(grams * 10) / 10,
              availableUnits,
            };
          }
        } catch {
          // Keep existing food info
        }
        return food;
      })
    );
  };

  // Manage temporary preview URL lifecycle cleanly
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const total = useMemo(() => {
    return analysis?.foods.reduce(
      (sum, food) => ({
        calories: Math.round((sum.calories + food.nutrition.calories) * 10) / 10,
        protein: Math.round((sum.protein + food.nutrition.protein) * 10) / 10,
        carbohydrates: Math.round((sum.carbohydrates + food.nutrition.carbohydrates) * 10) / 10,
        fat: Math.round((sum.fat + food.nutrition.fat) * 10) / 10,
        fiber: Math.round((sum.fiber + food.nutrition.fiber) * 10) / 10,
      }),
      { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 }
    );
  }, [analysis]);

  const handleFile = (selected?: File) => {
    if (!selected) return; // Cancelled picker - do nothing
    setAnalysis(null);
    setFileError('');
    setIsUnavailable(false);

    // Validate type
    const mimeType = selected.type ? selected.type.toLowerCase() : '';
    const hasValidExt = /\.(jpe?g|png|webp)$/i.test(selected.name || '');
    const isImage = (mimeType && mimeType.startsWith('image/')) || ALLOWED_MIME_TYPES.has(mimeType) || hasValidExt;
    if (!isImage) {
      setFileError('Only JPEG, PNG and WebP images are supported.');
      return;
    }

    // Validate size (max 10 MB)
    if (selected.size > MAX_FILE_SIZE) {
      setFileError('That image is larger than 10 MB. Choose a smaller file.');
      return;
    }

    setProgress(30);
    setFile(selected);
    window.setTimeout(() => setProgress(100), 200);
  };

  const handleAnalyzeImage = async () => {
    if (!file) {
      setFileError('Please choose or take a food photo first.');
      return;
    }

    if (!isAuthenticated) {
      openAuthModal('login');
      pushToast({
        tone: 'info',
        title: 'Sign in to use AI scanner',
        detail: 'Live AI photo analysis requires an authenticated session. Or try the demo estimate below.',
      });
      return;
    }

    setIsAnalyzing(true);
    setFileError('');
    setIsUnavailable(false);

    const imageFile = file;
    const textContext = description.trim();

    try {
      const res = await scannerApi.analyze(imageFile, textContext || undefined);
      const mapped = mapScanResponseToAnalysis(res, textContext || imageFile.name, meal);
      const enrichedFoods = await enrichFoodsWithCatalog(mapped.foods);
      setAnalysis({ ...mapped, foods: enrichedFoods });

      // Clean up file & preview per privacy contract: images are ephemeral
      setFile(null);
      setProgress(0);

      pushToast({
        tone: 'success',
        title: 'Meal analyzed',
        detail: res.provider === 'mock'
          ? 'Estimate returned from backend development mock provider.'
          : 'AI nutrition estimate ready for your review.',
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 503 || err.code === 'SCANNER_UNAVAILABLE' || err.code === 'SCANNER_PROVIDER_FAILURE') {
          setIsUnavailable(true);
          setFileError(err.message || 'Food scanning is unavailable. No AI provider is configured on the backend.');
        } else if (err.status === 413) {
          setFileError('The uploaded image exceeds the 10 MB server limit.');
        } else if (err.status === 415) {
          setFileError('The image format is not supported. Use JPG, PNG or WebP.');
        } else {
          setFileError(err.message || 'Image analysis failed. Please try again.');
        }
      } else {
        setFileError('Could not reach the scanner service. Check your connection.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleEstimateText = async () => {
    const text = description.trim();
    if (!text) {
      setFileError('Type a meal description first (e.g. "2 boiled eggs and 1 slice whole wheat toast").');
      return;
    }
    if (text.length > 1000) {
      setFileError('Meal description must be 1000 characters or less.');
      return;
    }

    if (!isAuthenticated) {
      openAuthModal('login');
      pushToast({
        tone: 'info',
        title: 'Sign in to use AI scanner',
        detail: 'Live nutrition estimation requires an authenticated session. Or try the demo estimate below.',
      });
      return;
    }

    setIsAnalyzing(true);
    setFileError('');
    setIsUnavailable(false);

    try {
      const res = await scannerApi.textEstimate(text);
      const mapped = mapScanResponseToAnalysis(res, text, meal);
      const enrichedFoods = await enrichFoodsWithCatalog(mapped.foods);
      setAnalysis({ ...mapped, foods: enrichedFoods });

      // Clear pending file if any
      if (file) {
        setFile(null);
        setProgress(0);
      }

      pushToast({
        tone: 'success',
        title: 'Text estimate ready',
        detail: res.provider === 'mock'
          ? 'Estimate returned from backend development mock provider.'
          : 'AI nutrition estimate ready for your review.',
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 503 || err.code === 'SCANNER_UNAVAILABLE' || err.code === 'SCANNER_PROVIDER_FAILURE') {
          setIsUnavailable(true);
          setFileError(err.message || 'Food scanning is unavailable. No AI provider is configured on the backend.');
        } else {
          setFileError(err.message || 'Text estimation failed. Please try again.');
        }
      } else {
        setFileError('Could not reach the scanner service. Check your connection.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const createMockAnalysis = () => {
    const text = description.trim() || (file ? file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : '2 Homemade Dosas with Chutney');

    const id = makeId();
    let sampleFoods: FoodAnalysis['foods'] = [];

    if (/dosa/i.test(text)) {
      sampleFoods = [
        {
          id: `${id}-1`,
          name: 'Homemade plain dosa (medium, ~75g)',
          quantity: 2,
          unit: 'piece',
          nutrition: { calories: 270, protein: 6.4, carbohydrates: 48, fat: 5.6, fiber: 2.4 },
          nutritionPerUnit: { calories: 135, protein: 3.2, carbohydrates: 24, fat: 2.8, fiber: 1.2 },
          confidence: 'high' as const,
          uncertainty: 'Estimated using standard IFCT reference (135 kcal per medium homemade dosa).',
          candidates: [
            {
              catalogId: 'in_dosa_plain',
              canonicalName: 'Plain Dosa',
              category: 'BREAKFAST',
              caloriesPer100g: 180,
              proteinPer100g: 4.2,
              carbohydratesPer100g: 32,
              fatPer100g: 3.7,
              fiberPer100g: 1.6,
              defaultServingUnit: 'piece',
              defaultServingGrams: 75,
              dataSource: 'IFCT 2017',
              matchScore: 0.95,
              matchReason: 'Reference match',
            },
          ],
        },
        {
          id: `${id}-2`,
          name: 'Coconut Chutney (1 tbsp / 30g)',
          quantity: 1,
          unit: 'serving',
          nutrition: { calories: 85, protein: 1.1, carbohydrates: 2.1, fat: 8.5, fiber: 1.2 },
          nutritionPerUnit: { calories: 85, protein: 1.1, carbohydrates: 2.1, fat: 8.5, fiber: 1.2 },
          confidence: 'medium' as const,
          uncertainty: 'Standard 1 tbsp serving with grated coconut and tadka.',
        },
      ];
    } else if (/idli/i.test(text)) {
      sampleFoods = [
        {
          id: `${id}-1`,
          name: 'Idli (sample estimate)',
          quantity: 4,
          unit: 'piece',
          nutrition: { calories: 232, protein: 8, carbohydrates: 48, fat: 1, fiber: 4 },
          nutritionPerUnit: { calories: 58, protein: 2, carbohydrates: 12, fat: 0.25, fiber: 1 },
          confidence: 'medium' as const,
          uncertainty: 'Size and batter recipe can change the estimate.',
        },
        {
          id: `${id}-2`,
          name: 'Tea with milk (sample estimate)',
          quantity: 1,
          unit: 'cup',
          nutrition: { calories: 85, protein: 3, carbohydrates: 12, fat: 3, fiber: 0 },
          nutritionPerUnit: { calories: 85, protein: 3, carbohydrates: 12, fat: 3, fiber: 0 },
          confidence: 'low' as const,
          uncertainty: 'Milk and sugar amounts are unknown.',
        },
      ];
    } else {
      sampleFoods = [
        {
          id: `${id}-1`,
          name: `Sample portion for: ${text.slice(0, 42)}${text.length > 42 ? '…' : ''}`,
          quantity: 1,
          unit: 'serving',
          nutrition: { calories: 350, protein: 18, carbohydrates: 42, fat: 12, fiber: 5 },
          nutritionPerUnit: { calories: 350, protein: 18, carbohydrates: 42, fat: 12, fiber: 5 },
          confidence: 'low' as const,
          uncertainty: 'This is generic demo data, not an estimate from a live AI model or your image.',
        },
      ];
    }

    setAnalysis({
      id,
      description: text,
      foods: sampleFoods,
      meal,
      provider: 'demo-local',
      disclaimer: 'Illustrative mock estimate for testing UI interactions without an active AI model. Verify portion and ingredients.',
      isEstimate: true,
      warnings: ['Demo mode: interactive local simulation.'],
    });
    setFileError('');
    setIsUnavailable(false);
  };

  const openCatalogModal = (targetFoodId: string | null, initialQuery?: string) => {
    setTargetFoodIdForCatalog(targetFoodId);
    setCatalogSearchQuery(initialQuery ? initialQuery.replace(/\(Uncertain match\)|\(sample estimate\)/gi, '').trim() : '');
    setCatalogCategory('ALL');
    setCatalogModalOpen(true);
  };

  const handlePortionChange = async (foodId: string, quantity: number, unit: string, customGrams?: number) => {
    const safeQty = Math.max(0.1, Number(quantity) || 0.1);
    const targetFood = analysis?.foods.find((f) => f.id === foodId);
    if (!targetFood) return;

    if (targetFood.catalogId) {
      try {
        const calc = await foodCatalogApi.calculate({
          catalogId: targetFood.catalogId,
          quantity: safeQty,
          unit,
          customGrams,
        });

        setAnalysis((current) =>
          current
            ? {
                ...current,
                foods: current.foods.map((item) =>
                  item.id === foodId
                    ? {
                        ...item,
                        quantity: safeQty,
                        unit: calc.unit,
                        calculatedGrams: Number(calc.calculatedGrams),
                        nutrition: {
                          calories: Number(calc.calories),
                          protein: Number(calc.protein),
                          carbohydrates: Number(calc.carbohydrates),
                          fat: Number(calc.fat),
                          fiber: Number(calc.fiber),
                        },
                        uncertainty: calc.calculationNote,
                      }
                    : item
                ),
              }
            : null
        );
        return;
      } catch (e) {
        console.warn('Calculation API error, falling back to local scaling', e);
      }
    }

    // Local fallback
    setAnalysis((current) =>
      current
        ? {
            ...current,
            foods: current.foods.map((item) => {
              if (item.id !== foodId) return item;
              return {
                ...item,
                quantity: safeQty,
                unit,
                nutrition: scaleNutrition(item.nutritionPerUnit, safeQty),
              };
            }),
          }
        : null
    );
  };

  const selectCatalogItem = (catItem: FoodCatalogItemDto) => {
    const defaultUnit = catItem.defaultServingUnit;
    const quantity = 1;
    const availableUnits = Object.keys(catItem.servingConversions || {});
    if (!availableUnits.includes('g')) availableUnits.push('g');

    const grams = catItem.defaultServingGrams;
    const factor = grams / 100;
    const cal = Math.round(catItem.caloriesPer100g * factor * 10) / 10;
    const pro = Math.round(catItem.proteinPer100g * factor * 10) / 10;
    const carb = Math.round(catItem.carbohydratesPer100g * factor * 10) / 10;
    const fat = Math.round(catItem.fatPer100g * factor * 10) / 10;
    const fiber = Math.round(catItem.fiberPer100g * factor * 10) / 10;

    const newFoodItem = {
      id: targetFoodIdForCatalog || makeId(),
      name: catItem.canonicalName,
      quantity,
      unit: defaultUnit,
      nutrition: { calories: cal, protein: pro, carbohydrates: carb, fat: fat, fiber: fiber },
      nutritionPerUnit: { calories: cal, protein: pro, carbohydrates: carb, fat: fat, fiber: fiber },
      confidence: 'high' as const,
      catalogId: catItem.id,
      dataSource: catItem.dataSource,
      sourceReferenceId: catItem.sourceReferenceId,
      recipeType: catItem.recipeType,
      calculatedGrams: grams,
      availableUnits,
      warnings: catItem.defaultWarning ? [catItem.defaultWarning] : [],
      uncertainty: `Verified reference entry: ${catItem.dataSource} (${catItem.sourceReferenceId || 'Standard'}). Standard reference serving: ${quantity} ${defaultUnit} (${grams}g).`,
    };

    if (targetFoodIdForCatalog) {
      // Replace existing item
      setAnalysis((cur) =>
        cur
          ? {
              ...cur,
              foods: cur.foods.map((f) => (f.id === targetFoodIdForCatalog ? newFoodItem : f)),
            }
          : null
      );
    } else {
      // Add new item
      setAnalysis((cur) =>
        cur
          ? {
              ...cur,
              foods: [...cur.foods, newFoodItem],
            }
          : {
              id: makeId(),
              description: catItem.canonicalName,
              meal,
              provider: 'catalog',
              disclaimer: 'Calculated using verified per-100g reference nutrition data. Portions and recipes may vary.',
              isEstimate: true,
              warnings: catItem.defaultWarning ? [catItem.defaultWarning] : [],
              foods: [newFoodItem],
            }
      );
    }

    setCatalogModalOpen(false);
    setTargetFoodIdForCatalog(null);
  };

  const handleSelectCandidate = async (
    foodId: string,
    cand: NonNullable<FoodAnalysis['foods'][number]['candidates']>[number]
  ) => {
    try {
      const catItem = await foodCatalogApi.getById(cand.catalogId);
      if (catItem) {
        setTargetFoodIdForCatalog(foodId);
        selectCatalogItem(catItem);
        pushToast({
          tone: 'success',
          title: 'Food matched with catalog',
          detail: `Selected ${catItem.canonicalName}. Nutrition recalculated from verified reference data.`,
        });
      }
    } catch (e) {
      console.warn('Failed to fetch catalog item details:', e);
    }
  };

  const updateFood = (foodId: string, field: 'name' | 'quantity', value: string) => {
    if (field === 'quantity') {
      const targetFood = analysis?.foods.find((f) => f.id === foodId);
      handlePortionChange(foodId, Number(value), targetFood?.unit || 'serving');
      return;
    }

    setAnalysis((current) =>
      current
        ? {
            ...current,
            foods: current.foods.map((food) => {
              if (food.id !== foodId) return food;
              return { ...food, name: value };
            }),
          }
        : current
    );
  };

  const updateFoodNutrient = (
    foodId: string,
    field: 'calories' | 'protein' | 'carbohydrates' | 'fat' | 'fiber',
    value: number
  ) => {
    setAnalysis((cur) => {
      if (!cur) return null;
      return {
        ...cur,
        foods: cur.foods.map((food) => {
          if (food.id !== foodId) return food;
          const updatedVal = Math.max(0, value);
          const nextNut = { ...food.nutrition, [field]: updatedVal };
          const perUnit = food.quantity > 0
            ? Math.round((updatedVal / food.quantity) * 10) / 10
            : updatedVal;
          const nextPerUnit = { ...food.nutritionPerUnit, [field]: perUnit };
          return {
            ...food,
            nutrition: nextNut,
            nutritionPerUnit: nextPerUnit,
          };
        }),
      };
    });
  };

  const applyDosaPreset = (foodId: string, variant: 'plain' | 'masala' | 'rava' | 'set') => {
    const presets = {
      plain: {
        name: 'Homemade Plain Dosa',
        cal: 135,
        p: 3.8,
        c: 24.5,
        f: 3.2,
        fib: 1.4,
        unit: 'dosa (75g)',
        grams: 75,
        warn: 'Standard homemade plain dosa roasted with ~1 tsp oil (130-150 kcal). Count chutney and sambar separately.',
      },
      masala: {
        name: 'Masala Dosa',
        cal: 280,
        p: 5.5,
        c: 38.0,
        f: 11.5,
        fib: 3.5,
        unit: 'dosa (150g)',
        grams: 150,
        warn: 'Contains spiced potato filling. Roasting ghee/oil and filling portion vary by preparation.',
      },
      rava: {
        name: 'Rava Dosa',
        cal: 230,
        p: 4.5,
        c: 36.0,
        f: 7.5,
        fib: 1.9,
        unit: 'dosa (120g)',
        grams: 120,
        warn: 'Crisp semolina crepe requiring generous tawa oil for characteristic lace texture.',
      },
      set: {
        name: 'Set Dosa',
        cal: 185,
        p: 4.8,
        c: 32.0,
        f: 4.2,
        fib: 2.1,
        unit: 'set (3 pieces, 150g)',
        grams: 150,
        warn: 'Thick spongy dosas prepared with minimal surface oil.',
      },
    };
    const p = presets[variant];
    setAnalysis((cur) => {
      if (!cur) return null;
      return {
        ...cur,
        foods: cur.foods.map((f) => {
          if (f.id !== foodId) return f;
          const q = f.quantity || 1;
          return {
            ...f,
            name: p.name,
            unit: p.unit,
            calculatedGrams: p.grams * q,
            nutrition: {
              calories: Math.round(p.cal * q),
              protein: Math.round(p.p * q * 10) / 10,
              carbohydrates: Math.round(p.c * q * 10) / 10,
              fat: Math.round(p.f * q * 10) / 10,
              fiber: Math.round(p.fib * q * 10) / 10,
            },
            nutritionPerUnit: {
              calories: p.cal,
              protein: p.p,
              carbohydrates: p.c,
              fat: p.f,
              fiber: p.fib,
            },
            warnings: [p.warn],
            uncertainty: 'User selected recipe formulation. Adjusted for portion and cooking oil.',
          };
        }),
      };
    });
  };

  const addAccompaniment = (type: 'coconut_chutney' | 'sambar' | 'tomato_chutney') => {
    const items = {
      coconut_chutney: {
        name: 'Coconut Chutney',
        cal: 85,
        p: 1.2,
        c: 3.5,
        f: 7.8,
        fib: 1.8,
        unit: 'serving (30g)',
        grams: 30,
        warn: 'Fresh grated coconut with mustard tadka. Calorie-dense from coconut fat.',
      },
      sambar: {
        name: 'Vegetable Sambar',
        cal: 98,
        p: 4.2,
        c: 14.2,
        f: 2.7,
        fib: 3.3,
        unit: 'bowl (150g)',
        grams: 150,
        warn: 'Toor dal simmered with vegetables and tamarind.',
      },
      tomato_chutney: {
        name: 'Tomato Chutney',
        cal: 42,
        p: 0.8,
        c: 5.2,
        f: 2.1,
        fib: 1.1,
        unit: 'serving (30g)',
        grams: 30,
        warn: 'Sauteed tomato and onion relish; lower in fat than coconut chutney.',
      },
    };
    const it = items[type];
    const newFood = {
      id: makeId(),
      name: it.name,
      quantity: 1,
      unit: it.unit,
      calculatedGrams: it.grams,
      nutrition: {
        calories: it.cal,
        protein: it.p,
        carbohydrates: it.c,
        fat: it.f,
        fiber: it.fib,
      },
      nutritionPerUnit: {
        calories: it.cal,
        protein: it.p,
        carbohydrates: it.c,
        fat: it.f,
        fiber: it.fib,
      },
      confidence: 'high' as const,
      warnings: [it.warn],
      uncertainty: 'Standard accompaniment reference portion.',
    };
    setAnalysis((cur) => (cur ? { ...cur, foods: [...cur.foods, newFood] } : null));
  };

  const saveAnalysis = async () => {
    if (!analysis || saving || !analysis.foods.length) return;
    setSaving(true);

    try {
      for (const food of analysis.foods) {
        const note = food.dataSource
          ? `${food.dataSource} [Ref: ${food.sourceReferenceId || 'STD'}] (${food.recipeType || 'standard'})`
          : (food.uncertainty || (analysis.provider ? `Source: ${analysis.provider}` : undefined));

        await saveFoodEntry({
          date,
          meal,
          name: food.name.trim() || 'Food item',
          quantity: food.quantity,
          unit: food.unit || 'serving',
          nutrition: {
            calories: food.nutrition.calories,
            protein: food.nutrition.protein,
            carbohydrates: food.nutrition.carbohydrates,
            fat: food.nutrition.fat,
            fiber: food.nutrition.fiber,
          },
          notes: note,
          source: 'scanner',
        });
      }

      setSaveOpen(false);
      setAnalysis(null);
      setDescription('');
      setFile(null);
      setProgress(0);

      pushToast({
        tone: 'success',
        title: 'Reviewed items added to your diary',
        detail: `Saved ${analysis.foods.length} entry snapshot${analysis.foods.length > 1 ? 's' : ''} to ${MEAL_LABELS[meal]}.`,
      });
      navigate('/diary');
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Failed to save items',
        detail: err instanceof Error ? err.message : 'Could not add foods to your diary.',
      });
    } finally {
      setSaving(false);
    }
  };

  const addSampleFood = () =>
    setAnalysis((current) =>
      current
        ? {
            ...current,
            foods: [
              ...current.foods,
              {
                id: makeId(),
                name: 'Additional item',
                quantity: 1,
                unit: 'serving',
                nutrition: { calories: 120, protein: 4, carbohydrates: 16, fat: 4, fiber: 2 },
                nutritionPerUnit: { calories: 120, protein: 4, carbohydrates: 16, fat: 4, fiber: 2 },
                confidence: 'medium',
                uncertainty: 'User-added item. Adjust name and portion.',
              },
            ],
          }
        : current
    );

  const providerBadge = useMemo(() => {
    if (!analysis) return null;
    if (analysis.provider === 'anthropic') {
      return <StatusPill tone="success"><Sparkles size={13} /> Claude Vision AI</StatusPill>;
    }
    if (analysis.provider === 'huggingface') {
      return <StatusPill tone="success"><Sparkles size={13} /> ViT Indian Food AI</StatusPill>;
    }
    if (analysis.provider === 'mock') {
      return <StatusPill tone="warning"><Sparkles size={13} /> Backend Mock Provider</StatusPill>;
    }
    return <StatusPill tone="warning"><Sparkles size={13} /> Illustrative Demo</StatusPill>;
  }, [analysis]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="AI-POWERED NUTRITION ESTIMATION"
        title="Food scanner"
        subtitle="Use a photo as a prompt, or describe your meal to prepare an estimate."
        action={
          isAuthenticated ? (
            isUnavailable ? (
              <StatusPill tone="coral"><AlertTriangle size={13} /> Scanner offline</StatusPill>
            ) : (
              <StatusPill tone="success"><Sparkles size={13} /> NutriTrack AI Connected</StatusPill>
            )
          ) : (
            <StatusPill tone="warning"><Sparkles size={13} /> Guest / Demo mode</StatusPill>
          )
        }
      />

      {isUnavailable ? (
        <div className="scanner-mode-banner" style={{ borderColor: '#f1c2b9', background: '#fff5f3' }}>
          <span className="mode-badge" style={{ color: '#b4514b', borderColor: '#f1c2b9', background: '#fff' }}>
            <AlertTriangle size={15} /> SCANNER SERVICE STATUS
          </span>
          <p style={{ color: '#883b37' }}>
            {fileError || 'Food scanning service is connecting. If your backend ViT sidecar or AI provider is active, tap Retry Live Analysis, or click Use local demo to analyze your meal instantly.'}
          </p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
            <Button
              tone="primary"
              onClick={() => {
                setIsUnavailable(false);
                setFileError('');
                if (file) {
                  handleAnalyzeImage();
                } else if (description.trim()) {
                  handleEstimateText();
                } else {
                  createMockAnalysis();
                }
              }}
              style={{ minHeight: '30px', padding: '4px 12px', fontSize: '11px' }}
            >
              Retry Live Analysis
            </Button>
            <Button
              tone="secondary"
              onClick={createMockAnalysis}
              style={{ minHeight: '30px', padding: '4px 10px', fontSize: '11px' }}
            >
              Use local demo
            </Button>
            <Button
              tone="ghost"
              onClick={() => openFoodModal(date, meal)}
              style={{ minHeight: '30px', padding: '4px 10px', fontSize: '11px' }}
            >
              Add manually to diary
            </Button>
          </div>
        </div>
      ) : !isAuthenticated ? (
        <div className="scanner-mode-banner">
          <span className="mode-badge">
            <Sparkles size={15} /> GUEST PREVIEW
          </span>
          <p>
            <strong>Sign in to enable live backend AI analysis.</strong> Guest sessions can test the interactive review flow using demo data. Images stay in memory and are never uploaded without an account.
          </p>
          <Button
            tone="secondary"
            onClick={() => openAuthModal('login')}
            style={{ minHeight: '30px', padding: '4px 10px', fontSize: '11px', flexShrink: 0 }}
          >
            <LogIn size={13} /> Sign in
          </Button>
        </div>
      ) : null}

      <div className="scanner-layout">
        <div className="scanner-main-column">
          <Card className="scanner-input-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">STEP 1 · ADD A MEAL</p>
                <h2>Choose how to start</h2>
              </div>
              <span className="step-count">
                01 <i>/ 02</i>
              </span>
            </div>

            <div className="scanner-input-options">
              {/* Native Gallery Picker (No capture attribute, clean input reset) */}
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(event) => {
                  const selected = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  if (selected) {
                    handleFile(selected);
                  }
                }}
                aria-label="Upload a food image from your gallery or files"
                disabled={isAnalyzing}
              />
              <button
                type="button"
                className="scanner-upload-zone"
                aria-label="Upload photo from phone gallery or files"
                disabled={isAnalyzing}
                onClick={() => galleryInputRef.current?.click()}
              >
                <span className="upload-icon">
                  <ImagePlus size={22} />
                </span>
                <strong>Choose from gallery / files</strong>
                <small>JPG, PNG, WebP · Up to 10 MB</small>
                <span className="upload-cta">
                  <Upload size={14} /> Open gallery
                </span>
              </button>

              {/* Dedicated Real-Time Camera Interface */}
              <button
                type="button"
                className="scanner-camera-zone"
                aria-label="Take a photo with live camera"
                disabled={isAnalyzing}
                onClick={() => setCameraModalOpen(true)}
              >
                <span className="camera-round">
                  <Camera size={20} />
                </span>
                <strong>Take photo</strong>
                <small>Live camera viewfinder (back camera preference)</small>
                <span className="upload-cta" style={{ background: '#eef6ee', color: '#276738' }}>
                  <Camera size={14} /> Launch camera
                </span>
              </button>
            </div>

            {fileError && (
              <p className="scanner-error" role="alert">
                <AlertTriangle size={15} /> {fileError}
              </p>
            )}

            {file && previewUrl && (
              <div className="image-preview-panel">
                <div className="image-preview-frame">
                  <img src={previewUrl} alt="Selected meal preview" />
                  <span className="preview-label">
                    <FileImage size={13} /> Ready for analysis
                  </span>
                </div>
                <div className="image-preview-meta">
                  <div>
                    <strong>{file.name}</strong>
                    <span>{(file.size / 1024 / 1024).toFixed(2)} MB · in browser memory</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove selected image"
                    className="icon-button"
                    disabled={isAnalyzing}
                    onClick={() => {
                      setFile(null);
                      setProgress(0);
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
                {progress > 0 && progress < 100 && (
                  <div className="local-progress">
                    <ProgressBar value={progress} target={100} tone="green" />
                    <span>Preparing image preview…</span>
                  </div>
                )}
                <p className="local-only-note">
                  <ShieldCheck size={15} /> Photos are processed in memory and never stored permanently.
                </p>
              </div>
            )}

            <div className="scanner-divider">
              <span>OR DESCRIBE YOUR MEAL</span>
            </div>

            <label className="field">
              <span>Meal description {file ? '(optional context for photo)' : ''}</span>
              <textarea
                rows={3}
                placeholder="e.g. 4 idli with coconut chutney and 1 cup chai"
                value={description}
                disabled={isAnalyzing}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setFileError('');
                }}
              />
              <small>
                {file
                  ? 'Adding details (portion size, preparation, dressing) helps the AI estimate more accurately.'
                  : 'Type foods and quantities to estimate nutrition directly from text.'}
              </small>
            </label>

            <div className="scanner-form-row">
              <label className="field">
                <span>Meal</span>
                <select
                  value={meal}
                  disabled={isAnalyzing}
                  onChange={(event) => {
                    const nextMeal = event.target.value as MealCategory;
                    setMeal(nextMeal);
                    setAnalysis((current) => (current ? { ...current, meal: nextMeal } : null));
                  }}
                >
                  {MEAL_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {MEAL_LABELS[category]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Date</span>
                <input
                  type="date"
                  value={date}
                  disabled={isAnalyzing}
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>
              {file ? (
                <Button disabled={isAnalyzing} onClick={handleAnalyzeImage}>
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={17} className="animate-spin" /> Analyzing photo with AI…
                    </>
                  ) : (
                    <>
                      <ScanLine size={17} /> Analyze photo with AI
                    </>
                  )}
                </Button>
              ) : (
                <Button disabled={isAnalyzing || !description.trim()} onClick={handleEstimateText}>
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={17} className="animate-spin" /> Estimating nutrition…
                    </>
                  ) : (
                    <>
                      <ScanLine size={17} /> Estimate nutrition from text
                    </>
                  )}
                </Button>
              )}

              {/* Retain clearly labeled interactive demo button */}
              <button
                type="button"
                onClick={createMockAnalysis}
                disabled={isAnalyzing}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#7a8578',
                  fontSize: '11px',
                  cursor: 'pointer',
                  padding: '6px',
                  textDecoration: 'underline',
                  textAlign: 'center',
                }}
              >
                Or generate an illustrative demo estimate
              </button>
            </div>
          </Card>

          <Card className="privacy-card">
            <div className="privacy-icon">
              <LockKeyhole size={18} />
            </div>
            <div>
              <h3>Your image privacy is protected</h3>
              <p>
                Images are sent only to perform this estimate, held in volatile memory, and never written to PostgreSQL, disk storage, or server logs. There is no scan-history table. The local preview URL is revoked as soon as the request completes.
              </p>
            </div>
          </Card>
        </div>

        <div className="scanner-results-column">
          <Card className="results-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">STEP 2 · REVIEW BEFORE SAVING</p>
                <h2>Estimate details</h2>
              </div>
              {providerBadge}
            </div>

            {!analysis ? (
              <div className="scanner-results-empty">
                <div className="scan-empty-art">
                  <span>
                    <ScanLine size={26} />
                  </span>
                  <i />
                  <b />
                </div>
                <h3>Your estimate will appear here</h3>
                <p>
                  Upload a photo or describe your meal to generate an estimate. You can review and adjust portions and macros before anything is saved to your diary.
                </p>
                <div className="uncertainty-hint">
                  <CircleHelp size={15} /> Oil, sauces, ingredients and exact serving sizes can shift estimates.
                </div>
              </div>
            ) : (
              <div className="analysis-content">
                <div className="analysis-context">
                  <span>
                    <Sparkles size={14} /> {analysis.provider === 'mock' ? 'Backend Mock Estimate' : analysis.provider === 'anthropic' ? 'Claude Vision AI' : analysis.provider === 'huggingface' ? 'ViT Indian Food AI' : 'Sample Estimate'}
                  </span>
                  <small>For: {analysis.description}</small>
                </div>

                {analysis.disclaimer && (
                  <div className="uncertainty-banner">
                    <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{analysis.disclaimer}</span>
                  </div>
                )}

                {analysis.warnings && analysis.warnings.length > 0 && (
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: '#fff3ea',
                      color: '#a3552a',
                      fontSize: '10px',
                      lineHeight: '1.45',
                    }}
                  >
                    {analysis.warnings.map((warn, i) => (
                      <div key={i} style={{ display: 'flex', gap: '5px', alignItems: 'flex-start' }}>
                        <Info size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>{warn}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="detected-food-list">
                  {analysis.foods.map((food) => (
                    <div className="detected-food" key={food.id}>
                      <div className="detected-food-heading">
                        <label className="field" style={{ flex: 1 }}>
                          <span>Food name</span>
                          <input
                            value={food.name}
                            onChange={(event) => updateFood(food.id, 'name', event.target.value)}
                            aria-label={`Edit name for ${food.name}`}
                          />
                        </label>
                        <button
                          type="button"
                          className="icon-button danger-icon"
                          aria-label={`Remove ${food.name}`}
                          onClick={() =>
                            setAnalysis((current) =>
                              current
                                ? { ...current, foods: current.foods.filter((item) => item.id !== food.id) }
                                : null
                            )
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Catalog Verified Source Badges */}
                      <div className="catalog-badge-row">
                        {food.dataSource && (
                          <span className="catalog-source-pill">
                            <Database size={11} /> {food.dataSource}
                          </span>
                        )}
                        {food.recipeType && (
                          <span
                            className={`catalog-type-pill catalog-type-${
                              food.recipeType === 'MEASURED_FOOD'
                                ? 'measured'
                                : food.recipeType === 'STANDARD_RECIPE'
                                ? 'standard'
                                : 'approx'
                            }`}
                          >
                            {food.recipeType.replace('_', ' ')}
                          </span>
                        )}
                        <button
                          type="button"
                          className="catalog-change-btn"
                          onClick={() => openCatalogModal(food.id, food.name)}
                          title="Search verified catalog to correct or replace this item"
                        >
                          <Search size={11} /> Correct with verified catalog
                        </button>
                      </div>

                      {/* Out-of-Distribution / Low Confidence Warning Banner */}
                      {(food.confidence === 'low' || food.name.includes('(Uncertain')) && (
                        <div
                          style={{
                            padding: '6px 8px',
                            borderRadius: '6px',
                            background: '#fff9e6',
                            border: '1px solid #ffe082',
                            color: '#8d6e19',
                            fontSize: '10px',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '6px',
                          }}
                        >
                          <span>AI is uncertain about this dish. Please verify or pick from the catalog.</span>
                          <button
                            type="button"
                            className="catalog-change-btn"
                            style={{ borderColor: '#f59e0b', color: '#b45309' }}
                            onClick={() => openCatalogModal(food.id, food.name)}
                          >
                            <Search size={11} /> Pick from Catalog
                          </button>
                        </div>
                      )}

                      {/* Ambiguous Dish Appearance Banner (Stage 14 Prediction Safety) */}
                      {(food.name.includes('(Review suggested') || food.name.includes('(Ambiguous')) && (
                        <div
                          style={{
                            padding: '6px 8px',
                            borderRadius: '6px',
                            background: '#f0f7ff',
                            border: '1px solid #bae0ff',
                            color: '#0050b3',
                            fontSize: '10px',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '6px',
                          }}
                        >
                          <span>Visually ambiguous dish appearance. Confirm your dish from candidates below or browse catalog.</span>
                          <button
                            type="button"
                            className="catalog-change-btn"
                            style={{ borderColor: '#1890ff', color: '#096dd9' }}
                            onClick={() => openCatalogModal(food.id, food.name)}
                          >
                            <Search size={11} /> Browse Catalog
                          </button>
                        </div>
                      )}

                      {/* Suggested Catalog Candidates (Stage 14 Safe Candidate Matching) */}
                      {food.candidates && food.candidates.length > 0 && (
                        <div
                          className="candidate-chips-section"
                          style={{
                            margin: '6px 0 10px',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            background: '#f4f8f3',
                            border: '1px solid #d8e6d6',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: '6px',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#2b5229',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <Sparkles size={12} /> Suggested Catalog Matches ({food.candidates.length})
                            </span>
                            <span style={{ fontSize: '10px', color: '#5f755d' }}>
                              Click to select & update nutrition
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {food.candidates.map((cand) => (
                              <button
                                key={cand.catalogId}
                                type="button"
                                onClick={() => handleSelectCandidate(food.id, cand)}
                                title={`${cand.canonicalName} (${cand.matchReason}) — ${cand.caloriesPer100g} kcal/100g`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  background: '#ffffff',
                                  border: '1px solid #b5d5b3',
                                  borderRadius: '16px',
                                  padding: '3px 10px',
                                  fontSize: '11px',
                                  fontWeight: 500,
                                  color: '#1a3319',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <span>{cand.canonicalName}</span>
                                <span
                                  style={{
                                    fontSize: '9px',
                                    color: '#496b47',
                                    background: '#e8f3e6',
                                    borderRadius: '8px',
                                    padding: '1px 5px',
                                  }}
                                >
                                  {cand.category.replace('_', ' ')}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="detected-food-data">
                        <label className="field">
                          <span>Portion & Unit</span>
                          <div className="portion-input" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <input
                              type="number"
                              min="0.1"
                              step="0.1"
                              style={{ width: '60px' }}
                              value={food.quantity}
                              onChange={(event) =>
                                handlePortionChange(food.id, Number(event.target.value), food.unit)
                              }
                              aria-label={`Edit portion for ${food.name}`}
                            />
                            {food.availableUnits && food.availableUnits.length > 0 ? (
                              <select
                                className="portion-unit-select"
                                value={food.unit}
                                onChange={(event) =>
                                  handlePortionChange(food.id, food.quantity, event.target.value)
                                }
                              >
                                {food.availableUnits.map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <em>{food.unit}</em>
                            )}
                            {food.calculatedGrams ? (
                              <span className="calculated-grams-pill" title="Defensible serving weight in grams">
                                ~{food.calculatedGrams}g
                              </span>
                            ) : null}
                          </div>
                        </label>
                        <div className="detected-kcal">
                          <strong>{formatNumber(food.nutrition.calories)}</strong>
                          <span>kcal</span>
                        </div>
                        <span className={`confidence confidence-${food.confidence}`}>
                          {food.confidence} confidence
                        </span>
                      </div>

                      <div className="food-macro-inline">
                        <span>
                          P <b>{food.nutrition.protein}g</b>
                        </span>
                        <span>
                          C <b>{food.nutrition.carbohydrates}g</b>
                        </span>
                        <span>
                          F <b>{food.nutrition.fat}g</b>
                        </span>
                        <span>
                          Fi <b>{food.nutrition.fiber}g</b>
                        </span>
                      </div>

                      {/* Dosa Recipe Variance & Accompaniment Controls (Priority 4) */}
                      {food.name.toLowerCase().includes('dosa') && (
                        <div
                          style={{
                            margin: '8px 0',
                            padding: '8px 10px',
                            background: '#f9fafb',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                          }}
                        >
                          <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                            Adjust Dosa Recipe & Serving (Uncertainty: 130–330 kcal per dosa)
                          </div>
                          <p style={{ fontSize: '10px', color: '#6b7280', margin: '0 0 6px' }}>
                            Homemade dosas with light oil are ~135 kcal each. Restaurant masala dosas with potato masala & ghee reach ~280–330 kcal.
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '6px' }}>
                            <button
                              type="button"
                              className="catalog-change-btn"
                              style={{ background: '#eef6ee', color: '#276738', borderColor: '#b5d5b3' }}
                              onClick={() => applyDosaPreset(food.id, 'plain')}
                            >
                              Homemade Plain (75g · ~135 kcal)
                            </button>
                            <button
                              type="button"
                              className="catalog-change-btn"
                              style={{ background: '#fffbeb', color: '#b45309', borderColor: '#fde68a' }}
                              onClick={() => applyDosaPreset(food.id, 'masala')}
                            >
                              Masala Dosa (150g · ~280 kcal)
                            </button>
                            <button
                              type="button"
                              className="catalog-change-btn"
                              style={{ background: '#fdf2f8', color: '#9d174d', borderColor: '#fbcfe8' }}
                              onClick={() => applyDosaPreset(food.id, 'rava')}
                            >
                              Rava Dosa (120g · ~230 kcal)
                            </button>
                            <button
                              type="button"
                              className="catalog-change-btn"
                              style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}
                              onClick={() => applyDosaPreset(food.id, 'set')}
                            >
                              Set Dosa (3 pcs · ~185 kcal)
                            </button>
                          </div>
                          <div style={{ fontSize: '10px', fontWeight: 500, color: '#4b5563', marginBottom: '3px' }}>
                            Add Accompaniments (counted separately):
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            <button
                              type="button"
                              className="catalog-change-btn"
                              onClick={() => addAccompaniment('coconut_chutney')}
                            >
                              + Coconut Chutney (30g · 85 kcal)
                            </button>
                            <button
                              type="button"
                              className="catalog-change-btn"
                              onClick={() => addAccompaniment('sambar')}
                            >
                              + Sambar (150g · 98 kcal)
                            </button>
                            <button
                              type="button"
                              className="catalog-change-btn"
                              onClick={() => addAccompaniment('tomato_chutney')}
                            >
                              + Tomato Chutney (30g · 42 kcal)
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Nutrient Fine-Tuning Drawer */}
                      <div style={{ marginTop: '6px' }}>
                        <button
                          type="button"
                          className="catalog-change-btn"
                          style={{ fontSize: '10px', padding: '2px 8px' }}
                          onClick={() =>
                            setExpandedNutrientsFoodId(
                              expandedNutrientsFoodId === food.id ? null : food.id
                            )
                          }
                        >
                          <Pencil size={11} />{' '}
                          {expandedNutrientsFoodId === food.id
                            ? 'Hide nutrient fine-tuning'
                            : 'Fine-tune exact nutrients'}
                        </button>

                        {expandedNutrientsFoodId === food.id && (
                          <div
                            style={{
                              marginTop: '6px',
                              padding: '8px',
                              background: '#f8fafc',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(75px, 1fr))',
                              gap: '6px',
                            }}
                          >
                            <label style={{ fontSize: '10px', color: '#475569' }}>
                              <span>Calories (kcal)</span>
                              <input
                                type="number"
                                min="0"
                                value={food.nutrition.calories}
                                onChange={(e) =>
                                  updateFoodNutrient(food.id, 'calories', Number(e.target.value))
                                }
                                style={{
                                  width: '100%',
                                  padding: '3px 5px',
                                  fontSize: '11px',
                                  borderRadius: '4px',
                                  border: '1px solid #cbd5e1',
                                }}
                              />
                            </label>
                            <label style={{ fontSize: '10px', color: '#475569' }}>
                              <span>Protein (g)</span>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={food.nutrition.protein}
                                onChange={(e) =>
                                  updateFoodNutrient(food.id, 'protein', Number(e.target.value))
                                }
                                style={{
                                  width: '100%',
                                  padding: '3px 5px',
                                  fontSize: '11px',
                                  borderRadius: '4px',
                                  border: '1px solid #cbd5e1',
                                }}
                              />
                            </label>
                            <label style={{ fontSize: '10px', color: '#475569' }}>
                              <span>Carbs (g)</span>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={food.nutrition.carbohydrates}
                                onChange={(e) =>
                                  updateFoodNutrient(food.id, 'carbohydrates', Number(e.target.value))
                                }
                                style={{
                                  width: '100%',
                                  padding: '3px 5px',
                                  fontSize: '11px',
                                  borderRadius: '4px',
                                  border: '1px solid #cbd5e1',
                                }}
                              />
                            </label>
                            <label style={{ fontSize: '10px', color: '#475569' }}>
                              <span>Fat (g)</span>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={food.nutrition.fat}
                                onChange={(e) =>
                                  updateFoodNutrient(food.id, 'fat', Number(e.target.value))
                                }
                                style={{
                                  width: '100%',
                                  padding: '3px 5px',
                                  fontSize: '11px',
                                  borderRadius: '4px',
                                  border: '1px solid #cbd5e1',
                                }}
                              />
                            </label>
                            <label style={{ fontSize: '10px', color: '#475569' }}>
                              <span>Fiber (g)</span>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={food.nutrition.fiber}
                                onChange={(e) =>
                                  updateFoodNutrient(food.id, 'fiber', Number(e.target.value))
                                }
                                style={{
                                  width: '100%',
                                  padding: '3px 5px',
                                  fontSize: '11px',
                                  borderRadius: '4px',
                                  border: '1px solid #cbd5e1',
                                }}
                              />
                            </label>
                          </div>
                        )}
                      </div>

                      {food.uncertainty && (
                        <p className="uncertainty-small">
                          <Info size={13} style={{ flexShrink: 0 }} /> {food.uncertainty}
                        </p>
                      )}

                      {food.warnings && food.warnings.length > 0 && (
                        <div style={{ marginTop: '4px', fontSize: '9px', color: '#9d6729' }}>
                          {food.warnings.map((w, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <AlertTriangle size={11} /> <span>{w}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '12px 0 6px' }}>
                  <button
                    type="button"
                    className="add-detected-food"
                    style={{ borderColor: '#276738', color: '#276738', flex: '1 1 auto' }}
                    onClick={() => openCatalogModal(null, '')}
                  >
                    <Database size={15} /> Add food from verified catalog
                  </button>
                  <button
                    type="button"
                    className="add-detected-food"
                    style={{ flex: '1 1 auto' }}
                    onClick={addSampleFood}
                  >
                    <Plus size={15} /> Add custom food
                  </button>
                </div>

                {total && (
                  <div className="analysis-total">
                    <div>
                      <span>Estimated total</span>
                      <small>
                        {MEAL_LABELS[analysis.meal]} ·{' '}
                        {format(date === todayISO() ? new Date() : new Date(`${date}T12:00:00`), 'MMM d')}
                      </small>
                    </div>
                    <strong>
                      {formatNumber(total.calories)} <small>kcal</small>
                    </strong>
                    <div className="total-macros">
                      <span>P {formatNumber(total.protein, 1)}g</span>
                      <span>C {formatNumber(total.carbohydrates, 1)}g</span>
                      <span>F {formatNumber(total.fat, 1)}g</span>
                      <span>Fi {formatNumber(total.fiber, 1)}g</span>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <Button
                    tone="ghost"
                    style={{ minHeight: '38px', color: '#883b37', borderColor: '#f1c2b9' }}
                    disabled={saving}
                    onClick={() => {
                      setAnalysis(null);
                      setFile(null);
                      setDescription('');
                      setProgress(0);
                      pushToast({
                        tone: 'info',
                        title: 'Scan cancelled',
                        detail: 'The scan estimate was discarded. Nothing was saved to your diary.',
                      });
                    }}
                  >
                    <X size={16} /> Discard & cancel
                  </Button>
                  <Button
                    className="review-save-button"
                    style={{ flex: 1 }}
                    disabled={!analysis.foods.length || saving}
                    onClick={() => setSaveOpen(true)}
                  >
                    <Check size={17} /> Review & save to diary
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card className="scanner-note-card">
            <div className="note-dot">
              <Info size={15} />
            </div>
            <p>
              <strong>Good to know</strong> AI scanner results are estimates, never exact measurements. Portion sizes, cooking oils, and hidden sugars are common variables. Always review and adjust before saving.
            </p>
          </Card>
        </div>
      </div>

      <Modal
        open={saveOpen}
        onClose={() => {
          if (!saving) setSaveOpen(false);
        }}
        title="Save these reviewed estimates?"
        subtitle="Only the food names and nutrition snapshots will be added to your diary; images are never saved."
      >
        <div className="save-review-summary">
          <span>{analysis?.foods.length ?? 0} reviewed items</span>
          <strong>{formatNumber(total?.calories ?? 0)} kcal</strong>
        </div>
        <p className="confirm-copy">
          Confirm that you have reviewed the items and want to add them to{' '}
          {MEAL_LABELS[meal].toLowerCase()} for {format(new Date(`${date}T12:00:00`), 'MMMM d')}.
        </p>
        <div className="modal-actions">
          <Button tone="secondary" disabled={saving} onClick={() => setSaveOpen(false)}>
            Go back and review
          </Button>
          <Button disabled={saving || !analysis?.foods.length} onClick={saveAnalysis}>
            {saving ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Saving…
              </>
            ) : (
              'Confirm & save'
            )}
          </Button>
        </div>
      </Modal>

      {/* Verified Food Catalog Modal (Stage 10) */}
      <Modal
        open={catalogModalOpen}
        onClose={() => {
          setCatalogModalOpen(false);
          setTargetFoodIdForCatalog(null);
        }}
        title={targetFoodIdForCatalog ? 'Select Verified Food Match' : 'Add Food from Verified Catalog'}
        subtitle="Curated, traceable nutrition data from ICMR-NIN IFCT 2017 & USDA FoodData Central"
      >
        <div className="catalog-modal-search">
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search dishes (e.g. Idli, Biryani, Pongal, Upma, Sambar, Apple...)"
              value={catalogSearchQuery}
              onChange={(e) => setCatalogSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 34px',
                borderRadius: '8px',
                border: '1px solid #d2dcd0',
                fontSize: '12px',
              }}
              autoFocus
            />
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#7a8578',
              }}
            />
          </div>

          <div className="catalog-category-tabs">
            {[
              { id: 'ALL', label: 'All Categories' },
              { id: 'BREAKFAST_GRAINS', label: 'Breakfast Grains' },
              { id: 'RICE_DISHES', label: 'Rice & Biryani' },
              { id: 'BREADS', label: 'Roti & Breads' },
              { id: 'LENTILS_PULSES', label: 'Dal & Pulses' },
              { id: 'CURRIES_GRAVIES', label: 'Curries & Gravies' },
              { id: 'SNACKS_STREETFOOD', label: 'Snacks' },
              { id: 'FRUITS_RAW', label: 'Fruits & Raw' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`catalog-cat-btn ${catalogCategory === cat.id ? 'active' : ''}`}
                onClick={() => setCatalogCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {catalogLoading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#667364' }}>
              <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: '12px' }}>Searching verified food composition data…</p>
            </div>
          ) : catalogResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#7a8578', fontSize: '12px' }}>
              <p>No verified foods matched your search.</p>
              <small>Try a broader search or switch categories.</small>
            </div>
          ) : (
            <div className="catalog-results-grid">
              {catalogResults.map((item) => (
                <div key={item.id} className="catalog-item-card">
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      flex: 1,
                      marginRight: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '13px', color: '#1a2419' }}>
                        {item.canonicalName}
                      </strong>
                      <span
                        className={`catalog-type-pill catalog-type-${
                          item.recipeType === 'MEASURED_FOOD'
                            ? 'measured'
                            : item.recipeType === 'STANDARD_RECIPE'
                            ? 'standard'
                            : 'approx'
                        }`}
                      >
                        {item.recipeType.replace('_', ' ')}
                      </span>
                    </div>
                    {item.regionalAliases && (
                      <span style={{ fontSize: '10px', color: '#687765' }}>
                        Aliases: {item.regionalAliases}
                      </span>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        fontSize: '10px',
                        color: '#445142',
                        marginTop: '2px',
                      }}
                    >
                      <span>
                        <b>{item.caloriesPer100g}</b> kcal/100g
                      </span>
                      <span>
                        P: <b>{item.proteinPer100g}g</b>
                      </span>
                      <span>
                        C: <b>{item.carbohydratesPer100g}g</b>
                      </span>
                      <span>
                        F: <b>{item.fatPer100g}g</b>
                      </span>
                      <span>
                        Fi: <b>{item.fiberPer100g}g</b>
                      </span>
                    </div>
                    <div style={{ fontSize: '9px', color: '#7a8578', marginTop: '2px' }}>
                      Ref: {item.dataSource}{' '}
                      {item.sourceReferenceId ? `(${item.sourceReferenceId})` : ''} · Standard serving: 1{' '}
                      {item.defaultServingUnit} (~{item.defaultServingGrams}g)
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => selectCatalogItem(item)}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Select Food
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Real-time Camera Viewfinder Modal */}
      <CameraCaptureModal
        open={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCapture={(capturedFile) => {
          handleFile(capturedFile);
          setCameraModalOpen(false);
        }}
        onFallbackToGallery={() => {
          setCameraModalOpen(false);
          galleryInputRef.current?.click();
        }}
      />
    </div>
  );
}
