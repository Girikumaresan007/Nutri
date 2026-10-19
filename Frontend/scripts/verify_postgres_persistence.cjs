const fs = require('fs');

const API_BASE = 'http://localhost:8081';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };
  let body = options.body;
  if (body && typeof body === 'object') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const res = await fetch(url, { method: options.method || 'GET', headers, body });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  return { status: res.status, ok: res.ok, data };
}

async function runStep1() {
  console.log('--- Step 1: Create Disposable Account & Test Record in PostgreSQL ---');
  const ts = Date.now();
  const testEmail = `persistence_verify_${ts}@nutritrack.app`;
  const password = 'Password123!';
  const recordName = `POSTGRES_PERSISTENCE_TEST_${ts}`;
  const today = '2026-10-14';

  const reg = await request('/api/v1/auth/register', {
    method: 'POST',
    body: { name: 'Persistence Tester', email: testEmail, password },
  });
  if (reg.status !== 201 && reg.status !== 200) {
    throw new Error(`Registration failed: ${reg.status} ${JSON.stringify(reg.data)}`);
  }
  const token = reg.data.accessToken;
  const userId = reg.data.user.id;
  console.log(`Created user: ${testEmail} (ID: ${userId})`);

  const entry = await request('/api/v1/food-entries', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      date: today,
      meal: 'breakfast',
      name: recordName,
      quantity: 1,
      unit: 'serving',
      nutrition: { calories: 350, protein: 25, carbohydrates: 40, fat: 10, fiber: 5 },
      notes: 'Testing persistence across backend restart',
      source: 'manual',
    },
  });
  if (entry.status !== 201) {
    throw new Error(`Failed to create food entry: ${entry.status} ${JSON.stringify(entry.data)}`);
  }
  const entryId = entry.data.id;
  console.log(`Created test food entry: ${recordName} (ID: ${entryId})`);

  fs.writeFileSync('scripts/persistence_test_state.json', JSON.stringify({
    testEmail,
    password,
    recordName,
    today,
    entryId,
    userId,
  }, null, 2));
  console.log('Saved test state to scripts/persistence_test_state.json');
}

async function runStep2() {
  console.log('--- Step 2: Verify Record After Backend Restart & Teardown ---');
  if (!fs.existsSync('scripts/persistence_test_state.json')) {
    throw new Error('State file not found');
  }
  const state = JSON.parse(fs.readFileSync('scripts/persistence_test_state.json', 'utf8'));
  console.log(`Verifying persistence for user: ${state.testEmail}`);

  // 1. Log in with the disposable user
  const login = await request('/api/v1/auth/login', {
    method: 'POST',
    body: { email: state.testEmail, password: state.password },
  });
  if (login.status !== 200) {
    throw new Error(`Login after restart failed: ${login.status}`);
  }
  const token = login.data.accessToken;
  console.log('Login succeeded after restart!');

  // 2. Query food entries
  const list = await request(`/api/v1/food-entries?date=${state.today}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (list.status !== 200) {
    throw new Error(`List foods failed: ${list.status}`);
  }
  const found = list.data.items?.find((item) => item.id === state.entryId);
  if (!found || found.name !== state.recordName) {
    throw new Error(`Record NOT found after restart! Found: ${JSON.stringify(list.data)}`);
  }
  console.log(`SUCCESS: Test record "${found.name}" survived backend restart!`);
  console.log(`Nutrition verified: Calories=${found.nutrition.calories}, Protein=${found.nutrition.protein}g`);

  // 3. Teardown / cleanup
  const delAcc = await request('/api/v1/auth/account', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    body: { password: state.password },
  });
  if (delAcc.status !== 200 && delAcc.status !== 204) {
    throw new Error(`Account deletion failed: ${delAcc.status}`);
  }
  console.log(`Cleaned up disposable test account ${state.testEmail}`);

  fs.unlinkSync('scripts/persistence_test_state.json');
  console.log('State file cleaned up.');
}

const mode = process.argv[2];
if (mode === 'create') {
  runStep1().catch((e) => { console.error(e); process.exit(1); });
} else if (mode === 'verify') {
  runStep2().catch((e) => { console.error(e); process.exit(1); });
} else {
  console.error('Specify mode: create or verify');
  process.exit(1);
}
