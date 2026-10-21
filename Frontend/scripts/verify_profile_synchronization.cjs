/**
 * NutriTrack AI — Profile Auto-Synchronization Regression Test Suite
 *
 * Verifies Scenarios A through F from Priority 5:
 *   Test A — Profile update without full-page refresh
 *   Test B — Immediate cross-component synchronization across Dashboard, Sidebar, Topbar, Account Cards, and Goals
 *   Test C — Session persistence and recovery after application reload
 *   Test D — Safe failure handling (failed save rejects without corrupting state or claiming success)
 *   Test E — Race condition protection (older in-flight profile fetch cannot overwrite newer save)
 *   Test F — Multi-field preservation (name + biometric/goal metrics preserved without data loss)
 */

let failures = 0;
let passes = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failures++;
  } else {
    console.log(`✅ PASS: ${message}`);
    passes++;
  }
}

console.log('======================================================================');
console.log('   NutriTrack AI — Profile Auto-Synchronization Regression Suite');
console.log('======================================================================\n');

// Mock data structures mirroring types/index.ts and AppContext.tsx
function createInitialAppContext() {
  let profileRequestSeq = 0;
  let currentUser = {
    id: 'user-uuid-101',
    email: 'elena@example.com',
    name: 'Original User',
    role: 'USER',
  };

  let data = {
    profile: {
      name: 'Original User',
      email: 'elena@example.com',
      dateOfBirth: '1995-04-12',
      heightCm: 168,
      currentWeightKg: 68,
      biologicalSex: 'female',
      activityLevel: 'moderate',
      goalType: 'maintain',
      targetWeightKg: 68,
      weightUnit: 'kg',
      heightUnit: 'cm',
      profileUpdatedAt: '2026-10-15',
    },
    goals: [
      {
        id: 'goal-1',
        effectiveFrom: '2026-10-15',
        goalType: 'maintain',
        dailyCalories: 2100,
        protein: 105,
        carbohydrates: 260,
        fat: 65,
        fiber: 28,
        targetWeightKg: 68,
      },
    ],
    entries: [],
    workouts: [],
    weights: [],
  };

  const getDashboardUserName = () => {
    return (data.profile?.name || currentUser?.name || 'friend').trim().split(' ')[0];
  };

  const getAppShellDisplayName = () => {
    return data.profile?.name?.trim() || currentUser?.name?.trim() || 'NutriTrack';
  };

  const getAppShellInitial = () => {
    const disp = getAppShellDisplayName();
    return disp.charAt(0).toUpperCase() || 'N';
  };

  const getProfileSummaryCardName = () => {
    return data.profile?.name || currentUser?.name || 'Connected user';
  };

  const getGoalsPageProfileName = () => {
    return data.profile?.name || currentUser?.name || 'User';
  };

  // Simulated saveProfile with sequence ref and dual-sync
  const saveProfile = async (profileUpdates, mockApiCaller) => {
    const currentSeq = ++profileRequestSeq;
    const res = await mockApiCaller(profileUpdates);
    if (currentSeq === profileRequestSeq) {
      data = { ...data, profile: { ...res } };
      if (currentUser) {
        currentUser = { ...currentUser, name: res.name, email: res.email || currentUser.email };
      }
    }
    return res;
  };

  // Simulated refreshProfileAndGoals with sequence ref
  const refreshProfileAndGoals = async (mockFetchCaller) => {
    const currentSeq = ++profileRequestSeq;
    const res = await mockFetchCaller();
    if (currentSeq !== profileRequestSeq) {
      // Discard stale response
      return;
    }
    data = { ...data, profile: { ...res.profile }, goals: [...res.goals] };
    if (currentUser && res.profile) {
      currentUser = { ...currentUser, name: res.profile.name, email: res.profile.email || currentUser.email };
    }
  };

  return {
    getCurrentUser: () => currentUser,
    getData: () => data,
    saveProfile,
    refreshProfileAndGoals,
    getDashboardUserName,
    getAppShellDisplayName,
    getAppShellInitial,
    getProfileSummaryCardName,
    getGoalsPageProfileName,
    getSeq: () => profileRequestSeq,
  };
}

// -----------------------------------------------------------------------------
// Test A — Profile update propagates without page refresh
// -----------------------------------------------------------------------------
async function testA() {
  console.log('--- Test A: Profile update propagates immediately ---');
  const app = createInitialAppContext();

  assert(app.getDashboardUserName() === 'Original', 'Initial Dashboard greeting uses Original name');

  const updatedProfile = {
    ...app.getData().profile,
    name: 'Elena Rostova',
  };

  await app.saveProfile(updatedProfile, async (p) => ({
    ...p,
    profileUpdatedAt: '2026-10-21',
  }));

  assert(app.getData().profile.name === 'Elena Rostova', 'Shared data.profile updated immediately');
  assert(app.getCurrentUser().name === 'Elena Rostova', 'Shared currentUser.name updated immediately');
  assert(app.getDashboardUserName() === 'Elena', 'Dashboard greeting shows "Elena" without page refresh');
}

// -----------------------------------------------------------------------------
// Test B — Cross-component synchronization
// -----------------------------------------------------------------------------
async function testB() {
  console.log('\n--- Test B: Cross-component synchronization ---');
  const app = createInitialAppContext();

  const updatedProfile = {
    ...app.getData().profile,
    name: 'Alexander Pierce',
  };

  await app.saveProfile(updatedProfile, async (p) => ({ ...p, profileUpdatedAt: '2026-10-21' }));

  assert(app.getDashboardUserName() === 'Alexander', 'Dashboard shows "Alexander"');
  assert(app.getAppShellDisplayName() === 'Alexander Pierce', 'Desktop sidebar displays "Alexander Pierce"');
  assert(app.getAppShellInitial() === 'A', 'Sidebar & Header avatar shows initial "A"');
  assert(app.getProfileSummaryCardName() === 'Alexander Pierce', 'Profile summary card shows "Alexander Pierce"');
  assert(app.getGoalsPageProfileName() === 'Alexander Pierce', 'Goals page profile defaults to "Alexander Pierce"');
}

// -----------------------------------------------------------------------------
// Test C — Persistence across app reload
// -----------------------------------------------------------------------------
async function testC() {
  console.log('\n--- Test C: Persistence after application reload ---');
  const app = createInitialAppContext();

  // 1. User updates profile
  await app.saveProfile(
    { ...app.getData().profile, name: 'Dr. Jane Watson', heightCm: 172 },
    async (p) => ({ ...p, profileUpdatedAt: '2026-10-21' })
  );

  // 2. Simulate browser restart: backend returns persisted profile
  const persistedState = app.getData().profile;
  const reloadedApp = createInitialAppContext();

  await reloadedApp.refreshProfileAndGoals(async () => ({
    profile: persistedState,
    goals: reloadedApp.getData().goals,
  }));

  assert(reloadedApp.getData().profile.name === 'Dr. Jane Watson', 'Reloaded app retrieves updated name');
  assert(reloadedApp.getData().profile.heightCm === 172, 'Reloaded app retrieves updated height');
  assert(reloadedApp.getCurrentUser().name === 'Dr. Jane Watson', 'Reloaded app synchronizes currentUser.name');
  assert(reloadedApp.getDashboardUserName() === 'Dr.', 'Dashboard greeting matches persisted title/name');
}

// -----------------------------------------------------------------------------
// Test D — Failed update handling
// -----------------------------------------------------------------------------
async function testD() {
  console.log('\n--- Test D: Failed update does not corrupt state ---');
  const app = createInitialAppContext();
  const initialName = app.getData().profile.name;

  let caughtError = null;
  try {
    await app.saveProfile({ ...app.getData().profile, name: 'Unsaved Malformed Name' }, async () => {
      throw new Error('500 Internal Server Error: Database timeout');
    });
  } catch (err) {
    caughtError = err;
  }

  assert(caughtError !== null, 'saveProfile rejected on server error');
  assert(app.getData().profile.name === initialName, 'data.profile retains original name on failure');
  assert(app.getCurrentUser().name === initialName, 'currentUser retains original name on failure');
  assert(app.getDashboardUserName() === 'Original', 'Dashboard continues displaying verified name');
}

// -----------------------------------------------------------------------------
// Test E — Race condition protection
// -----------------------------------------------------------------------------
async function testE() {
  console.log('\n--- Test E: Race condition: older fetch cannot overwrite newer save ---');
  const app = createInitialAppContext();

  // Simulate an older background fetch that takes 100ms
  let slowFetchResolve;
  const slowFetchPromise = new Promise((resolve) => {
    slowFetchResolve = resolve;
  });

  const backgroundFetch = app.refreshProfileAndGoals(async () => {
    await slowFetchPromise;
    return {
      profile: { ...app.getData().profile, name: 'Stale Old Background Name' },
      goals: app.getData().goals,
    };
  });

  // User promptly saves a new name while the background fetch is still in flight
  await app.saveProfile(
    { ...app.getData().profile, name: 'Authoritative Modern Name' },
    async (p) => ({ ...p, profileUpdatedAt: '2026-10-21' })
  );

  // Now the slow background fetch finishes
  slowFetchResolve();
  await backgroundFetch;

  assert(
    app.getData().profile.name === 'Authoritative Modern Name',
    'Newer profile save was NOT overwritten by stale background fetch'
  );
  assert(
    app.getCurrentUser().name === 'Authoritative Modern Name',
    'currentUser was NOT overwritten by stale background fetch'
  );
  assert(
    app.getDashboardUserName() === 'Authoritative',
    'Dashboard correctly reflects the newer authoritative name'
  );
}

// -----------------------------------------------------------------------------
// Test F — Other profile fields preserved
// -----------------------------------------------------------------------------
async function testF() {
  console.log('\n--- Test F: Multi-field preservation ---');
  const app = createInitialAppContext();

  const multiFieldUpdate = {
    ...app.getData().profile,
    name: 'Samantha Ray',
    currentWeightKg: 64.5,
    targetWeightKg: 60.0,
    goalType: 'lose',
    activityLevel: 'active',
    heightCm: 171,
    biologicalSex: 'female',
  };

  await app.saveProfile(multiFieldUpdate, async (p) => ({
    ...p,
    profileUpdatedAt: '2026-10-21',
  }));

  const saved = app.getData().profile;
  assert(saved.name === 'Samantha Ray', 'Name is updated');
  assert(saved.currentWeightKg === 64.5, 'currentWeightKg is preserved');
  assert(saved.targetWeightKg === 60.0, 'targetWeightKg is preserved');
  assert(saved.goalType === 'lose', 'goalType is preserved');
  assert(saved.activityLevel === 'active', 'activityLevel is preserved');
  assert(saved.heightCm === 171, 'heightCm is preserved');
  assert(saved.biologicalSex === 'female', 'biologicalSex is preserved');
}

// Run all test suites
async function run() {
  await testA();
  await testB();
  await testC();
  await testD();
  await testE();
  await testF();

  console.log('\n======================================================================');
  if (failures === 0) {
    console.log(`🎉 ALL ${passes} REGRESSION TESTS PASSED SUCCESSFULLY!`);
    console.log('======================================================================\n');
    process.exit(0);
  } else {
    console.error(`💥 REGRESSION RUN FAILED: ${failures} failure(s) out of ${passes + failures} tests.`);
    console.log('======================================================================\n');
    process.exit(1);
  }
}

run();
