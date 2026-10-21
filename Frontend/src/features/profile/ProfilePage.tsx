import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Bell, Check, CircleHelp, Database, Download, FileLock2, Loader2, LockKeyhole, LogIn, LogOut, Mail, Smartphone, Trash2, UserRound } from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { Button, Card, FieldError, PageHeader, StatusPill } from '@/components/ui';
import { ageFromBirthDate, calculateMacrosForCalories, displayToKg, estimateMaintenanceCalories, getGoalForDate, suggestedTargetCalories, todayISO, fallbackGoal } from '@/utils/nutrition';
import { repository } from '@/services/repository';
import { promptPwaInstall, subscribeInstallPrompt, isPwaStandalone } from '@/pwa';
import type { ActivityLevel, BiologicalSex, GoalType, HeightUnit, NutritionGoal, UserProfile, WeightUnit } from '@/types';

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.'),
  email: z.string().trim().email('Enter a valid email.').or(z.literal('')),
  dateOfBirth: z.string().min(1, 'Choose your date of birth.'),
  heightValue: z.number().min(50, 'Height must be at least 50 cm.').max(272, 'Height cannot exceed 272 cm.'),
  heightUnit: z.enum(['cm', 'ft-in']),
  currentWeight: z.number().min(20, 'Weight must be at least 20 kg.').max(500, 'Weight cannot exceed 500 kg.'),
  weightUnit: z.enum(['kg', 'lb']),
  biologicalSex: z.enum(['female', 'male', 'other', 'unspecified']),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very-active']),
  goalType: z.enum(['lose', 'maintain', 'gain', 'muscle']),
  targetWeight: z.number().min(20, 'Target weight must be at least 20 kg.').max(500, 'Target weight cannot exceed 500 kg.')
}).superRefine((values, context) => {
  if (values.dateOfBirth > todayISO()) context.addIssue({ code: 'custom', path: ['dateOfBirth'], message: 'Date of birth cannot be in the future.' });
  if (values.heightUnit === 'ft-in' && (values.heightValue * 30.48 < 50 || values.heightValue * 30.48 > 272)) {
    context.addIssue({ code: 'custom', path: ['heightValue'], message: 'Height must be between 50 cm and 272 cm.' });
  }
  const weightKg = displayToKg(values.currentWeight, values.weightUnit);
  if (weightKg < 20 || weightKg > 500) {
    context.addIssue({ code: 'custom', path: ['currentWeight'], message: 'Current weight must be between 20 kg and 500 kg.' });
  }
  const targetKg = displayToKg(values.targetWeight, values.weightUnit);
  if (targetKg < 20 || targetKg > 500) {
    context.addIssue({ code: 'custom', path: ['targetWeight'], message: 'Target weight must be between 20 kg and 500 kg.' });
  }
});
type ProfileForm = z.infer<typeof profileSchema>;

const kgDisplay = (kg: number, unit: 'kg' | 'lb') => unit === 'lb' ? kg * 2.20462 : kg;
const heightDisplay = (cm: number, unit: 'cm' | 'ft-in') => unit === 'ft-in' ? cm / 30.48 : cm;

export function ProfilePage() {
  const { data, askConfirm, pushToast, currentUser, isAuthenticated, openAuthModal, logout, saveProfile, saveGoal } = useApp();
  const defaultProfile: UserProfile = {
    name: data.profile?.name || currentUser?.name || 'User',
    email: currentUser?.email || data.profile?.email || '',
    dateOfBirth: '2000-01-01',
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
  const isNewProfile = !data.profile;
  const activeGoal = useMemo(() => getGoalForDate(data.goals, todayISO()) ?? { ...fallbackGoal, goalType: profile.goalType, targetWeightKg: profile.targetWeightKg }, [data.goals, profile.goalType, profile.targetWeightKg]);
  const [reminders, setReminders] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsStandalone(isPwaStandalone());
    return subscribeInstallPrompt((available) => {
      setCanInstall(available);
    });
  }, []);
  const { register, handleSubmit, reset, watch, getValues, setValue, trigger, formState: { errors, isSubmitting } } = useForm<ProfileForm>({ resolver: zodResolver(profileSchema), defaultValues: { name: profile.name, email: profile.email, dateOfBirth: profile.dateOfBirth, heightValue: heightDisplay(profile.heightCm, profile.heightUnit), heightUnit: profile.heightUnit, currentWeight: kgDisplay(profile.currentWeightKg, profile.weightUnit), weightUnit: profile.weightUnit, biologicalSex: profile.biologicalSex, activityLevel: profile.activityLevel, goalType: activeGoal.goalType, targetWeight: kgDisplay(activeGoal.targetWeightKg, profile.weightUnit) } });
  const heightUnit = watch('heightUnit');
  const weightUnit = watch('weightUnit');
  const dateOfBirth = watch('dateOfBirth');
  const currentAge = dateOfBirth ? ageFromBirthDate(dateOfBirth) : null;

  useEffect(() => reset({ name: profile.name, email: profile.email, dateOfBirth: profile.dateOfBirth, heightValue: heightDisplay(profile.heightCm, profile.heightUnit), heightUnit: profile.heightUnit, currentWeight: kgDisplay(profile.currentWeightKg, profile.weightUnit), weightUnit: profile.weightUnit, biologicalSex: profile.biologicalSex, activityLevel: profile.activityLevel, goalType: activeGoal.goalType, targetWeight: kgDisplay(activeGoal.targetWeightKg, profile.weightUnit) }), [activeGoal, profile, reset]);

  const changeHeightUnit = (nextUnit: HeightUnit) => {
    const currentUnit = getValues('heightUnit');
    if (currentUnit === nextUnit) return;
    const currentValue = getValues('heightValue');
    const centimeters = currentUnit === 'cm' ? currentValue : currentValue * 30.48;
    const nextValue = nextUnit === 'cm' ? centimeters : centimeters / 30.48;
    setValue('heightValue', Number(nextValue.toFixed(nextUnit === 'cm' ? 2 : 4)), { shouldDirty: true });
    setValue('heightUnit', nextUnit, { shouldDirty: true });
    void trigger(['heightValue', 'heightUnit']);
  };

  const changeWeightUnit = (nextUnit: WeightUnit) => {
    const currentUnit = getValues('weightUnit');
    if (currentUnit === nextUnit) return;
    const currentWeightKg = displayToKg(getValues('currentWeight'), currentUnit);
    const targetWeightKg = displayToKg(getValues('targetWeight'), currentUnit);
    const precision = nextUnit === 'kg' ? 2 : 3;
    setValue('currentWeight', Number(kgDisplay(currentWeightKg, nextUnit).toFixed(precision)), { shouldDirty: true });
    setValue('targetWeight', Number(kgDisplay(targetWeightKg, nextUnit).toFixed(precision)), { shouldDirty: true });
    setValue('weightUnit', nextUnit, { shouldDirty: true });
    void trigger(['currentWeight', 'targetWeight', 'weightUnit']);
  };

  const onSave = handleSubmit(async (values) => {
    const saved: UserProfile = {
      name: values.name.trim(), email: values.email.trim(), dateOfBirth: values.dateOfBirth,
      heightCm: values.heightUnit === 'ft-in' ? values.heightValue * 30.48 : values.heightValue,
      currentWeightKg: displayToKg(values.currentWeight, values.weightUnit), biologicalSex: values.biologicalSex as BiologicalSex,
      activityLevel: values.activityLevel as ActivityLevel, goalType: values.goalType as GoalType,
      targetWeightKg: displayToKg(values.targetWeight, values.weightUnit), weightUnit: values.weightUnit, heightUnit: values.heightUnit, profileUpdatedAt: todayISO(),
    };
    const goalChanged = values.goalType !== activeGoal.goalType || Math.abs(saved.targetWeightKg - activeGoal.targetWeightKg) > 0.05;
    let nextGoal: Omit<NutritionGoal, 'id'> | null = null;
    if (goalChanged) {
      const maintenance = estimateMaintenanceCalories(saved) ?? 2000;
      const targetCalories = suggestedTargetCalories(maintenance, saved.goalType);
      const macros = calculateMacrosForCalories(targetCalories, saved.currentWeightKg, saved.goalType);
      nextGoal = {
        effectiveFrom: todayISO(),
        goalType: values.goalType,
        dailyCalories: targetCalories,
        protein: macros.protein,
        carbohydrates: macros.carbohydrates,
        fat: macros.fat,
        fiber: macros.fiber,
        targetWeightKg: saved.targetWeightKg,
      };
    }

    const doSave = async () => {
      setIsSaving(true);
      try {
        await saveProfile(saved);
        if (nextGoal) {
          await saveGoal(nextGoal);
        }
        pushToast({
          tone: 'success',
          title: 'Profile updated',
          detail: isAuthenticated
            ? 'Your profile is saved to the NutriTrack backend.'
            : 'Your profile is saved in local guest mode.'
        });
      } catch (err) {
        pushToast({
          tone: 'error',
          title: 'Failed to update profile',
          detail: err instanceof Error ? err.message : 'Please check your inputs and try again.'
        });
      } finally {
        setIsSaving(false);
      }
    };

    if (nextGoal && data.goals.some((item) => item.effectiveFrom === nextGoal.effectiveFrom)) {
      askConfirm({
        title: 'Update today’s effective goal?',
        message: 'A goal already begins today. Confirm to update that same-date version; goals from other dates will remain unchanged.',
        confirmLabel: 'Update goal and profile',
        onConfirm: () => void doSave()
      });
    } else {
      await doSave();
    }
  });

  const clearData = () => askConfirm({ title: 'Clear all local NutriTrack records?', message: 'This removes diary entries, goals, workouts, weigh-ins, and profile information stored in this browser. Demo preview content is separate and will remain labelled as sample data.', confirmLabel: 'Clear my local data', onConfirm: () => { repository.clear(); pushToast({ tone: 'success', title: 'Local records cleared' }); } });

  return <div className="page-stack">
    <PageHeader
      eyebrow="YOUR SPACE, YOUR SETTINGS"
      title="Profile & settings"
      subtitle="Your preferences help make the estimates more personal."
      action={isAuthenticated ? <StatusPill tone="success"><Check size={13} /> {isNewProfile ? 'Account connected' : 'Connected profile'}</StatusPill> : <StatusPill tone="neutral"><Check size={13} /> Local profile</StatusPill>}
    />
    {isNewProfile && (
      <div className="demo-banner compact-demo" style={{ background: 'rgba(21, 128, 61, 0.08)', borderColor: 'rgba(21, 128, 61, 0.25)' }}>
        <span><CircleHelp size={16} style={{ color: '#15803d' }} /></span>
        <p>
          <strong>Set up your profile</strong>
          <span>Save your personal details below to calculate personalized daily calorie and nutrition targets.</span>
        </p>
      </div>
    )}
    <div className="profile-layout"><Card className="profile-form-card"><div className="card-heading"><div><p className="eyebrow">PERSONAL DETAILS</p><h2>About you</h2><p className="card-subtitle">Age is calculated automatically from your date of birth.</p></div><span className="soft-icon green-soft"><UserRound size={18} /></span></div>
      <form onSubmit={onSave} className="form-stack"><div className="form-grid form-grid-2"><label className="field"><span>Name</span><input autoComplete="name" {...register('name')} />{errors.name && <FieldError>{errors.name.message}</FieldError>}</label><label className="field"><span>Email <small>optional in this prototype</small></span><input type="email" autoComplete="email" {...register('email')} />{errors.email && <FieldError>{errors.email.message}</FieldError>}</label><label className="field"><span>Date of birth</span><input type="date" max={todayISO()} {...register('dateOfBirth')} />{errors.dateOfBirth && <FieldError>{errors.dateOfBirth.message}</FieldError>}</label><label className="field"><span>Calculated age</span><input value={currentAge === null ? 'Add a valid date of birth' : `${currentAge} years`} readOnly aria-label="Automatically calculated age" /></label><label className="field"><span>Height <small>{heightUnit === 'cm' ? 'cm' : 'decimal feet'}</small></span><input type="number" min="1" max={heightUnit === 'cm' ? 280 : 280 / 30.48} step="any" inputMode="decimal" {...register('heightValue', { valueAsNumber: true })} />{errors.heightValue && <FieldError>{errors.heightValue.message}</FieldError>}</label><label className="field"><span>Height unit</span><select {...register('heightUnit')} value={heightUnit} onChange={(event) => changeHeightUnit(event.target.value as HeightUnit)}><option value="cm">Centimetres</option><option value="ft-in">Feet & inches (enter decimal feet)</option></select></label><label className="field"><span>Current weight <small>{weightUnit}</small></span><input type="number" min="1" max="700" step="any" inputMode="decimal" {...register('currentWeight', { valueAsNumber: true })} />{errors.currentWeight && <FieldError>{errors.currentWeight.message}</FieldError>}</label><label className="field"><span>Preferred weight unit</span><select {...register('weightUnit')} value={weightUnit} onChange={(event) => changeWeightUnit(event.target.value as WeightUnit)}><option value="kg">Kilograms (kg)</option><option value="lb">Pounds (lb)</option></select></label><label className="field"><span>Biological sex <small>only used for some calorie estimates</small></span><select {...register('biologicalSex')}><option value="unspecified">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other / use general estimate</option></select></label><label className="field"><span>Activity level</span><select {...register('activityLevel')}><option value="sedentary">Mostly sitting</option><option value="light">Light activity</option><option value="moderate">Moderately active</option><option value="active">Very active</option><option value="very-active">Highly active</option></select></label><label className="field"><span>Goal <small>changes take effect today</small></span><select {...register('goalType')}><option value="lose">Weight loss</option><option value="maintain">Maintenance</option><option value="gain">Weight gain</option><option value="muscle">Muscle building</option></select></label><label className="field"><span>Target weight <small>{weightUnit}</small></span><input type="number" min="1" max="700" step="any" inputMode="decimal" {...register('targetWeight', { valueAsNumber: true })} />{errors.targetWeight && <FieldError>{errors.targetWeight.message}</FieldError>}</label></div>
        <div className="estimate-disclaimer"><CircleHelp size={15} /><p>Calorie estimates are approximate and are not medical advice. Biological sex is optional and is used only if selected for a formula.</p></div><div className="form-footer"><span>Updated {profile.profileUpdatedAt}</span><Button type="submit" disabled={isSubmitting || isSaving}>{isSubmitting || isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {isSubmitting || isSaving ? 'Saving profile…' : 'Save profile'}</Button></div>
      </form></Card>

      <div className="profile-side-stack"><Card className="settings-card"><div className="card-heading"><div><p className="eyebrow">PREFERENCES</p><h2>Daily support</h2></div><span className="soft-icon coral-soft"><Bell size={18} /></span></div><div className="setting-row"><div className="setting-icon"><Bell size={16} /></div><div className="setting-copy"><strong>Daily nudge</strong><span>Optional reminder preference for this prototype.</span></div><button type="button" className={`toggle-switch ${reminders ? 'on' : ''}`} role="switch" aria-checked={reminders} aria-label="Enable daily nudge" onClick={() => { setReminders((value) => !value); pushToast({ tone: 'info', title: reminders ? 'Reminder preference off' : 'Reminder preference on', detail: 'No notifications are sent in this frontend demo.' }); }}><i /></button></div><div className="setting-row"><div className="setting-icon"><Database size={16} /></div><div className="setting-copy"><strong>Local prototype storage</strong><span>Structured records are stored in this browser only. Not secure production storage.</span></div><StatusPill tone="warning">Local</StatusPill></div><div className="setting-row"><div className="setting-icon"><FileLock2 size={16} /></div><div className="setting-copy"><strong>Scanner privacy</strong><span>Food images remain in memory and are never stored or uploaded in mock mode.</span></div><StatusPill tone="success">On device</StatusPill></div><div className="setting-row"><div className="setting-icon"><Smartphone size={16} /></div><div className="setting-copy"><strong>Progressive Web App</strong><span>Install to your home screen or desktop for fast, standalone access.</span></div>{canInstall ? (<Button size="sm" type="button" onClick={() => void promptPwaInstall()}><Download size={14} /> Install</Button>) : isStandalone ? (<StatusPill tone="success">Installed</StatusPill>) : (<StatusPill tone="neutral">Ready</StatusPill>)}</div></Card>
        <Card className="settings-card account-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">ACCOUNT</p>
              <h2>{isAuthenticated ? 'NutriTrack account' : 'Guest mode'}</h2>
            </div>
            <span className="soft-icon"><LockKeyhole size={17} /></span>
          </div>
          <div className="account-state">
            <span className="account-state-icon"><Mail size={17} /></span>
            <div>
              <strong>{isAuthenticated ? (data.profile?.name || currentUser?.name || 'Connected user') : 'No account connected'}</strong>
              <span>{isAuthenticated ? (currentUser?.email || data.profile?.email || 'Logged in to backend') : 'Running in local guest mode.'}</span>
            </div>
          </div>
          <p className="subtle-note">
            {isAuthenticated
              ? 'Your account is authenticated with the NutriTrack backend.'
              : 'Sign in or register to sync your records with your account.'}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            {isAuthenticated ? (
              <button type="button" className="clear-data-button" style={{ borderColor: '#ef4444', color: '#ef4444' }} onClick={() => void logout()}>
                <LogOut size={15} /> Sign out
              </button>
            ) : (
              <Button type="button" size="sm" onClick={() => openAuthModal('login')}>
                <LogIn size={15} /> Sign in / Register
              </Button>
            )}
            <button type="button" className="clear-data-button" onClick={clearData}>
              <Trash2 size={15} /> Clear local records
            </button>
          </div>
        </Card>
      </div>
    </div>
  </div>;
}
