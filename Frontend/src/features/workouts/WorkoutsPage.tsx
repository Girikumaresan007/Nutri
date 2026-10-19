import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
import { format, parseISO, subDays } from 'date-fns';
import { Activity, CalendarDays, Clock3, Dumbbell, Flame, Plus, Scale, Trash2, Bike, Pencil, X, Loader2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '@/app/AppContext';
import { Button, Card, EmptyState, FieldError, PageHeader, StatusPill } from '@/components/ui';
import { makeId, todayISO, formatNumber, calculateWorkoutCalories } from '@/utils/nutrition';
import type { WorkoutSession } from '@/types';

const exerciseSchema = z.object({
  name: z.string(),
  sets: z.number().int().min(1, 'Min 1 set.').max(100, 'Max 100 sets.'),
  reps: z.number().int().min(1, 'Min 1 rep.').max(1000, 'Max 1000 reps.'),
  weightKg: z.number().min(0, 'Weight cannot be negative.').max(1000, 'Max 1000 kg.'),
  notes: z.string().max(500, 'Notes max 500 characters.').optional(),
});

const workoutSchema = z.object({
  date: z.string().min(1, 'Choose a date.'),
  type: z.enum(['strength', 'cardio']),
  split: z.string().min(1),
  name: z.string().trim().min(1, 'Add a workout name.').max(120, 'Name must be 120 characters or less.'),
  durationMinutes: z.number().min(1, 'Duration must be at least 1 minute.').max(1440, 'Duration cannot exceed 1440 minutes.'),
  estimatedCalories: z.number().min(0, 'Estimated calories cannot be negative.').max(20000, 'Calories cannot exceed 20000.'),
  distanceKm: z.number().min(0, 'Distance cannot be negative.').max(1000, 'Max 1000 km.').optional(),
  notes: z.string().max(1000, 'Notes max 1000 characters.').optional(),
  exercises: z.array(exerciseSchema),
}).superRefine((data, ctx) => {
  if (data.type === 'strength') {
    const validExercises = data.exercises.filter((e) => e.name.trim());
    if (validExercises.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: 'Strength workouts require at least one exercise with a name.',
      });
    }
  }
});

type WorkoutForm = z.infer<typeof workoutSchema>;
const defaultExercise = () => ({ name: '', sets: 3, reps: 10, weightKg: 0, notes: '' });

export function WorkoutsPage() {
  const { data, saveWorkout, removeWorkout, askConfirm, pushToast, isWorkoutsLoading, isAuthenticated } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WorkoutSession | null>(null);

  const workouts = data.workouts.slice().sort((a, b) => b.date.localeCompare(a.date));
  const weekData = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = format(subDays(new Date(), 6 - index), 'yyyy-MM-dd');
    return {
      date,
      minutes: workouts.filter((workout) => workout.date === date).reduce((sum, workout) => sum + workout.durationMinutes, 0),
    };
  }), [workouts]);

  const weekDescription = `Workout minutes by day over the last seven days. ${weekData
    .map((row) => `${format(parseISO(`${row.date}T12:00:00`), 'EEE, MMM d')}: ${formatNumber(row.minutes)} minutes`)
    .join('; ')}.`;
  const totalMinutes = workouts.reduce((sum, workout) => sum + workout.durationMinutes, 0);
  const estimatedKcal = workouts.reduce((sum, workout) => sum + workout.estimatedCalories, 0);

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (workout: WorkoutSession) => {
    setEditing(workout);
    setModalOpen(true);
  };

  const remove = (workout: WorkoutSession) =>
    askConfirm({
      title: 'Delete this workout?',
      message: `${workout.name} will be removed from your workout history.`,
      confirmLabel: 'Delete workout',
      onConfirm: async () => {
        try {
          await removeWorkout(workout.id);
          pushToast({ tone: 'success', title: 'Workout deleted' });
        } catch (err) {
          pushToast({
            tone: 'error',
            title: 'Failed to delete workout',
            detail: err instanceof Error ? err.message : 'Could not remove workout from backend.',
          });
        }
      },
    });

  const handleSave = async (workout: WorkoutSession) => {
    try {
      await saveWorkout(workout);
      setModalOpen(false);
      pushToast({
        tone: 'success',
        title: editing ? 'Workout updated' : 'Workout saved',
        detail: 'Estimated activity calories remain separate from food intake.',
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: editing ? 'Failed to update workout' : 'Failed to save workout',
        detail: err instanceof Error ? err.message : 'An error occurred while saving workout.',
      });
      throw err;
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="MOVEMENT THAT FEELS GOOD"
        title="Workouts"
        subtitle="Keep a simple record of strength work and cardio."
        action={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isWorkoutsLoading && <StatusPill tone="neutral"><Loader2 size={12} className="animate-spin" /> Syncing…</StatusPill>}
            <Button onClick={openNew}>
              <Plus size={17} /> Log workout
            </Button>
          </div>
        }
      />

      <div className="workout-stat-grid">
        <StatTile icon={<Dumbbell size={17} />} label="Sessions logged" value={String(workouts.length)} tone="green" />
        <StatTile icon={<Clock3 size={17} />} label="Total time" value={`${formatNumber(totalMinutes)} min`} tone="coral" />
        <StatTile icon={<Flame size={17} />} label="Est. activity energy" value={`${formatNumber(estimatedKcal)} kcal`} tone="gold" />
      </div>

      <Card className="workout-chart-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">YOUR MOVEMENT RHYTHM</p>
            <h2>Time spent this week</h2>
            <p className="card-subtitle">Minutes from workouts you have logged.</p>
          </div>
          <StatusPill tone={workouts.length ? 'neutral' : 'warning'}>
            {workouts.length ? (isAuthenticated ? 'Synced with cloud' : 'Local logs') : 'No workouts yet'}
          </StatusPill>
        </div>
        {workouts.length ? (
          <div className="chart-wrap" role="img" aria-label={weekDescription}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekData} margin={{ top: 12, right: 4, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="#edf0e9" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string) => format(parseISO(`${value}T12:00:00`), 'EEE')}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#8b918a', fontSize: 11 }}
                />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#8b918a', fontSize: 11 }} width={34} />
                <Tooltip
                  labelFormatter={(value) => format(parseISO(`${String(value)}T12:00:00`), 'EEE, MMM d')}
                  formatter={(value) => [`${formatNumber(Number(value))} min`, 'Workout time']}
                />
                <Bar dataKey="minutes" fill="#244c3a" radius={[7, 7, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            icon={<Activity size={20} />}
            title="Your first session starts the story"
            detail="Add a strength or cardio session to see your weekly movement rhythm."
            action={
              <Button onClick={openNew}>
                <Plus size={16} /> Add workout
              </Button>
            }
          />
        )}
      </Card>

      <div className="section-title-row">
        <div>
          <p className="eyebrow">YOUR ACTIVITY LOG</p>
          <h2>Recent sessions</h2>
        </div>
        <span className="quiet-note">{workouts.length} total</span>
      </div>

      {!workouts.length ? (
        <Card className="no-records-card">
          <EmptyState
            icon={<Dumbbell size={20} />}
            title="No workout sessions yet"
            detail="Strength training and cardio sessions can both live here."
            action={
              <Button onClick={openNew}>
                <Plus size={16} /> Log a workout
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="workout-list">
          {workouts.map((workout) => (
            <WorkoutCard
              key={workout.id}
              workout={workout}
              onEdit={() => openEdit(workout)}
              onDelete={() => remove(workout)}
            />
          ))}
        </div>
      )}

      <div className="calorie-accounting-note">
        <span>
          <Scale size={16} />
        </span>
        <p>
          <strong>About exercise calories</strong> Exercise energy is an estimate and is shown separately from your maintenance target. It is not added back to your food budget, because normal activity may already be included in your maintenance estimate.
        </p>
      </div>

      <WorkoutModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        existing={editing}
        onSave={handleSave}
      />
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'green' | 'coral' | 'gold';
}) {
  return (
    <Card className="workout-stat-card">
      <span className={`stat-icon stat-${tone}`}>{icon}</span>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
    </Card>
  );
}

function WorkoutCard({
  workout,
  onEdit,
  onDelete,
}: {
  workout: WorkoutSession;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dateLabel = format(parseISO(`${workout.date}T12:00:00`), 'EEE, MMM d');
  return (
    <Card className="workout-session-card">
      <div className="workout-session-top">
        <span className={`workout-type-icon ${workout.type === 'strength' ? 'strength-icon' : 'cardio-icon'}`}>
          {workout.type === 'strength' ? <Dumbbell size={18} /> : <Bike size={18} />}
        </span>
        <div className="workout-session-title">
          <div className="session-heading">
            <h3>{workout.name}</h3>
            <StatusPill>{workout.type === 'strength' ? workout.split : workout.cardioType}</StatusPill>
          </div>
          <div className="session-meta">
            <span>
              <CalendarDays size={13} /> {dateLabel}
            </span>
            <span>
              <Clock3 size={13} /> {workout.durationMinutes} min
            </span>
            <span>
              <Flame size={13} /> ~{workout.estimatedCalories} kcal est.
            </span>
          </div>
        </div>
        <div className="session-actions">
          <button type="button" className="icon-button" aria-label={`Edit ${workout.name}`} onClick={onEdit}>
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="icon-button danger-icon"
            aria-label={`Delete ${workout.name}`}
            onClick={onDelete}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {workout.type === 'strength' && workout.exercises.length > 0 && (
        <div className="exercise-pills">
          {workout.exercises.map((exercise) => (
            <span key={exercise.id}>
              <strong>{exercise.name || 'Exercise'}</strong>
              <small>
                {exercise.sets} × {exercise.reps}
                {exercise.weightKg ? ` · ${exercise.weightKg} kg` : ''}
                {exercise.notes ? ` · ${exercise.notes}` : ''}
              </small>
            </span>
          ))}
        </div>
      )}
      {workout.type === 'cardio' && workout.distanceKm ? (
        <p className="workout-details">Distance: {workout.distanceKm} km</p>
      ) : null}
      {workout.notes && <p className="workout-notes">{workout.notes}</p>}
    </Card>
  );
}

function WorkoutModal({
  open,
  onClose,
  existing,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  existing: WorkoutSession | null;
  onSave: (workout: WorkoutSession) => Promise<void>;
}) {
  const { data } = useApp();
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    watch,
    reset,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkoutForm>({
    resolver: zodResolver(workoutSchema),
    defaultValues: {
      date: todayISO(),
      type: 'strength',
      split: 'Legs',
      name: '',
      durationMinutes: 45,
      estimatedCalories: 220,
      distanceKm: undefined,
      notes: '',
      exercises: [defaultExercise()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'exercises' });
  const type = watch('type');
  const watchedDuration = watch('durationMinutes') || 45;
  const watchedSplit = watch('split') || 'Legs';
  const userWeightKg = data.profile?.currentWeightKg || 70;
  const metCalculation = calculateWorkoutCalories(userWeightKg, watchedDuration, watchedSplit);

  const applyMetCalories = () => {
    setValue('estimatedCalories', metCalculation.calories, { shouldDirty: true, shouldValidate: true });
  };

  useEffect(() => {
    setFormError(null);
    setIsSaving(false);
    reset(
      existing
        ? {
            date: existing.date,
            type: existing.type,
            split: existing.type === 'strength' ? existing.split : existing.cardioType,
            name: existing.name,
            durationMinutes: existing.durationMinutes,
            estimatedCalories: existing.estimatedCalories,
            distanceKm: existing.type === 'cardio' ? existing.distanceKm : undefined,
            notes: existing.notes ?? '',
            exercises:
              existing.type === 'strength' && existing.exercises.length
                ? existing.exercises.map(({ name, sets, reps, weightKg, notes }) => ({
                    name,
                    sets: Math.max(1, sets || 1),
                    reps: Math.max(1, reps || 1),
                    weightKg: Math.max(0, weightKg || 0),
                    notes: notes ?? '',
                  }))
                : [defaultExercise()],
          }
        : {
            date: todayISO(),
            type: 'strength',
            split: 'Legs',
            name: '',
            durationMinutes: 45,
            estimatedCalories: 220,
            distanceKm: undefined,
            notes: '',
            exercises: [defaultExercise()],
          }
    );
  }, [existing, open, reset]);

  // Lock background scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape key close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, isSaving, onClose]);

  const submit = handleSubmit(async (values) => {
    if (isSaving) return;
    setIsSaving(true);
    setFormError(null);

    const base = {
      id: existing?.id ?? makeId(),
      date: values.date,
      name: values.name.trim(),
      durationMinutes: values.durationMinutes,
      estimatedCalories: values.estimatedCalories,
      notes: values.notes?.trim() || undefined,
    };

    try {
      if (values.type === 'cardio') {
        await onSave({
          ...base,
          type: 'cardio',
          cardioType: values.split,
          distanceKm: values.distanceKm || undefined,
        });
      } else {
        const cleanedExercises = values.exercises
          .filter((exercise) => exercise.name.trim())
          .map((exercise) => ({
            id: makeId(),
            name: exercise.name.trim(),
            sets: Math.max(1, exercise.sets || 1),
            reps: Math.max(1, exercise.reps || 1),
            weightKg: Math.max(0, exercise.weightKg || 0),
            notes: exercise.notes?.trim() || undefined,
          }));

        await onSave({
          ...base,
          type: 'strength',
          split: values.split,
          exercises: cleanedExercises.length
            ? cleanedExercises
            : [{ id: makeId(), name: values.name.trim() || 'General Exercise', sets: 3, reps: 10, weightKg: 0 }],
        });
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save workout. Please try again.');
    } finally {
      setIsSaving(false);
    }
  });

  if (!open) return null;

  const modalElement = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={existing ? 'Edit workout' : 'Log a workout'}
      className="workout-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '24px 16px 140px 16px',
        background: 'rgba(15, 23, 18, 0.65)',
        backdropFilter: 'blur(6px)',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <div
        className="workout-modal-card"
        style={{
          width: '100%',
          maxWidth: '760px',
          margin: '0 auto',
          background: '#fffefa',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.85)',
          boxShadow: '0 25px 70px rgba(10, 25, 18, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            padding: '22px 24px 16px',
            borderBottom: '1px solid #edf0e9',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontFamily: 'Manrope, sans-serif',
                fontSize: '1.25rem',
                fontWeight: 700,
                letterSpacing: '-0.4px',
                color: '#1a2b20',
              }}
            >
              {existing ? 'Edit workout' : 'Log a workout'}
            </h2>
            <p
              style={{
                margin: '5px 0 0',
                color: '#738073',
                fontSize: '0.8125rem',
                lineHeight: 1.5,
              }}
            >
              Movement calories are estimates and do not change your food target.
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
            disabled={isSaving}
            style={{ flexShrink: 0 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body with all fields & bottom action buttons in one continuous scroll flow */}
        <form
          id="workout-modal-form"
          onSubmit={submit}
          className="form-stack"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            padding: '20px 24px 28px',
          }}
        >
          {formError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '0.8125rem',
                fontWeight: 500,
              }}
            >
              {formError}
            </div>
          )}

          <div className="form-grid form-grid-2">
            <label className="field">
              <span>Workout type</span>
              <select {...register('type')} disabled={isSaving}>
                <option value="strength">Strength training</option>
                <option value="cardio">Cardio</option>
              </select>
            </label>
            <label className="field">
              <span>Date</span>
              <input type="date" {...register('date')} disabled={isSaving} />
            </label>
            <label className="field">
              <span>{type === 'strength' ? 'Workout split' : 'Cardio type'}</span>
              {type === 'strength' ? (
                <select {...register('split')} disabled={isSaving}>
                  <option value="Chest / triceps">Chest / triceps</option>
                  <option value="Back / biceps">Back / biceps</option>
                  <option value="Legs">Legs</option>
                  <option value="Full body">Full body</option>
                  <option value="Custom">Custom</option>
                </select>
              ) : (
                <select {...register('split')} disabled={isSaving}>
                  <option value="Run">Run</option>
                  <option value="Walk">Walk</option>
                  <option value="Cycling">Cycling</option>
                  <option value="Swimming">Swimming</option>
                  <option value="Other cardio">Other cardio</option>
                </select>
              )}
            </label>
            <label className="field">
              <span>Session name</span>
              <input
                placeholder={type === 'strength' ? 'e.g. Lower body strength' : 'e.g. Easy outdoor run'}
                {...register('name')}
                disabled={isSaving}
              />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </label>
            <label className="field">
              <span>Duration <small>minutes</small></span>
              <input
                type="number"
                min="1"
                max="1440"
                inputMode="numeric"
                disabled={isSaving}
                {...register('durationMinutes', { valueAsNumber: true })}
              />
              {errors.durationMinutes && <FieldError>{errors.durationMinutes.message}</FieldError>}
            </label>
            <label className="field">
              <span>Estimated calories <small>kcal · estimate</small></span>
              <input
                type="number"
                min="0"
                max="20000"
                inputMode="numeric"
                disabled={isSaving}
                {...register('estimatedCalories', { valueAsNumber: true })}
              />
              {errors.estimatedCalories && <FieldError>{errors.estimatedCalories.message}</FieldError>}
            </label>

            {/* MET badge */}
            <div className="field-full" style={{ marginTop: '-4px' }}>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                  fontSize: '0.8125rem',
                  color: '#475569',
                }}
              >
                <div>
                  <strong>MET Expenditure Formula:</strong> {metCalculation.formula} ={' '}
                  <b>~{metCalculation.calories} kcal</b> (using {userWeightKg} kg body weight)
                </div>
                <button
                  type="button"
                  className="text-action"
                  style={{ fontSize: '0.8125rem', padding: '4px 8px', background: '#e2e8f0', borderRadius: '6px' }}
                  onClick={applyMetCalories}
                >
                  Apply MET estimate ({metCalculation.calories} kcal)
                </button>
              </div>
            </div>

            {type === 'cardio' && (
              <label className="field">
                <span>Distance <small>optional · km</small></span>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  step="0.1"
                  inputMode="decimal"
                  disabled={isSaving}
                  {...register('distanceKm', {
                    setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                  })}
                />
                {errors.distanceKm && <FieldError>{errors.distanceKm.message}</FieldError>}
              </label>
            )}
          </div>

          {type === 'strength' && (
            <div className="exercise-editor">
              <div className="section-divider">
                <span>Exercises</span>
                <button
                  type="button"
                  className="text-action"
                  disabled={isSaving}
                  onClick={() => append(defaultExercise())}
                >
                  <Plus size={14} /> Add exercise
                </button>
              </div>
              {fields.map((field, index) => (
                <div className="exercise-form-row" key={field.id}>
                  <label className="field exercise-name-field">
                    <span>Exercise name</span>
                    <input
                      placeholder="e.g. Goblet squat"
                      disabled={isSaving}
                      {...register(`exercises.${index}.name`)}
                    />
                    {errors.exercises?.[index]?.name && (
                      <FieldError>{errors.exercises[index]?.name?.message}</FieldError>
                    )}
                  </label>
                  <label className="field">
                    <span>Sets</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      disabled={isSaving}
                      {...register(`exercises.${index}.sets`, { valueAsNumber: true })}
                    />
                    {errors.exercises?.[index]?.sets && (
                      <FieldError>{errors.exercises[index]?.sets?.message}</FieldError>
                    )}
                  </label>
                  <label className="field">
                    <span>Reps</span>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      disabled={isSaving}
                      {...register(`exercises.${index}.reps`, { valueAsNumber: true })}
                    />
                    {errors.exercises?.[index]?.reps && (
                      <FieldError>{errors.exercises[index]?.reps?.message}</FieldError>
                    )}
                  </label>
                  <label className="field">
                    <span>Weight <small>kg</small></span>
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      step="0.5"
                      disabled={isSaving}
                      {...register(`exercises.${index}.weightKg`, { valueAsNumber: true })}
                    />
                    {errors.exercises?.[index]?.weightKg && (
                      <FieldError>{errors.exercises[index]?.weightKg?.message}</FieldError>
                    )}
                  </label>
                  <button
                    type="button"
                    className="icon-button danger-icon exercise-remove"
                    aria-label={`Remove exercise ${index + 1}`}
                    disabled={isSaving}
                    onClick={() => remove(index)}
                  >
                    <X size={15} />
                  </button>
                  <label className="field exercise-notes-field">
                    <span>Exercise notes <small>optional</small></span>
                    <input
                      placeholder="e.g. Keep a steady tempo"
                      disabled={isSaving}
                      {...register(`exercises.${index}.notes`)}
                    />
                  </label>
                </div>
              ))}
            </div>
          )}

          <label className="field">
            <span>Session notes <small>optional</small></span>
            <textarea
              rows={2}
              placeholder="How did it feel?"
              disabled={isSaving}
              {...register('notes')}
            />
          </label>

          <div className="calorie-accounting-note compact-note">
            <span>
              <Scale size={15} />
            </span>
            <p>
              Estimated exercise calories are recorded separately; they are not added to food calories remaining.
            </p>
          </div>

          {/* Bottom Action Buttons: Always in natural scroll order at the end of the form */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '20px',
              borderTop: '1px solid #edf0e9',
              marginTop: '4px',
            }}
          >
            <Button
              type="button"
              tone="secondary"
              disabled={isSaving}
              onClick={onClose}
              style={{ minWidth: '100px', minHeight: '44px' }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              style={{ minWidth: '140px', minHeight: '44px', fontWeight: 600 }}
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Saving…
                </>
              ) : existing ? (
                'Save changes'
              ) : (
                'Save workout'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalElement, document.body) : modalElement;
}
