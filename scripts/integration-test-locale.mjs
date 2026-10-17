// Owner-run, phrase-gated switch of the TEST owner's preferredLocale between en and
// zh-Hans for bilingual Weekly acceptance. Fixed TEST hosts only. Exactly one
// owner-only PUT /users/:id/profile { preferredLocale } and one read-back; nothing
// else (no consent, timezone, Events, memories, jobs or AI). Prints only statuses
// and locale values; never the email, password, tokens or owner id.
//   ZH acceptance:  TARGET_LOCALE=zh-Hans   Restore:  TARGET_LOCALE=en
const BACKEND = 'https://petalpal-backend-test.onrender.com';
const WEB_ORIGIN = 'https://petalpal-web-integration.petalpal-jx.workers.dev';
const PROJECT = 'petalpal-integration-test';
const PHRASE = 'SET-TEST-OWNER-LOCALE';
const SWITCH = { 'zh-Hans': 'en', en: 'zh-Hans' }; // target -> required current value
const env = process.env;
const stop = message => { console.log(`STOP: ${message}`); process.exit(2); };
if (env.AUTHORIZATION_PHRASE !== PHRASE) stop('authorization phrase missing; nothing was sent');
const target = env.TARGET_LOCALE;
if (!Object.hasOwn(SWITCH, target)) stop('TARGET_LOCALE must be zh-Hans or en; nothing was sent');
for (const name of ['EXPO_PUBLIC_FIREBASE_API_KEY', 'EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'INTEGRATION_TEST_EMAIL', 'INTEGRATION_TEST_PASSWORD']) {
  if (!env[name]) stop(`missing ${name}; nothing was sent`);
}
if (env.EXPO_PUBLIC_FIREBASE_PROJECT_ID !== PROJECT) stop('not the TEST Firebase project; nothing was sent');

const api = async (path, { token, method = 'GET', body } = {}) => {
  const response = await fetch(BACKEND + path, {
    method, redirect: 'manual', signal: AbortSignal.timeout(60000),
    headers: { Origin: WEB_ORIGIN, Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, json: await response.json().catch(() => null) };
};

const signIn = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(env.EXPO_PUBLIC_FIREBASE_API_KEY)}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Referer: `${WEB_ORIGIN}/` }, signal: AbortSignal.timeout(30000),
  body: JSON.stringify({ email: env.INTEGRATION_TEST_EMAIL, password: env.INTEGRATION_TEST_PASSWORD, returnSecureToken: true }),
});
// Only an allowlisted Firebase error code is printed (same idea as integration-e2e.mjs);
// never the raw response, key, email or password.
const AUTH_CODES = new Set(['API_KEY_INVALID', 'INVALID_ARGUMENT', 'INVALID_LOGIN_CREDENTIALS', 'EMAIL_NOT_FOUND',
  'INVALID_PASSWORD', 'INVALID_EMAIL', 'MISSING_PASSWORD', 'USER_DISABLED', 'TOO_MANY_ATTEMPTS_TRY_LATER',
  'OPERATION_NOT_ALLOWED', 'PROJECT_NOT_FOUND']);
const authCode = error => {
  const candidates = [...(Array.isArray(error?.details) ? error.details.map(d => d?.reason) : []),
    String(error?.message ?? '').split(/[\s:]/)[0], error?.status];
  return candidates.find(code => AUTH_CODES.has(code)) ?? 'UNKNOWN';
};
const signInBody = await signIn.json().catch(() => ({}));
const token = signInBody.idToken;
if (!token) stop(`TEST Firebase sign-in failed (HTTP ${signIn.status} ${authCode(signInBody.error)}); no write`);
const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
if (claims.aud !== PROJECT || claims.iss !== `https://securetoken.google.com/${PROJECT}` || claims.email_verified !== true) {
  stop('token is not a verified TEST identity; no write');
}

const session = await api('/auth/session', { token, method: 'POST', body: { deferProfileCreation: true } });
if (session.status !== 200 || session.json?.needsProfile) stop(`TEST owner profile unavailable (status ${session.status}); no write`);
const before = await api('/session?view=metadata', { token });
const owner = before.json?.user?.id, current = before.json?.user?.preferredLocale;
if (before.status !== 200 || typeof owner !== 'string' || !owner) stop(`could not read the TEST owner (status ${before.status}); no write`);
if (current === target) { console.log(`NO CHANGE: preferredLocale is already ${target}; no write`); process.exit(0); }
if (current !== SWITCH[target]) stop(`preferredLocale is ${typeof current === 'string' && /^[A-Za-z-]{2,35}$/.test(current) ? current : 'unexpected'}, expected ${SWITCH[target]}; no write`);

const put = await api(`/users/${encodeURIComponent(owner)}/profile`, { token, method: 'PUT', body: { preferredLocale: target } });
const after = await api('/session?view=metadata', { token });
const confirmed = put.status === 200 && put.json?.user?.preferredLocale === target &&
  after.status === 200 && after.json?.user?.id === owner && after.json?.user?.preferredLocale === target;
console.log(`${confirmed ? 'PASS' : 'FAIL'}: preferredLocale ${current} -> ${target} (update ${put.status}, read-back ${after.status}${confirmed ? '' : `, now ${after.json?.user?.preferredLocale === target ? target : 'unconfirmed'}`})`);
process.exit(confirmed ? 0 : 1);
