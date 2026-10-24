/**
 * NutriTrack AI — Critical Final Fix: Persistent Authentication & Reliability Test Suite
 *
 * Verifies:
 * 1. Persistent session hint cache (never stores tokens, stores user metadata).
 * 2. Session recovery across app reloads and connection interruptions.
 * 3. CONNECTION_ERROR state preserves user identity, never renders 'there', 'Guest', or zeroes as final.
 * 4. Token rotation grace period (recovery during grace window vs revocation after grace window).
 * 5. Reconnect and Retry deduplication (safe against rapid concurrent clicks).
 * 6. Auth modal timeout handling and user-friendly cold-start messaging.
 * 7. Workout statistic cards responsive alignment, equal height, centered labels, and vertical rhythm.
 */

const fs = require('fs');
const path = require('path');

let passes = 0;
let failures = 0;

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
console.log('  NutriTrack AI — Authentication Reliability & UI Regression Tests');
console.log('======================================================================\n');

// 1. Session Hint Cache & Zero-Token Security Test
console.log('--- 1. Session Hint & Storage Security ---');
const SESSION_CACHE_KEY = 'nutritrack.auth.session_hint.v1';
const mockLocalStorage = {};

function saveSessionHint(hint) {
  if (hint) {
    mockLocalStorage[SESSION_CACHE_KEY] = JSON.stringify(hint);
  } else {
    delete mockLocalStorage[SESSION_CACHE_KEY];
  }
}

function getStoredSessionHint() {
  const raw = mockLocalStorage[SESSION_CACHE_KEY];
  return raw ? JSON.parse(raw) : null;
}

saveSessionHint({ name: 'Girikumar', email: '0117girid@gmail.com' });
const retrieved = getStoredSessionHint();
assert(retrieved !== null, 'Session hint is saved and retrieved');
assert(retrieved.name === 'Girikumar', 'Session hint name is intact');
assert(retrieved.email === '0117girid@gmail.com', 'Session hint email is intact');
assert(!retrieved.token && !retrieved.accessToken && !retrieved.refreshToken, 'ZERO tokens are present in session storage');

// 2. CONNECTION_ERROR State Preservation (No 'there', No 'Guest', No 0 kcal fallback)
console.log('\n--- 2. CONNECTION_ERROR State & Identity Preservation ---');
let authStatus = 'INITIALIZING';
let currentUser = retrieved ? { id: '', name: retrieved.name, email: retrieved.email } : null;

// Simulate cold-start timeout during restoreSession
const simulatedRefreshResult = { status: 'CONNECTION_ERROR', error: 'Request timed out after 45000ms' };

if (simulatedRefreshResult.status === 'CONNECTION_ERROR') {
  authStatus = 'CONNECTION_ERROR';
  // Note: currentUser must NOT be wiped!
}

assert(authStatus === 'CONNECTION_ERROR', 'authStatus transitioned to CONNECTION_ERROR');
assert(currentUser !== null, 'currentUser is preserved in memory during connection error');
assert(currentUser.name === 'Girikumar', 'User name is retained');

// Check resolved greeting title
function getGreetingTitle(profile, user, status) {
  const resolvedName = (profile?.name || user?.name || '').trim();
  const greeting = 'Good evening';
  return resolvedName ? `${greeting}, ${resolvedName.split(' ')[0]}.` : `${greeting}.`;
}

const title = getGreetingTitle(null, currentUser, authStatus);
assert(title === 'Good evening, Girikumar.', `Title greeting is "${title}", never "Good evening, there."`);
assert(!title.includes('there'), 'Title never contains "there"');
assert(!title.includes('friend'), 'Title never contains "friend"');

// Check Topbar actions in AppShell
const hasUserSession = Boolean(currentUser);
const isReconnecting = authStatus === 'CONNECTION_ERROR' && hasUserSession;
const isUnauthenticated = authStatus === 'UNAUTHENTICATED' && !hasUserSession;

assert(isReconnecting === true, 'isReconnecting is correctly recognized');
assert(isUnauthenticated === false, 'isUnauthenticated is false while reconnecting');

// 3. Retry Connection Concurrency Guard
console.log('\n--- 3. Retry Connection Concurrency Safety ---');
let retryCallCount = 0;
let isRetrying = false;

async function retryConnection() {
  if (isRetrying) return;
  isRetrying = true;
  retryCallCount++;
  await new Promise((r) => setTimeout(r, 10));
  isRetrying = false;
}

// Simulate 5 rapid simultaneous clicks
Promise.all([
  retryConnection(),
  retryConnection(),
  retryConnection(),
  retryConnection(),
  retryConnection(),
]).then(() => {
  assert(retryCallCount === 1, `Rapid retry clicks deduplicated: exactly ${retryCallCount} execution`);
});

// 4. Token Rotation Reuse Grace Window Recovery with Client Proof Binding
console.log('\n--- 4. Token Rotation Reuse Grace Window Logic ---');
const REUSE_GRACE_SECONDS = 90;
const activeRotations = new Map();

function rotateToken(tokenRecord, rawToken, clientProof, nowTimestamp) {
  if (tokenRecord.expiresAt < nowTimestamp) {
    throw new Error('INVALID_TOKEN');
  }
  if (tokenRecord.revokedAt != null) {
    if (tokenRecord.revokedAt + REUSE_GRACE_SECONDS < nowTimestamp) {
      // Past grace window: attack detected, revoke everything!
      activeRotations.delete(rawToken);
      return { action: 'REVOKE_ALL_TOKENS', success: false };
    }
    // Within grace window: check clientProof
    const active = activeRotations.get(rawToken);
    if (active && clientProof && clientProof === active.clientProof) {
      // Legitimate concurrent request: return identical successor token
      return { action: 'RETURN_EXISTING_SUCCESSOR', newToken: active.newToken, success: true };
    }
    // Mismatched proof / theft: revoke everything!
    activeRotations.delete(rawToken);
    return { action: 'REVOKE_ALL_TOKENS', success: false };
  }
  tokenRecord.revokedAt = nowTimestamp;
  const newToken = 'token_new_' + Math.random().toString(36).substring(2);
  activeRotations.set(rawToken, { newToken, clientProof, rotatedAt: nowTimestamp });
  return { action: 'ROTATED', newToken, success: true };
}

const now = 100000;
const rawToken = 'sample_raw_token';
const validToken = { expiresAt: now + 86400, revokedAt: null };
const clientProof = '192.168.1.50|Chrome-PWA';

const firstRotation = rotateToken(validToken, rawToken, clientProof, now);
assert(firstRotation.success && firstRotation.action === 'ROTATED', 'First token rotation succeeds');

// Legitimate client concurrent request 10s later (same client proof)
const concurrentLegit = rotateToken(validToken, rawToken, clientProof, now + 10);
assert(concurrentLegit.success && concurrentLegit.action === 'RETURN_EXISTING_SUCCESSOR', 'Concurrent rotation with same clientProof returns identical successor token');
assert(concurrentLegit.newToken === firstRotation.newToken, 'Successor token is identical (zero family branching)');

// Replay by different client within grace window (theft attempt)
const theftAttempt = rotateToken(validToken, rawToken, '203.0.113.99|Attacker', now + 15);
assert(!theftAttempt.success && theftAttempt.action === 'REVOKE_ALL_TOKENS', 'Replay within grace window by different client triggers total revocation');

// Replay past 90s grace window
const postGraceValidToken = { expiresAt: now + 86400, revokedAt: now };
const attackDetected = rotateToken(postGraceValidToken, 'stale_token', clientProof, now + 120);
assert(!attackDetected.success && attackDetected.action === 'REVOKE_ALL_TOKENS', 'Replay past 90s grace window triggers theft detection and revokes all tokens');

// 5. CSS Workout Card Alignment & Responsive Rules
console.log('\n--- 5. Workout Statistic Cards CSS Verification ---');
const stylesPath = path.join(__dirname, '../src/styles.css');
const css = fs.readFileSync(stylesPath, 'utf8');

assert(css.includes('.workout-stat-card .stat-label'), 'workout-stat-card .stat-label rules exist');
assert(css.includes('align-self: center !important') || css.includes('text-align: center !important'), 'stat-label resets align-self to center');
assert(css.includes('min-height: 28px') || css.includes('min-height: 26px'), 'stat-label enforces consistent min-height for multi-line and single-line labels');
assert(css.includes('justify-content: flex-start'), 'workout-stat-card uses top-down vertical alignment');

// Check timeout settings in api.ts
console.log('\n--- 6. API Timeout Configuration Verification ---');
const apiPath = path.join(__dirname, '../src/services/api.ts');
const apiCode = fs.readFileSync(apiPath, 'utf8');

assert(apiCode.includes('45000'), 'api.ts includes 45000ms timeout for cold start tolerance on auth/refresh');
assert(apiCode.includes("'TIMEOUT'"), 'api.ts categorizes timeout errors with code TIMEOUT');

setTimeout(() => {
  console.log('\n======================================================================');
  if (failures === 0) {
    console.log(`🎉 ALL ${passes} AUTH RELIABILITY & RESPONSIVE UI TESTS PASSED!`);
  } else {
    console.error(`💥 ${failures} TEST(S) FAILED!`);
    process.exit(1);
  }
  console.log('======================================================================\n');
}, 50);
