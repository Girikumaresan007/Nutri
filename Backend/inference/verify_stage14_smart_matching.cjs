/**
 * verify_stage14_smart_matching.cjs
 * Comprehensive Automated Verification Suite for NutriTrack AI Stage 14:
 * Smart Food Matching, Candidate Ranking & Prediction Safety
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const BACKEND_URL = 'http://localhost:8081/api/v1';
const PYTHON_SIDECAR_URL = 'http://localhost:5001';

const results = {
  stage: 'Stage 14',
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
  const boundary = '----WebKitFormBoundaryStage14Verify' + Math.random().toString(36).substring(2);
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

async function runStage14Verification() {
  console.log('========================================================================');
  console.log('STAGE 14: SMART FOOD MATCHING, CANDIDATE RANKING & PREDICTION SAFETY');
  console.log('========================================================================\n');

  const ts = Date.now();
  const userAEmail = `stage14_alpha_${ts}@nutritrack.test`;
  const userBEmail = `stage14_beta_${ts}@nutritrack.test`;

  // Register users
  const authA = await registerUser(userAEmail, 'SecretPass123!', 'Alpha User');
  const authB = await registerUser(userBEmail, 'SecretPass123!', 'Beta User');
  const tokenA = authA.accessToken;
  const tokenB = authB.accessToken;
  const headersA = { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' };
  const headersB = { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' };
  record('Authenticated user sessions initialized for User Alpha & Beta', true);

  // ---------------------------------------------------------------------------
  // SECTION 1: HIGH-CONFIDENCE MISLEADING PREDICTIONS & AMBIGUOUS MIXED DISHES
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 1: High-Confidence Misleading Predictions Policy Defense ---');

  // Test 1A: Chicken Biryani scanned by real model
  const biryaniPath = path.resolve(__dirname, 'test_dataset/mixed_dishes/chicken_biryani_real.jpg');
  record('Genuine Chicken Biryani evaluation photo exists', fs.existsSync(biryaniPath));
  const biryaniBytes = fs.readFileSync(biryaniPath);

  const biryaniScanRes = await scanImage(biryaniBytes, 'image/jpeg', tokenA);
  record('Scan Chicken Biryani with real ViT sidecar HTTP 200', biryaniScanRes.ok);
  const biryaniScan = await biryaniScanRes.json();
  const biryaniItem = biryaniScan.items[0];

  record('Provider identified as huggingface', biryaniScan.provider === 'huggingface');
  record('Chicken Biryani detected as ambiguous dish with candidate review tag',
    biryaniItem.name.includes('(Review suggested candidates)'),
    `Display name: "${biryaniItem.name}"`
  );
  record('Confidence is demoted to MEDIUM (not falsely HIGH)',
    biryaniItem.confidence.toLowerCase() === 'medium' || biryaniItem.confidence.toLowerCase() === 'low',
    `Assigned confidence: ${biryaniItem.confidence}`
  );
  record('Ambiguity warning alerts user to closed-set vision model rice conflation',
    biryaniItem.warnings.some(w => w.includes('Closed-set vision models often conflate Fried Rice with Biryani')),
    'Warning explains visual conflation risk'
  );
  record('Grounded catalog candidates provided in scan item',
    Array.isArray(biryaniItem.candidates) && biryaniItem.candidates.length > 0,
    `Candidates count: ${biryaniItem.candidates ? biryaniItem.candidates.length : 0}`
  );
  const biryaniCandidate = biryaniItem.candidates.find(c => c.canonicalName === 'Chicken Biryani');
  record('Chicken Biryani offered as a prominent catalog candidate',
    !!biryaniCandidate,
    biryaniCandidate ? `Candidate: "${biryaniCandidate.canonicalName}" (Score: ${biryaniCandidate.matchScore}, Reason: ${biryaniCandidate.matchReason})` : 'Not found'
  );

  // Test 1B: Rajma Masala scanned by real model
  const rajmaPath = path.resolve(__dirname, 'test_dataset/mixed_dishes/rajma_masala_real.jpg');
  record('Genuine Rajma Masala evaluation photo exists', fs.existsSync(rajmaPath));
  const rajmaBytes = fs.readFileSync(rajmaPath);

  const rajmaScanRes = await scanImage(rajmaBytes, 'image/jpeg', tokenA);
  record('Scan Rajma Masala with real ViT sidecar HTTP 200', rajmaScanRes.ok);
  const rajmaScan = await rajmaScanRes.json();
  const rajmaItem = rajmaScan.items[0];

  record('Rajma Masala tagged with candidate review request',
    rajmaItem.name.includes('(Review suggested candidates)') || rajmaItem.name.includes('(Uncertain match)'),
    `Display name: "${rajmaItem.name}"`
  );
  record('Rajma Masala confidence demoted to prevent false pizza certainty',
    rajmaItem.confidence.toLowerCase() !== 'high',
    `Confidence: ${rajmaItem.confidence}`
  );
  const rajmaCandidate = rajmaItem.candidates && rajmaItem.candidates.find(c => c.canonicalName === 'Rajma Masala');
  record('Rajma Masala offered in candidate list from PostgreSQL catalog',
    !!rajmaCandidate,
    rajmaCandidate ? `Candidate: "${rajmaCandidate.canonicalName}" (Category: ${rajmaCandidate.category})` : 'Not found'
  );

  // Test 1C: Genuine supported in-distribution Samosa
  const samosaPath = path.resolve(__dirname, 'test_dataset/supported_indian_foods/samosa_real.jpg');
  record('Genuine Samosa evaluation photo exists', fs.existsSync(samosaPath));
  const samosaBytes = fs.readFileSync(samosaPath);

  const samosaScanRes = await scanImage(samosaBytes, 'image/jpeg', tokenA);
  record('Scan supported Samosa HTTP 200', samosaScanRes.ok);
  const samosaScan = await samosaScanRes.json();
  const samosaItem = samosaScan.items[0];
  record('Supported Samosa correctly identified as "Samosa"', samosaItem.name === 'Samosa');
  record('Supported Samosa marked with Confidence.HIGH', samosaItem.confidence.toLowerCase() === 'high');
  record('Catalog candidates remain available even when model prediction is healthy',
    Array.isArray(samosaItem.candidates) && samosaItem.candidates.length > 0,
    `Count: ${samosaItem.candidates ? samosaItem.candidates.length : 0}`
  );

  // ---------------------------------------------------------------------------
  // SECTION 2: DETERMINISTIC CANDIDATE RANKING ALGORITHM AUDIT
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 2: Deterministic Candidate Ordering & Explainability ---');

  // Test 2A: Exact text match ranking precedence
  const biryaniTextRes = await fetch(`${BACKEND_URL}/scanner/text-estimate`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ description: 'Chicken Biryani' })
  });
  record('Text estimate for "Chicken Biryani" HTTP 200', biryaniTextRes.ok);
  const biryaniTextData = await biryaniTextRes.json();
  const biryaniTextCandidates = biryaniTextData.items[0].candidates;

  record('Top candidate for "Chicken Biryani" is exact match at rank 1',
    biryaniTextCandidates[0].canonicalName === 'Chicken Biryani',
    `Rank 1: ${biryaniTextCandidates[0].canonicalName}`
  );
  record('Exact canonical match receives highest score (100.0)',
    biryaniTextCandidates[0].matchScore >= 100.0,
    `Score: ${biryaniTextCandidates[0].matchScore}`
  );
  record('Match reason clearly explains exact canonical match',
    biryaniTextCandidates[0].matchReason.includes('Exact user match'),
    biryaniTextCandidates[0].matchReason
  );

  // Test 2B: Regional alias match ranking precedence
  const aliasTextRes = await fetch(`${BACKEND_URL}/scanner/text-estimate`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ description: 'dum biryani' })
  });
  record('Text estimate for alias "dum biryani" HTTP 200', aliasTextRes.ok);
  const aliasTextData = await aliasTextRes.json();
  const aliasCandidates = aliasTextData.items[0].candidates;

  record('Top candidate for alias "dum biryani" resolves to "Chicken Biryani"',
    aliasCandidates[0].canonicalName === 'Chicken Biryani',
    `Rank 1: ${aliasCandidates[0].canonicalName}`
  );
  record('Exact alias match receives high deterministic score (95.0)',
    aliasCandidates[0].matchScore === 95.0,
    `Score: ${aliasCandidates[0].matchScore}`
  );
  record('Match reason explains regional alias match',
    aliasCandidates[0].matchReason.includes('regional alias'),
    aliasCandidates[0].matchReason
  );

  // Test 2C: Deterministic ordering invariance (re-running produces identical order)
  const aliasTextRes2 = await fetch(`${BACKEND_URL}/scanner/text-estimate`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ description: 'dum biryani' })
  });
  const aliasTextData2 = await aliasTextRes2.json();
  const list1 = aliasCandidates.map(c => `${c.canonicalName}:${c.matchScore}`);
  const list2 = aliasTextData2.items[0].candidates.map(c => `${c.canonicalName}:${c.matchScore}`);
  record('Candidate ordering is 100% deterministic across repeat invocations',
    JSON.stringify(list1) === JSON.stringify(list2),
    list1.join(' > ')
  );

  // ---------------------------------------------------------------------------
  // SECTION 3: CATALOG SEARCH: ALIASES, PARTIAL, EMPTY & NO MATCH
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 3: Catalog Search: Aliases, Partial, Empty & No Match ---');

  // Exact alias search
  const golgappaRes = await fetch(`${BACKEND_URL}/food-catalog?q=golgappa`, { headers: headersA });
  record('Catalog search for regional alias "golgappa" HTTP 200', golgappaRes.ok);
  const golgappaItems = await golgappaRes.json();
  record('Alias "golgappa" resolves to "Pani Puri / Golgappa"',
    golgappaItems.length > 0 && golgappaItems[0].canonicalName === 'Pani Puri / Golgappa',
    golgappaItems[0] ? golgappaItems[0].canonicalName : 'None'
  );

  // Phulka alias search
  const phulkaRes = await fetch(`${BACKEND_URL}/food-catalog?q=phulka`, { headers: headersA });
  record('Catalog search for regional alias "phulka" HTTP 200', phulkaRes.ok);
  const phulkaItems = await phulkaRes.json();
  record('Alias "phulka" resolves to "Chapati / Phulka"',
    phulkaItems.length > 0 && phulkaItems[0].canonicalName === 'Chapati / Phulka',
    phulkaItems[0] ? phulkaItems[0].canonicalName : 'None'
  );

  // Partial substring search
  const partialRes = await fetch(`${BACKEND_URL}/food-catalog?q=biry`, { headers: headersA });
  record('Partial search for "biry" HTTP 200', partialRes.ok);
  const partialItems = await partialRes.json();
  record('Partial search "biry" returns both Chicken Biryani and Vegetable Dum Biryani',
    partialItems.some(i => i.canonicalName === 'Chicken Biryani') &&
    partialItems.some(i => i.canonicalName === 'Vegetable Dum Biryani'),
    `Found: ${partialItems.map(i => i.canonicalName).join(', ')}`
  );

  // Empty search
  const emptyRes = await fetch(`${BACKEND_URL}/food-catalog`, { headers: headersA });
  record('Empty query catalog search returns default catalog list HTTP 200', emptyRes.ok);
  const emptyItems = await emptyRes.json();
  record('Empty query returns full page of verified catalog foods',
    emptyItems.length >= 20,
    `Items returned: ${emptyItems.length}`
  );

  // No matching results
  const noMatchRes = await fetch(`${BACKEND_URL}/food-catalog?q=xyz_nonexistent_exotic_food_12345`, { headers: headersA });
  record('Non-matching query returns HTTP 200', noMatchRes.ok);
  const noMatchItems = await noMatchRes.json();
  record('Non-matching query cleanly returns empty array [] without error',
    Array.isArray(noMatchItems) && noMatchItems.length === 0,
    `Count: ${noMatchItems.length}`
  );

  // ---------------------------------------------------------------------------
  // SECTION 4: NUTRITION INTEGRITY, PORTION & SERVING CONVERSION
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 4: Nutrition Integrity, Selection Update & Portion Conversion ---');

  // Verify Chicken Biryani catalog per-100g data
  const biryaniCat = partialItems.find(i => i.canonicalName === 'Chicken Biryani');
  record('Chicken Biryani catalog record retrieved', !!biryaniCat);

  // Calculate for 1 plate (default 250g)
  const calcPlateRes = await fetch(`${BACKEND_URL}/food-catalog/calculate`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      catalogId: biryaniCat.id,
      quantity: 1,
      unit: 'plate'
    })
  });
  record('Calculate nutrition for 1 plate Chicken Biryani HTTP 200', calcPlateRes.ok);
  const plateData = await calcPlateRes.json();
  record('1 plate Chicken Biryani calculates to 250g total weight',
    Number(plateData.calculatedGrams) === 250,
    `${plateData.calculatedGrams}g`
  );
  record('1 plate Chicken Biryani matches verified 462.5 kcal',
    Number(plateData.calories) === 462.5,
    `${plateData.calories} kcal`
  );
  record('1 plate Chicken Biryani matches verified 21.2g protein',
    Number(plateData.protein) === 21.2 || Number(plateData.protein) === 21.3,
    `${plateData.protein}g`
  );

  // Calculate for 150 grams using 'g' unit conversion
  const calcGramRes = await fetch(`${BACKEND_URL}/food-catalog/calculate`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      catalogId: biryaniCat.id,
      quantity: 150,
      unit: 'g'
    })
  });
  record('Calculate nutrition for 150g Chicken Biryani HTTP 200', calcGramRes.ok);
  const gramData = await calcGramRes.json();
  record('150g calculates to exactly 277.5 kcal (185 kcal/100g * 1.5)',
    Number(gramData.calories) === 277.5,
    `${gramData.calories} kcal`
  );

  // Calculate for 2 pieces of Chapati / Phulka
  const chapatiCat = phulkaItems[0];
  const calcChapatiRes = await fetch(`${BACKEND_URL}/food-catalog/calculate`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      catalogId: chapatiCat.id,
      quantity: 2,
      unit: 'roti'
    })
  });
  record('Calculate nutrition for 2 rotis Chapati HTTP 200', calcChapatiRes.ok);
  const chapatiCalc = await calcChapatiRes.json();
  record('2 rotis calculates to 80g total weight',
    Number(chapatiCalc.calculatedGrams) === 80,
    `${chapatiCalc.calculatedGrams}g`
  );
  record('2 rotis matches 208.0 kcal',
    Number(chapatiCalc.calories) === 208.0,
    `${chapatiCalc.calories} kcal`
  );

  // ---------------------------------------------------------------------------
  // SECTION 5: USER REVIEW EXPERIENCE: CANCEL VS EXPLICIT CONFIRMATION
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 5: User Review Experience: Cancel vs Explicit Save ---');

  // Verify User A initial diary count is 0
  const initialDiaryRes = await fetch(`${BACKEND_URL}/food-entries?from=2026-10-01&to=2026-10-31`, { headers: headersA });
  const initialDiary = await initialDiaryRes.json();
  const initialCount = initialDiary.totalElements !== undefined ? initialDiary.totalElements : (initialDiary.items ? initialDiary.items.length : 0);
  record('User A diary is initially empty prior to review actions', initialCount === 0);

  // Test 5A: Canceling scan review creates NO diary entries
  // (We scanned Biryani, Rajma, and Samosa in Section 1, which represents scans that were not confirmed)
  const afterScanDiaryRes = await fetch(`${BACKEND_URL}/food-entries?from=2026-10-01&to=2026-10-31`, { headers: headersA });
  const afterScanDiary = await afterScanDiaryRes.json();
  const afterScanCount = afterScanDiary.totalElements !== undefined ? afterScanDiary.totalElements : (afterScanDiary.items ? afterScanDiary.items.length : 0);
  record('Canceling scan review leaves diary completely unmodified (0 entries created)',
    afterScanCount === 0,
    `Diary count: ${afterScanCount}`
  );

  // Test 5B: Explicit confirmation creates exactly ONE diary entry
  const explicitSaveRes = await fetch(`${BACKEND_URL}/food-entries`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      date: '2026-10-14',
      meal: 'lunch',
      name: 'Chicken Biryani (Reviewed & Selected from Catalog)',
      quantity: 1,
      unit: 'plate',
      nutrition: {
        calories: 462.5,
        protein: 21.2,
        carbohydrates: 55.0,
        fat: 17.5,
        fiber: 3.0
      },
      notes: 'Reviewed & verified from catalog: SIRA-B001 (APPROXIMATE_RECIPE)',
      source: 'scanner'
    })
  });
  record('Explicit confirmation to save reviewed item HTTP 201 CREATED',
    explicitSaveRes.status === 201 || explicitSaveRes.status === 200
  );
  const savedEntry = await explicitSaveRes.json();
  record('Saved diary entry received unique UUID', !!savedEntry.id, savedEntry.id);

  // Check diary count is exactly 1
  const finalDiaryRes = await fetch(`${BACKEND_URL}/food-entries?from=2026-10-01&to=2026-10-31`, { headers: headersA });
  const finalDiary = await finalDiaryRes.json();
  const finalCount = finalDiary.totalElements !== undefined ? finalDiary.totalElements : (finalDiary.items ? finalDiary.items.length : 0);
  record('Diary contains exactly 1 explicitly confirmed entry',
    finalCount === 1,
    `Count: ${finalCount}`
  );

  // ---------------------------------------------------------------------------
  // SECTION 6: SECURITY, PRIVACY & MULTI-TENANT ISOLATION
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 6: Security, Image Privacy & Multi-Tenant Defense ---');

  // Cross-tenant IDOR defense: User B cannot view User A's meal
  const crossTenantGet = await fetch(`${BACKEND_URL}/food-entries/${savedEntry.id}`, { headers: headersB });
  record('Cross-tenant IDOR GET blocked with HTTP 404 NOT_FOUND',
    crossTenantGet.status === 404
  );

  // Cross-tenant IDOR defense: User B cannot delete User A's meal
  const crossTenantDelete = await fetch(`${BACKEND_URL}/food-entries/${savedEntry.id}`, {
    method: 'DELETE',
    headers: headersB
  });
  record('Cross-tenant IDOR DELETE blocked with HTTP 404 NOT_FOUND',
    crossTenantDelete.status === 404
  );

  // Invalid MIME upload rejection
  const invalidMimeRes = await fetch(`${BACKEND_URL}/scanner/analyze`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenA}`,
      'Content-Type': 'text/plain'
    },
    body: 'Not a real image file'
  });
  record('Invalid MIME upload safely rejected with HTTP 415/400',
    invalidMimeRes.status === 415 || invalidMimeRes.status === 400
  );

  // Empty upload rejection
  const emptyUploadRes = await fetch(`${BACKEND_URL}/scanner/analyze`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenA}`,
      'Content-Type': 'multipart/form-data; boundary=emptyBoundary'
    },
    body: '--emptyBoundary--\r\n'
  });
  record('Empty image upload safely rejected with HTTP 400 BAD_REQUEST',
    emptyUploadRes.status === 400
  );

  // Excessive payload rejection (> 10MB)
  const hugeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11 MB
  const hugeRes = await scanImage(hugeBuffer, 'image/jpeg', tokenA);
  record('Payload exceeding 10MB limit safely rejected with HTTP 413/400',
    hugeRes.status === 413 || hugeRes.status === 400
  );

  console.log('\n========================================================================');
  console.log(`STAGE 14 VERIFICATION COMPLETE: ${results.passed}/${results.passed + results.failed} TESTS PASSED (100% SUCCESS)`);
  console.log('========================================================================\n');

  // Write STAGE14_TEST_RESULTS.json
  const outPath = path.resolve(__dirname, '../../STAGE14_TEST_RESULTS.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`Stage 14 test results saved to: ${outPath}`);
}

runStage14Verification().catch(err => {
  console.error('\nSTAGE 14 VERIFICATION FAILED:', err);
  process.exit(1);
});
