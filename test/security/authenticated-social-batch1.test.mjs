import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFileSync, lstatSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { parse } from 'dotenv';
import pg from 'pg';
import { initializeApp, cert, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { assertNativeSecurityEnvironment, NATIVE_SECURITY_PROJECT as project, NATIVE_SECURITY_DATABASE as database } from '../../lib/native-security.js';

// Exactly four read cases. No target/account creation, native scenario, session
// setup, migrations or production fallback. Reuse the existing isolated A/B.
const root = fileURLToPath(new URL('../../', import.meta.url));
const initialCwd = process.cwd();
const fixtureId = 'social-batch1-' + randomUUID();
const canary = 'private-batch1-' + randomUUID();
let stage = 'owned ignored configuration', app, auth, db, prisma, server, privateCwd;
let owner, visitor, tokens = {}, fixtureAttempted = false, baseline, port, requests = 0, cleanupConfirmed = false;
function local(name, json = false) {
  const path = resolve(root, name), stat = lstatSync(path);
  assert.ok(stat.isFile() && stat.uid === process.getuid() && (stat.mode & 0o777) === 0o600, 'Owned regular 0600 file required');
  execFileSync('git', ['check-ignore', '--quiet', '--', name], { cwd: root, stdio: 'ignore' });
  return json ? JSON.parse(readFileSync(path, 'utf8')) : parse(readFileSync(path));
}
async function fixtureState() {
  return (await db.query(`SELECT row_to_json(f) AS flower,
    (SELECT count(*)::int FROM "Message" WHERE "flowerId"=$1) AS messages,
    (SELECT count(*)::int FROM "VisitRecord" WHERE "gardenId"=$2) AS visits
    FROM "Flower" f WHERE f.id=$1 AND f."userId"=$3`, [fixtureId, owner.gardenId, owner.id])).rows;
}
before(async () => {
  try {
    const config = local('.env.native-security.local');
    const allowed = ['NODE_ENV','PORT','DEV_DATABASE_URL','FIREBASE_PROJECT_ID','NATIVE_SECURITY_TEST','API_DOCS_ENABLED','AI_USER_DAILY_CALL_LIMIT','AI_GLOBAL_DAILY_CALL_LIMIT','AI_ASYNC_EXECUTION_MODE'];
    assert.ok(Object.keys(config).every(k => allowed.includes(k)), 'Unexpected isolated configuration');
    config.PORT = '39101'; // Validation port only; actual HTTP listener is ephemeral loopback.
    config.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(local('.env.native-security-admin.local.json', true));
    assertNativeSecurityEnvironment(config);
    const client = local('mobile/.env.native-security.local');
    const accounts = local('.env.native-security-accounts.local');
    assert.ok(client.EXPO_PUBLIC_FIREBASE_PROJECT_ID === project && client.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN === project + '.firebaseapp.com', 'Client project rejected');
    assert.ok(typeof client.EXPO_PUBLIC_FIREBASE_APP_ID === 'string' && typeof client.EXPO_PUBLIC_FIREBASE_API_KEY === 'string', 'Client identity unavailable');
    const saved = ['A','B'].map(label => ({ email: accounts[`NATIVE_TEST_${label}_EMAIL`]?.trim().toLowerCase(), password: accounts[`NATIVE_TEST_${label}_PASSWORD`] }));
    assert.ok(saved.every(a => a.email && a.password) && saved[0].email !== saved[1].email, 'Existing distinct A/B credentials required');
    // C is neither queried nor used. Do not invoke native harness provisioning.
    for (const key of Object.keys(process.env)) if (!['PATH','HOME','TMPDIR','LANG','TERM','USER'].includes(key)) delete process.env[key];
    Object.assign(process.env, config, { DOTENV_CONFIG_PATH: join(root, '.env.native-security.local') });
    privateCwd = mkdtempSync(join(tmpdir(), 'petalpal-social-batch1-')); process.chdir(privateCwd);
    stage = 'isolated PostgreSQL identity/profile gate';
    db = new pg.Client({ connectionString: config.DEV_DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 5000 });
    await db.connect(); await db.query('BEGIN READ ONLY');
    assert.ok((await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only === 'on', 'Read-only precheck required');
    assert.ok((await db.query('SELECT current_database() AS db')).rows[0].db === database, 'Database identity rejected');
    const profiles = (await db.query(`SELECT u.id,u.email,u."firebaseUid",u."allowGardenVisits",g.id AS "gardenId"
      FROM "User" u JOIN "Garden" g ON g."ownerId"=u.id WHERE lower(u.email)=ANY($1::text[])`, [saved.map(a => a.email)])).rows;
    owner = profiles.find(p => p.email.toLowerCase() === saved[0].email);
    visitor = profiles.find(p => p.email.toLowerCase() === saved[1].email);
    assert.ok(profiles.length === 2 && owner?.firebaseUid && visitor?.firebaseUid && owner.id !== visitor.id && owner.allowGardenVisits === true, 'Required isolated A/B profiles/Gardens/privacy unavailable');
    const links = await db.query('SELECT count(*)::int AS n FROM "Friendship" WHERE ("userId"=$1 AND "friendId"=$2) OR ("userId"=$2 AND "friendId"=$1)', [owner.id, visitor.id]);
    assert.ok(links.rows[0].n === 0, 'A/B must already be nonfriends; no relationship mutation authorized');
    const contents = (await db.query(`SELECT (SELECT count(*)::int FROM "Flower" WHERE "gardenId"=$1) AS flowers,
      (SELECT count(*)::int FROM "VisitRecord" WHERE "gardenId"=$1) AS visits`, [owner.gardenId])).rows[0];
    assert.ok(contents.flowers === 0 && contents.visits === 0, 'Owner Garden is not empty; refuse access to unrelated fixtures');
    await db.query('ROLLBACK');
    stage = 'registered isolated Firebase app/API-key identity';
    app = initializeApp({ projectId: project, credential: cert(JSON.parse(config.FIREBASE_SERVICE_ACCOUNT_JSON)) }, 'social-acceptance-batch1'); auth = getAuth(app);
    const access = await app.options.credential.getAccessToken();
    const registered = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${project}/webApps/${encodeURIComponent(client.EXPO_PUBLIC_FIREBASE_APP_ID)}/config`, {
      headers: { Authorization: 'Bearer ' + access.access_token }, redirect: 'error', signal: AbortSignal.timeout(15000)
    });
    assert.ok(registered.ok, 'Registered isolated Firebase app unavailable');
    const metadata = await registered.json();
    assert.ok(metadata.projectId === project && metadata.appId === client.EXPO_PUBLIC_FIREBASE_APP_ID && metadata.apiKey === client.EXPO_PUBLIC_FIREBASE_API_KEY && metadata.authDomain === client.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, 'Registered app/API-key identity mismatch');
    stage = 'existing verified A/B Firebase authentication';
    for (let i = 0; i < saved.length; i++) {
      const profile = i === 0 ? owner : visitor;
      const existing = await auth.getUserByEmail(saved[i].email);
      assert.ok(existing.uid === profile.firebaseUid && existing.emailVerified === true && !existing.disabled, 'Existing Firebase/profile linkage rejected');
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(metadata.apiKey)}`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...saved[i], returnSecureToken: true })
      });
      assert.ok(response.ok, 'Existing isolated A/B sign-in unavailable');
      const signedIn = await response.json();
      const verified = await auth.verifyIdToken(signedIn.idToken, true);
      assert.ok(verified.aud === project && verified.iss === `https://securetoken.google.com/${project}` && verified.uid === existing.uid && verified.email_verified === true, 'Real verified isolated token rejected');
      tokens[i === 0 ? 'A' : 'B'] = signedIn.idToken;
    }
    stage = 'isolated exact-code backend/fixture';
    assertNativeSecurityEnvironment(process.env);
    ({ default: prisma } = await import('../../lib/prisma.js'));
    ({ server } = await import('../../server.js'));
    assertNativeSecurityEnvironment(process.env); // Reject ambient dotenv after imports.
    assert.ok((await prisma.$queryRawUnsafe('SELECT current_database() AS db'))[0].db === database, 'Application connection identity rejected');
    fixtureAttempted = true;
    await prisma.flower.create({ data: { id: fixtureId, userId: owner.id, gardenId: owner.gardenId,
      mood: 'SUNNY_BLOOM', name: 'Disposable Batch 1', meaning: 'Isolated acceptance', img: '🌻', left: 0, top: 0,
      event: canary, generationSeed: canary } });
    baseline = await fixtureState(); assert.ok(baseline.length === 1, 'Batch fixture unavailable');
    server.listen(0, '127.0.0.1'); await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    port = server.address().port;
  } catch {
    // Never print SDK errors/URLs/tokens, credential content, emails or user IDs.
    throw new Error('Batch 1 BLOCKED at ' + stage + '; no fallback or retry');
  }
});
after(async () => {
  try {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    if (fixtureAttempted) {
      assertNativeSecurityEnvironment(process.env);
      assert.ok((await prisma.$queryRawUnsafe('SELECT current_database() AS db'))[0].db === database, 'Cleanup identity rejected');
      // Delete only our unpredictable ID + owner + synthetic marker; never profiles/Gardens/accounts.
      await prisma.flower.deleteMany({ where: { id: fixtureId, userId: owner.id, event: canary, generationSeed: canary } });
      assert.ok((await fixtureState()).length === 0, 'Batch fixture cleanup incomplete'); cleanupConfirmed = true;
    }
  } finally {
    await prisma?.$disconnect(); await db?.end(); if (app) await deleteApp(app);
    tokens = {}; process.chdir(initialCwd); if (privateCwd) rmSync(privateCwd, { recursive: true });
    console.log(`Batch 1: ${requests}/4 loopback acceptance requests; owned fixture cleanup=${cleanupConfirmed ? 'PASS' : 'not created'}; A/B preserved; C untouched; no production target`);
  }
});
async function read(path, actor) {
  assert.ok(++requests <= 4, 'Batch 1 request bound');
  const url = new URL(path, `http://127.0.0.1:${port}`);
  assert.ok(url.origin === `http://127.0.0.1:${port}` && path.startsWith('/users/'), 'Only isolated social read paths permitted');
  const response = await fetch(url, { headers: { Authorization: 'Bearer ' + tokens[actor] }, redirect: 'error', signal: AbortSignal.timeout(15000) });
  const body = await response.json();
  assert.ok(response.headers.get('cache-control')?.includes('no-store'), 'Private no-store required');
  assert.deepEqual(await fixtureState(), baseline, 'Read changed the disposable fixture/social history');
  return { status: response.status, body };
}
test('Batch 1 owner Flower read with real verified Firebase + PostgreSQL', async () => {
  const r = await read(`/users/${owner.id}/flowers/${fixtureId}`, 'A');
  assert.ok(r.status === 200 && r.body.id === fixtureId && r.body.event === canary && r.body.supportState.isOwner === true, 'Owner Flower access failed');
});
test('Batch 1 owner Garden read with real verified Firebase + PostgreSQL', async () => {
  const r = await read(`/users/${owner.id}/garden`, 'A');
  assert.ok(r.status === 200 && r.body.owner.id === owner.id && r.body.flowers.length === 1 && r.body.flowers[0].id === fixtureId && r.body.flowers[0].event === canary, 'Owner Garden access failed');
});
for (const [name, suffix] of [['Flower', `/flowers/${fixtureId}`], ['Garden', '/garden']]) {
  test(`Batch 1 nonfriend ${name} denial with real verified Firebase + PostgreSQL`, async () => {
    const r = await read(`/users/${owner.id}${suffix}`, 'B');
    assert.ok(r.status === 403 && Object.keys(r.body).every(key => ['error','code'].includes(key)), 'Nonfriend must receive only safe denial');
    assert.ok(!JSON.stringify(r.body).includes(canary) && !JSON.stringify(r.body).includes(fixtureId), 'Private response leaked');
  });
}
