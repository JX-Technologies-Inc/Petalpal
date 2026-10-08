import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { parse } from 'dotenv';
import pg from 'pg';
import { cert, initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { assertNativeSecurityEnvironment, assertNativeSecurityHttps,
  NATIVE_SECURITY_PROJECT, NATIVE_SECURITY_DATABASE } from '../lib/native-security.js';

class PreparationBlocker extends Error {}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function localFile(relative, json = false) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) throw new PreparationBlocker(`Missing owner-only ignored file: ${relative}`);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || (stat.mode & 0o777) !== 0o600 || stat.uid !== process.getuid()) throw new PreparationBlocker(`Require owned regular 0600 file: ${relative}`);
  execFileSync('git', ['check-ignore', '--quiet', '--', relative], { cwd: root, stdio: 'ignore' });
  return json ? JSON.parse(fs.readFileSync(file, 'utf8')) : parse(fs.readFileSync(file));
}
function backendConfig(requireAdmin = true) {
  const config = localFile('.env.native-security.local');
  const allowed = ['NODE_ENV', 'PORT', 'DEV_DATABASE_URL', 'FIREBASE_PROJECT_ID', 'NATIVE_SECURITY_TEST',
    'API_DOCS_ENABLED', 'AI_USER_DAILY_CALL_LIMIT', 'AI_GLOBAL_DAILY_CALL_LIMIT', 'AI_ASYNC_EXECUTION_MODE'];
  if (Object.keys(config).some(key => !allowed.includes(key))) throw new PreparationBlocker('Unexpected isolated backend setting');
  if (config.NATIVE_SECURITY_TEST !== '1') throw new PreparationBlocker('Explicit native-security flag required');
  if (requireAdmin) config.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(localFile('.env.native-security-admin.local.json', true));
  return config;
}
function childEnvironment(config) {
  const env = {};
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'LANG', 'TERM', 'USER']) if (process.env[key]) env[key] = process.env[key];
  return { ...env, ...config, DOTENV_CONFIG_PATH: path.join(root, '.env.native-security.local') };
}
async function database(config) {
  const url = new URL(config.DEV_DATABASE_URL);
  if (config.NODE_ENV !== 'development' || config.FIREBASE_PROJECT_ID !== NATIVE_SECURITY_PROJECT ||
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.port !== '5433' ||
      decodeURIComponent(url.pathname.slice(1)) !== NATIVE_SECURITY_DATABASE || url.hash ||
      [...url.searchParams].some(([k, v]) => k !== 'schema' || v !== 'public')) throw new PreparationBlocker('Isolated DB configuration rejected');
  const client = new pg.Client({ connectionString: config.DEV_DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    await client.connect(); await client.query('BEGIN READ ONLY');
    const result = await client.query('SELECT current_database() AS db, (SELECT count(*)::int FROM "User") AS users, (SELECT count(*)::int FROM "_prisma_migrations" WHERE finished_at IS NOT NULL) AS migrations');
    if (result.rows[0].db !== NATIVE_SECURITY_DATABASE || result.rows[0].migrations < 1) throw new PreparationBlocker('Isolated DB/schema identity rejected');
    await client.query('ROLLBACK');
    console.log(`Isolated DB boundary PASS; Users=${result.rows[0].users}; applied migrations=${result.rows[0].migrations}`);
  } finally { await client.end(); }
}
async function admin(config) {
  assertNativeSecurityEnvironment(config);
  const app = initializeApp({ projectId: NATIVE_SECURITY_PROJECT,
    credential: cert(JSON.parse(config.FIREBASE_SERVICE_ACCOUNT_JSON)) }, 'native-security-preflight');
  try {
    const auth = getAuth(app);
    // Server-side provider identity and Email/Password availability, no user payload output.
    const token = await app.options.credential.getAccessToken();
    const readProvider = async url => {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token.access_token}` },
        redirect: 'error', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new PreparationBlocker('Isolated provider configuration read blocked; test-project config-read permission required');
      return response.json();
    };
    const result = await readProvider(`https://identitytoolkit.googleapis.com/admin/v2/projects/${NATIVE_SECURITY_PROJECT}/config`);
    if (!result.signIn?.email?.enabled || !result.signIn?.email?.passwordRequired) {
      throw new PreparationBlocker('Isolated Email/Password provider is not ready');
    }
    const mobile = localFile('mobile/.env.native-security.local');
    const client = await readProvider(`https://firebase.googleapis.com/v1beta1/projects/${NATIVE_SECURITY_PROJECT}/webApps/${encodeURIComponent(mobile.EXPO_PUBLIC_FIREBASE_APP_ID)}/config`);
    for (const [key, field] of [['PROJECT_ID', 'projectId'], ['APP_ID', 'appId'], ['API_KEY', 'apiKey'], ['AUTH_DOMAIN', 'authDomain']]) {
      if (!client[field] || client[field] !== mobile[`EXPO_PUBLIC_FIREBASE_${key}`]) {
        throw new PreparationBlocker('Isolated client fields do not match registered test-project app');
      }
    }
    if (client.projectId !== NATIVE_SECURITY_PROJECT ||
        ![NATIVE_SECURITY_PROJECT, client.projectNumber].some(id => id && result.name === `projects/${id}/config`)) {
      throw new PreparationBlocker('Isolated provider project identity mismatch');
    }
    // Confirms Auth Admin read access without exposing any returned user data.
    await auth.listUsers(1);
    console.log('Isolated Firebase Admin access PASS');
    return { app, auth };
  } catch (error) {
    await deleteApp(app);
    if (error instanceof PreparationBlocker) throw error;
    throw new PreparationBlocker('Isolated Firebase Admin/provider access BLOCKED');
  }
}
async function freePort(start) {
  for (let port = start; port < start + 100; port++) {
    const available = await new Promise(resolve => {
      const probe = net.createServer();
      probe.once('error', () => resolve(false));
      probe.listen(port, '0.0.0.0', () => probe.close(() => resolve(true)));
    });
    if (available) return port;
  }
  throw new PreparationBlocker('No free isolated port found');
}
async function health(origin) {
  const response = await fetch(origin, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  const body = await response.json();
  if (!response.ok || body.environment !== 'native-security-test' ||
      body.firebaseProject !== NATIVE_SECURITY_PROJECT || body.database !== NATIVE_SECURITY_DATABASE) {
    throw new PreparationBlocker('Isolated health boundary mismatch');
  }
  const session = await fetch(`${origin}/session?view=metadata`, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (session.status !== 401) throw new PreparationBlocker('Session boundary did not reject anonymous access');
  console.log('Isolated health/session boundary PASS');
}
function run(command, args, options) {
  const child = spawn(command, args, options);
  child.on('error', () => { console.error('Isolated process could not start'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code || 0; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
  return child;
}

async function main() {
  if (execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim() !== 'integration/mobile-backend-test') {
    throw new PreparationBlocker('Required integration branch is not selected');
  }
  const command = process.argv[2];
  if (!['db', 'check', 'provision', 'backend', 'tunnel', 'expo'].includes(command)) {
    throw new PreparationBlocker('Use db | check | provision | backend | tunnel <backend-port> | expo <verified-https-origin>');
  }
  const config = backendConfig(command !== 'db');
  // SDKs inspect ambient emulator/ADC variables even with explicit app options.
  // Install the allowlisted environment before any provider/database access.
  const isolatedEnvironment = childEnvironment(config);
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, isolatedEnvironment);
  await database(config);
  if (command === 'db') return;
  const { app, auth } = await admin(config);
  try {
    if (command === 'check' || command === 'provision') {
      const accounts = localFile('.env.native-security-accounts.local');
      if (accounts.NATIVE_TEST_C_DISPOSABLE !== 'true') throw new PreparationBlocker('Disposable C marker required (deletion is not authorized)');
      const emails = ['A', 'B', 'C'].map(label => accounts[`NATIVE_TEST_${label}_EMAIL`]?.trim().toLowerCase());
      if (emails.some(email => !email) || new Set(emails).size !== 3) throw new PreparationBlocker('Three distinct isolated identities required');
      // Import Prisma only after the explicit isolated environment has been installed.
      const { default: prisma } = await import('../lib/prisma.js');
      try {
        for (const label of ['A', 'B', 'C']) {
          const email = accounts[`NATIVE_TEST_${label}_EMAIL`].trim().toLowerCase();
          const password = accounts[`NATIVE_TEST_${label}_PASSWORD`];
          if (!password || password.length < 12) throw new PreparationBlocker(`Test ${label}: local credential incomplete`);
          let user;
          try { user = await auth.getUserByEmail(email); }
          catch (error) { if (error.code !== 'auth/user-not-found') throw new PreparationBlocker(`Test ${label}: provider lookup blocked`); }
          const profile = await prisma.user.findUnique({ where: { email } });
          if (profile && (!user || profile.firebaseUid !== user.uid)) throw new PreparationBlocker(`Test ${label}: existing linkage mismatch`);
          if (!user && command === 'provision') user = await auth.createUser({ email, password, emailVerified: true, displayName: `Native Test ${label}` });
          if (!user || user.disabled || !user.emailVerified) throw new PreparationBlocker(`Test ${label}: missing/disabled/unverified isolated identity`);
          let linked = profile;
          if (!linked && command === 'provision') linked = await prisma.user.create({ data: {
            id: `native_test_${randomUUID()}`, firebaseUid: user.uid, email, emailVerifiedAt: new Date(), name: `Native Test ${label}`,
            garden: { create: {} }, fairyState: { create: {} }, aiConsent: { create: { termsVersion: '2026-08-25', aiProcessing: false } },
            subscriptionEntitlement: { create: {} }
          } });
          if (!linked || linked.firebaseUid !== user.uid || !(await prisma.garden.findUnique({ where: { ownerId: linked.id } }))) {
            throw new PreparationBlocker(`Test ${label}: profile/garden linkage missing`);
          }
          const mobile = localFile('mobile/.env.native-security.local');
          const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(mobile.EXPO_PUBLIC_FIREBASE_API_KEY)}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'error',
            body: JSON.stringify({ email, password, returnSecureToken: true }), signal: AbortSignal.timeout(15000)
          });
          if (!response.ok) throw new PreparationBlocker(`Test ${label}: isolated saved credential authentication blocked`);
          const signedIn = await response.json();
          const identity = await auth.verifyIdToken(signedIn.idToken, true);
          if (identity.uid !== user.uid || identity.aud !== NATIVE_SECURITY_PROJECT || !identity.email_verified) {
            throw new PreparationBlocker(`Test ${label}: isolated identity/session mismatch`);
          }
          console.log(`Test ${label}: verified isolated identity/profile/garden PASS; no private fixtures added`);
        }
      } finally { await prisma.$disconnect(); }
    }
  } finally { await deleteApp(app); }
  if (command === 'backend') {
    const port = await freePort(3108);
    console.log(`Isolated backend selected port ${port}; loopback only; no migration`);
    // Natural's optional adapters call dotenv.config() without a path. Keep
    // default dotenv discovery away from root .env; our explicit path stays set.
    const workingDirectory = fs.mkdtempSync(path.join(tmpdir(), 'petalpal-native-security-'));
    const child = run(process.execPath, [path.join(root, 'server.js')], { cwd: workingDirectory,
      env: childEnvironment({ ...config, PORT: String(port) }), stdio: ['ignore', 'pipe', 'pipe'] });
    child.once('exit', () => fs.rmdirSync(workingDirectory));
    // Keep raw backend output out of shared terminals; health is the observable boundary.
    child.stdout.resume(); child.stderr.resume();
  }
  if (command === 'tunnel') {
    const port = Number(process.argv[3]);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new PreparationBlocker('Pass the isolated backend selected port');
    await health(`http://127.0.0.1:${port}`);
    console.log('Temporary HTTPS tunnel exposes only the verified isolated loopback backend; API retains Firebase authentication');
    const child = run('cloudflared', ['tunnel', '--url', `http://127.0.0.1:${port}`, '--no-autoupdate'],
      { cwd: root, env: childEnvironment({}), stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.resume();
    let buffer = '';
    child.stderr.on('data', chunk => {
      buffer = (buffer + chunk.toString()).slice(-8192);
      const match = buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) { console.log(`Isolated HTTPS candidate: ${match[0]}; verify with expo preflight before device use`); buffer = ''; }
    });
  }
  if (command === 'expo') {
    const origin = assertNativeSecurityHttps(process.argv[3]);
    await health(origin);
    const mobile = localFile('mobile/.env.native-security.local');
    const keys = ['EXPO_PUBLIC_FIREBASE_API_KEY', 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', 'EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'EXPO_PUBLIC_FIREBASE_APP_ID'];
    if (Object.keys(mobile).some(key => !keys.includes(key)) || keys.some(key => !mobile[key]) ||
        mobile.EXPO_PUBLIC_FIREBASE_PROJECT_ID !== NATIVE_SECURITY_PROJECT ||
        mobile.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN !== `${NATIVE_SECURITY_PROJECT}.firebaseapp.com`) throw new PreparationBlocker('Isolated Expo client config mismatch');
    const port = await freePort(8108);
    console.log(`Isolated Expo port ${port}; Firebase ${NATIVE_SECURITY_PROJECT}; API ${origin}; dotenv disabled`);
    run(path.join(root, 'mobile/node_modules/.bin/expo'), ['start', '--go', '--lan', '--port', String(port)], {
      cwd: path.join(root, 'mobile'), stdio: 'inherit', env: childEnvironment({ ...mobile, NODE_ENV: 'development',
        EXPO_NO_DOTENV: '1', EXPO_PUBLIC_NATIVE_SECURITY_TEST: '1', EXPO_PUBLIC_API_BASE_URL: origin })
    });
  }
}
main().catch(error => {
  // Known configuration blockers contain file names/status only; SDK/DB payloads never escape.
  console.error(error instanceof PreparationBlocker ? `Native-security preparation BLOCKED: ${error.message}` : 'Native-security preparation BLOCKED: provider/DB/process error (payload withheld).');
  process.exitCode = 1;
});
