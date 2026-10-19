import { useMemo, useState } from 'react';
import { addDays, format, parseISO, subDays } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Copy, MoreHorizontal, Pencil, Plus, Search, Trash2, Utensils } from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { Button, Card, EmptyState, PageHeader, StatusPill } from '@/components/ui';
import { sumNutrition, todayISO, formatNumber } from '@/utils/nutrition';
import { MEAL_CATEGORIES, MEAL_LABELS, type FoodEntry, type Meal } from '@/types';

const formatDateLabel = (date: string) => {
  const parsed = parseISO(`${date}T12:00:00`);
  if (date === todayISO()) return 'Today';
  if (date === format(subDays(new Date(), 1), 'yyyy-MM-dd')) return 'Yesterday';
  return format(parsed, 'EEEE, MMM d');
};

export function DiaryPage() {
  const { data, selectedDate, setSelectedDate, openFoodModal, askConfirm, removeFood, duplicateFood, pushToast, isAuthenticated, dailySummary, isFoodLoading } = useApp();
  const [search, setSearch] = useState('');
  const dateEntries = useMemo(() => data.entries.filter((entry) => entry.date === selectedDate), [data.entries, selectedDate]);
  const filteredEntries = useMemo(() => dateEntries.filter((entry) => entry.name.toLowerCase().includes(search.trim().toLowerCase())), [dateEntries, search]);
  const total = (isAuthenticated && dailySummary?.logged) ? dailySummary.consumed : sumNutrition(dateEntries);
  const meals = useMemo<Meal[]>(() => MEAL_CATEGORIES.map((category) => {
    const entries = filteredEntries.filter((entry) => entry.meal === category);
    return { date: selectedDate, category, entries, nutrition: sumNutrition(entries) };
  }), [filteredEntries, selectedDate]);

  const duplicate = async (entry: FoodEntry) => {
    try {
      await duplicateFood(entry.id, entry.date, entry.meal);
      pushToast({ tone: 'success', title: 'Food entry duplicated' });
    } catch (err: unknown) {
      pushToast({ tone: 'error', title: 'Failed to duplicate food entry', detail: (err as Error)?.message || 'Please try again.' });
    }
  };

  const deleteEntry = (entry: FoodEntry) => askConfirm({
    title: 'Delete this food entry?', message: `${entry.name} will be removed from your diary for ${format(parseISO(`${entry.date}T12:00:00`), 'MMM d')}.`, confirmLabel: 'Delete entry',
    onConfirm: async () => {
      try {
        await removeFood(entry.id);
        pushToast({ tone: 'success', title: 'Food entry deleted' });
      } catch (err: unknown) {
        pushToast({ tone: 'error', title: 'Failed to delete food entry', detail: (err as Error)?.message || 'Please try again.' });
      }
    },
  });

  return <div className="page-stack">
    <PageHeader eyebrow="A LITTLE MORE AWARENESS" title="Food diary" subtitle="Log what you eat, without making it complicated." action={<Button onClick={() => openFoodModal(selectedDate, 'breakfast')}><Plus size={17} /> Add food</Button>} />
    <div className="diary-toolbar card">
      <div className="diary-date-nav"><button className="icon-button" type="button" aria-label="Previous day" onClick={() => setSelectedDate(format(subDays(parseISO(`${selectedDate}T12:00:00`), 1), 'yyyy-MM-dd'))}><ChevronLeft size={18} /></button><label className="date-control date-control-large"><CalendarDays size={16} /><input type="date" value={selectedDate} aria-label="Choose diary date" onChange={(event) => setSelectedDate(event.target.value)} /><span>{formatDateLabel(selectedDate)}</span></label><button className="icon-button" type="button" aria-label="Next day" onClick={() => setSelectedDate(format(addDays(parseISO(`${selectedDate}T12:00:00`), 1), 'yyyy-MM-dd'))}><ChevronRight size={18} /></button><button className="today-link" type="button" onClick={() => setSelectedDate(todayISO())}>Today</button></div>
      <label className="search-field"><Search size={16} /><input type="search" placeholder="Search today’s food" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search food entries" />{search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')}>×</button>}</label>
    </div>
    <div className="diary-summary-row"><span><strong>{formatNumber(total.calories)}</strong> kcal logged</span><span><strong>{formatNumber(total.protein)}g</strong> protein</span><span><strong>{dateEntries.length}</strong> {dateEntries.length === 1 ? 'entry' : 'entries'}</span><StatusPill tone={isFoodLoading ? 'warning' : dateEntries.length ? 'success' : 'neutral'}>{isFoodLoading ? 'Syncing...' : dateEntries.length ? (isAuthenticated ? 'Synced records' : 'Your records') : 'No records yet'}</StatusPill></div>

    <div className="diary-meals">{meals.map((meal) => <MealSection key={meal.category} meal={meal} onAdd={() => openFoodModal(selectedDate, meal.category)} onEdit={(entry) => openFoodModal(selectedDate, meal.category, entry)} onDuplicate={duplicate} onDelete={deleteEntry} />)}</div>
    {!dateEntries.length && !search && <Card><EmptyState icon={<Utensils size={20} />} title="A fresh page for today" detail="Add a meal whenever it feels useful. Your nutrition is stored as a snapshot for each entry." action={<Button onClick={() => openFoodModal(selectedDate, 'breakfast')}><Plus size={16} /> Add your first food</Button>} /></Card>}
    {search && !filteredEntries.length && <Card><EmptyState icon={<Search size={20} />} title="No matching food" detail={`Nothing in ${formatDateLabel(selectedDate).toLowerCase()} matches “${search}”. Try a different name or clear your search.`} action={<Button tone="secondary" onClick={() => setSearch('')}>Clear search</Button>} /></Card>}
    <p className="privacy-footnote">{isAuthenticated ? 'Your structured diary records are securely synced with your NutriTrack account.' : 'Guest mode stores your diary records in this browser only. Sign in to save and sync across devices.'}</p>
  </div>;
}

function MealSection({ meal, onAdd, onEdit, onDuplicate, onDelete }: { meal: Meal; onAdd: () => void; onEdit: (entry: FoodEntry) => void; onDuplicate: (entry: FoodEntry) => void; onDelete: (entry: FoodEntry) => void }) {
  const entries = meal.entries;
  const subtotal = meal.nutrition;
  return <Card className="diary-meal-card"><div className="meal-section-header"><div className="meal-title-wrap"><span className={`meal-icon meal-icon-${meal.category}`}><Utensils size={16} /></span><div><h2>{MEAL_LABELS[meal.category]}</h2><span>{entries.length ? `${entries.length} ${entries.length === 1 ? 'food' : 'foods'}` : 'Ready when you are'}</span></div></div><div className="meal-total"><strong>{formatNumber(subtotal.calories)}</strong><span>kcal</span></div></div>
    {entries.length ? <div className="entry-table">{entries.map((entry) => <FoodRow key={entry.id} entry={entry} onEdit={() => onEdit(entry)} onDuplicate={() => onDuplicate(entry)} onDelete={() => onDelete(entry)} />)}</div> : <div className="meal-empty-panel"><span>No food logged in {MEAL_LABELS[meal.category].toLowerCase()}.</span><button type="button" onClick={onAdd}><Plus size={15} /> Add food</button></div>}
    <button type="button" className="add-another-row" onClick={onAdd}><Plus size={15} /> Add to {MEAL_LABELS[meal.category].toLowerCase()}</button>
  </Card>;
}

function FoodRow({ entry, onEdit, onDuplicate, onDelete }: { entry: FoodEntry; onEdit: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="food-row"><div className="food-row-main"><span className="food-dot" /><div className="food-name-wrap"><strong>{entry.name}</strong><span>{entry.quantity} {entry.unit}{entry.notes ? ` · ${entry.notes}` : ''}</span></div></div><div className="food-row-nutrition"><strong>{formatNumber(entry.nutrition.calories)}</strong><span>kcal</span></div><div className="food-row-macros"><span>P <b>{formatNumber(entry.nutrition.protein, 1)}g</b></span><span>C <b>{formatNumber(entry.nutrition.carbohydrates, 1)}g</b></span><span>F <b>{formatNumber(entry.nutrition.fat, 1)}g</b></span><span>Fi <b>{formatNumber(entry.nutrition.fiber, 1)}g</b></span></div><div className="row-actions"><button type="button" className="icon-button row-menu-trigger" aria-label={`Actions for ${entry.name}`} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><MoreHorizontal size={18} /></button>{menuOpen && <div className="row-menu"><button type="button" onClick={() => { setMenuOpen(false); onEdit(); }}><Pencil size={14} /> Edit</button><button type="button" onClick={() => { setMenuOpen(false); onDuplicate(); }}><Copy size={14} /> Duplicate</button><button type="button" className="danger-menu-item" onClick={() => { setMenuOpen(false); onDelete(); }}><Trash2 size={14} /> Delete</button></div>}</div></div>;
}
