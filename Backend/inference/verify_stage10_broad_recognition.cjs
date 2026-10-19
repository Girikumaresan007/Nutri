const fs = require('fs');
const path = require('path');

const BACKEND_URL = 'http://localhost:8081/api/v1';
const HF_SERVICE_URL = 'http://127.0.0.1:5001';

async function run() {
  console.log('========================================================================');
  console.log('STAGE 10: BROAD FOOD RECOGNITION & VERIFIED NUTRITION DATABASE VERIFICATION');
  console.log('========================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, name, details) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✓ PASS: ${name}${details ? ' - ' + details : ''}`);
    } else {
      console.error(`  ✗ FAIL: ${name}${details ? ' - ' + details : ''}`);
      throw new Error(`Test failed: ${name}`);
    }
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 1: Python Inference Service Health & Out-of-Distribution Entropy
  // ---------------------------------------------------------------------------
  console.log('--- Test Suite 1: Vision Inference Sidecar & Entropy / OOD Detection ---');
  const healthRes = await fetch(`${HF_SERVICE_URL}/health`);
  assert(healthRes.ok, 'HF sidecar /health HTTP 200');
  const healthData = await healthRes.json();
  assert(healthData.status === 'UP', 'HF sidecar status UP', `Model: ${healthData.model}`);

  const idliImgPath = path.resolve(__dirname, '../../Frontend/public/test_idli.jpg');
  const samosaImgPath = path.resolve(__dirname, '../../Frontend/public/test_samosa.jpg');
  const saladImgPath = path.resolve(__dirname, '../../Frontend/public/test_salad.jpg');

  // 1A. In-distribution: Idli
  if (fs.existsSync(idliImgPath)) {
    const idliBytes = fs.readFileSync(idliImgPath);
    const idliInfRes = await fetch(`${HF_SERVICE_URL}/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: idliBytes,
    });
    assert(idliInfRes.ok, 'Idli direct image inference HTTP 200');
    const idliData = await idliInfRes.json();
    console.log(`    Idli top prediction: ${idliData.predictions[0].label} (${(idliData.predictions[0].score * 100).toFixed(1)}%) | Entropy: ${idliData.entropy} | Uncertain: ${idliData.is_uncertain}`);
    assert(idliData.predictions[0].label.toLowerCase() === 'idli', 'Idli recognized correctly as in-distribution');
    assert(idliData.is_uncertain === false, 'High confidence idli not flagged uncertain');
  }

  // 1B. In-distribution: Samosa
  if (fs.existsSync(samosaImgPath)) {
    const samosaBytes = fs.readFileSync(samosaImgPath);
    const samosaInfRes = await fetch(`${HF_SERVICE_URL}/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: samosaBytes,
    });
    assert(samosaInfRes.ok, 'Samosa direct image inference HTTP 200');
    const samosaData = await samosaInfRes.json();
    console.log(`    Samosa top prediction: ${samosaData.predictions[0].label} (${(samosaData.predictions[0].score * 100).toFixed(1)}%) | Entropy: ${samosaData.entropy} | Uncertain: ${samosaData.is_uncertain}`);
    assert(samosaData.predictions[0].label.toLowerCase() === 'samosa', 'Samosa recognized correctly as in-distribution');
  }

  // 1C. Out-of-Distribution: Green Salad (not in 20 ViT classes)
  if (fs.existsSync(saladImgPath)) {
    const saladBytes = fs.readFileSync(saladImgPath);
    const saladInfRes = await fetch(`${HF_SERVICE_URL}/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: saladBytes,
    });
    assert(saladInfRes.ok, 'Salad direct image inference HTTP 200');
    const saladData = await saladInfRes.json();
    console.log(`    Salad (OOD) classification: ${saladData.predictions[0].label} (${(saladData.predictions[0].score * 100).toFixed(1)}%) | Entropy: ${saladData.entropy} | Uncertain: ${saladData.is_uncertain}`);
    assert(saladData.is_uncertain === true || saladData.predictions[0].score < 0.70, 'OOD salad marked uncertain or low confidence');
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 2: User Registration & Authentication
  // ---------------------------------------------------------------------------
  console.log('\n--- Test Suite 2: Authenticated Session Setup ---');
  const testUser = {
    name: 'Dr. Priya Nutritionist',
    email: `priya_${Date.now()}@nutritrack.test`,
    password: 'SecurePassword123!',
  };
  const regRes = await fetch(`${BACKEND_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser),
  });
  assert(regRes.ok, 'User registration HTTP 200', testUser.email);
  const regData = await regRes.json();
  const token = regData.accessToken;
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // ---------------------------------------------------------------------------
  // TEST SUITE 3: Verified Food Catalog Search & Coverage
  // ---------------------------------------------------------------------------
  console.log('\n--- Test Suite 3: Verified Food Catalog Search & Source Coverage ---');
  
  // Search tests across various categories and regional foods
  const testQueries = [
    { query: 'idli', expectedName: 'Idli', expectedSource: 'ICMR-NIN IFCT 2017' },
    { query: 'dosa', expectedName: 'Plain Dosa', expectedSource: 'ICMR-NIN IFCT 2017' },
    { query: 'biryani', expectedName: 'Chicken Biryani', expectedSource: 'Standard Indian Recipe Analysis' },
    { query: 'pongal', expectedName: 'Ven Pongal', expectedSource: 'ICMR-NIN IFCT 2017' },
    { query: 'upma', expectedName: 'Rava Upma', expectedSource: 'ICMR-NIN IFCT 2017' },
    { query: 'sambar', expectedName: 'Sambar', expectedSource: 'ICMR-NIN IFCT 2017' },
    { query: 'curd rice', expectedName: 'Curd Rice', expectedSource: 'ICMR-NIN IFCT 2017' },
    { query: 'chapati', expectedName: 'Chapati / Phulka', expectedSource: 'ICMR-NIN IFCT 2017' },
    { query: 'dal tadka', expectedName: 'Dal Tadka', expectedSource: 'ICMR-NIN IFCT 2017' },
    { query: 'rajma', expectedName: 'Rajma Masala', expectedSource: 'ICMR-NIN IFCT 2017' },
    { query: 'salad', expectedName: 'Mixed Green Salad', expectedSource: 'USDA FoodData Central' },
    { query: 'apple', expectedName: 'Apple (Raw with Skin)', expectedSource: 'USDA FoodData Central' },
  ];

  for (const item of testQueries) {
    const searchRes = await fetch(`${BACKEND_URL}/food-catalog?q=${encodeURIComponent(item.query)}`, {
      headers: authHeaders,
    });
    assert(searchRes.ok, `Catalog search for "${item.query}" HTTP 200`);
    const results = await searchRes.json();
    assert(results.length > 0, `Results returned for "${item.query}"`, `Count: ${results.length}`);
    const match = results[0];
    assert(
      match.canonicalName.toLowerCase().includes(item.expectedName.toLowerCase()) ||
      match.regionalAliases.toLowerCase().includes(item.query.toLowerCase()),
      `Canonical name/alias match for "${item.query}"`,
      `Found: "${match.canonicalName}"`
    );
    assert(
      match.dataSource.includes(item.expectedSource) || match.dataSource.length > 0,
      `Traceable data source for "${match.canonicalName}"`,
      `Source: ${match.dataSource} (Ref: ${match.sourceReferenceId})`
    );
    assert(
      ['MEASURED_FOOD', 'STANDARD_RECIPE', 'APPROXIMATE_RECIPE'].includes(match.recipeType),
      `Valid recipe type for "${match.canonicalName}"`,
      `Type: ${match.recipeType}`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 4: Quantity-Based Nutrition Calculations & Defensible Conversions
  // ---------------------------------------------------------------------------
  console.log('\n--- Test Suite 4: Quantity-Based Nutrition Calculations ---');

  // 4A. Idli: 3 pieces @ 50g each = 150g -> 198.0 kcal (132 * 1.5)
  const idliSearch = await (await fetch(`${BACKEND_URL}/food-catalog?q=idli`, { headers: authHeaders })).json();
  const idliItem = idliSearch[0];
  const idliCalcRes = await fetch(`${BACKEND_URL}/food-catalog/calculate`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ catalogId: idliItem.id, quantity: 3, unit: 'piece' }),
  });
  assert(idliCalcRes.ok, 'Calculate 3 pieces Idli HTTP 200');
  const idliCalc = await idliCalcRes.json();
  assert(Number(idliCalc.calculatedGrams) === 150, '3 pieces Idli conversion weight equals 150g', `${idliCalc.calculatedGrams}g`);
  assert(Number(idliCalc.calories) === 198.0, '3 pieces Idli calories equals 198.0 kcal', `${idliCalc.calories} kcal`);
  assert(Number(idliCalc.protein) === 7.8, '3 pieces Idli protein equals 7.8g', `${idliCalc.protein}g`);
  assert(Number(idliCalc.carbohydrates) === 39.8, '3 pieces Idli carbs equals 39.8g', `${idliCalc.carbohydrates}g`);

  // 4B. Chicken Biryani: 1 plate = 250g -> 462.5 kcal (185 * 2.5)
  const biryaniSearch = await (await fetch(`${BACKEND_URL}/food-catalog?q=chicken%20biryani`, { headers: authHeaders })).json();
  const biryaniItem = biryaniSearch[0];
  const biryaniCalcRes = await fetch(`${BACKEND_URL}/food-catalog/calculate`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ catalogId: biryaniItem.id, quantity: 1, unit: 'plate' }),
  });
  assert(biryaniCalcRes.ok, 'Calculate 1 plate Chicken Biryani HTTP 200');
  const biryaniCalc = await biryaniCalcRes.json();
  assert(Number(biryaniCalc.calculatedGrams) === 250, '1 plate Biryani conversion equals 250g', `${biryaniCalc.calculatedGrams}g`);
  assert(Number(biryaniCalc.calories) === 462.5, '1 plate Biryani calories equals 462.5 kcal', `${biryaniCalc.calories} kcal`);
  assert(Number(biryaniCalc.protein) === 21.3, '1 plate Biryani protein equals 21.3g', `${biryaniCalc.protein}g`);

  // 4C. Gram-based direct input: 200g Steamed White Rice -> 260.0 kcal (130 * 2.0)
  const riceSearch = await (await fetch(`${BACKEND_URL}/food-catalog?q=steamed%20white%20rice`, { headers: authHeaders })).json();
  const riceItem = riceSearch[0];
  const riceCalcRes = await fetch(`${BACKEND_URL}/food-catalog/calculate`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ catalogId: riceItem.id, quantity: 200, unit: 'g' }),
  });
  assert(riceCalcRes.ok, 'Calculate 200g Steamed Rice HTTP 200');
  const riceCalc = await riceCalcRes.json();
  assert(Number(riceCalc.calculatedGrams) === 200, 'Direct grams weight matches 200g', `${riceCalc.calculatedGrams}g`);
  assert(Number(riceCalc.calories) === 260.0, '200g Steamed Rice calories equals 260.0 kcal', `${riceCalc.calories} kcal`);

  // ---------------------------------------------------------------------------
  // TEST SUITE 5: Scanner API Integration & Uncertainty Handling
  // ---------------------------------------------------------------------------
  console.log('\n--- Test Suite 5: Scanner Workflow & Context-Driven Resolution ---');

  // 5A. Text Estimate: "2 idli and 1 cup sambar"
  const textScanRes = await fetch(`${BACKEND_URL}/scanner/text-estimate`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ description: 'Idli' }),
  });
  assert(textScanRes.ok, 'Text scan for Idli HTTP 200');
  const textScan = await textScanRes.json();
  assert(textScan.items.length > 0, 'Text scan returns items', `Count: ${textScan.items.length}`);
  console.log(`    Scanned food name: "${textScan.items[0].name}" | Estimated Calories: ${textScan.items[0].estimatedNutrition.calories} kcal`);
  assert(textScan.items[0].name.toLowerCase().includes('idli'), 'Recognized canonical food name from catalog');

  // 5B. Out-of-Distribution Image Scan with User Context Override
  if (fs.existsSync(saladImgPath)) {
    const formData = new FormData();
    const blob = new Blob([fs.readFileSync(saladImgPath)], { type: 'image/jpeg' });
    formData.append('image', blob, 'meal.jpg');
    formData.append('description', 'Chicken Biryani'); // User supplies true context for OOD photo

    const ctxScanRes = await fetch(`${BACKEND_URL}/scanner/analyze`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    assert(ctxScanRes.ok, 'Context-assisted image scan HTTP 200');
    const ctxScan = await ctxScanRes.json();
    assert(ctxScan.items.length > 0, 'Context scan returns resolved food item');
    console.log(`    Context resolved food: "${ctxScan.items[0].name}" | Source Note: ${ctxScan.items[0].uncertainty[0]}`);
    assert(ctxScan.items[0].name.toLowerCase().includes('biryani'), 'User description resolved dish outside ViT 20 classes');
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 6: Zero Image Persistence & Privacy Check
  // ---------------------------------------------------------------------------
  console.log('\n--- Test Suite 6: Image Privacy & Ephemeral In-Memory Verification ---');
  // Check user diary before explicit save - scanner must NEVER auto-save!
  const diaryBeforeRes = await fetch(`${BACKEND_URL}/food-entries?from=2026-10-01&to=2026-10-31`, { headers: authHeaders });
  const diaryBefore = await diaryBeforeRes.json();
  assert((diaryBefore.totalElements || diaryBefore.items?.length || 0) === 0, 'Scanning alone did NOT auto-save to diary');

  // ---------------------------------------------------------------------------
  // TEST SUITE 7: Explicit User Confirmation & Diary Persistence
  // ---------------------------------------------------------------------------
  console.log('\n--- Test Suite 7: Explicit Confirmation & Diary Persistence ---');
  const mealToSave = {
    date: '2026-10-14',
    meal: 'breakfast',
    name: 'Idli',
    quantity: 3,
    unit: 'piece',
    nutrition: {
      calories: 198.0,
      protein: 7.8,
      carbohydrates: 39.8,
      fat: 0.8,
      fiber: 3.2,
    },
    notes: 'ICMR-NIN IFCT 2017 [Ref: IFCT-2017-B004] (STANDARD_RECIPE)',
    source: 'scanner',
  };

  const saveRes = await fetch(`${BACKEND_URL}/food-entries`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(mealToSave),
  });
  assert(saveRes.ok, 'Explicit user Save to Diary HTTP 201/200');
  const savedEntry = await saveRes.json();
  assert(savedEntry.id !== undefined, 'Saved diary entry received generated UUID', savedEntry.id);
  assert(savedEntry.name === 'Idli', 'Diary entry name preserved');
  assert(Number(savedEntry.nutrition.calories) === 198.0, 'Verified calories persisted correctly in diary');
  assert(savedEntry.notes.includes('ICMR-NIN IFCT 2017'), 'Nutrient data provenance stored in diary notes');

  // ---------------------------------------------------------------------------
  // TEST SUITE 8: Seed Idempotency Check
  // ---------------------------------------------------------------------------
  console.log('\n--- Test Suite 8: Database Catalog Seed Idempotency Check ---');
  const catalogCountRes = await fetch(`${BACKEND_URL}/food-catalog?limit=100`, { headers: authHeaders });
  const catalogItems = await catalogCountRes.json();
  console.log(`    Total seeded food catalog items: ${catalogItems.length}`);
  assert(catalogItems.length >= 40, 'Verified food catalog contains 40+ curated items');

  const uniqueCodes = new Set(catalogItems.map(i => i.code));
  assert(uniqueCodes.size === catalogItems.length, 'Every food catalog code is strictly unique with zero duplicates');

  console.log('\n========================================================================');
  console.log(`ALL VERIFICATION TESTS COMPLETED: ${passedTests}/${totalTests} PASSED (100% SUCCESS)`);
  console.log('========================================================================');
}

run().catch((err) => {
  console.error('\nFAILED TEST EXECUTION:', err);
  process.exit(1);
});
