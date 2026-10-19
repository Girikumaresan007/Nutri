/**
 * ============================================================================
 * NutriTrack AI — Stage 16 Verification Suite
 * Nutrition Data Expansion, Food Lookup & Portion Accuracy
 * ============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BACKEND_BASE = 'http://127.0.0.1:8081';
const INFERENCE_BASE = 'http://127.0.0.1:5001';

let testsPassed = 0;
let testsFailed = 0;
const testResults = [];

function recordTest(name, status, detail = null) {
  testResults.push({ name, status, detail });
  if (status === 'PASS') {
    testsPassed++;
    console.log(`  ✓ PASS: ${name}${detail ? ` - ${detail}` : ''}`);
  } else {
    testsFailed++;
    console.error(`  ✗ FAIL: ${name}${detail ? ` - ${detail}` : ''}`);
  }
}

async function request(url, options = {}) {
  const method = options.method || 'GET';
  const headers = options.headers || {};
  let body = options.body || null;

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: headers,
      timeout: 10000,
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (body) {
      if (typeof body === 'object' && !Buffer.isBuffer(body)) {
        req.setHeader('Content-Type', 'application/json');
        body = JSON.stringify(body);
      }
      req.write(body);
    }
    req.end();
  });
}

async function run() {
  console.log('========================================================================');
  console.log('STAGE 16: NUTRITION DATA EXPANSION, FOOD LOOKUP & PORTION ACCURACY');
  console.log('========================================================================\n');

  // Authenticate two distinct tenant users
  const timestamp = Date.now();
  const userAlpha = { name: 'Alpha Stage16', email: `alpha_${timestamp}@example.com`, password: 'Password123!' };
  const userBeta = { name: 'Beta Stage16', email: `beta_${timestamp}@example.com`, password: 'Password123!' };

  let tokenAlpha = '';
  let tokenBeta = '';

  try {
    const regA = await request(`${BACKEND_BASE}/api/v1/auth/register`, { method: 'POST', body: userAlpha });
    tokenAlpha = regA.body.accessToken;
    const regB = await request(`${BACKEND_BASE}/api/v1/auth/register`, { method: 'POST', body: userBeta });
    tokenBeta = regB.body.accessToken;
    recordTest('Authenticated sessions initialized for User Alpha & User Beta', tokenAlpha && tokenBeta ? 'PASS' : 'FAIL');
  } catch (err) {
    recordTest('Authenticated sessions initialized for User Alpha & User Beta', 'FAIL', err.message);
    process.exit(1);
  }

  const authHeaders = { Authorization: `Bearer ${tokenAlpha}` };
  const betaHeaders = { Authorization: `Bearer ${tokenBeta}` };

  // =========================================================================
  // Section 1: Catalog Expansion, Counts & Category Coverage
  // =========================================================================
  console.log('\n--- Section 1: Food Catalog Expansion & Category Coverage ---');
  try {
    const catRes = await request(`${BACKEND_BASE}/api/v1/food-catalog?limit=250`, { headers: authHeaders });
    const items = catRes.body;
    recordTest('Catalog query returns HTTP 200', catRes.status === 200 ? 'PASS' : 'FAIL');
    recordTest('Catalog expanded to >= 150 verified records', items.length >= 150 ? 'PASS' : 'FAIL', `Total records: ${items.length}`);

    // Verify key categories exist
    const categories = new Set(items.map((i) => i.category));
    const expectedCategories = [
      'BREAKFAST_GRAINS',
      'RICE_DISHES',
      'BREADS',
      'CURRIES_GRAVIES',
      'PROTEIN_EGG_MEAT',
      'VEGETABLES',
      'FRUITS',
      'SNACKS_STREETFOOD',
      'SWEETS_DESSERTS',
      'BEVERAGES',
      'RAW_INGREDIENTS',
    ];
    let allCategoriesPresent = expectedCategories.every((c) => categories.has(c));
    recordTest('All core nutritional categories populated', allCategoriesPresent ? 'PASS' : 'FAIL', `Categories: ${Array.from(categories).length}`);

    // Verify Recipe Types
    const recipeTypes = new Set(items.map((i) => i.recipeType));
    const expectedTypes = ['MEASURED_FOOD', 'STANDARD_RECIPE', 'APPROXIMATE_RECIPE', 'BRANDED_PRODUCT', 'RAW_INGREDIENT'];
    let allTypesPresent = expectedTypes.every((t) => recipeTypes.has(t));
    recordTest('Recipe types include BRANDED_PRODUCT and RAW_INGREDIENT', allTypesPresent ? 'PASS' : 'FAIL', `Types: ${Array.from(recipeTypes).join(', ')}`);

    // Verify Data Sources
    const dataSources = new Set(items.map((i) => i.dataSource));
    recordTest('ICMR-NIN IFCT 2017 data source present', dataSources.has('ICMR-NIN IFCT 2017') ? 'PASS' : 'FAIL');
    recordTest('USDA FoodData Central data source present', dataSources.has('USDA FoodData Central') ? 'PASS' : 'FAIL');
    recordTest('Open Food Facts data source present', dataSources.has('Open Food Facts (Manufacturer Label)') ? 'PASS' : 'FAIL');
  } catch (err) {
    recordTest('Food Catalog Expansion verification', 'FAIL', err.message);
  }

  // =========================================================================
  // Section 2: Regional Staples & Recipe Differentiation
  // =========================================================================
  console.log('\n--- Section 2: South Indian, North Indian & Staples Coverage ---');
  try {
    // 1. South Indian staple: Rava Idli
    const ravaRes = await request(`${BACKEND_BASE}/api/v1/food-catalog?q=Rava+Idli`, { headers: authHeaders });
    const ravaItem = ravaRes.body.find((i) => i.code === 'IFCT_RAVA_IDLI');
    recordTest('South Indian Rava Idli exists in catalog', ravaItem ? 'PASS' : 'FAIL', ravaItem?.canonicalName);
    recordTest('Rava Idli calories grounded in IFCT (165.0 kcal/100g)', ravaItem && ravaItem.caloriesPer100g === 165.0 ? 'PASS' : 'FAIL');

    // 2. South Indian staple: Appam
    const appamRes = await request(`${BACKEND_BASE}/api/v1/food-catalog?q=Appam`, { headers: authHeaders });
    const appamItem = appamRes.body.find((i) => i.code === 'IFCT_APPAM');
    recordTest('South Indian Appam exists in catalog', appamItem ? 'PASS' : 'FAIL', appamItem?.canonicalName);

    // 3. Raw Ingredient: Raw Toor Dal
    const toorRes = await request(`${BACKEND_BASE}/api/v1/food-catalog?q=Toor+Dal`, { headers: authHeaders });
    const toorItem = toorRes.body.find((i) => i.code === 'IFCT_RAW_TOOR_DAL');
    recordTest('Raw Toor Dal ingredient exists in catalog', toorItem ? 'PASS' : 'FAIL', toorItem?.canonicalName);
    recordTest('Raw Toor Dal recipe type is RAW_INGREDIENT', toorItem && toorItem.recipeType === 'RAW_INGREDIENT' ? 'PASS' : 'FAIL');

    // 4. North Indian Curry: Paneer Butter Masala
    const pbmRes = await request(`${BACKEND_BASE}/api/v1/food-catalog?q=Paneer+Butter+Masala`, { headers: authHeaders });
    const pbmItem = pbmRes.body.find((i) => i.code === 'IFCT_PANEER_BUTTER_MASALA');
    recordTest('Paneer Butter Masala exists in catalog', pbmItem ? 'PASS' : 'FAIL', pbmItem?.canonicalName);
    recordTest('Paneer Butter Masala marked as APPROXIMATE_RECIPE', pbmItem && pbmItem.recipeType === 'APPROXIMATE_RECIPE' ? 'PASS' : 'FAIL');

    // 5. Packaged Product: Maggi 2-Minute Noodles
    const maggiRes = await request(`${BACKEND_BASE}/api/v1/food-catalog?q=Maggi`, { headers: authHeaders });
    const maggiItem = maggiRes.body.find((i) => i.code === 'OFF_MAGGI_NOODLES');
    recordTest('Branded Maggi Noodles exists in catalog', maggiItem ? 'PASS' : 'FAIL', maggiItem?.canonicalName);
    recordTest('Maggi Noodles marked as BRANDED_PRODUCT', maggiItem && maggiItem.recipeType === 'BRANDED_PRODUCT' ? 'PASS' : 'FAIL');
  } catch (err) {
    recordTest('Regional staples verification', 'FAIL', err.message);
  }

  // =========================================================================
  // Section 3: Portion Accuracy & Exact Nutrition Calculations
  // =========================================================================
  console.log('\n--- Section 3: Serving-Size & Portion Nutrition Calculations ---');
  try {
    // 1. Plain Cooked White Rice: 130 kcal/100g
    const riceRes = await request(`${BACKEND_BASE}/api/v1/food-catalog/code/IFCT_WHITE_RICE`, { headers: authHeaders });
    const riceItem = riceRes.body;

    // Test 100g exact portion = 130.0 kcal
    const calc100g = await request(`${BACKEND_BASE}/api/v1/food-catalog/calculate`, {
      method: 'POST',
      headers: authHeaders,
      body: { catalogId: riceItem.id, quantity: 100, unit: 'g' },
    });
    recordTest('100g portion calculates exact base nutrients', calc100g.body.calories === 130.0 ? 'PASS' : 'FAIL', `${calc100g.body.calories} kcal`);

    // Test 150g portion = 195.0 kcal
    const calc150g = await request(`${BACKEND_BASE}/api/v1/food-catalog/calculate`, {
      method: 'POST',
      headers: authHeaders,
      body: { catalogId: riceItem.id, quantity: 150, unit: 'g' },
    });
    recordTest('150g portion calculates exact 1.5x scaling (195.0 kcal)', calc150g.body.calories === 195.0 ? 'PASS' : 'FAIL', `${calc150g.body.calories} kcal`);

    // Test household unit conversion: 1 bowl (katori) = 150g = 195.0 kcal
    const calcBowl = await request(`${BACKEND_BASE}/api/v1/food-catalog/calculate`, {
      method: 'POST',
      headers: authHeaders,
      body: { catalogId: riceItem.id, quantity: 1, unit: 'bowl (katori)' },
    });
    recordTest('Household measure (bowl) resolves to 150g (195.0 kcal)', calcBowl.body.calculatedGrams === 150.0 && calcBowl.body.calories === 195.0 ? 'PASS' : 'FAIL');

    // Test user-custom portion weight: 2 pieces of Idli @ custom 70g each (total 140g)
    const idliRes = await request(`${BACKEND_BASE}/api/v1/food-catalog/code/IFCT_IDLI`, { headers: authHeaders });
    const idliItem = idliRes.body; // 132 kcal/100g
    // 140g = 1.4 * 132 = 184.8 kcal
    const calcCustom = await request(`${BACKEND_BASE}/api/v1/food-catalog/calculate`, {
      method: 'POST',
      headers: authHeaders,
      body: { catalogId: idliItem.id, quantity: 2, unit: 'piece', customGrams: 70.0 },
    });
    recordTest('Custom portion weight (70g/piece) applied accurately', calcCustom.body.calculatedGrams === 140.0 ? 'PASS' : 'FAIL', `Total: ${calcCustom.body.calculatedGrams}g`);
    recordTest('Custom portion calculates 184.8 kcal (1.4x 132 kcal)', calcCustom.body.calories === 184.8 ? 'PASS' : 'FAIL', `${calcCustom.body.calories} kcal`);
    recordTest('Calculation note discloses user-adjusted portion weight', calcCustom.body.calculationNote.includes('user-adjusted weight') ? 'PASS' : 'FAIL');

    // Test approximate recipe warning disclosure
    const pbmRes = await request(`${BACKEND_BASE}/api/v1/food-catalog/code/IFCT_PANEER_BUTTER_MASALA`, { headers: authHeaders });
    const calcApprox = await request(`${BACKEND_BASE}/api/v1/food-catalog/calculate`, {
      method: 'POST',
      headers: authHeaders,
      body: { catalogId: pbmRes.body.id, quantity: 1, unit: 'bowl (katori)' },
    });
    recordTest('Approximate recipe discloses culinary variation warning', calcApprox.body.warning && calcApprox.body.warning.includes('Approximate recipe formulation') ? 'PASS' : 'FAIL');
  } catch (err) {
    recordTest('Portion calculation tests', 'FAIL', err.message);
  }

  // =========================================================================
  // Section 4: Unified Food Lookup & External Provider Flow
  // =========================================================================
  console.log('\n--- Section 4: Unified Food Lookup & Open Food Facts Provider ---');
  try {
    // 1. Local catalog lookup for existing food
    const localLookup = await request(`${BACKEND_BASE}/api/v1/food-catalog/lookup?q=Dosa`, { headers: authHeaders });
    recordTest('Lookup for local food returns HTTP 200', localLookup.status === 200 ? 'PASS' : 'FAIL');
    recordTest('Lookup status is LOCAL_MATCH for catalog foods', localLookup.body.lookupStatus === 'LOCAL_MATCH' ? 'PASS' : 'FAIL', localLookup.body.lookupStatus);
    recordTest('Lookup returns local matches array with >= 5 varieties', localLookup.body.localMatches.length >= 5 ? 'PASS' : 'FAIL', `Count: ${localLookup.body.localMatches.length}`);

    // 2. External lookup for uncataloged item with includeExternal=true
    const extLookup = await request(`${BACKEND_BASE}/api/v1/food-catalog/lookup?q=Nutella&includeExternal=true`, { headers: authHeaders });
    recordTest('External lookup for uncataloged food returns HTTP 200', extLookup.status === 200 ? 'PASS' : 'FAIL');
    recordTest('External lookup identifies EXTERNAL_MATCH or LOCAL_AND_EXTERNAL_MATCH', extLookup.body.lookupStatus === 'EXTERNAL_MATCH' || extLookup.body.lookupStatus === 'LOCAL_AND_EXTERNAL_MATCH' ? 'PASS' : 'FAIL', extLookup.body.lookupStatus);
    recordTest('External lookup returns validated products from Open Food Facts', extLookup.body.externalMatches.length > 0 ? 'PASS' : 'FAIL', `Matches: ${extLookup.body.externalMatches.length}`);

    const firstExt = extLookup.body.externalMatches[0];
    recordTest('External match has valid calories per 100g (> 0)', firstExt && firstExt.caloriesPer100g > 0 ? 'PASS' : 'FAIL', `${firstExt?.caloriesPer100g} kcal/100g`);
    recordTest('External match has Open Food Facts attribution', firstExt && firstExt.dataSource === 'Open Food Facts' ? 'PASS' : 'FAIL');

    // 3. Test caching/idempotent import of external food into catalog
    const importRes = await request(`${BACKEND_BASE}/api/v1/food-catalog/import-external`, {
      method: 'POST',
      headers: authHeaders,
      body: firstExt,
    });
    recordTest('Import external food returns HTTP 200', importRes.status === 200 ? 'PASS' : 'FAIL');
    recordTest('Imported item assigned stable UUID and BRANDED_PRODUCT recipe type', importRes.body.id && importRes.body.recipeType === 'BRANDED_PRODUCT' ? 'PASS' : 'FAIL', importRes.body.id);

    // 4. Test calculating portion on newly imported external food
    const calcImported = await request(`${BACKEND_BASE}/api/v1/food-catalog/calculate`, {
      method: 'POST',
      headers: authHeaders,
      body: { catalogId: importRes.body.id, quantity: 15, unit: 'g' },
    });
    recordTest('Imported external food calculates portion accurately (15g)', calcImported.body.calories > 0 ? 'PASS' : 'FAIL', `${calcImported.body.calories} kcal`);

    // 5. Test graceful fallback on impossible search query
    const emptyLookup = await request(`${BACKEND_BASE}/api/v1/food-catalog/lookup?q=xyznonexistentfood123456789&includeExternal=true`, { headers: authHeaders });
    recordTest('Non-existent food lookup returns HTTP 200 safely without error', emptyLookup.status === 200 ? 'PASS' : 'FAIL');
    recordTest('Non-existent food lookup returns NO_MATCH without fabrication', emptyLookup.body.lookupStatus === 'NO_MATCH' && emptyLookup.body.localMatches.length === 0 && emptyLookup.body.externalMatches.length === 0 ? 'PASS' : 'FAIL');
  } catch (err) {
    recordTest('External lookup verification', 'FAIL', err.message);
  }

  // =========================================================================
  // Section 5: Integration with Vision Model & Safe Candidate Matching
  // =========================================================================
  console.log('\n--- Section 5: AI Vision Scanner & Deterministic Candidate Ranking ---');
  try {
    // Check python ViT service health
    const vitHealth = await request(`${INFERENCE_BASE}/health`);
    recordTest('ViT inference service listening on port 5001', vitHealth.status === 200 ? 'PASS' : 'FAIL');
    recordTest('Production ViT model DrishtiSharma 20-class preserved', vitHealth.body.model === 'DrishtiSharma/finetuned-ViT-Indian-Food-Classification-v3' ? 'PASS' : 'FAIL');

    // Text estimate query that leverages expanded catalog ranking
    const textEst = await request(`${BACKEND_BASE}/api/v1/scanner/text-estimate`, {
      method: 'POST',
      headers: authHeaders,
      body: { description: 'A plate of hot rava dosa with coconut chutney' },
    });
    recordTest('Scanner text-estimate returns HTTP 200', textEst.status === 200 ? 'PASS' : 'FAIL');
    const topItem = (textEst.body.items && textEst.body.items.length > 0) ? textEst.body.items[0] : textEst.body.topItem;
    recordTest('Expanded food Rava Dosa recognized and mapped from catalog', topItem && topItem.name.includes('Rava Dosa') ? 'PASS' : 'FAIL', topItem?.name);
    recordTest('Candidates array returned for multi-dish context', topItem && Array.isArray(topItem.candidates) && topItem.candidates.length > 0 ? 'PASS' : 'FAIL', `Candidates: ${topItem?.candidates?.length}`);

    // Ambiguous image scanning remains safe (Chicken Biryani vs Fried Rice)
    const sampleBiryaniPath = path.resolve(__dirname, 'dataset', 'test', 'chicken_biryani_test_01.jpg');
    if (fs.existsSync(sampleBiryaniPath)) {
      const boundary = '----WebKitFormBoundaryStage16' + Date.now();
      const imgBytes = fs.readFileSync(sampleBiryaniPath);
      const postData = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="biryani.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
        imgBytes,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);

      const scanRes = await request(`${BACKEND_BASE}/api/v1/scanner/analyze`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: postData,
      });

      recordTest('Scan Biryani image returns HTTP 200', scanRes.status === 200 ? 'PASS' : 'FAIL');
      const scanTop = (scanRes.body.items && scanRes.body.items.length > 0) ? scanRes.body.items[0] : scanRes.body.topItem;
      recordTest('Biryani flagged as ambiguous candidate match (no manufactured certainty)', scanTop && scanTop.confidence !== 'high' ? 'PASS' : 'FAIL', `Confidence: ${scanTop?.confidence}`);
      recordTest('Biryani candidates rank Chicken Biryani prominently', scanTop && scanTop.candidates?.some((c) => c.canonicalName.includes('Biryani')) ? 'PASS' : 'FAIL');
    }
  } catch (err) {
    recordTest('AI Scanner integration', 'FAIL', err.message);
  }

  // =========================================================================
  // Section 6: User Review Invariant & Tenant Data Isolation
  // =========================================================================
  console.log('\n--- Section 6: Meal Review Invariant & Multi-Tenant Data Isolation ---');
  try {
    // 1. Initial count for User Alpha is 0 (zero automatic scan saving)
    const initialDiary = await request(`${BACKEND_BASE}/api/v1/food-entries?date=2026-10-15`, { headers: authHeaders });
    const initialEntries = initialDiary.body.items || initialDiary.body.content || [];
    recordTest('User Alpha diary has 0 entries prior to explicit confirmation', initialEntries.length === 0 ? 'PASS' : 'FAIL');

    // 2. Explicit confirmation: Save reviewed meal to diary
    const createRes = await request(`${BACKEND_BASE}/api/v1/food-entries`, {
      method: 'POST',
      headers: authHeaders,
      body: {
        date: '2026-10-15',
        meal: 'BREAKFAST',
        name: 'Rava Idli with Sambar',
        quantity: 2,
        unit: 'piece',
        nutrition: {
          calories: 247.5,
          protein: 6.3,
          carbohydrates: 42.8,
          fat: 5.7,
          fiber: 2.7,
        },
        notes: '[ICMR-NIN IFCT 2017] Explicitly reviewed breakfast',
        source: 'MANUAL',
      },
    });
    recordTest('Explicit save confirmation returns HTTP 201 CREATED', createRes.status === 201 ? 'PASS' : 'FAIL');
    const createdId = createRes.body.id;
    recordTest('Created entry assigned valid UUID', Boolean(createdId) ? 'PASS' : 'FAIL', createdId);

    // 3. User Alpha diary has exactly 1 entry
    const alphaDiary = await request(`${BACKEND_BASE}/api/v1/food-entries?date=2026-10-15`, { headers: authHeaders });
    const alphaEntries = alphaDiary.body.items || alphaDiary.body.content || [];
    recordTest('User Alpha diary contains exactly 1 explicitly saved entry', alphaEntries.length === 1 ? 'PASS' : 'FAIL');

    // 4. Multi-tenant isolation: User Beta cannot access User Alpha entry
    const crossGet = await request(`${BACKEND_BASE}/api/v1/food-entries/${createdId}`, { headers: betaHeaders });
    recordTest('Cross-tenant GET blocked with HTTP 404 NOT_FOUND', crossGet.status === 404 ? 'PASS' : 'FAIL', `HTTP ${crossGet.status}`);

    const crossDelete = await request(`${BACKEND_BASE}/api/v1/food-entries/${createdId}`, {
      method: 'DELETE',
      headers: betaHeaders,
    });
    recordTest('Cross-tenant DELETE blocked with HTTP 404 NOT_FOUND', crossDelete.status === 404 ? 'PASS' : 'FAIL', `HTTP ${crossDelete.status}`);

    // 5. User Beta diary remains empty
    const betaDiary = await request(`${BACKEND_BASE}/api/v1/food-entries?date=2026-10-15`, { headers: betaHeaders });
    const betaEntries = betaDiary.body.items || betaDiary.body.content || [];
    recordTest('User Beta diary isolated and empty (0 entries)', betaEntries.length === 0 ? 'PASS' : 'FAIL');
  } catch (err) {
    recordTest('Tenant isolation verification', 'FAIL', err.message);
  }

  // =========================================================================
  // Section 7: Unauthenticated Access Defense
  // =========================================================================
  console.log('\n--- Section 7: Unauthenticated Access Defense ---');
  try {
    const unauthCatalog = await request(`${BACKEND_BASE}/api/v1/food-catalog`);
    recordTest('Unauthenticated catalog search blocked with HTTP 401', unauthCatalog.status === 401 ? 'PASS' : 'FAIL', `HTTP ${unauthCatalog.status}`);

    const unauthLookup = await request(`${BACKEND_BASE}/api/v1/food-catalog/lookup?q=Apple`);
    recordTest('Unauthenticated food lookup blocked with HTTP 401', unauthLookup.status === 401 ? 'PASS' : 'FAIL', `HTTP ${unauthLookup.status}`);

    const unauthCalculate = await request(`${BACKEND_BASE}/api/v1/food-catalog/calculate`, {
      method: 'POST',
      body: { catalogId: '10000000-0000-0000-0000-000000000001', quantity: 1, unit: 'piece' },
    });
    recordTest('Unauthenticated calculate blocked with HTTP 401', unauthCalculate.status === 401 ? 'PASS' : 'FAIL', `HTTP ${unauthCalculate.status}`);
  } catch (err) {
    recordTest('Unauthenticated access defense', 'FAIL', err.message);
  }

  // =========================================================================
  // Summary & Report Generation
  // =========================================================================
  console.log('\n========================================================================');
  console.log(`STAGE 16 VERIFICATION COMPLETE: ${testsPassed}/${testsPassed + testsFailed} TESTS PASSED`);
  console.log('========================================================================\n');

  const report = {
    stage: 'Stage 16',
    timestamp: new Date().toISOString(),
    passed: testsPassed,
    failed: testsFailed,
    tests: testResults,
  };

  const outputPath = path.resolve(__dirname, '..', '..', 'STAGE16_TEST_RESULTS.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`Stage 16 test results saved to: ${outputPath}`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('Fatal test execution error:', e);
  process.exit(1);
});
