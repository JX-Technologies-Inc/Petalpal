export const NATIVE_SECURITY_PROJECT = 'petalpal-native-security-test';
export const NATIVE_SECURITY_DATABASE = 'petalpal_native_security_test';

// Opt-in only: normal development/production behavior is unchanged.
export function assertNativeSecurityEnvironment(env = process.env) {
  if (!env.NATIVE_SECURITY_TEST) return;
  const fail = () => { throw new Error('Native security isolation cannot be confirmed'); };
  if (env.NATIVE_SECURITY_TEST !== '1' || env.NODE_ENV !== 'development' ||
      !/^\d+$/.test(env.PORT || '') || Number(env.PORT) < 1024 || Number(env.PORT) > 65535 ||
      [3107, 8107, 8081, 8082].includes(Number(env.PORT)) ||
      env.FIREBASE_PROJECT_ID !== NATIVE_SECURITY_PROJECT || env.DATABASE_URL ||
      env.GOOGLE_APPLICATION_CREDENTIALS || env.FIREBASE_CLIENT_EMAIL || env.FIREBASE_PRIVATE_KEY ||
      env.FIREBASE_CONFIG || env.FIREBASE_AUTH_EMULATOR_HOST ||
      env.API_DOCS_ENABLED !== 'false' || env.AI_USER_DAILY_CALL_LIMIT !== '0' ||
      env.AI_GLOBAL_DAILY_CALL_LIMIT !== '0' || env.AI_ASYNC_EXECUTION_MODE !== 'manual') fail();
  try {
    const db = new URL(env.DEV_DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(db.protocol) ||
        !['127.0.0.1', 'localhost', '[::1]'].includes(db.hostname) || db.port !== '5433' ||
        decodeURIComponent(db.pathname.slice(1)) !== NATIVE_SECURITY_DATABASE ||
        db.hash || [...db.searchParams].some(([k, v]) => k !== 'schema' || v !== 'public')) fail();
    const credential = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (credential.type !== 'service_account' || credential.project_id !== NATIVE_SECURITY_PROJECT ||
        !credential.client_email?.endsWith(`@${NATIVE_SECURITY_PROJECT}.iam.gserviceaccount.com`) ||
        !credential.private_key?.includes('BEGIN PRIVATE KEY')) fail();
  } catch { fail(); }
}

export function assertNativeSecurityHttps(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Isolated HTTPS endpoint is missing'); }
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.trycloudflare\.com$/.test(url.hostname) ||
      url.username || url.password || url.port || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Isolated HTTPS endpoint must be the verified temporary tunnel origin');
  }
  return url.origin;
}
