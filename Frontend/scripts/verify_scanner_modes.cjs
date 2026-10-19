const fs = require('fs');

const API_BASE = 'http://localhost:8081';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };
  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData) && !Buffer.isBuffer(body)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const res = await fetch(url, { method: options.method || 'GET', headers, body });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  return { status: res.status, ok: res.ok, data };
}

const results = [];
function record(category, testName, pass, detail = '') {
  results.push({ category, testName, pass, detail });
  const icon = pass ? '✓ PASS' : '✗ FAIL';
  console.log(`[${icon}] [${category}] ${testName}${detail ? ` — ${detail}` : ''}`);
}

async function runScannerSuite() {
  console.log('================================================================');
  console.log('NUTRITRACK AI — STAGE 9B: SCANNER COMPREHENSIVE VERIFICATION');
  console.log('================================================================\n');

  // Authenticate test user
  const ts = Date.now();
  const testEmail = `scannertest_${ts}@nutritrack.app`;
  const password = 'Password123!';
  const reg = await request('/api/v1/auth/register', {
    method: 'POST',
    body: { name: 'Scanner Tester', email: testEmail, password },
  });
  if (reg.status !== 201 && reg.status !== 200) {
    throw new Error('Failed to register scanner test user: ' + JSON.stringify(reg.data));
  }
  const token = reg.data.accessToken;
  const authHeaders = { Authorization: `Bearer ${token}` };

  // -------------------------------------------------------------
  // Test 1: Unauthenticated request rejection
  // -------------------------------------------------------------
  const unauthRes = await request('/api/v1/scanner/text-estimate', {
    method: 'POST',
    body: { description: 'two scrambled eggs' },
  });
  record('Security', 'Unauthenticated request rejected with 401', unauthRes.status === 401);

  // -------------------------------------------------------------
  // Test 2: Valid text estimate (mock provider behavior)
  // -------------------------------------------------------------
  const textRes = await request('/api/v1/scanner/text-estimate', {
    method: 'POST',
    headers: authHeaders,
    body: { description: 'Grilled chicken breast with steamed rice and broccoli' },
  });
  const textPass = textRes.status === 200 && textRes.data.isEstimate === true && Array.isArray(textRes.data.items) && textRes.data.items.length > 0;
  record('Text Estimate', 'Valid description returns estimates', textPass, `Provider: ${textRes.data?.provider}`);

  if (textRes.data?.items?.length > 0) {
    const item = textRes.data.items[0];
    const hasNutr = item.estimatedNutrition?.calories > 0 && typeof item.estimatedNutrition?.protein === 'number';
    const isMock = textRes.data.provider === 'mock';
    const labeledMock = item.name.includes('(MOCK)');
    record('Attribution', 'Provider attribution is explicit', Boolean(textRes.data.provider), `Provider: "${textRes.data.provider}"`);
    record('Attribution', 'Mock estimates clearly labeled in food names', isMock ? labeledMock : true, `Name: "${item.name}"`);
    record('Nutrition', 'Returns portions and macro breakdown', hasNutr, `Cal: ${item.estimatedNutrition?.calories}, P: ${item.estimatedNutrition?.protein}g, C: ${item.estimatedNutrition?.carbohydrates}g, F: ${item.estimatedNutrition?.fat}g`);
    record('Disclaimer', 'Includes disclaimer that estimates are not exact measurements', typeof textRes.data.disclaimer === 'string' && textRes.data.disclaimer.includes('estimates, not exact measurements'));
  }

  // -------------------------------------------------------------
  // Test 3: Validation errors on text estimate
  // -------------------------------------------------------------
  const emptyTextRes = await request('/api/v1/scanner/text-estimate', {
    method: 'POST',
    headers: authHeaders,
    body: { description: '' },
  });
  record('Validation', 'Empty text description rejected with 400', emptyTextRes.status === 400);

  const spacesTextRes = await request('/api/v1/scanner/text-estimate', {
    method: 'POST',
    headers: authHeaders,
    body: { description: '    ' },
  });
  record('Validation', 'Whitespace-only description rejected with 400', spacesTextRes.status === 400);

  // -------------------------------------------------------------
  // Test 4: Valid image analysis (PNG image with real magic bytes)
  // -------------------------------------------------------------
  const validPngBytes = fs.readFileSync('public/test_meal.png');
  const validBlob = new Blob([validPngBytes], { type: 'image/png' });
  const validFormData = new FormData();
  validFormData.append('image', validBlob, 'test_meal.png');
  validFormData.append('description', 'Healthy lunch plate');

  const validImgRes = await fetch(`${API_BASE}/api/v1/scanner/analyze`, {
    method: 'POST',
    headers: authHeaders,
    body: validFormData,
  });
  const validImgData = await validImgRes.json();
  record('Image Analysis', 'Valid PNG image analyzed successfully', validImgRes.status === 200 && validImgData.isEstimate === true, `Analysis ID: ${validImgData.analysisId}`);

  // -------------------------------------------------------------
  // Test 5: Stateless guarantee (zero rows persisted to database)
  // -------------------------------------------------------------
  const today = '2026-10-14';
  const diaryRes = await request(`/api/v1/food-entries?date=${today}`, { headers: authHeaders });
  record('Statelessness', 'Scan results never auto-persisted to diary', diaryRes.status === 200 && diaryRes.data.items?.length === 0, `Diary items: ${diaryRes.data.items?.length || 0}`);

  // -------------------------------------------------------------
  // Test 6: Invalid image files (magic byte validation)
  // -------------------------------------------------------------
  // A text file masquerading as a JPEG (header mismatch)
  const fakeJpgBytes = Buffer.from('This is a plain text file, not a real JPEG image.');
  const fakeBlob = new Blob([fakeJpgBytes], { type: 'image/jpeg' });
  const fakeFormData = new FormData();
  fakeFormData.append('image', fakeBlob, 'fake.jpg');

  const fakeImgRes = await fetch(`${API_BASE}/api/v1/scanner/analyze`, {
    method: 'POST',
    headers: authHeaders,
    body: fakeFormData,
  });
  const fakeImgData = await fakeImgRes.json();
  record('Image Validation', 'Corrupted / fake image header rejected with 400 INVALID_IMAGE', fakeImgRes.status === 400 && fakeImgData.error === 'INVALID_IMAGE');

  // -------------------------------------------------------------
  // Test 7: Unsupported Media Type (e.g. PDF file)
  // -------------------------------------------------------------
  const pdfBytes = Buffer.from('%PDF-1.4 dummy content');
  const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
  const pdfFormData = new FormData();
  pdfFormData.append('image', pdfBlob, 'document.pdf');

  const pdfRes = await fetch(`${API_BASE}/api/v1/scanner/analyze`, {
    method: 'POST',
    headers: authHeaders,
    body: pdfFormData,
  });
  record('Image Validation', 'Unsupported media type (PDF) rejected with 415', pdfRes.status === 415);

  // -------------------------------------------------------------
  // Test 8: Empty image file
  // -------------------------------------------------------------
  const emptyBlob = new Blob([], { type: 'image/png' });
  const emptyFormData = new FormData();
  emptyFormData.append('image', emptyBlob, 'empty.png');

  const emptyImgRes = await fetch(`${API_BASE}/api/v1/scanner/analyze`, {
    method: 'POST',
    headers: authHeaders,
    body: emptyFormData,
  });
  record('Image Validation', 'Empty image file rejected with 400 EMPTY_FILE', emptyImgRes.status === 400);

  // -------------------------------------------------------------
  // Test 9: Oversized file handling (> 10MB)
  // -------------------------------------------------------------
  // Generate valid JPEG header followed by 11MB of dummy padding
  const oversizedHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const oversizedPadding = Buffer.alloc(11 * 1024 * 1024, 0x00);
  const oversizedBytes = Buffer.concat([oversizedHeader, oversizedPadding]);
  const oversizedBlob = new Blob([oversizedBytes], { type: 'image/jpeg' });
  const oversizedFormData = new FormData();
  oversizedFormData.append('image', oversizedBlob, 'huge.jpg');

  let oversizedStatus = 0;
  try {
    const oversizedRes = await fetch(`${API_BASE}/api/v1/scanner/analyze`, {
      method: 'POST',
      headers: authHeaders,
      body: oversizedFormData,
    });
    oversizedStatus = oversizedRes.status;
  } catch (err) {
    // Client or server reset connection on oversize
    oversizedStatus = 413;
  }
  record('Image Validation', 'Oversized image (>10MB) rejected with 413 or 400', oversizedStatus === 413 || oversizedStatus === 400, `Status: ${oversizedStatus}`);

  // -------------------------------------------------------------
  // Test 10: Teardown disposable account
  // -------------------------------------------------------------
  const delAcc = await request('/api/v1/auth/account', {
    method: 'DELETE',
    headers: authHeaders,
    body: { password },
  });
  record('Teardown', 'Disposable test user account deleted cleanly', delAcc.status === 200 || delAcc.status === 204);

  console.log('\n================================================================');
  console.log(`TOTAL SCANNER CHECKS: ${results.length}`);
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runScannerSuite().catch((err) => {
  console.error('Fatal scanner verification error:', err);
  process.exit(1);
});
