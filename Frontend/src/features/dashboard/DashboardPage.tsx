import { format, parseISO, subDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Clock3, Droplets, Flame, Plus, ScanLine, Sparkles, Weight, Dumbbell } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '@/app/AppContext';
import { toFrontendGoal } from '@/services/api';
import { Card, PageHeader, ProgressBar, RingProgress, StatusPill, Button } from '@/components/ui';
import { formatNumber, getGoalForDate, sumNutrition, fallbackGoal, todayISO } from '@/utils/nutrition';
import { MEAL_CATEGORIES, MEAL_LABELS } from '@/types';

const macroCards = [
  { key: 'protein', label: 'Protein', tone: 'green', mark: 'P' },
  { key: 'carbohydrates', label: 'Carbs', tone: 'coral', mark: 'C' },
  { key: 'fat', label: 'Fat', tone: 'gold', mark: 'F' },
  { key: 'fiber', label: 'Fiber', tone: 'blue', mark: 'Fi' },
] as const;

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};

export function DashboardPage() {
  const {
    data,
    selectedDate,
    setSelectedDate,
    openFoodModal,
    pushToast,
    authStatus,
    isAuthenticated,
    dailySummary,
    openAuthModal,
    currentUser,
    isFoodLoading,
    retryConnection,
  } = useApp();
  const navigate = useNavigate();
  const entries = data.entries.filter((entry) => entry.date === selectedDate);
  const isSummaryForSelectedDate = Boolean(dailySummary && dailySummary.date === selectedDate);
  // In authenticated mode, summary is strictly considered loading until verified cloud dailySummary for selectedDate is received
  const isSummaryLoading = authStatus === 'INITIALIZING' || (isAuthenticated && (!isSummaryForSelectedDate || isFoodLoading));

  const summary = (isAuthenticated && isSummaryForSelectedDate && dailySummary?.consumed)
    ? dailySummary.consumed
    : (isAuthenticated ? { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 } : sumNutrition(entries));
  const goal = (isAuthenticated && isSummaryForSelectedDate && dailySummary?.target)
    ? toFrontendGoal(dailySummary.target)
    : (getGoalForDate(data.goals, selectedDate) ?? fallbackGoal);
  const remaining = (isAuthenticated && isSummaryForSelectedDate && dailySummary?.remaining?.calories != null)
    ? dailySummary.remaining.calories
    : (goal.dailyCalories - summary.calories);
  const startOfDay = parseISO(`${selectedDate}T12:00:00`);
  const meals = MEAL_CATEGORIES.map((meal) => ({ meal, items: entries.filter((entry) => entry.meal === meal) }));
  const dayWorkouts = data.workouts.filter((workout) => workout.date === selectedDate);
  const workoutMinutes = dayWorkouts.reduce((sum, workout) => sum + workout.durationMinutes, 0);
  const workoutCalories = dayWorkouts.reduce((sum, workout) => sum + workout.estimatedCalories, 0);

  const today = todayISO();
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const isViewingHistorical = selectedDate !== today;

  // Month-to-date accumulated metrics (Priority 2)
  const currentMonthStr = format(new Date(), 'yyyy-MM');
  const monthEntries = data.entries.filter((entry) => entry.date.startsWith(currentMonthStr));
  const monthNut = sumNutrition(monthEntries);
  const loggedDaysInMonth = new Set(monthEntries.map((e) => e.date)).size;
  const currentDayOfMonth = new Date().getDate();
  const daysInCurrentMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const avgPerLoggedDay = loggedDaysInMonth > 0 ? Math.round(monthNut.calories / loggedDaysInMonth) : 0;
  const avgPerCalendarDay = currentDayOfMonth > 0 ? Math.round(monthNut.calories / currentDayOfMonth) : 0;
  const monthTarget = goal.dailyCalories * currentDayOfMonth;

  // Real 7-day intake and target history
  const thisWeek = Array.from({ length: 7 }, (_, index) => {
    const date = format(subDays(new Date(), 6 - index), 'yyyy-MM-dd');
    const dayEntries = data.entries.filter((entry) => entry.date === date);
    return {
      date,
      calories: sumNutrition(dayEntries).calories,
      target: getGoalForDate(data.goals, date)?.dailyCalories ?? fallbackGoal.dailyCalories,
    };
  });

  const trendDescription = `Seven-day calorie intake and target trend. ${thisWeek.map((row) => `${format(parseISO(`${row.date}T12:00:00`), 'EEE, MMM d')}: ${formatNumber(row.calories)} kcal intake, ${formatNumber(row.target)} kcal target`).join('; ')}.`;
  const macros = goal;
  const userName = (data.profile?.name || currentUser?.name || (isAuthenticated ? 'friend' : 'there')).trim().split(' ')[0] || (isAuthenticated ? 'friend' : 'there');

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="YOUR DAILY RHYTHM"
        title={`${greeting()}, ${userName}.`}
        subtitle={format(startOfDay, 'EEEE, MMMM d')}
        action={
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', maxWidth: '100%' }}>
            <button
              type="button"
              className={`today-badge-btn ${selectedDate === today ? 'active' : ''}`}
              style={{
                padding: '6px 11px',
                borderRadius: '8px',
                border: '1px solid #dcdfe3',
                background: selectedDate === today ? '#276738' : '#ffffff',
                color: selectedDate === today ? '#ffffff' : '#374151',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => setSelectedDate(today)}
            >
              Today
            </button>
            <button
              type="button"
              className={`today-badge-btn ${selectedDate === yesterday ? 'active' : ''}`}
              style={{
                padding: '6px 11px',
                borderRadius: '8px',
                border: '1px solid #dcdfe3',
                background: selectedDate === yesterday ? '#276738' : '#ffffff',
                color: selectedDate === yesterday ? '#ffffff' : '#374151',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => setSelectedDate(yesterday)}
            >
              Yesterday
            </button>
            <label className="date-control">
              <CalendarDays size={16} />
              <input
                aria-label="Choose dashboard date"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </label>
          </div>
        }
      />

      {/* Historical Date Notice */}
      {isViewingHistorical && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#1e40af',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <span>
            Viewing historical logs for <b>{format(startOfDay, 'MMMM d, yyyy')}</b>. Your entries for today are preserved safely.
          </span>
          <Button size="sm" tone="secondary" onClick={() => setSelectedDate(today)}>
            Back to Today
          </Button>
        </div>
      )}

      {authStatus === 'CONNECTION_ERROR' && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            color: '#9f1239',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <strong>Cloud Connection Unavailable:</strong> We could not connect to your NutriTrack health cloud. Your session is preserved safely.
          </div>
          <Button size="sm" tone="primary" onClick={() => void retryConnection()}>
            Retry Connection
          </Button>
        </div>
      )}

      {authStatus === 'UNAUTHENTICATED' && !isAuthenticated && (
        <div
          className="demo-banner"
          style={{
            background: 'rgba(21, 128, 61, 0.08)',
            borderColor: 'rgba(21, 128, 61, 0.25)',
          }}
        >
          <span><Sparkles size={16} style={{ color: '#15803d' }} /></span>
          <p>
            <strong>Guest Mode</strong>
            <span>Your logs are currently stored in this browser session. Sign in or create an account to sync securely with the cloud.</span>
          </p>
          <button type="button" onClick={() => openAuthModal('register')}>
            Create account <ArrowRight size={14} />
          </button>
        </div>
      )}

      <div className="dashboard-hero-grid">
        <Card className="calorie-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">CALORIE CHECK-IN</p>
              <h2>{selectedDate === today ? 'Your day, at a glance' : `Intake for ${format(startOfDay, 'MMM d')}`}</h2>
            </div>
            <span className="soft-icon green-soft"><Flame size={18} /></span>
          </div>
          {isSummaryLoading ? (
            <div className="calorie-main" style={{ opacity: 0.85 }}>
              <div
                className="skeleton-pulse"
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  margin: '8px auto',
                }}
              />
              <div className="calorie-summary">
                <span className="summary-label">DAILY TARGET</span>
                <div className="skeleton-pulse" style={{ width: '90px', height: '24px', margin: '4px 0 8px' }} />
                <div className="skeleton-pulse" style={{ width: '130px', height: '20px', borderRadius: '12px' }} />
                <p className="muted-copy">Synchronizing verified nutrition…</p>
              </div>
            </div>
          ) : (
            <div className="calorie-main">
              <RingProgress value={summary.calories} target={goal.dailyCalories} label={formatNumber(summary.calories)} sublabel="consumed" />
              <div className="calorie-summary">
                <span className="summary-label">DAILY TARGET</span>
                <strong>{formatNumber(goal.dailyCalories)} <small>kcal</small></strong>
                <div className={`remaining-badge ${remaining < 0 ? 'over' : ''}`}>
                  {remaining >= 0 ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                  <span>{formatNumber(Math.abs(remaining))} kcal {remaining >= 0 ? 'remaining' : 'over target'}</span>
                </div>
                <p className="muted-copy">A helpful estimate, not a score.</p>
              </div>
            </div>
          )}
        </Card>

        <Card className="macro-panel">
          <div className="card-heading">
            <div>
              <p className="eyebrow">NUTRIENT BALANCE</p>
              <h2>Macros &amp; fiber</h2>
            </div>
            <span className="quiet-note">{selectedDate === today ? 'Today' : format(startOfDay, 'MMM d')}</span>
          </div>
          {isSummaryLoading ? (
            <div className="macro-list">
              {macroCards.map(({ key, label, tone, mark }) => (
                <div className="macro-row" key={key}>
                  <span className={`macro-mark macro-${tone}`}>{mark}</span>
                  <div className="macro-content">
                    <div className="macro-label-line">
                      <strong>{label}</strong>
                      <span className="skeleton-pulse" style={{ width: '55px', height: '14px', display: 'inline-block' }} />
                    </div>
                    <div className="skeleton-pulse" style={{ width: '100%', height: '8px', borderRadius: '4px', marginTop: '6px' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="macro-list">
              {macroCards.map(({ key, label, tone, mark }) => (
                <div className="macro-row" key={key}>
                  <span className={`macro-mark macro-${tone}`}>{mark}</span>
                  <div className="macro-content">
                    <div className="macro-label-line">
                      <strong>{label}</strong>
                      <span>{formatNumber(summary[key])}<small> / {formatNumber(macros[key])} g</small></span>
                    </div>
                    <ProgressBar value={summary[key]} target={macros[key]} tone={tone} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="subtle-note">Targets are personal estimates that can be adjusted in Goals.</p>
        </Card>
      </div>

      {/* This Month's Accumulated Nutrition Card (Priority 2) */}
      <div className="card" style={{ padding: '16px 20px', background: '#fafbfa', border: '1px solid #e7ece4' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>MONTH-TO-DATE OVERVIEW</p>
            <h2 style={{ fontSize: '16px', margin: '3px 0 0', fontFamily: 'Manrope, sans-serif' }}>
              {format(new Date(), 'MMMM yyyy')} Nutrition
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '12px', background: '#eef6ee', color: '#276738', fontWeight: 600 }}>
              Month-to-date ({currentDayOfMonth} of {daysInCurrentMonth} days)
            </span>
            <button
              type="button"
              className="text-action"
              style={{ fontSize: '11px' }}
              onClick={() => navigate('/analytics')}
            >
              Full monthly analytics <ArrowRight size={13} />
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '10px 12px', background: '#ffffff', borderRadius: '10px', border: '1px solid #edf0e9' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#8c948a', letterSpacing: '0.6px' }}>TOTAL INTAKE</span>
            <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'Manrope, sans-serif', color: '#244c3a', marginTop: '3px' }}>
              {formatNumber(monthNut.calories)} <small style={{ fontSize: '11px', color: '#687363' }}>kcal</small>
            </div>
            <span style={{ fontSize: '10px', color: '#889184' }}>{monthEntries.length} logged meals</span>
          </div>

          <div style={{ padding: '10px 12px', background: '#ffffff', borderRadius: '10px', border: '1px solid #edf0e9' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#8c948a', letterSpacing: '0.6px' }}>DAILY AVERAGE (LOGGED DAYS)</span>
            <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'Manrope, sans-serif', color: '#244c3a', marginTop: '3px' }}>
              {formatNumber(avgPerLoggedDay)} <small style={{ fontSize: '11px', color: '#687363' }}>kcal/day</small>
            </div>
            <span style={{ fontSize: '10px', color: '#889184' }}>÷ {loggedDaysInMonth} active logged {loggedDaysInMonth === 1 ? 'day' : 'days'}</span>
          </div>

          <div style={{ padding: '10px 12px', background: '#ffffff', borderRadius: '10px', border: '1px solid #edf0e9' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#8c948a', letterSpacing: '0.6px' }}>DAILY AVERAGE (CALENDAR DAYS)</span>
            <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'Manrope, sans-serif', color: '#244c3a', marginTop: '3px' }}>
              {formatNumber(avgPerCalendarDay)} <small style={{ fontSize: '11px', color: '#687363' }}>kcal/day</small>
            </div>
            <span style={{ fontSize: '10px', color: '#889184' }}>÷ {currentDayOfMonth} elapsed calendar days</span>
          </div>

          <div style={{ padding: '10px 12px', background: '#ffffff', borderRadius: '10px', border: '1px solid #edf0e9' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#8c948a', letterSpacing: '0.6px' }}>MONTH ACCUMULATED MACROS</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11px', color: '#435142', marginTop: '6px' }}>
              <span>P: <b>{formatNumber(monthNut.protein)}g</b></span>
              <span>C: <b>{formatNumber(monthNut.carbohydrates)}g</b></span>
              <span>F: <b>{formatNumber(monthNut.fat)}g</b></span>
              <span>Fi: <b>{formatNumber(monthNut.fiber)}g</b></span>
            </div>
            <span style={{ fontSize: '10px', color: '#889184', display: 'block', marginTop: '4px' }}>
              Target pace: {formatNumber(monthTarget)} kcal
            </span>
          </div>
        </div>
      </div>

      <div className="section-title-row">
        <div>
          <p className="eyebrow">THE EVERYDAY DETAILS</p>
          <h2>Meals &amp; movement</h2>
        </div>
        <button type="button" className="text-action" onClick={() => navigate('/diary')}>
          Full diary <ArrowRight size={15} />
        </button>
      </div>

      <div className="dashboard-lower-grid">
        <Card className="meals-card">
          <div className="card-heading">
            <div>
              <h2>Today’s meals</h2>
              <p className="card-subtitle">
                {entries.length === 0
                  ? 'No meals logged yet today'
                  : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} in your diary`}
              </p>
            </div>
            <StatusPill tone="neutral">
              {formatNumber(summary.calories)} kcal
            </StatusPill>
          </div>
          <div className="meal-list">
            {meals.map(({ meal, items }) => (
              <div className="meal-group" key={meal}>
                <div className="meal-heading">
                  <div>
                    <span className={`meal-dot dot-${meal}`} />
                    <strong>{MEAL_LABELS[meal]}</strong>
                  </div>
                  <button type="button" aria-label={`Add ${MEAL_LABELS[meal].toLowerCase()} food`} className="mini-add" onClick={() => openFoodModal(selectedDate, meal)}>
                    <Plus size={15} />
                  </button>
                </div>
                {items.length ? (
                  <div className="meal-items">
                    {items.slice(0, 2).map((entry) => (
                      <div className="meal-item" key={entry.id}>
                        <div>
                          <strong>{entry.name}</strong>
                          <span>{entry.quantity} {entry.unit}</span>
                        </div>
                        <span>{formatNumber(entry.nutrition.calories)} kcal</span>
                      </div>
                    ))}
                    {items.length > 2 && <span className="more-items">+{items.length - 2} more</span>}
                  </div>
                ) : (
                  <div className="meal-empty">
                    Nothing logged yet <button type="button" onClick={() => openFoodModal(selectedDate, meal)}>Add food</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        <div className="dashboard-side-stack">
          <Card className="quick-actions-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">MAKE IT EASY</p>
                <h2>Quick actions</h2>
              </div>
            </div>
            <div className="quick-actions-grid">
              <button type="button" className="quick-action scan-action" onClick={() => navigate('/scanner')}>
                <span><ScanLine size={18} /></span>
                <strong>Scan food</strong>
                <small>AI scanner</small>
              </button>
              <button type="button" className="quick-action add-action" onClick={() => openFoodModal(selectedDate, 'breakfast')}>
                <span><Plus size={18} /></span>
                <strong>Add food</strong>
                <small>Log a meal</small>
              </button>
              <button type="button" className="quick-action" onClick={() => navigate('/workouts')}>
                <span><Dumbbell size={18} /></span>
                <strong>Log workout</strong>
                <small>Track movement</small>
              </button>
              <button type="button" className="quick-action" onClick={() => navigate('/goals')}>
                <span><Weight size={18} /></span>
                <strong>Log weight</strong>
                <small>See your trend</small>
              </button>
            </div>
          </Card>
          <Card className="water-card">
            <div className="water-icon"><Droplets size={18} /></div>
            <div className="water-copy">
              <strong>Hydration check</strong>
              <span>Water tracking is optional</span>
            </div>
            <Button tone="ghost" size="sm" onClick={() => pushToast({ tone: 'info', title: 'Water tracking', detail: 'Optional water logging can be added from your diary.' })}>
              Explore
            </Button>
          </Card>
        </div>
      </div>

      <Card className="activity-summary-card">
        <span className="activity-summary-icon"><Activity size={18} /></span>
        <div className="activity-summary-copy">
          <p className="eyebrow">TODAY’S ACTIVITY</p>
          <strong>{dayWorkouts.length ? `${dayWorkouts.length} ${dayWorkouts.length === 1 ? 'session' : 'sessions'} logged` : 'Movement, your way'}</strong>
          <span>{dayWorkouts.length ? 'Exercise calories stay separate from your food target.' : 'Log a workout whenever you’d like to include it in your day.'}</span>
        </div>
        <div className="activity-summary-stats">
          <span><Clock3 size={14} /><strong>{formatNumber(workoutMinutes)}</strong><small>min</small></span>
          <span><Flame size={14} /><strong>{formatNumber(workoutCalories)}</strong><small>kcal est.</small></span>
        </div>
        <button type="button" className="text-action" onClick={() => navigate('/workouts')}>
          Workouts <ArrowRight size={14} />
        </button>
      </Card>

      <Card className="chart-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">YOUR WEEK IN CONTEXT</p>
            <h2>Calorie rhythm</h2>
            <p className="card-subtitle">A gentle look at your recent intake, not a pass/fail score.</p>
          </div>
          <StatusPill tone="neutral">
            {data.entries.length ? 'Your logs' : 'No entries yet'}
          </StatusPill>
        </div>
        <div className="chart-wrap chart-tall" role="img" aria-label={trendDescription}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={thisWeek} margin={{ top: 12, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="#edf0e9" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(value: string) => format(parseISO(`${value}T12:00:00`), 'EEE')} tickLine={false} axisLine={false} tick={{ fill: '#8b918a', fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: '#8b918a', fontSize: 11 }} width={42} />
              <Tooltip labelFormatter={(value) => format(parseISO(`${String(value)}T12:00:00`), 'EEE, MMM d')} formatter={(value) => [`${formatNumber(Number(value))} kcal`, 'Calories']} contentStyle={{ border: '1px solid #e5e8df', borderRadius: 12, boxShadow: '0 10px 28px #20282112' }} />
              <Line type="monotone" dataKey="target" stroke="#bdcbbb" strokeDasharray="5 5" strokeWidth={1.5} dot={false} name="Target" />
              <Line type="monotone" dataKey="calories" stroke="#244c3a" strokeWidth={3} dot={{ r: 3, fill: '#244c3a', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} name="Calories" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-legend">
          <span><i className="legend-dot" /> Calories</span>
          <span><i className="legend-line" /> Daily target</span>
          <span className="chart-note">
            {data.entries.length ? 'Based on your saved diary entries.' : 'Log meals in your diary to populate your real trend.'}
          </span>
        </div>
      </Card>
    </div>
  );
}
