import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { format, parseISO } from 'date-fns';
import { useApp } from '@/app/AppContext';
import { Button, Card, FieldError, PageHeader, StatusPill } from '@/components/ui';
import { calculateBmr, calculateMacrosForCalories, displayToKg, estimateMaintenanceCalories, formatNumber, getGoalForDate, suggestedTargetCalories, sumNutrition, todayISO, fallbackGoal } from '@/utils/nutrition';
import { Activity, ArrowRight, CalendarClock, CircleHelp, Flame, History, Plus, Scale, Target, Trash2, Pencil, Loader2, Utensils } from 'lucide-react';
import type { GoalType, NutritionGoal, UserProfile, WeightLog } from '@/types';

const goalSchema = z.object({
  effectiveFrom: z.string().min(1, 'Choose an effective date.'),
  goalType: z.enum(['lose', 'maintain', 'gain', 'muscle']),
  dailyCalories: z.number().min(800, 'Choose at least 800 kcal.').max(6000, 'Choose a value below 6000 kcal.'),
  protein: z.number().min(0).max(500),
  carbohydrates: z.number().min(0).max(800),
  fat: z.number().min(0).max(400),
  fiber: z.number().min(0).max(150),
  targetWeight: z.number().positive('Target weight must be greater than zero.'),
});
type GoalForm = z.infer<typeof goalSchema>;
const goalNames: Record<GoalType, string> = { lose: 'Weight loss', maintain: 'Maintenance', gain: 'Weight gain', muscle: 'Muscle building' };

export function GoalsPage() {
  const { data, saveWeight, removeWeight, isWeightsLoading, pushToast, askConfirm, saveGoal, deleteGoal, isAuthenticated, currentUser } = useApp();
  const hasSavedProfile = Boolean(data.profile);
  const defaultProfile: UserProfile = {
    name: currentUser?.name || 'User',
    email: currentUser?.email || '',
    dateOfBirth: '',
    heightCm: 170,
    currentWeightKg: 70,
    biologicalSex: 'unspecified',
    activityLevel: 'moderate',
    goalType: 'maintain',
    targetWeightKg: 70,
    weightUnit: 'kg',
    heightUnit: 'cm',
    profileUpdatedAt: todayISO(),
  };
  const profile: UserProfile = data.profile ?? defaultProfile;
  const savedCurrentGoal = getGoalForDate(data.goals, todayISO());
  const activeGoal = savedCurrentGoal ?? fallbackGoal;
  const bmr = calculateBmr(profile);
  const maintenance = estimateMaintenanceCalories(profile);
  const [weightOpen, setWeightOpen] = useState(false);
  const [editingWeight, setEditingWeight] = useState<WeightLog | null>(null);
  const orderedGoals = data.goals.slice().sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  const sortedWeights = useMemo(() => {
    return [...data.weights].sort((a, b) => b.date.localeCompare(a.date));
  }, [data.weights]);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<GoalForm>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      effectiveFrom: todayISO(),
      goalType: activeGoal.goalType,
      dailyCalories: activeGoal.dailyCalories,
      protein: activeGoal.protein,
      carbohydrates: activeGoal.carbohydrates,
      fat: activeGoal.fat,
      fiber: activeGoal.fiber,
      targetWeight: Math.round(activeGoal.targetWeightKg * (profile.weightUnit === 'lb' ? 2.20462 : 1) * 10) / 10,
    },
  });

  const watchedGoalType = watch('goalType');
  const suggested = maintenance === null ? null : suggestedTargetCalories(maintenance, watchedGoalType);

  useEffect(() => reset({
    effectiveFrom: todayISO(),
    goalType: activeGoal.goalType,
    dailyCalories: activeGoal.dailyCalories,
    protein: activeGoal.protein,
    carbohydrates: activeGoal.carbohydrates,
    fat: activeGoal.fat,
    fiber: activeGoal.fiber,
    targetWeight: Math.round(activeGoal.targetWeightKg * (profile.weightUnit === 'lb' ? 2.20462 : 1) * 10) / 10,
  }), [activeGoal, profile.weightUnit, reset]);

  const onSaveGoal = handleSubmit(async (values) => {
    const next: Omit<NutritionGoal, 'id'> = {
      effectiveFrom: values.effectiveFrom,
      goalType: values.goalType,
      dailyCalories: values.dailyCalories,
      protein: values.protein,
      carbohydrates: values.carbohydrates,
      fat: values.fat,
      fiber: values.fiber,
      targetWeightKg: displayToKg(values.targetWeight, profile.weightUnit),
    };
    const prior = data.goals.find((item) => item.effectiveFrom === values.effectiveFrom);
    const save = async () => {
      try {
        await saveGoal(next, prior?.id);
        pushToast({
          tone: 'success',
          title: 'Goal saved',
          detail: `This target applies from ${format(parseISO(`${values.effectiveFrom}T12:00:00`), 'MMM d, yyyy')}. Earlier goals remain in history.`
        });
      } catch (err) {
        pushToast({
          tone: 'error',
          title: 'Could not save goal',
          detail: err instanceof Error ? err.message : 'Please check your inputs and try again.'
        });
      }
    };
    if (prior) {
      askConfirm({
        title: 'Replace the goal effective on this date?',
        message: 'A goal already begins on this date. Confirm to replace that same-date version; goals from other dates will remain unchanged.',
        confirmLabel: 'Replace same-date goal',
        onConfirm: () => void save()
      });
    } else {
      await save();
    }
  });

  const removeGoalItem = (goal: NutritionGoal) => {
    askConfirm({
      title: 'Delete this goal from history?',
      message: `Goal starting on ${format(parseISO(`${goal.effectiveFrom}T12:00:00`), 'MMM d, yyyy')} will be removed.`,
      confirmLabel: 'Delete goal',
      onConfirm: async () => {
        try {
          await deleteGoal(goal.id);
          pushToast({ tone: 'success', title: 'Goal deleted' });
        } catch (err) {
          pushToast({
            tone: 'error',
            title: 'Could not delete goal',
            detail: err instanceof Error ? err.message : 'Cannot delete goal that applies to days with logged food.'
          });
        }
      }
    });
  };

  const addSuggested = () => {
    if (suggested !== null) {
      setValue('dailyCalories', suggested, { shouldDirty: true, shouldValidate: true });
      const macros = calculateMacrosForCalories(suggested, profile.currentWeightKg, watchedGoalType);
      setValue('protein', macros.protein, { shouldDirty: true, shouldValidate: true });
      setValue('carbohydrates', macros.carbohydrates, { shouldDirty: true, shouldValidate: true });
      setValue('fat', macros.fat, { shouldDirty: true, shouldValidate: true });
      setValue('fiber', macros.fiber, { shouldDirty: true, shouldValidate: true });
      pushToast({
        tone: 'info',
        title: 'Personalized targets applied',
        detail: `Updated calories to ${formatNumber(suggested)} kcal and balanced macros for ${goalNames[watchedGoalType].toLowerCase()}.`
      });
    }
  };

  const latestWeight = sortedWeights[0];
  const displayWeight = (weightKg: number) => `${(weightKg * (profile.weightUnit === 'lb' ? 2.20462 : 1)).toFixed(1)} ${profile.weightUnit}`;
  const todayEntries = data.entries.filter((e) => e.date === todayISO());
  const actualTodayCalories = sumNutrition(todayEntries).calories;

  const handleSaveWeight = async (log: Omit<WeightLog, 'id'>, existingId?: string) => {
    try {
      await saveWeight(log, existingId);
      setWeightOpen(false);
      setEditingWeight(null);
      pushToast({
        tone: 'success',
        title: existingId ? 'Weight entry updated' : 'Weight logged',
        detail: `Saved ${displayWeight(log.weightKg)} for ${format(parseISO(`${log.date}T12:00:00`), 'MMM d, yyyy')}.`,
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: existingId ? 'Could not update weight' : 'Could not save weight',
        detail: err instanceof Error ? err.message : 'Please check your inputs and try again.',
      });
      throw err;
    }
  };

  const handleDeleteWeight = (entry: WeightLog) => {
    askConfirm({
      title: 'Delete this weight entry?',
      message: `Weight entry of ${displayWeight(entry.weightKg)} on ${format(parseISO(`${entry.date}T12:00:00`), 'MMM d, yyyy')} will be removed.`,
      confirmLabel: 'Delete entry',
      onConfirm: async () => {
        try {
          await removeWeight(entry.id);
          pushToast({ tone: 'success', title: 'Weight entry deleted' });
        } catch (err) {
          pushToast({
            tone: 'error',
            title: 'Could not delete weight entry',
            detail: err instanceof Error ? err.message : 'Please try again.',
          });
        }
      },
    });
  };

  return <div className="page-stack">
    <PageHeader
      eyebrow="A DIRECTION, NOT A DEADLINE"
      title="Weight & goals"
      subtitle="Set a direction that can change as life changes."
      action={<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {isAuthenticated ? <StatusPill tone="success">Synced with backend</StatusPill> : <StatusPill tone="neutral">Local mode</StatusPill>}
        <Button tone="secondary" onClick={() => { setEditingWeight(null); setWeightOpen((open) => !open); }}><Scale size={16} /> Log weight</Button>
      </div>}
    />

      {/* 4 Distinct Energy Concepts (Priority 3) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        <Card className="goal-highlight-card">
          <span className="goal-highlight-icon" style={{ background: '#eef2ff', color: '#4338ca' }}><Activity size={18} /></span>
          <div>
            <span className="eyebrow">1. BMR (RESTING ENERGY)</span>
            <strong>{bmr !== null ? `${formatNumber(bmr)} kcal` : 'Add profile'}</strong>
            <span className="goal-highlight-caption">
              {bmr !== null ? 'Resting expenditure via Mifflin–St Jeor formula.' : 'Requires DOB, height, weight & biological sex.'}
            </span>
          </div>
        </Card>

        <Card className="goal-highlight-card">
          <span className="goal-highlight-icon sage"><Flame size={18} /></span>
          <div>
            <span className="eyebrow">2. MAINTENANCE (TDEE)</span>
            <strong>{maintenance !== null ? `${formatNumber(maintenance)} kcal` : 'Add profile'}</strong>
            <span className="goal-highlight-caption">
              {maintenance !== null ? `BMR × ${profile.activityLevel.replace('-', ' ')} activity multiplier.` : 'Daily expenditure including activity.'}
            </span>
          </div>
        </Card>

        <Card className="goal-highlight-card">
          <span className="goal-highlight-icon"><Target size={18} /></span>
          <div>
            <span className="eyebrow">3. TARGET INTAKE</span>
            <strong>{formatNumber(activeGoal.dailyCalories)} <small>kcal/day</small></strong>
            <span className="goal-highlight-caption">
              {maintenance !== null && activeGoal.dailyCalories !== maintenance
                ? `${activeGoal.dailyCalories < maintenance ? 'Deficit' : 'Surplus'}: ${activeGoal.dailyCalories < maintenance ? '-' : '+'}${Math.abs(activeGoal.dailyCalories - maintenance)} kcal vs maintenance`
                : `${goalNames[activeGoal.goalType]} target`}
            </span>
          </div>
        </Card>

        <Card className="goal-highlight-card">
          <span className="goal-highlight-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}><Utensils size={18} /></span>
          <div>
            <span className="eyebrow">4. ACTUAL INTAKE TODAY</span>
            <strong>{formatNumber(actualTodayCalories)} <small>kcal</small></strong>
            <span className="goal-highlight-caption">
              {todayEntries.length} {todayEntries.length === 1 ? 'logged entry' : 'logged entries'} today.
            </span>
          </div>
        </Card>
      </div>

      {/* Weight Loss / Goal Context Callout */}
      {maintenance !== null && (
        <div
          style={{
            padding: '10px 14px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            fontSize: '11px',
            color: '#334155',
            lineHeight: '1.5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            <strong>Goal Strategy ({goalNames[activeGoal.goalType]}):</strong> Current weight is{' '}
            <b>{displayWeight(profile.currentWeightKg)}</b> · Target weight is{' '}
            <b>{displayWeight(activeGoal.targetWeightKg)}</b>. Estimated maintenance is{' '}
            <b>{formatNumber(maintenance)} kcal</b>.{' '}
            {activeGoal.goalType === 'lose'
              ? `Recommended calorie target incorporates a conservative ~350-400 kcal deficit. We do not claim a fixed arrival date as metabolic adaptation and body composition vary.`
              : activeGoal.goalType === 'gain'
              ? `Recommended calorie target incorporates a conservative ~300 kcal surplus to support lean tissue accretion while minimizing excessive fat gain.`
              : `Calorie target aims to preserve equilibrium with your daily expenditure.`}
          </div>
        </div>
      )}

      <div className="goals-layout">
        <Card className="goal-form-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">PERSONALIZE YOUR TARGET</p>
              <h2>Nutrition goal</h2>
              <p className="card-subtitle">Choose when these targets should take effect.</p>
            </div>
            <span className="soft-icon coral-soft"><CalendarClock size={18} /></span>
          </div>

          {suggested !== null && (
            <div className="suggested-target">
              <div>
                <span>{hasSavedProfile ? `Personalized ${goalNames[watchedGoalType]} estimate` : 'Sample estimate'}</span>
                <strong>{formatNumber(suggested)} kcal/day ({watchedGoalType === 'lose' ? '-350 kcal deficit' : watchedGoalType === 'gain' ? '+300 kcal surplus' : 'maintenance'})</strong>
              </div>
              <button type="button" onClick={addSuggested}>
                Apply personalized targets <ArrowRight size={14} />
              </button>
            </div>
          )}
        <form className="form-stack" onSubmit={onSaveGoal}>
          <div className="form-grid form-grid-2">
            <label className="field"><span>Goal</span><select {...register('goalType')}><option value="lose">Weight loss</option><option value="maintain">Maintenance</option><option value="gain">Weight gain</option><option value="muscle">Muscle building</option></select></label>
            <label className="field"><span>Effective from</span><input type="date" {...register('effectiveFrom')} />{errors.effectiveFrom && <FieldError>{errors.effectiveFrom.message}</FieldError>}</label>
            <label className="field"><span>Daily calories <small>kcal</small></span><input type="number" min="800" max="6000" inputMode="numeric" {...register('dailyCalories', { valueAsNumber: true })} />{errors.dailyCalories && <FieldError>{errors.dailyCalories.message}</FieldError>}</label>
            <label className="field"><span>Target weight <small>{profile.weightUnit}</small></span><input type="number" min="1" step="0.1" inputMode="decimal" {...register('targetWeight', { valueAsNumber: true })} />{errors.targetWeight && <FieldError>{errors.targetWeight.message}</FieldError>}</label>
          </div>
          <div className="section-divider"><span>Daily nutrient targets</span><span>grams</span></div>
          <div className="form-grid form-grid-4">
            {(['protein', 'carbohydrates', 'fat', 'fiber'] as const).map((key) => <label className="field" key={key}>
              <span>{key === 'carbohydrates' ? 'Carbs' : key[0]?.toUpperCase() + key.slice(1)}</span>
              <input type="number" min="0" step="1" inputMode="numeric" {...register(key, { valueAsNumber: true })} />
              {errors[key] && <FieldError>{errors[key]?.message}</FieldError>}
            </label>)}
          </div>
          <div className="estimate-disclaimer"><CircleHelp size={15} /><p>Nutrition targets are estimates, not exact measurements or medical advice. The suggested target is a general starting point, not a prescription.</p></div>
          <Button type="submit"><Target size={16} /> Save goal with effective date</Button>
        </form>
      </Card>

      <div className="goals-history-column">
        <Card className="goal-history-card">
          <div className="card-heading"><div><p className="eyebrow">YOUR GOALS OVER TIME</p><h2>Goal history</h2></div><History size={18} className="muted-icon" /></div>
          {orderedGoals.length
            ? <div className="goal-history-list">{orderedGoals.map((goal) => <div className={`goal-history-item ${goal.id === activeGoal.id ? 'current' : ''}`} key={goal.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flex: 1 }}>
                <span className="history-point" />
                <div>
                  <div className="history-title"><strong>{goalNames[goal.goalType]}</strong>{goal.id === activeGoal.id && <StatusPill tone="success">Current</StatusPill>}</div>
                  <span>Effective {format(parseISO(`${goal.effectiveFrom}T12:00:00`), 'MMM d, yyyy')}</span>
                  <small>{formatNumber(goal.dailyCalories)} kcal · P {goal.protein}g · C {goal.carbohydrates}g · F {goal.fat}g · Fi {goal.fiber}g</small>
                </div>
              </div>
              <button
                type="button"
                className="icon-button danger-icon"
                aria-label={`Delete goal effective ${goal.effectiveFrom}`}
                title="Delete this goal"
                style={{ opacity: 0.8 }}
                onClick={() => removeGoalItem(goal)}
              >
                <Trash2 size={14} />
              </button>
            </div>)}</div>
            : <div className="empty-inline"><p>Goals you save will appear here with their effective dates. Historical targets are preserved.</p></div>}
        </Card>

        <Card className="weight-card">
          <div className="card-heading">
            <div><p className="eyebrow">WEIGHT LOG</p><h2>Keep your own pace</h2></div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {isWeightsLoading && <Loader2 size={14} className="animate-spin text-muted" />}
              <span className="soft-icon"><Scale size={17} /></span>
            </div>
          </div>
          <div className="weight-current">
            <span>Latest weigh-in</span>
            <strong>{latestWeight ? displayWeight(latestWeight.weightKg) : displayWeight(profile.currentWeightKg)}</strong>
            <small>{latestWeight ? `${format(parseISO(`${latestWeight.date}T12:00:00`), 'MMM d, yyyy')}${latestWeight.note ? ` · ${latestWeight.note}` : ''}` : data.profile ? 'Profile weight' : 'Sample profile value'}</small>
          </div>
          {weightOpen
            ? <WeightLogForm
                profile={profile}
                initialLog={editingWeight}
                onCancel={() => { setWeightOpen(false); setEditingWeight(null); }}
                onSave={handleSaveWeight}
              />
            : <Button
                tone="secondary"
                className="full-width-button"
                onClick={() => { setEditingWeight(null); setWeightOpen(true); }}
              >
                <Plus size={15} /> Add weigh-in
              </Button>}

          <div className="weight-history-section">
            <div className="weight-history-header">
              <span className="eyebrow">RECENT WEIGH-INS</span>
              {sortedWeights.length > 0 && <small>{sortedWeights.length} {sortedWeights.length === 1 ? 'entry' : 'entries'}</small>}
            </div>

            {sortedWeights.length > 0 ? (
              <div className="weight-history-list">
                {sortedWeights.map((entry) => (
                  <div key={entry.id} className="weight-history-item">
                    <div className="weight-history-meta">
                      <strong>{displayWeight(entry.weightKg)}</strong>
                      <span>{format(parseISO(`${entry.date}T12:00:00`), 'MMM d, yyyy')}</span>
                      {entry.note && <small className="weight-history-note">{entry.note}</small>}
                    </div>
                    <div className="weight-history-actions">
                      <button
                        type="button"
                        className="icon-button"
                        title="Edit weigh-in"
                        aria-label={`Edit weigh-in on ${entry.date}`}
                        onClick={() => {
                          setEditingWeight(entry);
                          setWeightOpen(true);
                        }}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className="icon-button danger-icon"
                        title="Delete weigh-in"
                        aria-label={`Delete weigh-in on ${entry.date}`}
                        onClick={() => handleDeleteWeight(entry)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-inline">
                <p>No weigh-ins recorded yet. Log your weight above to start tracking progress.</p>
              </div>
            )}
          </div>

          <p className="subtle-note">Weight can fluctuate naturally; trends over time are more useful than single readings.</p>
        </Card>
      </div>
    </div>
  </div>;
}

function WeightLogForm({
  profile,
  initialLog,
  onCancel,
  onSave,
}: {
  profile: UserProfile;
  initialLog?: WeightLog | null;
  onCancel: () => void;
  onSave: (weight: Omit<WeightLog, 'id'>, existingId?: string) => Promise<void>;
}) {
  const initialValue = initialLog
    ? (initialLog.weightKg * (profile.weightUnit === 'lb' ? 2.20462 : 1)).toFixed(1)
    : (profile.currentWeightKg * (profile.weightUnit === 'lb' ? 2.20462 : 1)).toFixed(1);

  const [weight, setWeight] = useState(String(initialValue));
  const [date, setDate] = useState(initialLog?.date ?? todayISO());
  const [note, setNote] = useState(initialLog?.note ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const number = Number(weight);
  const weightKg = Number.isFinite(number) ? displayToKg(number, profile.weightUnit) : 0;
  // Backend validation: weightKg between 20 and 500, valid date
  const valid = Number.isFinite(number) && weightKg >= 20 && weightKg <= 500 && Boolean(date);

  const minDisplay = profile.weightUnit === 'lb' ? (20 * 2.20462).toFixed(1) : '20';
  const maxDisplay = profile.weightUnit === 'lb' ? (500 * 2.20462).toFixed(1) : '500';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || isSaving) return;
    setIsSaving(true);
    try {
      await onSave(
        {
          date,
          weightKg: Number(weightKg.toFixed(2)),
          note: note.trim() || undefined,
        },
        initialLog?.id
      );
    } catch {
      // Keep form open for corrections on failure
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="weight-log-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Weight <small>{profile.weightUnit} (20–500 kg / {minDisplay}–{maxDisplay} lb)</small></span>
        <input
          type="number"
          min="1"
          max="1200"
          step="0.1"
          value={weight}
          onChange={(event) => setWeight(event.target.value)}
          disabled={isSaving}
          required
        />
        {Number.isFinite(number) && (weightKg < 20 || weightKg > 500) && (
          <FieldError>Weight must be between {minDisplay} and {maxDisplay} {profile.weightUnit}.</FieldError>
        )}
      </label>
      <label className="field">
        <span>Date</span>
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          disabled={isSaving}
          required
        />
      </label>
      <label className="field">
        <span>Note <small>optional, max 500 characters</small></span>
        <input
          type="text"
          maxLength={500}
          placeholder="e.g. Morning fasting, post-workout"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={isSaving}
        />
      </label>
      <div className="inline-actions">
        <Button tone="secondary" size="sm" type="button" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button size="sm" type="submit" disabled={!valid || isSaving}>
          {isSaving ? (
            <>
              <Loader2 size={13} className="animate-spin mr-1" />
              Saving...
            </>
          ) : initialLog ? (
            'Update weigh-in'
          ) : (
            'Save weigh-in'
          )}
        </Button>
      </div>
    </form>
  );
}

