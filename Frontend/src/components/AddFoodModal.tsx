import { useEffect, useState, useTransition } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/app/AppContext';
import { ApiError, foodCatalogApi, type FoodCatalogItemDto } from '@/services/api';
import { Button, FieldError, Modal, StatusPill } from '@/components/ui';
import { MEAL_CATEGORIES, MEAL_LABELS, type ExternalFoodItem, type FoodEntry } from '@/types';
import { Search, Globe, CheckCircle2, AlertCircle, Info, Sparkles, Scale } from 'lucide-react';

const foodSchema = z.object({
  name: z.string().trim().min(1, 'Add a food name.'),
  date: z.string().min(1, 'Choose a date.'),
  meal: z.enum(MEAL_CATEGORIES),
  quantity: z.number().positive('Quantity must be greater than zero.'),
  unit: z.string().trim().min(1, 'Choose a serving unit.'),
  customGrams: z.number().positive().optional(),
  calories: z.number().min(0, 'Calories cannot be negative.'),
  protein: z.number().min(0, 'Protein cannot be negative.'),
  carbohydrates: z.number().min(0, 'Carbohydrates cannot be negative.'),
  fat: z.number().min(0, 'Fat cannot be negative.'),
  fiber: z.number().min(0, 'Fiber cannot be negative.'),
  notes: z.string().max(240, 'Keep notes under 240 characters.'),
});

type FoodFormInput = z.infer<typeof foodSchema>;

export function AddFoodModal() {
  const { addFoodModal, closeFoodModal, saveFoodEntry, pushToast, isAuthenticated } = useApp();
  const navigate = useNavigate();
  const editing = Boolean(addFoodModal.entry);

  const [searchQuery, setSearchQuery] = useState('');
  const [localMatches, setLocalMatches] = useState<FoodCatalogItemDto[]>([]);
  const [externalMatches, setExternalMatches] = useState<ExternalFoodItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [includeExternal, setIncludeExternal] = useState(false);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<FoodCatalogItemDto | null>(null);
  const [customGramsVal, setCustomGramsVal] = useState<number | undefined>(undefined);
  const [searchStatusNote, setSearchStatusNote] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FoodFormInput>({
    resolver: zodResolver(foodSchema),
    defaultValues: {
      name: '',
      date: addFoodModal.date,
      meal: addFoodModal.meal,
      quantity: 1,
      unit: 'serving',
      calories: 0,
      protein: 0,
      carbohydrates: 0,
      fat: 0,
      fiber: 0,
      notes: '',
    },
  });

  const watchedQuantity = watch('quantity');
  const watchedUnit = watch('unit');

  useEffect(() => {
    const entry = addFoodModal.entry;
    const quantity = entry?.quantity ?? 1;
    reset({
      name: entry?.name ?? '',
      date: entry?.date ?? addFoodModal.date,
      meal: entry?.meal ?? addFoodModal.meal,
      quantity,
      unit: entry?.unit ?? 'serving',
      calories: entry ? Number((entry.nutrition.calories / quantity).toFixed(4)) : 0,
      protein: entry ? Number((entry.nutrition.protein / quantity).toFixed(4)) : 0,
      carbohydrates: entry ? Number((entry.nutrition.carbohydrates / quantity).toFixed(4)) : 0,
      fat: entry ? Number((entry.nutrition.fat / quantity).toFixed(4)) : 0,
      fiber: entry ? Number((entry.nutrition.fiber / quantity).toFixed(4)) : 0,
      notes: entry?.notes ?? '',
    });
    setSearchQuery('');
    setLocalMatches([]);
    setExternalMatches([]);
    setSelectedCatalogItem(null);
    setCustomGramsVal(undefined);
    setSearchStatusNote(null);
  }, [addFoodModal.date, addFoodModal.entry, addFoodModal.meal, reset]);

  // Live local catalog search
  useEffect(() => {
    if (!searchQuery.trim() || !addFoodModal.open || editing || !isAuthenticated) {
      setLocalMatches([]);
      if (!includeExternal) setExternalMatches([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const lookup = await foodCatalogApi.lookup(searchQuery.trim(), includeExternal, 6);
        startTransition(() => {
          setLocalMatches(lookup.localMatches || []);
          setExternalMatches(lookup.externalMatches || []);
          setSearchStatusNote(lookup.attributionNote);
        });
      } catch (e) {
        // Fallback to simple local search if lookup fails
        try {
          const res = await foodCatalogApi.search(searchQuery.trim(), undefined, 6);
          startTransition(() => {
            setLocalMatches(res);
            setExternalMatches([]);
            setSearchStatusNote('Verified NutriTrack catalog matches.');
          });
        } catch {
          setLocalMatches([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, includeExternal, addFoodModal.open, editing, isAuthenticated]);

  // When selectedCatalogItem, quantity, or unit changes, recalculate nutrition automatically
  useEffect(() => {
    if (!selectedCatalogItem) return;
    const calcAsync = async () => {
      try {
        const calc = await foodCatalogApi.calculate({
          catalogId: selectedCatalogItem.id,
          quantity: 1, // calculate per 1 unit for form inputs (total is scaled on save)
          unit: watchedUnit,
          customGrams: customGramsVal,
        });
        setValue('calories', Number(calc.calories));
        setValue('protein', Number(calc.protein));
        setValue('carbohydrates', Number(calc.carbohydrates));
        setValue('fat', Number(calc.fat));
        setValue('fiber', Number(calc.fiber));
      } catch {
        // keep existing values if recalculate fails
      }
    };
    calcAsync();
  }, [selectedCatalogItem, watchedUnit, customGramsVal, setValue]);

  const selectCatalogItem = (item: FoodCatalogItemDto) => {
    setSelectedCatalogItem(item);
    setValue('name', item.canonicalName);
    setValue('unit', item.defaultServingUnit);
    setValue('quantity', 1);
    setCustomGramsVal(undefined);
    setLocalMatches([]);
    setExternalMatches([]);
    setSearchQuery('');
  };

  const selectExternalItem = async (external: ExternalFoodItem) => {
    try {
      setIsSearching(true);
      const imported = await foodCatalogApi.importExternal(external);
      selectCatalogItem(imported);
      pushToast({
        tone: 'success',
        title: 'Product imported from Open Food Facts',
        detail: `${imported.canonicalName} is now added to your verified food catalog.`,
      });
    } catch (err: unknown) {
      pushToast({
        tone: 'error',
        title: 'Could not import external product',
        detail: (err as Error)?.message || 'Please try again or enter details manually.',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    const multiply = (value: number) => Math.round(value * values.quantity * 10) / 10;
    const existing = addFoodModal.entry;
    const nutritionKeys = ['calories', 'protein', 'carbohydrates', 'fat', 'fiber'] as const;
    const unchangedNutrition = existing && values.quantity === existing.quantity && nutritionKeys.every((key) => values[key] === Number((existing.nutrition[key] / existing.quantity).toFixed(4)));

    let notesText = values.notes.trim() || undefined;
    if (selectedCatalogItem) {
      const sourceTag = `[${selectedCatalogItem.dataSource}]`;
      if (!notesText) {
        notesText = sourceTag;
      } else if (!notesText.includes(selectedCatalogItem.dataSource)) {
        notesText = `${notesText} ${sourceTag}`;
      }
    }

    const entry: Omit<FoodEntry, 'id'> = {
      date: values.date,
      meal: values.meal,
      name: values.name.trim(),
      quantity: values.quantity,
      unit: values.unit,
      nutrition: unchangedNutrition
        ? existing.nutrition
        : {
            calories: multiply(values.calories),
            protein: multiply(values.protein),
            carbohydrates: multiply(values.carbohydrates),
            fat: multiply(values.fat),
            fiber: multiply(values.fiber),
          },
      notes: notesText,
      source: addFoodModal.entry?.source ?? 'manual',
    };

    try {
      await saveFoodEntry(entry, addFoodModal.entry?.id);
      closeFoodModal();
      pushToast({
        tone: 'success',
        title: editing ? 'Food entry updated' : 'Food added to your diary',
        detail: 'Nutrition values are saved as an authoritative snapshot for this entry.',
      });
      navigate('/diary');
    } catch (err: unknown) {
      const detail = err instanceof ApiError
        ? err.fieldErrors?.length
          ? err.fieldErrors.map((f) => `${f.field}: ${f.message}`).join(', ')
          : err.message
        : (err as Error)?.message || 'Failed to save food entry.';
      pushToast({
        tone: 'error',
        title: editing ? 'Could not update food entry' : 'Could not add food',
        detail,
      });
    }
  });

  return (
    <Modal
      open={addFoodModal.open}
      onClose={closeFoodModal}
      title={editing ? 'Edit food entry' : 'Add food to diary'}
      subtitle="Search the verified catalog (160+ foods), query external products, or enter custom details."
      wide
    >
      <div className="add-food-container">
        {!editing && isAuthenticated && (
          <div className="catalog-lookup-section">
            <div className="catalog-search-bar">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="catalog-search-input"
                placeholder="Search food catalog (e.g., Idli, Dosa, Chicken, Paneer, Oats, Nutella...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => { setSearchQuery(''); setLocalMatches([]); setExternalMatches([]); }}
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            <div className="catalog-search-options">
              <label className="external-toggle-label">
                <input
                  type="checkbox"
                  checked={includeExternal}
                  onChange={(e) => setIncludeExternal(e.target.checked)}
                />
                <Globe size={14} /> Include external open databases (Open Food Facts)
              </label>
              {isSearching && <span className="searching-spinner"><Sparkles size={13} className="spin-icon" /> Searching...</span>}
            </div>

            {/* Suggestions dropdown */}
            {(localMatches.length > 0 || externalMatches.length > 0) && (
              <div className="catalog-suggestions-dropdown">
                {localMatches.length > 0 && (
                  <div className="suggestions-group">
                    <div className="suggestions-group-title">Verified Reference Catalog</div>
                    {localMatches.map((item) => (
                      <div
                        key={item.id}
                        className="suggestion-item"
                        onClick={() => selectCatalogItem(item)}
                      >
                        <div className="suggestion-item-main">
                          <strong>{item.canonicalName}</strong>
                          <span className="suggestion-category">{item.category.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="suggestion-item-meta">
                          <span className="cal-badge">{item.caloriesPer100g} kcal / 100g</span>
                          <span className="source-tag">{item.dataSource}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {externalMatches.length > 0 && (
                  <div className="suggestions-group external-group">
                    <div className="suggestions-group-title">Open Food Facts (Manufacturer Labels)</div>
                    {externalMatches.map((item) => (
                      <div
                        key={item.code}
                        className="suggestion-item"
                        onClick={() => selectExternalItem(item)}
                      >
                        <div className="suggestion-item-main">
                          <strong>{item.canonicalName}</strong>
                          {item.brand && <span className="suggestion-category">{item.brand}</span>}
                        </div>
                        <div className="suggestion-item-meta">
                          <span className="cal-badge">{item.caloriesPer100g} kcal / 100g</span>
                          <span className="source-tag external-tag">Open Food Facts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchStatusNote && (
                  <div className="suggestions-footnote">
                    <Info size={12} /> {searchStatusNote}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Selected catalog item banner */}
        {selectedCatalogItem && (
          <div className="selected-item-banner">
            <div className="selected-item-header">
              <div className="selected-item-name">
                <CheckCircle2 size={16} className="text-success" />
                <strong>{selectedCatalogItem.canonicalName}</strong>
              </div>
              <StatusPill tone="success">
                {selectedCatalogItem.recipeType.replace(/_/g, ' ')}
              </StatusPill>
            </div>
            <div className="selected-item-details">
              <span>Source: <b>{selectedCatalogItem.dataSource}</b></span>
              <span>Reference: <b>{selectedCatalogItem.caloriesPer100g} kcal / 100g</b></span>
              <span>Default: <b>{selectedCatalogItem.defaultServingGrams}g per {selectedCatalogItem.defaultServingUnit}</b></span>
            </div>
            {selectedCatalogItem.defaultWarning && (
              <div className="selected-item-warning">
                <AlertCircle size={14} />
                <span>{selectedCatalogItem.defaultWarning}</span>
              </div>
            )}
          </div>
        )}

        <form onSubmit={onSubmit} className="form-stack">
          <div className="form-grid form-grid-2">
            <label className="field field-full">
              <span>Food name</span>
              <input placeholder="e.g. Rava Idli with Sambar" {...register('name')} />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </label>
            <label className="field">
              <span>Date</span>
              <input type="date" {...register('date')} />
              {errors.date && <FieldError>{errors.date.message}</FieldError>}
            </label>
            <label className="field">
              <span>Meal</span>
              <select {...register('meal')}>
                {MEAL_CATEGORIES.map((meal) => (
                  <option value={meal} key={meal}>{MEAL_LABELS[meal]}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Quantity</span>
              <input
                type="number"
                min="0.1"
                step="0.1"
                inputMode="decimal"
                {...register('quantity', { valueAsNumber: true })}
              />
              {errors.quantity && <FieldError>{errors.quantity.message}</FieldError>}
            </label>
            <label className="field">
              <span>Serving unit</span>
              {selectedCatalogItem?.servingConversions && Object.keys(selectedCatalogItem.servingConversions).length > 0 ? (
                <select {...register('unit')}>
                  {Object.keys(selectedCatalogItem.servingConversions).map((u) => (
                    <option value={u} key={u}>{u}</option>
                  ))}
                  {selectedCatalogItem.defaultServingUnit && !selectedCatalogItem.servingConversions[selectedCatalogItem.defaultServingUnit] && (
                    <option value={selectedCatalogItem.defaultServingUnit}>{selectedCatalogItem.defaultServingUnit}</option>
                  )}
                </select>
              ) : (
                <select {...register('unit')}>
                  <option value="serving">serving</option>
                  <option value="piece">piece</option>
                  <option value="plate">plate</option>
                  <option value="bowl">bowl (katori)</option>
                  <option value="cup">cup</option>
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="slice">slice</option>
                  <option value="tbsp">tbsp</option>
                  <option value="tsp">tsp</option>
                </select>
              )}
            </label>
          </div>

          {/* Optional Portion Weight Calibration */}
          {selectedCatalogItem && (
            <div className="portion-calibration-box">
              <div className="portion-calibration-header">
                <Scale size={15} />
                <span>Adjust unit weight (optional)</span>
              </div>
              <p className="portion-calibration-desc">
                If your specific portion weighs differently than the standard {selectedCatalogItem.defaultServingGrams}g reference, enter its exact weight below:
              </p>
              <div className="portion-calibration-input-row">
                <label className="field-inline">
                  <span>Weight per 1 {watchedUnit}:</span>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    step="1"
                    placeholder={String(selectedCatalogItem.defaultServingGrams)}
                    value={customGramsVal ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : undefined;
                      setCustomGramsVal(val && val > 0 ? val : undefined);
                    }}
                  />
                  <span>grams</span>
                </label>
                {customGramsVal && (
                  <button
                    type="button"
                    className="reset-weight-btn"
                    onClick={() => setCustomGramsVal(undefined)}
                  >
                    Reset to standard ({selectedCatalogItem.defaultServingGrams}g)
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="section-divider">
            <span>Nutrition per 1 {watchedUnit}</span>
            <span>Total logged scales with quantity ({watchedQuantity} × {watchedUnit})</span>
          </div>

          <div className="form-grid form-grid-5">
            {([
              ['calories', 'Calories', 'kcal'],
              ['protein', 'Protein', 'g'],
              ['carbohydrates', 'Carbs', 'g'],
              ['fat', 'Fat', 'g'],
              ['fiber', 'Fiber', 'g'],
            ] as const).map(([key, label, unit]) => (
              <label className="field" key={key}>
                <span>{label} <small>{unit}</small></span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  {...register(key, { valueAsNumber: true })}
                />
                {errors[key] && <FieldError>{errors[key]?.message}</FieldError>}
              </label>
            ))}
          </div>

          <label className="field">
            <span>Notes <small>optional</small></span>
            <textarea rows={2} placeholder="Preparation notes, restaurant name, or adjustments" {...register('notes')} />
            {errors.notes && <FieldError>{errors.notes.message}</FieldError>}
          </label>

          <div className="modal-actions">
            <Button type="button" tone="secondary" onClick={closeFoodModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {editing ? 'Save changes' : 'Add to diary'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
