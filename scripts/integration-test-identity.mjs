// One-time, owner-authorized provisioning of ONE email-verified TEST identity for
// the integration e2e. Fixed TEST hosts/project only. Prints PASS/FAIL, HTTP
// status and sanitized codes: never the email, password, tokens or bodies.
//   phase=signup  creates the TEST Firebase account (or reuses it) and requests a
//                 verification email; the owner opens the link from the mailbox.
//   phase=profile after verification, creates the TEST backend profile
//                 (POST /auth/session) so the e2e has an owner row.
const BACKEND = 'https://petalpal-backend-test.onrender.com';
const WEB_ORIGIN = 'https://petalpal-web-integration.petalpal-jx.workers.dev';
const PROJECT = 'petalpal-integration-test';
const env = process.env;
const phase = process.argv[2];
const fail = message => { console.log(`::error title=test identity::${message}`); process.exit(1); };
const ok = message => console.log(`::notice title=test identity::${message}`);
if (env.AUTHORIZATION_PHRASE !== 'CREATE-ONE-TEST-IDENTITY') fail('write authorization phrase missing');
if (!['signup', 'profile'].includes(phase)) fail('unknown phase');
for (const name of ['EXPO_PUBLIC_FIREBASE_API_KEY', 'EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'INTEGRATION_TEST_EMAIL', 'INTEGRATION_TEST_PASSWORD']) if (!env[name]) fail(`missing ${name}`);
if (env.EXPO_PUBLIC_FIREBASE_PROJECT_ID !== PROJECT) fail('not the TEST Firebase project');
if (!/^[^@\s]+@jastrevia\.com$/i.test(env.INTEGRATION_TEST_EMAIL)) fail('test identity must be a company mailbox the owner can read');
if (env.INTEGRATION_TEST_PASSWORD.length < 16) fail('test password must be at least 16 characters');

const safe = value => (/^[A-Z_]{3,40}$/.test(String(value)) ? String(value) : 'redacted');
const identity = async (endpoint, body) => {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${encodeURIComponent(env.EXPO_PUBLIC_FIREBASE_API_KEY)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Referer: `${WEB_ORIGIN}/` }, signal: AbortSignal.timeout(30000), body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json, code: safe(String(json.error?.message || '').split(' ')[0]) };
};
const credentials = { email: env.INTEGRATION_TEST_EMAIL, password: env.INTEGRATION_TEST_PASSWORD, returnSecureToken: true };

let session = await identity('signUp', credentials);
if (session.code === 'EMAIL_EXISTS') session = await identity('signInWithPassword', credentials);
if (!session.json.idToken) fail(`TEST Firebase account step failed (HTTP ${session.status} ${session.code})`);
const idToken = session.json.idToken;

if (phase === 'signup') {
  const sent = await identity('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken });
  if (sent.status !== 200) fail(`verification email request failed (HTTP ${sent.status} ${sent.code})`);
  ok('TEST account ready; one verification email requested. Open the link in the mailbox, then run phase=profile.');
} else {
  const lookup = await identity('lookup', { idToken });
  if (lookup.json.users?.[0]?.emailVerified !== true) fail('BLOCKED: email not verified yet; no profile created');
  const response = await fetch(`${BACKEND}/auth/session`, {
    method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(60000),
    headers: { Origin: WEB_ORIGIN, Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'PetalPal Integration Tester', timezone: 'UTC', aiConsent: false }),
  });
  await response.arrayBuffer();
  if (response.status !== 200) fail(`TEST profile step failed (HTTP ${response.status})`);
  ok('TEST backend profile exists for the verified identity. The e2e workflow can run.');
}
