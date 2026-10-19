const fs = require('fs');

const API_BASE = 'http://localhost:8081';

// Cookie jar for handling refresh token cookies
let cookieJar = {};

function storeCookies(headers) {
  const setCookie = headers.get('set-cookie');
  if (!setCookie) return;
  // Parse cookies (handling comma-separated or single)
  const parts = setCookie.split(/,(?=\s*[a-zA-Z0-9_-]+=)/);
  for (const part of parts) {
    const [nameVal] = part.split(';');
    const eqIdx = nameVal.indexOf('=');
    if (eqIdx !== -1) {
      const name = nameVal.slice(0, eqIdx).trim();
      const val = nameVal.slice(eqIdx + 1).trim();
      cookieJar[name] = val;
    }
  }
}

function getCookieHeader() {
  return Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');
}

function clearCookies() {
  cookieJar = {};
}

async function api(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  const cookieHeader = getCookieHeader();
  if (cookieHeader && !headers.Cookie) {
    headers.Cookie = cookieHeader;
  }

  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData) && !Buffer.isBuffer(body)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body,
  });

  storeCookies(res.headers);

  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

const results = [];
function record(area, name, pass, detail = '') {
  results.push({ area, name, pass, detail });
  const icon = pass ? '✓ PASS' : '✗ FAIL';
  console.log(`[${icon}] [${area}] ${name}${detail ? ` (${detail})` : ''}`);
}

async function runAudit() {
  console.log('================================================================');
  console.log('NUTRITRACK AI — FULL APPLICATION INTEGRATION & REGRESSION AUDIT');
  console.log('================================================================\n');

  const ts = Date.now();
  const userAEmail = `audit_usera_${ts}@nutritrack.app`;
  const userBEmail = `audit_userb_${ts}@nutritrack.app`;
  const password = 'Password123!';
  const newPassword = 'NewPassword456!';

  let tokenA = '';
  let tokenB = '';

  // -------------------------------------------------------------
  // AREA 1: Authentication & Session Lifecycle
  // -------------------------------------------------------------
  console.log('\n--- 1. Testing Authentication & Session Lifecycle ---');

  // Register User A
  const regA = await api('/api/v1/auth/register', {
    method: 'POST',
    body: { name: 'Audit User A', email: userAEmail, password },
  });
  record('Auth', 'User A Registration', (regA.status === 200 || regA.status === 201) && regA.data.user.email === userAEmail);
  tokenA = regA.data.accessToken;

  // Me endpoint
  const meA = await api('/api/v1/auth/me', { headers: { Authorization: `Bearer ${tokenA}` } });
  record('Auth', 'Get Current User (/auth/me)', meA.status === 200 && meA.data.email === userAEmail);

  // Register User B
  const regB = await api('/api/v1/auth/register', {
    method: 'POST',
    body: { name: 'Audit User B', email: userBEmail, password },
  });
  record('Auth', 'User B Registration', (regB.status === 200 || regB.status === 201) && regB.data.user.email === userBEmail);
  tokenB = regB.data.accessToken;

  // Login User A
  const loginA = await api('/api/v1/auth/login', {
    method: 'POST',
    body: { email: userAEmail, password },
  });
  tokenA = loginA.data.accessToken;
  record('Auth', 'User A Login', loginA.status === 200 && Boolean(tokenA));

  // Token refresh with cookie & CSRF
  const refreshA = await api('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'X-Requested-With': 'NutriTrack' },
  });
  record('Auth', 'Token Refresh with Cookie & CSRF', refreshA.status === 200 && Boolean(refreshA.data.accessToken));
  if (refreshA.data?.accessToken) tokenA = refreshA.data.accessToken;

  // Refresh missing CSRF header
  const refreshNoCsrf = await api('/api/v1/auth/refresh', { method: 'POST' });
  record('Auth', 'Refresh Missing CSRF Rejected (403)', refreshNoCsrf.status === 403);

  // Invalid token authentication check
  const badTokenRes = await api('/api/v1/auth/me', { headers: { Authorization: 'Bearer invalid-token-123' } });
  record('Auth', 'Invalid Token Rejected (401)', badTokenRes.status === 401);

  // Change password
  const changePwd = await api('/api/v1/auth/password', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { currentPassword: password, newPassword },
  });
  record('Auth', 'Change Password', changePwd.status === 200 || changePwd.status === 204);

  // Login with old password should fail
  const oldLogin = await api('/api/v1/auth/login', {
    method: 'POST',
    body: { email: userAEmail, password },
  });
  record('Auth', 'Old Password Rejected (401)', oldLogin.status === 401);

  // Login with new password should succeed
  const newLogin = await api('/api/v1/auth/login', {
    method: 'POST',
    body: { email: userAEmail, password: newPassword },
  });
  tokenA = newLogin.data.accessToken;
  record('Auth', 'New Password Accepted (200)', newLogin.status === 200 && Boolean(tokenA));

  // Logout
  const logoutRes = await api('/api/v1/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}`, 'X-Requested-With': 'NutriTrack' },
  });
  record('Auth', 'Logout (/auth/logout)', logoutRes.status === 204);

  // Re-login User A for data testing
  const reLoginA = await api('/api/v1/auth/login', {
    method: 'POST',
    body: { email: userAEmail, password: newPassword },
  });
  tokenA = reLoginA.data.accessToken;

  // -------------------------------------------------------------
  // AREA 2: Profile & Goals
  // -------------------------------------------------------------
  console.log('\n--- 2. Testing Profile & Goals ---');
  const headersA = { Authorization: `Bearer ${tokenA}` };
  const headersB = { Authorization: `Bearer ${tokenB}` };

  // Update profile
  const profileReq = {
    name: 'Audit User A Updated',
    dateOfBirth: '1995-06-15',
    heightCm: 178,
    currentWeightKg: 78.5,
    biologicalSex: 'male',
    activityLevel: 'moderate',
    goalType: 'lose_weight',
    targetWeightKg: 72.0,
    weightUnit: 'kg',
    heightUnit: 'cm',
  };
  const profUpdate = await api('/api/v1/profile', { method: 'PUT', headers: headersA, body: profileReq });
  record('Profile', 'Update Profile (PUT /profile)', profUpdate.status === 200 && profUpdate.data.currentWeightKg === 78.5);

  const profGet = await api('/api/v1/profile', { headers: headersA });
  record('Profile', 'Get Profile (GET /profile)', profGet.status === 200 && profGet.data.name === 'Audit User A Updated');

  // Create Goal
  const goalReq = {
    effectiveFrom: '2026-10-01',
    goalType: 'lose_weight',
    dailyCalories: 2100,
    protein: 160,
    carbohydrates: 200,
    fat: 65,
    fiber: 30,
    targetWeightKg: 72.0,
  };
  const goalCreate = await api('/api/v1/goals', { method: 'POST', headers: headersA, body: goalReq });
  record('Goals', 'Create Goal (POST /goals)', goalCreate.status === 201 && goalCreate.data.dailyCalories === 2100);
  const goalIdA = goalCreate.data.id;

  // Active Goal
  const activeGoal = await api('/api/v1/goals/active?date=2026-10-14', { headers: headersA });
  record('Goals', 'Get Active Goal (/goals/active)', activeGoal.status === 200 && activeGoal.data.id === goalIdA);

  // List Goals
  const listGoals = await api('/api/v1/goals', { headers: headersA });
  record('Goals', 'List Goals (/goals)', listGoals.status === 200 && Array.isArray(listGoals.data) && listGoals.data.length >= 1);

  // Update Goal
  const goalUpdate = await api(`/api/v1/goals/${goalIdA}`, {
    method: 'PUT',
    headers: headersA,
    body: { ...goalReq, dailyCalories: 2150 },
  });
  record('Goals', 'Update Goal (PUT /goals/{id})', goalUpdate.status === 200 && goalUpdate.data.dailyCalories === 2150);

  // -------------------------------------------------------------
  // AREA 3: Food Diary & Daily Nutrition Summary
  // -------------------------------------------------------------
  console.log('\n--- 3. Testing Food Diary & Daily Summary ---');

  // Create Breakfast Entry
  const food1 = await api('/api/v1/food-entries', {
    method: 'POST',
    headers: headersA,
    body: {
      date: '2026-10-14',
      meal: 'breakfast',
      name: 'Oatmeal with Blueberries',
      quantity: 1,
      unit: 'bowl',
      nutrition: { calories: 320, protein: 12, carbohydrates: 55, fat: 5, fiber: 8 },
      source: 'manual',
    },
  });
  record('Food Diary', 'Create Breakfast Entry', food1.status === 201 && food1.data.nutrition.calories === 320);
  const foodIdA1 = food1.data.id;

  // Create Lunch Entry
  const food2 = await api('/api/v1/food-entries', {
    method: 'POST',
    headers: headersA,
    body: {
      date: '2026-10-14',
      meal: 'lunch',
      name: 'Grilled Chicken Salad',
      quantity: 1,
      unit: 'plate',
      nutrition: { calories: 480, protein: 42, carbohydrates: 18, fat: 16, fiber: 6 },
      source: 'manual',
    },
  });
  record('Food Diary', 'Create Lunch Entry', food2.status === 201 && food2.data.nutrition.calories === 480);
  const foodIdA2 = food2.data.id;

  // Food summary by date
  const foodSum = await api('/api/v1/food-entries/summary?date=2026-10-14', { headers: headersA });
  const totalCalExpected = 320 + 480;
  record('Food Diary', 'Food Entries Summary (/food-entries/summary)', foodSum.status === 200 && foodSum.data.totals.calories === totalCalExpected);

  // Daily Nutrition Summary
  const dailyNutr = await api('/api/v1/nutrition/daily-summary?date=2026-10-14', { headers: headersA });
  record('Nutrition', 'Daily Summary Consumed Calories', dailyNutr.status === 200 && dailyNutr.data.consumed.calories === totalCalExpected);
  record('Nutrition', 'Daily Summary Target Present', dailyNutr.data.target?.dailyCalories === 2150);
  record('Nutrition', 'Daily Summary Remaining Calories', dailyNutr.data.remaining?.calories === (2150 - totalCalExpected));

  // Duplicate Entry to Dinner
  const dup = await api(`/api/v1/food-entries/${foodIdA1}/duplicate`, {
    method: 'POST',
    headers: headersA,
    body: { date: '2026-10-14', meal: 'dinner' },
  });
  record('Food Diary', 'Duplicate Entry (/duplicate)', dup.status === 201 && dup.data.meal === 'dinner');
  const dupId = dup.data.id;

  // Update duplicated entry
  const foodUpd = await api(`/api/v1/food-entries/${dupId}`, {
    method: 'PUT',
    headers: headersA,
    body: {
      date: '2026-10-14',
      meal: 'dinner',
      name: 'Oatmeal (Large Bowl)',
      quantity: 1.5,
      unit: 'bowl',
      nutrition: { calories: 480, protein: 18, carbohydrates: 82, fat: 7.5, fiber: 12 },
    },
  });
  record('Food Diary', 'Update Food Entry (PUT)', foodUpd.status === 200 && foodUpd.data.name.includes('Large'));

  // Delete duplicated entry
  const foodDel = await api(`/api/v1/food-entries/${dupId}`, { method: 'DELETE', headers: headersA });
  record('Food Diary', 'Delete Food Entry (DELETE)', foodDel.status === 204);

  // -------------------------------------------------------------
  // AREA 4: AI Food Scanner & Estimates
  // -------------------------------------------------------------
  console.log('\n--- 4. Testing AI Food Scanner & Estimates ---');

  // Text estimate
  const textEst = await api('/api/v1/scanner/text-estimate', {
    method: 'POST',
    headers: headersA,
    body: { description: '2 scrambled eggs and 1 slice of buttered toast' },
  });
  record('Scanner', 'Text Nutrition Estimate (/scanner/text-estimate)', textEst.status === 200 && textEst.data.items?.length >= 1);

  // Text estimate validation error
  const textEstBad = await api('/api/v1/scanner/text-estimate', {
    method: 'POST',
    headers: headersA,
    body: { description: '' },
  });
  record('Scanner', 'Text Estimate Empty Input Rejected (400)', textEstBad.status === 400);

  // Multipart Image Analysis
  let imageAnalysisStatus = 0;
  try {
    const imgBytes = fs.readFileSync('public/test_meal.png');
    const blob = new Blob([imgBytes], { type: 'image/png' });
    const formData = new FormData();
    formData.append('image', blob, 'test_meal.png');
    formData.append('description', 'Healthy breakfast salad');

    const imageRes = await fetch(`${API_BASE}/api/v1/scanner/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formData,
    });
    imageAnalysisStatus = imageRes.status;
  } catch (err) {
    imageAnalysisStatus = 500;
  }
  // Note: Backend handles image analysis via Gemini. If API key is missing, it returns 503 or fallback results
  record('Scanner', 'Multipart Image Analysis Endpoint (/scanner/analyze)', imageAnalysisStatus === 200 || imageAnalysisStatus === 503, `Status ${imageAnalysisStatus}`);

  // Nutrition Target Estimate endpoint (BMR / Mifflin-St Jeor calculation)
  const nutrEst = await api('/api/v1/nutrition/estimate', {
    method: 'GET',
    headers: headersA,
  });
  record('Profile/Nutrition', 'Personalized Nutrition Target Estimate (/nutrition/estimate)', nutrEst.status === 200 && nutrEst.data.suggestedCalorieTarget > 0);

  // -------------------------------------------------------------
  // AREA 5: Workout Tracking
  // -------------------------------------------------------------
  console.log('\n--- 5. Testing Workout Tracking ---');

  // Create Strength Workout
  const workoutStrength = await api('/api/v1/workouts', {
    method: 'POST',
    headers: headersA,
    body: {
      type: 'strength',
      date: '2026-10-14',
      name: 'Morning Push Workout',
      split: 'chest_triceps',
      durationMinutes: 50,
      estimatedCalories: 350,
      exercises: [
        { name: 'Bench Press', sets: 4, reps: 8, weightKg: 80, notes: 'Felt strong' },
        { name: 'Overhead Press', sets: 3, reps: 10, weightKg: 45 },
      ],
    },
  });
  record('Workouts', 'Create Strength Workout (POST)', workoutStrength.status === 201 && workoutStrength.data.exercises?.length === 2);
  const workoutIdA1 = workoutStrength.data.id;

  // Create Cardio Workout
  const workoutCardio = await api('/api/v1/workouts', {
    method: 'POST',
    headers: headersA,
    body: {
      type: 'cardio',
      date: '2026-10-14',
      name: 'Evening Trail Run',
      cardioType: 'running',
      durationMinutes: 30,
      distanceKm: 5.2,
      estimatedCalories: 310,
    },
  });
  record('Workouts', 'Create Cardio Workout (POST)', workoutCardio.status === 201 && workoutCardio.data.cardioType === 'running');
  const workoutIdA2 = workoutCardio.data.id;

  // Get Workout by ID
  const getW = await api(`/api/v1/workouts/${workoutIdA1}`, { headers: headersA });
  record('Workouts', 'Get Workout by ID (GET)', getW.status === 200 && getW.data.name === 'Morning Push Workout');

  // Update Workout
  const updW = await api(`/api/v1/workouts/${workoutIdA1}`, {
    method: 'PUT',
    headers: headersA,
    body: {
      type: 'strength',
      date: '2026-10-14',
      name: 'Morning Push Workout (Heavy)',
      split: 'chest_triceps',
      durationMinutes: 55,
      estimatedCalories: 380,
      exercises: [
        { name: 'Bench Press', sets: 4, reps: 8, weightKg: 85, notes: 'PR hit' },
      ],
    },
  });
  record('Workouts', 'Update Workout (PUT)', updW.status === 200 && updW.data.durationMinutes === 55);

  // Daily Summary workout totals verification
  const dailyWorkoutSum = await api('/api/v1/nutrition/daily-summary?date=2026-10-14', { headers: headersA });
  record('Workouts', 'Daily Summary Reflects Exercise Sessions', dailyWorkoutSum.data.exercise?.sessionCount === 2);
  record('Workouts', 'Daily Summary Reflects Duration Minutes', dailyWorkoutSum.data.exercise?.durationMinutes === (55 + 30));
  record('Workouts', 'Daily Summary Reflects Estimated Calories Burned', dailyWorkoutSum.data.exercise?.estimatedCalories === (380 + 310));

  // Delete Cardio Workout
  const delW = await api(`/api/v1/workouts/${workoutIdA2}`, { method: 'DELETE', headers: headersA });
  record('Workouts', 'Delete Workout (DELETE)', delW.status === 204);

  // -------------------------------------------------------------
  // AREA 6: Weight Tracking
  // -------------------------------------------------------------
  console.log('\n--- 6. Testing Weight Tracking ---');

  // Create Weight Record
  const weight1 = await api('/api/v1/weights', {
    method: 'POST',
    headers: headersA,
    body: {
      date: '2026-10-14',
      weightKg: 78.2,
      note: 'Morning post-run weigh-in',
    },
  });
  record('Weights', 'Create Weight Record (POST)', weight1.status === 201 && weight1.data.weightKg === 78.2);
  const weightIdA = weight1.data.id;

  // Validation bounds checks
  const lowW = await api('/api/v1/weights', {
    method: 'POST',
    headers: headersA,
    body: { date: '2026-10-14', weightKg: 10 },
  });
  record('Weights', 'Reject Weight < 20 kg (400)', lowW.status === 400);

  const highW = await api('/api/v1/weights', {
    method: 'POST',
    headers: headersA,
    body: { date: '2026-10-14', weightKg: 600 },
  });
  record('Weights', 'Reject Weight > 500 kg (400)', highW.status === 400);

  const futureW = await api('/api/v1/weights', {
    method: 'POST',
    headers: headersA,
    body: { date: '2035-01-01', weightKg: 75 },
  });
  record('Weights', 'Reject Far Future Date (400)', futureW.status === 400);

  // Update Weight Record
  const updWeight = await api(`/api/v1/weights/${weightIdA}`, {
    method: 'PUT',
    headers: headersA,
    body: { date: '2026-10-14', weightKg: 78.0, note: 'Recalibrated scale' },
  });
  record('Weights', 'Update Weight Record (PUT)', updWeight.status === 200 && updWeight.data.weightKg === 78.0);

  // List Weights
  const listW = await api('/api/v1/weights', { headers: headersA });
  record('Weights', 'List Weights (GET /weights)', listW.status === 200 && listW.data.items?.some((w) => w.id === weightIdA));

  // -------------------------------------------------------------
  // AREA 7: Analytics Integration
  // -------------------------------------------------------------
  console.log('\n--- 7. Testing Analytics Integration ---');

  // Daily Analytics
  const anDaily = await api('/api/v1/analytics/daily?date=2026-10-14', { headers: headersA });
  record('Analytics', 'Daily Analytics (/analytics/daily)', anDaily.status === 200 && anDaily.data.logged === true && anDaily.data.intake?.calories === totalCalExpected);

  // Weekly Analytics (7 days)
  const anWeekly = await api('/api/v1/analytics/weekly?from=2026-10-08&to=2026-10-14', { headers: headersA });
  record('Analytics', 'Weekly Analytics (/analytics/weekly)', anWeekly.status === 200 && anWeekly.data.calendarDays === 7 && anWeekly.data.days?.length === 7);

  // Weekly Range Validation (> 31 days)
  const anWeeklyOver = await api('/api/v1/analytics/weekly?from=2026-09-01&to=2026-10-14', { headers: headersA });
  record('Analytics', 'Weekly Range > 31 Days Validation (400)', anWeeklyOver.status === 400);

  // Monthly Analytics
  const anMonthly = await api('/api/v1/analytics/monthly?year=2026&month=10', { headers: headersA });
  record('Analytics', 'Monthly Analytics (/analytics/monthly)', anMonthly.status === 200 && anMonthly.data.calendarDays === 31);

  // Monthly Invalid Month
  const anMonthlyBad = await api('/api/v1/analytics/monthly?year=2026&month=13', { headers: headersA });
  record('Analytics', 'Monthly Validation Month=13 (400)', anMonthlyBad.status === 400);

  // Yearly Analytics
  const anYearly = await api('/api/v1/analytics/yearly?year=2026', { headers: headersA });
  record('Analytics', 'Yearly Analytics (/analytics/yearly)', anYearly.status === 200 && anYearly.data.months?.length === 12);

  // -------------------------------------------------------------
  // AREA 8: Multi-Tenant Authorization & Data Isolation
  // -------------------------------------------------------------
  console.log('\n--- 8. Testing Multi-Tenant Data Isolation ---');

  // User B attempts to access User A's Goal
  const crossGoalGet = await api(`/api/v1/goals/${goalIdA}`, { headers: headersB });
  record('Multi-Tenant', 'User B Cannot Read User A Goal (404)', crossGoalGet.status === 404);

  const crossGoalPut = await api(`/api/v1/goals/${goalIdA}`, {
    method: 'PUT',
    headers: headersB,
    body: { ...goalReq, dailyCalories: 9999 },
  });
  record('Multi-Tenant', 'User B Cannot Update User A Goal (404)', crossGoalPut.status === 404);

  const crossGoalDel = await api(`/api/v1/goals/${goalIdA}`, { method: 'DELETE', headers: headersB });
  record('Multi-Tenant', 'User B Cannot Delete User A Goal (404)', crossGoalDel.status === 404);

  // User B attempts to access User A's Food Entry
  const crossFoodPut = await api(`/api/v1/food-entries/${foodIdA1}`, {
    method: 'PUT',
    headers: headersB,
    body: { date: '2026-10-14', meal: 'breakfast', name: 'Hacked food', quantity: 1, unit: 'g', nutrition: { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 } },
  });
  record('Multi-Tenant', 'User B Cannot Update User A Food Entry (404)', crossFoodPut.status === 404);

  const crossFoodDel = await api(`/api/v1/food-entries/${foodIdA1}`, { method: 'DELETE', headers: headersB });
  record('Multi-Tenant', 'User B Cannot Delete User A Food Entry (404)', crossFoodDel.status === 404);

  // User B attempts to access User A's Workout
  const crossWorkGet = await api(`/api/v1/workouts/${workoutIdA1}`, { headers: headersB });
  record('Multi-Tenant', 'User B Cannot Read User A Workout (404)', crossWorkGet.status === 404);

  const crossWorkPut = await api(`/api/v1/workouts/${workoutIdA1}`, {
    method: 'PUT',
    headers: headersB,
    body: { type: 'cardio', cardioType: 'running', date: '2026-10-14', name: 'Hacked', durationMinutes: 20, estimatedCalories: 150 },
  });
  record('Multi-Tenant', 'User B Cannot Update User A Workout (404)', crossWorkPut.status === 404);

  const crossWorkDel = await api(`/api/v1/workouts/${workoutIdA1}`, { method: 'DELETE', headers: headersB });
  record('Multi-Tenant', 'User B Cannot Delete User A Workout (404)', crossWorkDel.status === 404);

  // User B attempts to access User A's Weight
  const crossWeightPut = await api(`/api/v1/weights/${weightIdA}`, {
    method: 'PUT',
    headers: headersB,
    body: { date: '2026-10-14', weightKg: 100 },
  });
  record('Multi-Tenant', 'User B Cannot Update User A Weight (404)', crossWeightPut.status === 404);

  const crossWeightDel = await api(`/api/v1/weights/${weightIdA}`, { method: 'DELETE', headers: headersB });
  record('Multi-Tenant', 'User B Cannot Delete User A Weight (404)', crossWeightDel.status === 404);

  // User B list checks (isolation)
  const userBFoods = await api('/api/v1/food-entries?date=2026-10-14', { headers: headersB });
  record('Multi-Tenant', 'User B Food List Empty (No Leaks)', userBFoods.status === 200 && userBFoods.data.items?.length === 0);

  const userBWorkouts = await api('/api/v1/workouts?date=2026-10-14', { headers: headersB });
  record('Multi-Tenant', 'User B Workout List Empty (No Leaks)', userBWorkouts.status === 200 && userBWorkouts.data.items?.length === 0);

  const userBWeights = await api('/api/v1/weights', { headers: headersB });
  record('Multi-Tenant', 'User B Weight List Empty (No Leaks)', userBWeights.status === 200 && userBWeights.data.items?.length === 0);

  // -------------------------------------------------------------
  // AREA 9: Cleanup Disposable Test Accounts
  // -------------------------------------------------------------
  console.log('\n--- 9. Cleaning Up Test Accounts ---');

  // Delete User B account
  const delUserB = await api('/api/v1/auth/account', {
    method: 'DELETE',
    headers: headersB,
    body: { password },
  });
  record('Cleanup', 'Delete User B Account', delUserB.status === 200 || delUserB.status === 204);

  // Delete User A account
  const delUserA = await api('/api/v1/auth/account', {
    method: 'DELETE',
    headers: headersA,
    body: { password: newPassword },
  });
  record('Cleanup', 'Delete User A Account', delUserA.status === 200 || delUserA.status === 204);

  console.log('\n================================================================');
  console.log(`TOTAL CHECKS: ${results.length}`);
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error('Audit fatal error:', err);
  process.exit(1);
});
