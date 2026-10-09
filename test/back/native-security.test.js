import test from 'node:test';
import assert from 'node:assert/strict';
import { assertNativeSecurityEnvironment, assertNativeSecurityHttps } from '../../lib/native-security.js';
import { resolveDatabaseUrl } from '../../lib/database-isolation.js';
import { readFirebaseAdminConfig } from '../../lib/firebase-admin.js';
const isolated = {
  NATIVE_SECURITY_TEST: '1', NODE_ENV: 'development', PORT: '3108', FIREBASE_PROJECT_ID: 'petalpal-native-security-test',
  DEV_DATABASE_URL: 'postgresql://synthetic:synthetic@127.0.0.1:5433/petalpal_native_security_test',
  API_DOCS_ENABLED: 'false', AI_USER_DAILY_CALL_LIMIT: '0', AI_GLOBAL_DAILY_CALL_LIMIT: '0', AI_ASYNC_EXECUTION_MODE: 'manual',
  FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ type: 'service_account', project_id: 'petalpal-native-security-test',
    client_email: 'synthetic@petalpal-native-security-test.iam.gserviceaccount.com', private_key: 'BEGIN PRIVATE KEY synthetic' }),
};
test('explicit isolated configuration accepted; normal startup unchanged', () => {
  assert.doesNotThrow(() => assertNativeSecurityEnvironment(isolated));
  assert.equal(resolveDatabaseUrl(isolated), isolated.DEV_DATABASE_URL);
  assert.equal(readFirebaseAdminConfig(isolated).projectId, isolated.FIREBASE_PROJECT_ID);
  assert.doesNotThrow(() => assertNativeSecurityEnvironment({ NODE_ENV: 'production' }));
});
for (const [label, change] of Object.entries({
  'production mode': { NODE_ENV: 'production' },
  'missing isolated port': { PORT: '' },
  'working backend port': { PORT: '3107' },
  'ambiguous flag': { NATIVE_SECURITY_TEST: '2' },
  'missing Firebase project': { FIREBASE_PROJECT_ID: '' },
  'production Firebase': { FIREBASE_PROJECT_ID: 'petalpal-b212c' },
  'production DB variable': { DATABASE_URL: isolated.DEV_DATABASE_URL },
  'wrong local DB': { DEV_DATABASE_URL: isolated.DEV_DATABASE_URL.replace('petalpal_native_security_test', 'petalpal_dev') },
  'remote DB': { DEV_DATABASE_URL: isolated.DEV_DATABASE_URL.replace('127.0.0.1', 'production.example') },
  'DB query redirection': { DEV_DATABASE_URL: isolated.DEV_DATABASE_URL + '?host=production.example' },
  'missing Admin': { FIREBASE_SERVICE_ACCOUNT_JSON: '' },
  'production Admin': { FIREBASE_SERVICE_ACCOUNT_JSON: isolated.FIREBASE_SERVICE_ACCOUNT_JSON.replaceAll('petalpal-native-security-test', 'petalpal-b212c') },
  'ambient Admin': { GOOGLE_APPLICATION_CREDENTIALS: 'synthetic.json' },
  'paired Admin fallback': { FIREBASE_CLIENT_EMAIL: 'synthetic@example.test' },
  'auth emulator': { FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099' },
  'paid AI enabled': { AI_GLOBAL_DAILY_CALL_LIMIT: '1' },
})) test(`startup rejects ${label} before DB/Admin use`, () => {
  const env = { ...isolated, ...change };
  assert.throws(() => resolveDatabaseUrl(env), /isolation cannot be confirmed/);
  assert.throws(() => readFirebaseAdminConfig(env), /isolation cannot be confirmed/);
});
test('HTTPS accepts temporary isolated origin and rejects production/HTTP/loopback/URL credentials', () => {
  assert.equal(assertNativeSecurityHttps('https://synthetic-test.trycloudflare.com'), 'https://synthetic-test.trycloudflare.com');
  for (const url of ['http://synthetic-test.trycloudflare.com', 'https://petalpal-v2.onrender.com', 'https://localhost',
    'https://test.trycloudflare.com.evil.example', 'https://user:password@test.trycloudflare.com', 'https://test.trycloudflare.com/production']) {
    assert.throws(() => assertNativeSecurityHttps(url));
  }
});
