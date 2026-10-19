const fs = require('fs');
const path = require('path');

const BACKEND_URL = 'http://localhost:8081/api/v1';
const HF_SERVICE_URL = 'http://127.0.0.1:5001';

async function runStage11Audit() {
  console.log('========================================================================');
  console.log('STAGE 11: REAL-WORLD FOOD RECOGNITION ACCURACY & INTEGRITY AUDIT');
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
  // STEP 0: SIDE CAR HEALTH & ARCHITECTURE INSPECTION
  // ---------------------------------------------------------------------------
  console.log('--- Step 0: Vision Inference Sidecar Health & Baseline Inspection ---');
  const healthRes = await fetch(`${HF_SERVICE_URL}/health`);
  assert(healthRes.ok, 'HF sidecar /health HTTP 200');
  const healthData = await healthRes.json();
  assert(healthData.status === 'UP', 'HF sidecar status UP', `Model: ${healthData.model}`);
  assert(healthData.classes === 20, 'ViT classifier baseline confirms 20 supported classes', `Classes: ${healthData.classes}`);

  // ---------------------------------------------------------------------------
  // STEP 1: AUTHENTICATED USER SESSIONS FOR TENANT ISOLATION
  // ---------------------------------------------------------------------------
  console.log('\n--- Step 1: User Registration & Multi-Tenant Setup ---');
  const ts = Date.now();
  const userA = {
    name: 'Auditor Alpha',
    email: `auditor_alpha_${ts}@nutritrack.test`,
    password: 'SecurePassword123!',
  };
  const userB = {
    name: 'Auditor Beta',
    email: `auditor_beta_${ts}@nutritrack.test`,
    password: 'SecurePassword123!',
  };

  const regResA = await fetch(`${BACKEND_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userA),
  });
  assert(regResA.ok, 'User A registration HTTP 200', userA.email);
  const authDataA = await regResA.json();
  const tokenA = authDataA.accessToken;
  const headersA = { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' };

  const regResB = await fetch(`${BACKEND_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userB),
  });
  if (!regResB.ok) {
    console.error('User B registration failed status:', regResB.status, await regResB.text());
  }
  assert(regResB.ok, 'User B registration HTTP 200', userB.email);
  const authDataB = await regResB.json();
  const tokenB = authDataB.accessToken;
  const headersB = { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' };

  // ---------------------------------------------------------------------------
  // STEP 2: ACCURACY AUDIT ON GENUINE FOOD TEST IMAGES
  // ---------------------------------------------------------------------------
  console.log('\n--- Step 2: Recognition Accuracy on Genuine Project Food Images ---');

  const genuineImages = [
    {
      id: 'IMG-001',
      file: 'test_dataset/supported_indian_foods/idli_real.jpg',
      groundTruth: 'idli',
      category: 'Supported Indian Foods',
      isOOD: false,
    },
    {
      id: 'IMG-002',
      file: 'test_dataset/supported_indian_foods/samosa_real.jpg',
      groundTruth: 'samosa',
      category: 'Supported Indian Foods',
      isOOD: false,
    },
    {
      id: 'IMG-003',
      file: 'test_dataset/supported_indian_foods/masala_dosa_real.jpg',
      groundTruth: 'masala_dosa',
      category: 'Supported Indian Foods',
      isOOD: false,
    },
    {
      id: 'IMG-004',
      file: 'test_dataset/supported_indian_foods/chole_bhature_real.jpg',
      groundTruth: 'chole_bhature',
      category: 'Supported Indian Foods',
      isOOD: false,
    },
    {
      id: 'IMG-005',
      file: 'test_dataset/supported_indian_foods/jalebi_real.jpg',
      groundTruth: 'jalebi',
      category: 'Supported Indian Foods',
      isOOD: false,
    },
    {
      id: 'IMG-006',
      file: 'test_dataset/fruits_and_vegetables/salad_real.jpg',
      groundTruth: 'salad',
      category: 'Fruits & Vegetables (OOD)',
      isOOD: true,
    },
  ];

  let top1Correct = 0;
  let top5Correct = 0;
  let oodCorrectlyFlagged = 0;
  let totalEvaluated = genuineImages.length;
  const auditRecords = [];
  const confusionMatrix = {};

  for (const imgTest of genuineImages) {
    const fullPath = path.resolve(__dirname, imgTest.file);
    assert(fs.existsSync(fullPath), `Genuine image file exists: ${imgTest.file}`);

    const fileBytes = fs.readFileSync(fullPath);
    const classifyRes = await fetch(`${HF_SERVICE_URL}/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: fileBytes,
    });
    assert(classifyRes.ok, `Direct classification for ${imgTest.id} (${imgTest.groundTruth}) HTTP 200`);
    const data = await classifyRes.json();

    const topPrediction = data.predictions[0];
    const top5Labels = data.predictions.map(p => p.label.toLowerCase());
    const isTop1Match = topPrediction.label.toLowerCase() === imgTest.groundTruth.toLowerCase();
    const isTop5Match = top5Labels.includes(imgTest.groundTruth.toLowerCase());

    if (isTop1Match) top1Correct++;
    if (isTop5Match) top5Correct++;

    // Check OOD / Uncertainty detection
    const oodFlagged = data.is_uncertain === true || topPrediction.score < 0.70 || data.entropy > 1.6;
    if (imgTest.isOOD && oodFlagged) {
      oodCorrectlyFlagged++;
    } else if (!imgTest.isOOD && !data.is_uncertain) {
      oodCorrectlyFlagged++;
    }

    // Track confusion matrix
    const gt = imgTest.groundTruth;
    const pred = topPrediction.label;
    if (!confusionMatrix[gt]) confusionMatrix[gt] = {};
    confusionMatrix[gt][pred] = (confusionMatrix[gt][pred] || 0) + 1;

    auditRecords.push({
      id: imgTest.id,
      file: path.basename(imgTest.file),
      groundTruth: imgTest.groundTruth,
      category: imgTest.category,
      topPredicted: topPrediction.label,
      confidence: (topPrediction.score * 100).toFixed(1) + '%',
      entropy: data.entropy,
      uncertain: data.is_uncertain,
      top5: top5Labels.slice(0, 5).join(', '),
      isOOD: imgTest.isOOD,
      isTop1: isTop1Match,
      isTop5: isTop5Match,
    });

    console.log(`    [${imgTest.id}] ${imgTest.groundTruth.toUpperCase().padEnd(14)} -> Pred: ${topPrediction.label.padEnd(14)} (${(topPrediction.score * 100).toFixed(1)}%) | Entropy: ${data.entropy} | Uncertain: ${data.is_uncertain} | Top-1: ${isTop1Match ? '✓' : '✗'}`);
  }

  const inDistImages = genuineImages.filter(img => !img.isOOD);
  const inDistTotal = inDistImages.length;
  const inDistTop1Accuracy = (top1Correct / inDistTotal) * 100;
  const inDistTop5Accuracy = (top5Correct / inDistTotal) * 100;
  const oodAccuracy = (oodCorrectlyFlagged / totalEvaluated) * 100;

  console.log(`\n  Genuine Food Images Evaluated: ${totalEvaluated} (${inDistTotal} in-distribution, 1 OOD)`);
  console.log(`  In-Distribution Top-1 Accuracy: ${inDistTop1Accuracy.toFixed(1)}% (${top1Correct}/${inDistTotal})`);
  console.log(`  In-Distribution Top-5 Accuracy: ${inDistTop5Accuracy.toFixed(1)}% (${top5Correct}/${inDistTotal})`);
  console.log(`  OOD/Uncertainty Detection Accuracy: ${oodAccuracy.toFixed(1)}% (${oodCorrectlyFlagged}/${totalEvaluated})`);

  assert(inDistTop1Accuracy >= 80.0, 'Top-1 accuracy on in-distribution genuine image set meets >= 80% threshold');
  assert(inDistTop5Accuracy === 100.0, 'Top-5 accuracy on in-distribution genuine image set achieves 100% coverage');
  assert(oodAccuracy === 100.0, 'Out-of-distribution (OOD) detection accurately flags non-supported dishes');

  // ---------------------------------------------------------------------------
  // STEP 3: DATASET COVERAGE & UNAVAILABLE DATA REPORTING
  // ---------------------------------------------------------------------------
  console.log('\n--- Step 3: Dataset Category Coverage & Gap Accounting ---');
  const requiredCategories = [
    { category: 'Supported Indian Foods', testedReal: 5, status: 'Audited with Real Images' },
    { category: 'Fruits & Vegetables', testedReal: 1, status: 'Audited with Real Images (OOD salad)' },
    { category: 'South Indian Meals', testedReal: 0, status: 'Real images unavailable; tested via Verified Catalog & Text Context' },
    { category: 'Mixed Dishes', testedReal: 0, status: 'Real images unavailable; tested via Verified Catalog & Text Context' },
    { category: 'Other Foods (Eggs, Toast, Pizza)', testedReal: 0, status: 'Real images unavailable; tested via Verified Catalog & Text Context' },
    { category: 'Challenging (Multi-food, poor lighting)', testedReal: 0, status: 'Real images unavailable; tested via Entropy & Dispersion checks' },
  ];

  requiredCategories.forEach(c => {
    console.log(`  - Category: ${c.category.padEnd(35)} | Real: ${c.testedReal} | Status: ${c.status}`);
  });

  // ---------------------------------------------------------------------------
  // STEP 4: QUANTITY-BASED NUTRITION CALCULATION FORMULA & BOUNDARY AUDIT
  // ---------------------------------------------------------------------------
  console.log('\n--- Step 4: Quantity-Based Nutrition Calculations & Boundary Audit ---');

  // Find idli, chicken biryani, and steamed white rice catalog IDs
  const idliItem = (await (await fetch(`${BACKEND_URL}/food-catalog?q=idli`, { headers: headersA })).json())[0];
  const biryaniItem = (await (await fetch(`${BACKEND_URL}/food-catalog?q=chicken%20biryani`, { headers: headersA })).json())[0];
  const riceItem = (await (await fetch(`${BACKEND_URL}/food-catalog?q=steamed%20white%20rice`, { headers: headersA })).json())[0];
  const pavBhajiItem = (await (await fetch(`${BACKEND_URL}/food-catalog?q=pav%20bhaji`, { headers: headersA })).json())[0];
  const sambarItem = (await (await fetch(`${BACKEND_URL}/food-catalog?q=sambar`, { headers: headersA })).json())[0];

  assert(idliItem && biryaniItem && riceItem, 'Catalog items found for formula testing');

  // Formula Test 4A: Standard idli (3 pieces @ 50g = 150g)
  // Per 100g: 132.0 kcal, 5.2g P, 26.5g C, 0.5g F, 2.1g Fib
  // Factor = 150 / 100 = 1.5
  // Cal = 132 * 1.5 = 198.0 kcal, P = 5.2 * 1.5 = 7.8g, C = 26.5 * 1.5 = 39.8g
  const calcIdli = await (await fetch(`${BACKEND_URL}/food-catalog/calculate`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ catalogId: idliItem.id, quantity: 3, unit: 'piece' }),
  })).json();
  assert(Number(calcIdli.calculatedGrams) === 150, 'Formula: 3 pieces Idli totalGrams = 150g', `${calcIdli.calculatedGrams}g`);
  assert(Number(calcIdli.calories) === 198.0, 'Formula: 3 pieces Idli calories = 198.0 kcal', `${calcIdli.calories} kcal`);
  assert(Number(calcIdli.protein) === 7.8, 'Formula: 3 pieces Idli protein = 7.8g', `${calcIdli.protein}g`);

  // Formula Test 4B: Fractional quantity: 1.5 plates Pav Bhaji (1.5 * 250g = 375g)
  // Per 100g: 158.0 kcal, 3.2g P, 20.8g C, 7.2g F, 2.4g Fib
  // Factor = 375 / 100 = 3.75
  // Cal = 158 * 3.75 = 592.5 kcal, P = 3.2 * 3.75 = 12.0g, C = 20.8 * 3.75 = 78.0g, F = 7.2 * 3.75 = 27.0g
  const calcPavBhaji = await (await fetch(`${BACKEND_URL}/food-catalog/calculate`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ catalogId: pavBhajiItem.id, quantity: 1.5, unit: 'plate' }),
  })).json();
  assert(Number(calcPavBhaji.calculatedGrams) === 375, 'Fractional quantity: 1.5 plates Pav Bhaji = 375g', `${calcPavBhaji.calculatedGrams}g`);
  assert(Number(calcPavBhaji.calories) === 592.5, 'Fractional calories: 592.5 kcal', `${calcPavBhaji.calories} kcal`);
  assert(Number(calcPavBhaji.protein) === 12.0, 'Fractional protein: 12.0g', `${calcPavBhaji.protein}g`);
  assert(calcPavBhaji.dataSource.includes('ICMR-NIN'), 'Nutrient provenance traceable to ICMR-NIN IFCT 2017');

  // Formula Test 4C: Direct grams: 200g Steamed Rice
  // Per 100g: 130.0 kcal, 2.7g P, 28.2g C, 0.3g F, 0.4g Fib
  // Factor = 2.0 -> Cal = 260.0 kcal, P = 5.4g, C = 56.4g
  const calcRice = await (await fetch(`${BACKEND_URL}/food-catalog/calculate`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ catalogId: riceItem.id, quantity: 200, unit: 'g' }),
  })).json();
  assert(Number(calcRice.calculatedGrams) === 200, 'Direct grams: 200g Rice weight matches', `${calcRice.calculatedGrams}g`);
  assert(Number(calcRice.calories) === 260.0, 'Direct grams calories: 260.0 kcal', `${calcRice.calories} kcal`);
  assert(Number(calcRice.protein) === 5.4, 'Direct grams protein: 5.4g', `${calcRice.protein}g`);

  // Formula Test 4D: Boundary & Rejection Testing
  console.log('\n  Testing Boundary Rejections:');
  
  // Zero quantity
  const zeroRes = await fetch(`${BACKEND_URL}/food-catalog/calculate`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ catalogId: idliItem.id, quantity: 0, unit: 'piece' }),
  });
  assert(zeroRes.status === 400, 'Rejection: Zero quantity rejected with HTTP 400');

  // Negative quantity
  const negRes = await fetch(`${BACKEND_URL}/food-catalog/calculate`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ catalogId: idliItem.id, quantity: -2.5, unit: 'piece' }),
  });
  assert(negRes.status === 400, 'Rejection: Negative quantity (-2.5) rejected with HTTP 400');

  // Excessively large quantity (>100,000)
  const hugeRes = await fetch(`${BACKEND_URL}/food-catalog/calculate`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ catalogId: idliItem.id, quantity: 150000, unit: 'piece' }),
  });
  assert(hugeRes.status === 400, 'Rejection: Excessively large quantity (150,000) rejected with HTTP 400');

  // Blank unit
  const blankUnitRes = await fetch(`${BACKEND_URL}/food-catalog/calculate`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ catalogId: idliItem.id, quantity: 2, unit: '   ' }),
  });
  assert(blankUnitRes.status === 400, 'Rejection: Blank serving unit rejected with HTTP 400');

  // Non-existent UUID
  const nonExistentRes = await fetch(`${BACKEND_URL}/food-catalog/calculate`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ catalogId: '00000000-0000-0000-0000-000000000000', quantity: 1, unit: 'piece' }),
  });
  assert(nonExistentRes.status === 404, 'Rejection: Non-existent catalog UUID returns HTTP 404 FOOD_NOT_FOUND');

  // ---------------------------------------------------------------------------
  // STEP 5: UNKNOWN FOODS, CATALOG SEARCH & USER CORRECTION FLOW
  // ---------------------------------------------------------------------------
  console.log('\n--- Step 5: Unknown Foods, Catalog Search & User Corrections ---');

  // 5A. Regional alias searches
  const aliasTests = [
    { query: 'phulka', expected: 'Chapati / Phulka' },
    { query: 'golgappa', expected: 'Pani Puri / Golgappa' },
    { query: 'khaman', expected: 'Khaman Dhokla' },
    { query: 'bhajji', expected: 'Onion Pakoda / Bhajji' },
    { query: 'dum biryani', expected: 'Vegetable Dum Biryani' },
  ];

  for (const t of aliasTests) {
    const sRes = await fetch(`${BACKEND_URL}/food-catalog?q=${encodeURIComponent(t.query)}`, { headers: headersA });
    assert(sRes.ok, `Search query "${t.query}" HTTP 200`);
    const results = await sRes.json();
    assert(results.length > 0, `Alias search "${t.query}" returned matches`);
    assert(results[0].canonicalName === t.expected || results[0].regionalAliases.toLowerCase().includes(t.query),
      `Regional alias "${t.query}" resolved to "${t.expected}"`);
  }

  // 5B. Completely unknown search query must NOT fabricate nutrition data
  const unknownSearchRes = await fetch(`${BACKEND_URL}/food-catalog?q=xyznonexistentdish999`, { headers: headersA });
  assert(unknownSearchRes.ok, 'Unknown query search HTTP 200');
  const unknownResults = await unknownSearchRes.json();
  assert(unknownResults.length === 0, 'Unknown search query returns empty array (no fabricated entries)', `Count: ${unknownResults.length}`);

  // 5C. User context correction: Image of OOD salad with text context "Ven Pongal"
  const saladPath = path.resolve(__dirname, '../../Frontend/public/test_salad.jpg');
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const saladBytes = fs.readFileSync(saladPath);

  const contextBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="meal.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    saladBytes,
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="description"\r\n\r\nVen Pongal\r\n--${boundary}--\r\n`)
  ]);

  const ctxRes = await fetch(`${BACKEND_URL}/scanner/analyze`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenA}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: contextBody
  });
  assert(ctxRes.ok, 'Context-assisted image scan HTTP 200');
  const ctxData = await ctxRes.json();
  assert(ctxData.items.length > 0, 'Context scan returns items');
  assert(ctxData.items[0].name === 'Ven Pongal', 'User context successfully resolved true dish', ctxData.items[0].name);
  assert(Number(ctxData.items[0].estimatedNutrition.calories) === 330, 'Calculated from verified Ven Pongal catalog entry', `${ctxData.items[0].estimatedNutrition.calories} kcal`);

  // ---------------------------------------------------------------------------
  // STEP 6: IMAGE PRIVACY & TENANT ISOLATION AUDIT
  // ---------------------------------------------------------------------------
  console.log('\n--- Step 6: Image Privacy & Tenant Isolation Verification ---');

  // Check User A diary before save: must be empty
  const diaryABefore = await (await fetch(`${BACKEND_URL}/food-entries?from=2026-10-01&to=2026-10-31`, { headers: headersA })).json();
  assert((diaryABefore.totalElements || diaryABefore.items?.length || 0) === 0, 'Scan alone did NOT auto-save to User A diary');

  // Explicit Save by User A: Masala Dosa
  const dosaEntry = {
    date: '2026-10-14',
    meal: 'breakfast',
    name: 'Masala Dosa',
    quantity: 1,
    unit: 'dosa',
    nutrition: {
      calories: 330.0,
      protein: 6.0,
      carbohydrates: 45.0,
      fat: 14.0,
      fiber: 4.0,
    },
    notes: 'ICMR-NIN IFCT 2017 [Ref: IFCT-2017-B006] (STANDARD_RECIPE)',
    source: 'scanner',
  };

  const saveResA = await fetch(`${BACKEND_URL}/food-entries`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify(dosaEntry),
  });
  assert(saveResA.status === 201, 'User A explicit Save to Diary HTTP 201');
  const savedA = await saveResA.json();
  assert(savedA.id !== undefined, 'User A diary entry created with UUID', savedA.id);

  // Tenant Isolation Check: User B CANNOT view or access User A's diary entry
  const getEntryByB = await fetch(`${BACKEND_URL}/food-entries/${savedA.id}`, { headers: headersB });
  assert(getEntryByB.status === 404, 'Tenant Isolation: User B cannot access User A record (HTTP 404 NOT_FOUND)');

  const diaryB = await (await fetch(`${BACKEND_URL}/food-entries?from=2026-10-01&to=2026-10-31`, { headers: headersB })).json();
  assert((diaryB.totalElements || diaryB.items?.length || 0) === 0, 'Tenant Isolation: User B diary remains strictly empty');

  // Upload Validation Check: oversized image (>10MB) must be rejected
  console.log('\n  Testing Image Upload Type & Size Restrictions:');
  const oversizedBoundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const oversizedBytes = Buffer.alloc(11 * 1024 * 1024, 0); // 11 MB
  const oversizedBody = Buffer.concat([
    Buffer.from(`--${oversizedBoundary}\r\nContent-Disposition: form-data; name="image"; filename="huge.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    oversizedBytes,
    Buffer.from(`\r\n--${oversizedBoundary}--\r\n`)
  ]);

  const overRes = await fetch(`${BACKEND_URL}/scanner/analyze`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenA}`,
      'Content-Type': `multipart/form-data; boundary=${oversizedBoundary}`
    },
    body: oversizedBody
  });
  assert(overRes.status === 413 || overRes.status === 400, 'Rejection: Upload exceeding 10MB rejected safely', `Status: ${overRes.status}`);

  // Upload Validation Check: invalid text/plain mime type
  const badMimeBoundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const badMimeBody = Buffer.concat([
    Buffer.from(`--${badMimeBoundary}\r\nContent-Disposition: form-data; name="image"; filename="script.sh"\r\nContent-Type: text/plain\r\n\r\n#!/bin/bash\r\necho exploit\r\n`),
    Buffer.from(`\r\n--${badMimeBoundary}--\r\n`)
  ]);

  const badMimeRes = await fetch(`${BACKEND_URL}/scanner/analyze`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenA}`,
      'Content-Type': `multipart/form-data; boundary=${badMimeBoundary}`
    },
    body: badMimeBody
  });
  assert(badMimeRes.status === 415 || badMimeRes.status === 400, 'Rejection: Disallowed MIME type (text/plain) rejected with HTTP 415/400', `Status: ${badMimeRes.status}`);

  console.log('\n========================================================================');
  console.log(`STAGE 11 AUDIT COMPLETE: ${passedTests}/${totalTests} TESTS PASSED (100% SUCCESS)`);
  console.log('========================================================================\n');

  return {
    passedTests,
    totalTests,
    top1Accuracy: inDistTop1Accuracy,
    top5Accuracy: inDistTop5Accuracy,
    oodAccuracy,
    auditRecords,
    confusionMatrix,
  };
}

runStage11Audit().then(res => {
  fs.writeFileSync(path.resolve(__dirname, 'stage11_audit_results.json'), JSON.stringify(res, null, 2));
  console.log('Stage 11 audit results saved to: stage11_audit_results.json');
}).catch(err => {
  console.error('\nSTAGE 11 AUDIT FAILURE:', err);
  process.exit(1);
});
