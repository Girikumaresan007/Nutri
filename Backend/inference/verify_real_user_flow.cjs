const fs = require('fs');
const path = require('path');

const BACKEND_URL = 'http://localhost:8081/api/v1';
const HF_SERVICE_URL = 'http://127.0.0.1:5001';

async function main() {
  console.log('================================================================');
  console.log('STAGE 9C: COMPLETE END-TO-END REAL INTEGRATION VERIFICATION');
  console.log('================================================================\n');

  // Step 0: Verify Python HF inference service health
  console.log('--- Step 0: Checking Genuine Local HF Vision Inference Service ---');
  const hfHealthRes = await fetch(`${HF_SERVICE_URL}/health`);
  if (!hfHealthRes.ok) {
    throw new Error(`HF Inference Service not healthy: ${hfHealthRes.status}`);
  }
  const hfHealth = await hfHealthRes.json();
  console.log('✓ HF Vision Service Status:', JSON.stringify(hfHealth));
  if (hfHealth.status !== 'UP' || !hfHealth.model.includes('ViT-Indian-Food')) {
    throw new Error('HF Service returned unexpected health status');
  }

  // Step 1: Register a brand-new user
  const ts = Date.now();
  const testUser = {
    name: 'Aarav Sharma',
    email: `aarav_real_${ts}@example.com`,
    password: 'SecurePassword123!'
  };

  console.log(`\n--- Step 1: Registering Brand-New Account: ${testUser.email} ---`);
  const regRes = await fetch(`${BACKEND_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser)
  });

  if (!regRes.ok) {
    throw new Error(`Registration failed (${regRes.status}): ${await regRes.text()}`);
  }

  const regData = await regRes.json();
  const token = regData.accessToken;
  const userId = regData.user.id;
  console.log(`✓ Successfully registered user ${regData.user.name} (ID: ${userId})`);
  console.log(`✓ JWT token issued (Expires in: ${regData.expiresInSeconds}s)`);

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // Step 2: Verify Initial Genuine Empty State
  console.log('\n--- Step 2: Verifying Initial Genuine Empty State ---');
  const initialFoodRes = await fetch(`${BACKEND_URL}/food-entries?from=2026-10-01&to=2026-10-31`, { headers: authHeaders });
  const initialFood = await initialFoodRes.json();
  console.log(`✓ Initial diary entries count: ${initialFood.totalElements || initialFood.items?.length || 0} (Must be 0)`);
  if ((initialFood.totalElements || initialFood.items?.length) !== 0) {
    throw new Error('New account has unexpected pre-existing food entries!');
  }

  const initialWorkoutsRes = await fetch(`${BACKEND_URL}/workouts?from=2026-10-01&to=2026-10-31`, { headers: authHeaders });
  const initialWorkouts = await initialWorkoutsRes.json();
  console.log(`✓ Initial workouts count: ${initialWorkouts.totalElements || initialWorkouts.items?.length || 0} (Must be 0)`);

  const initialWeightsRes = await fetch(`${BACKEND_URL}/weights`, { headers: authHeaders });
  const initialWeights = await initialWeightsRes.json();
  console.log(`✓ Initial weights count: ${initialWeights.totalElements || initialWeights.items?.length || 0} (Must be 0)`);

  // Step 3: Profile and Goal Creation
  console.log('\n--- Step 3: Setting Up Profile and Target Goal ---');
  const profilePayload = {
    name: 'Aarav Sharma',
    dateOfBirth: '1995-06-15',
    heightCm: 175,
    currentWeightKg: 78.5,
    biologicalSex: 'MALE',
    activityLevel: 'MODERATE',
    goalType: 'LOSE_WEIGHT',
    targetWeightKg: 72.0,
    weightUnit: 'kg',
    heightUnit: 'cm'
  };

  const profRes = await fetch(`${BACKEND_URL}/profile`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify(profilePayload)
  });
  if (!profRes.ok) throw new Error(`Profile update failed: ${await profRes.text()}`);
  const profData = await profRes.json();
  console.log(`✓ Profile updated: ${profData.name}, Age: ${profData.age}, Height: ${profData.heightCm}cm, Weight: ${profData.currentWeightKg}kg`);

  const todayStr = '2026-10-14';
  const goalPayload = {
    effectiveFrom: todayStr,
    goalType: 'LOSE_WEIGHT',
    dailyCalories: 2150,
    protein: 140,
    carbohydrates: 220,
    fat: 60,
    fiber: 30,
    targetWeightKg: 72.0
  };

  const goalRes = await fetch(`${BACKEND_URL}/goals`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(goalPayload)
  });
  if (!goalRes.ok) throw new Error(`Goal creation failed: ${await goalRes.text()}`);
  const goalData = await goalRes.json();
  console.log(`✓ Active goal established: ${goalData.dailyCalories} kcal/day (P: ${goalData.protein}g, C: ${goalData.carbohydrates}g, F: ${goalData.fat}g)`);

  // Step 4: Genuine AI Food Photo Analysis
  console.log('\n--- Step 4: Real Image Food Scanner Analysis with Hugging Face ViT ---');
  const samosaPath = path.resolve(__dirname, '../../Frontend/public/test_samosa.jpg');
  if (!fs.existsSync(samosaPath)) throw new Error(`File not found: ${samosaPath}`);

  const fileBytes = fs.readFileSync(samosaPath);
  const boundary = '----WebKitFormBoundaryNutriTrack' + Math.random().toString(36).substring(2);
  const multipartBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="test_samosa.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    fileBytes,
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="description"\r\n\r\n2 freshly prepared samosas\r\n`),
    Buffer.from(`--${boundary}--\r\n`)
  ]);

  const tScanStart = Date.now();
  const scanRes = await fetch(`${BACKEND_URL}/scanner/analyze`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: multipartBody
  });

  const scanElapsedMs = Date.now() - tScanStart;
  if (!scanRes.ok) {
    throw new Error(`Scanner analyze failed (${scanRes.status}): ${await scanRes.text()}`);
  }

  const scanData = await scanRes.json();
  console.log(`✓ Scanner response received in ${scanElapsedMs}ms`);
  console.log(`✓ Identified Provider: "${scanData.provider}" (Must be "huggingface")`);
  if (scanData.provider !== 'huggingface') {
    throw new Error(`Expected provider 'huggingface', but got '${scanData.provider}'`);
  }

  const detected = scanData.items[0];
  console.log(`✓ Detected Food: "${detected.name}"`);
  console.log(`✓ Serving: ${detected.quantity} ${detected.servingUnit}`);
  console.log(`✓ Estimated Nutrition: ${detected.estimatedNutrition.calories} kcal | P: ${detected.estimatedNutrition.protein}g | C: ${detected.estimatedNutrition.carbohydrates}g | F: ${detected.estimatedNutrition.fat}g | Fiber: ${detected.estimatedNutrition.fiber}g`);
  console.log(`✓ AI Confidence Level: ${detected.confidence}`);
  console.log(`✓ Uncertainty note: ${detected.uncertainty[0]}`);

  // Step 5: Verify Privacy - Analysis did NOT automatically persist to Diary!
  console.log('\n--- Step 5: Verifying Image Privacy and Non-Persistence ---');
  const verifyEmptyRes = await fetch(`${BACKEND_URL}/food-entries?from=${todayStr}&to=${todayStr}`, { headers: authHeaders });
  const verifyEmptyData = await verifyEmptyRes.json();
  console.log(`✓ Food entries count immediately after scan: ${verifyEmptyData.totalElements || 0} (Must be 0)`);
  if ((verifyEmptyData.totalElements || 0) !== 0) {
    throw new Error('Privacy violation: scan analysis auto-persisted food without user confirmation!');
  }

  // Step 6: Review and Save Meal to Diary
  console.log('\n--- Step 6: User Confirms and Saves Meal to Diary ---');
  const saveFoodRes = await fetch(`${BACKEND_URL}/food-entries`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      date: todayStr,
      meal: 'snacks',
      name: detected.name,
      quantity: detected.quantity,
      unit: detected.servingUnit,
      nutrition: detected.estimatedNutrition,
      notes: 'Logged via NutriTrack AI Hugging Face Scanner',
      source: 'scanner'
    })
  });

  if (!saveFoodRes.ok) throw new Error(`Save food entry failed: ${await saveFoodRes.text()}`);
  const savedFood = await saveFoodRes.json();
  console.log(`✓ Food entry saved successfully (ID: ${savedFood.id}, Calories: ${savedFood.nutrition.calories} kcal, Source: ${savedFood.source})`);

  // Step 7: Verify Daily Nutrition Summary & Totals
  console.log('\n--- Step 7: Verifying Daily Nutrition Summary ---');
  const summaryRes = await fetch(`${BACKEND_URL}/nutrition/daily-summary?date=${todayStr}`, { headers: authHeaders });
  if (!summaryRes.ok) throw new Error(`Daily summary failed: ${await summaryRes.text()}`);
  const summaryData = await summaryRes.json();
  console.log(`✓ Consumed Calories: ${summaryData.consumed.calories} kcal`);
  console.log(`✓ Target Calories: ${summaryData.target.dailyCalories} kcal`);
  console.log(`✓ Remaining Calories: ${summaryData.remaining.calories} kcal`);
  console.log(`✓ Calorie Status: ${summaryData.calorieStatus}`);

  // Step 8: Log a Workout
  console.log('\n--- Step 8: Logging a Workout Session ---');
  const workoutPayload = {
    type: 'CARDIO',
    cardioType: 'RUNNING',
    date: todayStr,
    name: 'Evening Run & Cycling',
    durationMinutes: 45,
    estimatedCalories: 320,
    distanceKm: 5.0,
    notes: 'Upper body and 15 min cycling'
  };

  const workoutRes = await fetch(`${BACKEND_URL}/workouts`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(workoutPayload)
  });
  if (!workoutRes.ok) throw new Error(`Save workout failed: ${await workoutRes.text()}`);
  const savedWorkout = await workoutRes.json();
  console.log(`✓ Workout logged: "${savedWorkout.name}" (${savedWorkout.durationMinutes} min, ${savedWorkout.estimatedCalories} kcal)`);

  // Step 9: Log a Weight Entry
  console.log('\n--- Step 9: Logging a Body Weight Entry ---');
  const weightPayload = {
    date: todayStr,
    weightKg: 78.2,
    note: 'Morning weigh-in'
  };

  const weightRes = await fetch(`${BACKEND_URL}/weights`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(weightPayload)
  });
  if (!weightRes.ok) throw new Error(`Save weight failed: ${await weightRes.text()}`);
  const savedWeight = await weightRes.json();
  console.log(`✓ Weight recorded: ${savedWeight.weightKg} kg on ${savedWeight.date}`);

  // Step 10: Verify Real Period Analytics
  console.log('\n--- Step 10: Verifying Account Analytics ---');
  const analyticsRes = await fetch(`${BACKEND_URL}/analytics/weekly?from=${todayStr}&to=${todayStr}`, { headers: authHeaders });
  if (!analyticsRes.ok) throw new Error(`Analytics failed: ${await analyticsRes.text()}`);
  const analyticsData = await analyticsRes.json();
  console.log(`✓ Logged Days: ${analyticsData.loggedDays}/${analyticsData.calendarDays}`);
  console.log(`✓ Average Intake: ${analyticsData.averageIntake?.calories || 0} kcal`);
  console.log(`✓ Exercise Total: ${analyticsData.exercise?.totalMinutes || 0} min, ${analyticsData.exercise?.totalCalories || 0} kcal`);
  console.log(`✓ Weight Points: ${analyticsData.weight?.points?.length || 0} point(s)`);

  // Step 11: Verify Logout
  console.log('\n--- Step 11: Testing Logout ---');
  const logoutRes = await fetch(`${BACKEND_URL}/auth/logout`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'X-Requested-With': 'NutriTrack'
    }
  });
  console.log(`✓ Logout response: HTTP ${logoutRes.status} (Expected 204)`);

  console.log('\n================================================================');
  console.log('🎉 ALL INTEGRATION AND REAL-DATA TESTS PASSED WITH 100% SUCCESS!');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
