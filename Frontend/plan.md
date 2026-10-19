# NutriTrack AI — Implementation Plan

## Scope and approach

Build the requested responsive React 18+ / TypeScript application as a frontend-first Vite project. Use Tailwind CSS, React Router, lucide-react, Recharts, Framer Motion, React Hook Form, Zod, and date-fns. The Webdev project is currently an empty workspace; no existing application code needs preservation. Managed server and database are intentionally disabled, matching the brief's requirement to finish the frontend before backend work. A typed service/repository boundary will isolate development demo/local data from future REST APIs. Demo records will be visibly marked as demo; app records may use a replaceable local development adapter, with no claim of secure production persistence. Images selected for scanner preview will remain in component memory only and will never be written to localStorage/IndexedDB; temporary object URLs will be revoked when previews are replaced, removed, or otherwise no longer needed.

The application will include all seven requested destinations: Dashboard, Food Diary, AI Food Scanner, Nutrition Analytics, Workouts, Weight & Goals, and Profile & Settings. Working frontend interactions include navigation, responsive mobile bottom navigation and desktop collapsible sidebar, date selection, manual meal CRUD and duplicate, daily/meal nutrition totals, goal/profile forms and validation, workout CRUD, chart filters, accessible dialogs, confirmations, and toast feedback. The scanner will support camera where available, image selection/preview/replacement/removal and text description; in the absence of a real AI connection, analysis is explicitly mock-only, allows editing portions and detected foods, communicates estimation uncertainty, and requires a review/confirmation before diary save. Add Food and Scan Food actions will be positioned and sized for comfortable one-handed reach on phones. Calorie and exercise-energy estimates will be clearly distinguished, with guidance against double-counting normal activity.

Every page will be reviewed at 320px, 360px, 390px, and 430px widths, in addition to 375px, 768px, 1024px, and desktop widths from the source brief. The phone-width review will check one-hand reach for Add Food and Scan Food, safe-area navigation, readable chart/forms, and absence of horizontal overflow.

## Architecture and data flow

- `src/app/`: application entry, route configuration, providers, and global state boundaries.
- `src/components/layout/`, `navigation/`, and `ui/`: responsive shell, reusable accessible controls, modals, confirmations, toasts, skeletons, empty/error states.
- `src/components/charts/` and `food/`: shared chart and nutrition/meal presentation components.
- `src/pages/`: route-level page composition for the seven destinations.
- `src/features/{dashboard,diary,scanner,analytics,workouts,goals,profile}/`: feature-specific UI and interaction logic.
- `src/hooks/`: reusable application hooks.
- `src/services/`: typed API and repository interfaces; development adapter can be replaced by REST services without rewriting pages.
- `src/types/`: UserProfile, NutritionGoal, FoodEntry, Meal, FoodAnalysis, WorkoutSession, Exercise, CardioSession, WeightLog, and DailyNutritionSummary.
- `src/utils/`: nutrition/calorie math, age/goal estimates, date and unit helpers.
- `src/mocks/`: clearly labelled realistic demo fixtures.
- `src/styles/`: Tailwind setup, semantic design tokens, and global styles.
- `public/manus-routes.json`: page route manifest kept in sync with React Router.

Use an environment variable for the future backend base URL, with no AI keys or database credentials in browser code. Each saved food entry will include a nutrition snapshot (calories, protein, carbohydrates, fat, and fiber) so later edits to reference foods do not silently rewrite diary history. Goal changes will retain effective dates rather than silently replacing historical targets. Exercise calories will remain labelled as estimates and separately presented from maintenance calories; accounting guidance will prevent double-counting when maintenance already includes normal activity. Historical analytics will not imply mock records are real.

## Design direction

- **Design movement:** contemporary editorial wellness with a quiet, tactile health-tech finish.
- **Core principles:** calm clarity; nutrition data made legible; friendly, non-judgmental coaching; mobile-first practicality.
- **Color philosophy:** the requested forest green `#244C3A` anchors trust and steadiness; sage `#A8C5A0` softens progress states; warm ivory `#F8F6EF` keeps the canvas human and low-glare; coral `#F08A70` is reserved for a small number of motivating actions. White cards, ink `#202821`, secondary `#70776F`, borders `#E5E8DF`, success `#3C8B62`, warning `#E4A34A`, and error `#D9534F` preserve contrast and hierarchy.
- **Layout paradigm:** a compact desktop navigation rail beside a spacious, asymmetric content canvas; on phones, a short top bar and safe-area-aware fixed bottom navigation frame one-column, thumb-friendly flows.
- **Signature elements:** a soft-ring calorie progress visualization; small sage/coral nutrition markers; softly rounded, restrained cards with subtle borders and shadows.
- **Interaction philosophy:** direct manipulation, clear state changes, no hidden destructive actions, and calm feedback; every primary control is reachable by keyboard and touch.
- **Animation:** restrained Framer Motion transitions for route/content entry, progress changes, and dialogs; honor reduced-motion preferences and avoid decorative looping motion.
- **Typography system:** readable sans-serif interface typography with a distinctive editorial display face for page headings; clear numeric hierarchy for calories and macro totals.
- **Brand essence:** a calm nutrition companion that turns everyday meals into usable, non-judgmental progress; **clear, encouraging, grounded**.
- **Brand voice:** supportive and factual, never shaming. Example lines: “A steady day, one meal at a time.” “You’re 420 kcal under today’s target.”
- **Wordmark & logo:** a custom compact leaf-and-measure mark built from two curved strokes around a small circular nutrition point, paired with a clean NutriTrack wordmark.
- **Signature brand color:** forest green `#244C3A`.

## Dependencies and serving

Use a pinned pnpm toolchain and a reviewed lifecycle-script policy before the first install, then build with the Vite static frontend. The Webdev preview runtime remains on its configured port 3000. Add `/manus-routes.json` before starting the first dev server. No backend, login, managed database, or production-grade data persistence is included in this frontend stage; REST integration remains future-ready through typed interfaces. The frontend should not present scanner mock output as actual AI analysis.
