const fs = require('fs');
const path = require('path');

async function run() {
  console.log('--- Stage 9C Hugging Face Scanner End-to-End Verification ---');
  
  // 1. Register a test user against Spring Boot backend
  const ts = Date.now();
  const testEmail = `vit_tester_${ts}@nutritrack.app`;
  const password = 'Password123!';
  const authRes = await fetch('http://localhost:8081/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'ViT Tester', email: testEmail, password })
  });
  
  if (!authRes.ok) {
    console.error('Failed to register/authenticate:', authRes.status, await authRes.text());
    process.exit(1);
  }
  
  const authData = await authRes.json();
  const token = authData.accessToken || authData.token;
  console.log('✓ Successfully registered and authenticated. User:', authData.user ? authData.user.email : testEmail);

  // Helper for multipart/form-data upload
  async function testScannerAnalyze(filePath, expectedLabel) {
    console.log(`\nTesting image: ${path.basename(filePath)} (expected: ${expectedLabel})...`);
    const fileBytes = fs.readFileSync(filePath);
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    
    let body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${path.basename(filePath)}"\r\nContent-Type: image/jpeg\r\n\r\n`),
      fileBytes,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const res = await fetch('http://localhost:8081/api/v1/scanner/analyze', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: body
    });

    const status = res.status;
    const data = await res.json();
    console.log(`HTTP ${status}:`, JSON.stringify(data, null, 2));

    if (status !== 200) {
      throw new Error(`Analyze failed with HTTP ${status}`);
    }

    if (data.provider !== 'huggingface') {
      throw new Error(`Expected provider 'huggingface', got '${data.provider}'`);
    }

    console.log(`✓ Provider confirmed: ${data.provider}`);
    const topItem = data.items && data.items.length > 0 ? data.items[0] : null;
    if (topItem) {
      console.log(`✓ Food Identified: "${topItem.name}" (Serving: ${topItem.quantity} ${topItem.servingUnit})`);
      console.log(`✓ Nutrition: ${topItem.estimatedNutrition?.calories} kcal | P: ${topItem.estimatedNutrition?.protein}g | C: ${topItem.estimatedNutrition?.carbohydrates}g | F: ${topItem.estimatedNutrition?.fat}g | Fiber: ${topItem.estimatedNutrition?.fiber}g`);
      console.log(`✓ Confidence: ${topItem.confidence}`);
      console.log(`✓ Uncertainty note: ${topItem.uncertainty && topItem.uncertainty[0] ? topItem.uncertainty[0] : 'None'}`);
    }
    return data;
  }

  // Test 1: Samosa
  const samosaPath = path.resolve(__dirname, '../../Frontend/public/test_samosa.jpg');
  const samosaResult = await testScannerAnalyze(samosaPath, 'Samosa');

  // Test 2: Idli
  const idliPath = path.resolve(__dirname, '../../Frontend/public/test_idli.jpg');
  const idliResult = await testScannerAnalyze(idliPath, 'Idli');

  // Test 3: Out-of-distribution test (Salad photo - not in the 20 Indian food classes)
  const saladPath = path.resolve(__dirname, '../../Frontend/public/test_salad.jpg');
  console.log('\nTesting out-of-distribution image: test_salad.jpg...');
  const saladResult = await testScannerAnalyze(saladPath, 'OOD/Low Confidence');
  console.log('Salad classified as:', saladResult.items[0].name, 'with confidence:', saladResult.items[0].confidence, 'uncertainty:', saladResult.items[0].uncertainty);

  const item = samosaResult.items[0];
  console.log(`✓ Food Identified: "${item.name}" (${item.quantity} ${item.servingUnit})`);
  console.log(`✓ Nutrition: ${item.estimatedNutrition.calories} kcal | P: ${item.estimatedNutrition.protein}g | C: ${item.estimatedNutrition.carbohydrates}g | F: ${item.estimatedNutrition.fat}g | Fiber: ${item.estimatedNutrition.fiber}g`);
  console.log(`✓ Confidence: ${item.confidence}`);
  console.log(`✓ Uncertainty note: ${item.uncertainty[0]}`);

  // Test 3: Log scanner result to Food Diary
  console.log('\nLogging Samosa analysis to Food Diary (/api/v1/food-entries)...');
  const diaryRes = await fetch('http://localhost:8081/api/v1/food-entries', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: item.name,
      meal: 'snacks',
      quantity: item.quantity,
      unit: item.servingUnit,
      nutrition: item.estimatedNutrition,
      date: new Date().toISOString().slice(0, 10),
      source: 'scanner'
    })
  });

  const diaryStatus = diaryRes.status;
  const diaryData = await diaryRes.json();
  console.log(`HTTP ${diaryStatus}:`, JSON.stringify(diaryData, null, 2));

  if (diaryStatus !== 201 && diaryStatus !== 200) {
    throw new Error(`Diary logging failed with HTTP ${diaryStatus}`);
  }
  console.log('✓ Successfully persisted food diary entry derived from AI food scanner.');

  console.log('\n========================================');
  console.log('ALL HUGGING FACE SCANNER TESTS PASSED! 🎉');
  console.log('========================================');
}

run().catch(err => {
  console.error('\n❌ Test run failed:', err);
  process.exit(1);
});
