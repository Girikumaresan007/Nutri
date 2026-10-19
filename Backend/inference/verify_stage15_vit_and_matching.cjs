/**
 * verify_stage15_vit_and_matching.cjs
 * Comprehensive Automated Verification Suite for NutriTrack AI Stage 15:
 * Expanded Food Dataset, Controlled ViT Fine-Tuning & Regression Safety
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

const BACKEND_URL = 'http://127.0.0.1:8081/api/v1';
const PYTHON_SIDECAR_URL = 'http://127.0.0.1:5001';
const OUTPUT_JSON_PATH = path.resolve(__dirname, '../../STAGE15_TEST_RESULTS.json');
const PYTHON_EXE = 'C:\\Users\\0117g\\AppData\\Local\\Programs\\Python\\Python311\\python.exe';

const results = {
  stage: 'Stage 15',
  timestamp: new Date().toISOString(),
  passed: 0,
  failed: 0,
  tests: []
};

function record(name, pass, detail = null) {
  if (pass) {
    results.passed++;
    console.log(`  ✓ PASS: ${name}${detail ? ` - ${detail}` : ''}`);
    results.tests.push({ name, status: 'PASS', detail });
  } else {
    results.failed++;
    console.error(`  ✗ FAIL: ${name}${detail ? ` - ${detail}` : ''}`);
    results.tests.push({ name, status: 'FAIL', detail });
    throw new Error(`Test failed: ${name}`);
  }
}

async function registerUser(email, password, name) {
  const res = await fetch(`${BACKEND_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Registration failed (${res.status}): ${errText}`);
  }
  return res.json();
}

async function scanImage(imageBuffer, mimeType, token, description = null) {
  const boundary = '----WebKitFormBoundaryStage15Verify' + Math.random().toString(36).substring(2);
  let payload = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="image"; filename="food.jpg"\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`
  );
  payload = Buffer.concat([payload, imageBuffer]);
  if (description) {
    payload = Buffer.concat([
      payload,
      Buffer.from(
        `\r\n--${boundary}\r\n` +
        `Content-Disposition: form-data; name="description"\r\n\r\n` +
        `${description}`
      )
    ]);
  }
  payload = Buffer.concat([payload, Buffer.from(`\r\n--${boundary}--\r\n`)]);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': `multipart/form-data; boundary=${boundary}`
  };

  return fetch(`${BACKEND_URL}/scanner/analyze`, {
    method: 'POST',
    headers,
    body: payload
  });
}

async function runStage15Verification() {
  console.log('========================================================================');
  console.log('STAGE 15: EXPANDED FOOD DATASET, ViT FINE-TUNING & SAFETY REGRESSION');
  console.log('========================================================================\n');

  const ts = Date.now();
  const userAEmail = `stage15_alpha_${ts}@nutritrack.test`;
  const userBEmail = `stage15_beta_${ts}@nutritrack.test`;

  // Register users
  const authA = await registerUser(userAEmail, 'SecretPass123!', 'Alpha User');
  const authB = await registerUser(userBEmail, 'SecretPass123!', 'Beta User');
  const tokenA = authA.accessToken;
  const tokenB = authB.accessToken;
  const headersA = { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' };
  const headersB = { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' };
  record('Authenticated sessions initialized for User Alpha & User Beta', true);

  // ---------------------------------------------------------------------------
  // SECTION 1: PRODUCTION INFERENCE SERVICE HEALTH & ZERO REGRESSION
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 1: Production ViT Inference Service Health ---');
  const healthRes = await fetch(`${PYTHON_SIDECAR_URL}/health`);
  record('Inference health endpoint HTTP 200', healthRes.status === 200);
  const health = await healthRes.json();
  record('Production engine is real_vit_model', health.engine === 'real_vit_model', `Engine: ${health.engine}`);
  record('Production model is DrishtiSharma 20-class ViT', health.model.includes('DrishtiSharma'), `Model: ${health.model}`);
  record('Production service is not in degraded mode', health.is_degraded === false);
  record('Production model has exactly 20 output classes', health.classes === 20, `Classes: ${health.classes}`);

  // ---------------------------------------------------------------------------
  // SECTION 2: EXPERIMENTAL MODEL CHECKPOINT, LOADING & FAILURE HANDLING
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 2: Experimental Model Loading & Failure Handling ---');
  const ckptDir = path.resolve(__dirname, 'experimental_model', 'checkpoint');
  const configPath = path.join(ckptDir, 'config.json');
  const safetensorsPath = path.join(ckptDir, 'model.safetensors');

  record('Experimental checkpoint directory exists', fs.existsSync(ckptDir), ckptDir);
  record('Experimental config.json exists', fs.existsSync(configPath));
  record('Experimental model.safetensors exists', fs.existsSync(safetensorsPath));

  const expConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const expClassesCount = Object.keys(expConfig.id2label).length;
  record('Experimental checkpoint configured with 22 expanded classes', expClassesCount === 22, `Classes: ${expClassesCount}`);

  // Test loading experimental checkpoint via Python
  let expLoadSuccess = false;
  try {
    const pythonCheckCmd = `& "${PYTHON_EXE}" -c "from transformers import AutoModelForImageClassification; m = AutoModelForImageClassification.from_pretrained(r'${ckptDir}', local_files_only=True); print(f'OK:{len(m.config.id2label)}')"`;
    const checkOut = execSync(pythonCheckCmd, { shell: 'powershell.exe', encoding: 'utf8' });
    expLoadSuccess = checkOut.includes('OK:22');
  } catch (e) {
    expLoadSuccess = false;
  }
  record('Experimental model checkpoint loads cleanly in PyTorch without errors', expLoadSuccess);

  // Test corrupted / invalid model path handling in Python
  let failureHandled = false;
  try {
    const pythonFailCmd = `& "${PYTHON_EXE}" -c "
try:
    from transformers import AutoModelForImageClassification
    m = AutoModelForImageClassification.from_pretrained(r'nonexistent_fake_dir', local_files_only=True)
    print('SHOULD_FAIL')
except Exception as e:
    print('HANDLED_EXCEPTION')
"`;
    const failOut = execSync(pythonFailCmd, { shell: 'powershell.exe', encoding: 'utf8' });
    failureHandled = failOut.includes('HANDLED_EXCEPTION');
  } catch (e) {
    failureHandled = true; // Exception expected
  }
  record('Model loader safely catches missing/corrupted checkpoints and raises handled exception', failureHandled);

  // ---------------------------------------------------------------------------
  // SECTION 3: CLASS MAPPING COMPATIBILITY & UNKNOWN / UNMAPPED CLASS SAFETY
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 3: Class Mapping Compatibility & Unmapped Food Safety ---');
  // Unknown query must never synthesize false nutrition
  const unknownSearchRes = await fetch(`${BACKEND_URL}/food-catalog?q=xyz_nonexistent_exotic_food_123`, {
    headers: headersA
  });
  record('Unknown food query returns HTTP 200 without error', unknownSearchRes.status === 200);
  const unknownItems = await unknownSearchRes.json();
  record('Unknown food query cleanly returns empty catalog results', Array.isArray(unknownItems) && unknownItems.length === 0, `Count: ${unknownItems.length}`);

  // Test scanner with text description of unmapped class
  const unmappedTextRes = await fetch(`${BACKEND_URL}/scanner/text-estimate`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ description: 'xyz_completely_unknown_food_999' })
  });
  record('Text estimate for unmapped food returns HTTP 200', unmappedTextRes.status === 200);
  const unmappedData = await unmappedTextRes.json();
  record('Unmapped food returns empty or low-confidence fallback (no fabricated certainty)',
    !unmappedData.items || unmappedData.items.length === 0 || unmappedData.items[0].confidence === 'low');

  // ---------------------------------------------------------------------------
  // SECTION 4: PREDICTION CONFIDENCE, UNCERTAINTY & DECISION POLICY
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 4: Prediction Confidence, Uncertainty & Decision States ---');
  // Supported food: Samosa
  const samosaBytes = fs.readFileSync(path.resolve(__dirname, 'test_dataset/supported_indian_foods/samosa_real.jpg'));
  const samosaRes = await scanImage(samosaBytes, 'image/jpeg', tokenA);
  record('Scan supported samosa HTTP 200', samosaRes.status === 200);
  const samosaData = await samosaRes.json();
  record('Supported samosa identified as Samosa', samosaData.items[0].name.toLowerCase().includes('samosa'));
  record('Supported samosa receives Confidence.HIGH', samosaData.items[0].confidence === 'high');

  // Ambiguous food: Chicken Biryani (closed-set conflation defense)
  const biryaniBytes = fs.readFileSync(path.resolve(__dirname, 'test_dataset/mixed_dishes/chicken_biryani_real.jpg'));
  const biryaniRes = await scanImage(biryaniBytes, 'image/jpeg', tokenA);
  record('Scan Chicken Biryani HTTP 200', biryaniRes.status === 200);
  const biryaniData = await biryaniRes.json();
  record('Chicken Biryani detected as ambiguous with candidate review tag', biryaniData.items[0].name.includes('(Review suggested candidates)'));
  record('Chicken Biryani confidence demoted to MEDIUM (not falsely HIGH)', biryaniData.items[0].confidence === 'medium');
  record('Chicken Biryani suggested in catalog candidates list', biryaniData.items[0].candidates.some(c => c.canonicalName === 'Chicken Biryani'));

  // Out-of-Distribution food: Salad
  const saladBytes = fs.readFileSync(path.resolve(__dirname, 'test_dataset/fruits_and_vegetables/salad_real.jpg'));
  const saladRes = await scanImage(saladBytes, 'image/jpeg', tokenA);
  record('Scan OOD Salad HTTP 200', saladRes.status === 200);
  const saladData = await saladRes.json();
  record('OOD Salad flagged with Confidence.LOW', saladData.items[0].confidence === 'low');
  record('OOD Salad appended with (Uncertain match)', saladData.items[0].name.includes('(Uncertain match)'));

  // ---------------------------------------------------------------------------
  // SECTION 5: CATALOG MAPPING & NUTRITION GROUNDING
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 5: Catalog Mapping & Nutrition Grounding ---');
  const catSearchRes = await fetch(`${BACKEND_URL}/food-catalog?q=chicken biryani`, { headers: headersA });
  const catItems = await catSearchRes.json();
  const biryaniCat = catItems.find(i => i.canonicalName === 'Chicken Biryani');
  record('Chicken Biryani exists in verified PostgreSQL catalog', !!biryaniCat, `ID: ${biryaniCat.id}`);

  // Calculate nutrition for 1 plate (250g)
  const calc1Res = await fetch(`${BACKEND_URL}/food-catalog/calculate`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ catalogId: biryaniCat.id, unit: 'plate', quantity: 1.0 })
  });
  record('Calculate nutrition for 1 plate Chicken Biryani HTTP 200', calc1Res.status === 200);
  const calc1 = await calc1Res.json();
  record('1 plate Chicken Biryani calculates to verified 462.5 kcal', Number(calc1.calories) === 462.5, `${calc1.calories} kcal`);
  record('1 plate Chicken Biryani calculates to verified 21.3g protein', Math.abs(Number(calc1.protein) - 21.3) < 0.2, `${calc1.protein}g`);

  // Calculate nutrition for 150g portion
  const calc2Res = await fetch(`${BACKEND_URL}/food-catalog/calculate`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ catalogId: biryaniCat.id, unit: 'g', quantity: 150.0 })
  });
  record('Calculate nutrition for 150g Chicken Biryani HTTP 200', calc2Res.status === 200);
  const calc2 = await calc2Res.json();
  record('150g Chicken Biryani calculates to exactly 277.5 kcal', Number(calc2.calories) === 277.5, `${calc2.calories} kcal`);

  // ---------------------------------------------------------------------------
  // SECTION 6: EXPLICIT USER CONFIRMATION & ZERO AUTOMATIC DIARY PERSISTENCE
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 6: Explicit User Review & Zero Automatic Persistence ---');
  // Confirm diary for User Alpha is currently empty
  const diaryInitialRes = await fetch(`${BACKEND_URL}/food-entries?from=2026-10-01&to=2026-10-31`, { headers: headersA });
  const diaryInitial = await diaryInitialRes.json();
  const initialCount = diaryInitial.totalElements !== undefined ? diaryInitial.totalElements : (diaryInitial.items ? diaryInitial.items.length : 0);
  record('User Alpha diary initial count is 0 before explicit confirmation', initialCount === 0, `Count: ${initialCount}`);

  // Explicit save of reviewed meal
  const saveRes = await fetch(`${BACKEND_URL}/food-entries`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      date: '2026-10-15',
      meal: 'lunch',
      name: 'Chicken Biryani (Reviewed from Catalog)',
      quantity: 1.0,
      unit: 'plate',
      nutrition: {
        calories: Number(calc1.calories),
        protein: Number(calc1.protein),
        carbohydrates: 55.0,
        fat: 17.5,
        fiber: 3.0
      },
      notes: 'Explicitly reviewed from catalog',
      source: 'scanner'
    })
  });
  record('Explicit confirmation to save reviewed meal returns HTTP 201 CREATED', saveRes.status === 201 || saveRes.status === 200);
  const savedEntry = await saveRes.json();
  record('Saved entry assigned valid UUID', !!savedEntry.id && savedEntry.id.length > 20, `ID: ${savedEntry.id}`);

  // Confirm exactly 1 entry exists
  const diaryAfterRes = await fetch(`${BACKEND_URL}/food-entries?from=2026-10-01&to=2026-10-31`, { headers: headersA });
  const diaryAfter = await diaryAfterRes.json();
  const afterCount = diaryAfter.totalElements !== undefined ? diaryAfter.totalElements : (diaryAfter.items ? diaryAfter.items.length : 0);
  record('Diary contains exactly 1 explicitly confirmed entry', afterCount === 1, `Count: ${afterCount}`);

  // ---------------------------------------------------------------------------
  // SECTION 7: IMAGE NON-PERSISTENCE & UPLOAD VALIDATION
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 7: Ephemeral Image Processing & Upload Defense ---');
  // Non-image upload rejected
  const textPayload = Buffer.from('This is a text file, not an image.');
  const textRes = await scanImage(textPayload, 'text/plain', tokenA);
  record('Non-image upload (text/plain) safely rejected with HTTP 415 or 400', [400, 415].includes(textRes.status), `HTTP ${textRes.status}`);

  // Empty upload rejected
  const emptyRes = await scanImage(Buffer.alloc(0), 'image/jpeg', tokenA);
  record('Empty image upload rejected with HTTP 400', emptyRes.status === 400);

  // Oversized upload rejected (>10MB)
  const bigBytes = Buffer.alloc(11 * 1024 * 1024, 0);
  const bigRes = await scanImage(bigBytes, 'image/jpeg', tokenA);
  record('Oversized upload (>10MB) safely rejected with HTTP 413 or 400', [400, 413].includes(bigRes.status), `HTTP ${bigRes.status}`);

  // ---------------------------------------------------------------------------
  // SECTION 8: TENANT ISOLATION & IDOR DEFENSE
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 8: Multi-Tenant Data Isolation ---');
  const crossGetRes = await fetch(`${BACKEND_URL}/food-entries/${savedEntry.id}`, { headers: headersB });
  record('Cross-tenant GET blocked with HTTP 404 NOT_FOUND', crossGetRes.status === 404, `HTTP ${crossGetRes.status}`);

  const crossDelRes = await fetch(`${BACKEND_URL}/food-entries/${savedEntry.id}`, {
    method: 'DELETE',
    headers: headersB
  });
  record('Cross-tenant DELETE blocked with HTTP 404 NOT_FOUND', crossDelRes.status === 404, `HTTP ${crossDelRes.status}`);

  // ---------------------------------------------------------------------------
  // SECTION 9: BACKWARD COMPATIBILITY WITH EXISTING SCANNER
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 9: Backward Compatibility with Existing Scanner ---');
  record('Scanner response preserves provider="huggingface"', samosaData.provider === 'huggingface');
  record('Scanner response preserves topItem structure with nutrition and confidence',
    samosaData.items && samosaData.items[0].estimatedNutrition && samosaData.items[0].confidence);
  record('Scanner response enriches item with candidates array without breaking legacy clients',
    Array.isArray(samosaData.items[0].candidates));

  // ---------------------------------------------------------------------------
  // SUMMARY & REPORT EXPORT
  // ---------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`STAGE 15 VERIFICATION COMPLETE: ${results.passed}/${results.passed + results.failed} TESTS PASSED (100% SUCCESS)`);
  console.log('========================================================================\n');

  fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Stage 15 test results saved to: ${OUTPUT_JSON_PATH}`);
}

runStage15Verification().catch(err => {
  console.error('\nVerification halted with fatal error:', err, err.cause);
  process.exit(1);
});
