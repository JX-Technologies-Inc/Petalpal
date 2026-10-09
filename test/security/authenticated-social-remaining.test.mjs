import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, writeFileSync, lstatSync, mkdtempSync, rmSync } from 'node:fs';
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

// Four missing cases per batch, 2–5. Real A/B authentication is reused once.
// No Batch 1 or concurrency reruns, account provisioning, migrations or production fallback.
const root = fileURLToPath(new URL('../../', import.meta.url));
const initialCwd = process.cwd();
let fixtureId;
const canary = 'private-batches2to5-' + randomUUID();
let stage = 'owned ignored configuration', app, auth, db, prisma, server, privateCwd;
let owner, visitor, tokens = {}, fixtureAttempted = false, baseline, port, requests = 0, cleanupConfirmed = false;
let firebaseMetadata, profileBaseline, gardenBaseline, friendshipIds = [], activeBatch, batchStartRequests;
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
async function setup({ authenticateExisting = true } = {}) {
  try {
    const config = local('.env.native-security.local');
    const allowed = ['NODE_ENV','PORT','DEV_DATABASE_URL','FIREBASE_PROJECT_ID','NATIVE_SECURITY_TEST','API_DOCS_ENABLED','AI_USER_DAILY_CALL_LIMIT','AI_GLOBAL_DAILY_CALL_LIMIT','AI_ASYNC_EXECUTION_MODE'];
    assert.ok(Object.keys(config).every(k => allowed.includes(k)), 'Unexpected isolated configuration');
    config.PORT = '39101'; // Validation port only; actual HTTP listener is ephemeral loopback.
    config.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(local('.env.native-security-admin.local.json', true));
    assert.equal(config.NATIVE_SECURITY_TEST, '1', 'Explicit isolated mode required');
    assertNativeSecurityEnvironment(config);
    const client = local('mobile/.env.native-security.local');
    const accounts = local('.env.native-security-accounts.local');
    assert.ok(client.EXPO_PUBLIC_FIREBASE_PROJECT_ID === project && client.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN === project + '.firebaseapp.com', 'Client project rejected');
    assert.ok(typeof client.EXPO_PUBLIC_FIREBASE_APP_ID === 'string' && typeof client.EXPO_PUBLIC_FIREBASE_API_KEY === 'string', 'Client identity unavailable');
    const saved = ['A','B'].map(label => ({ email: accounts[`NATIVE_TEST_${label}_EMAIL`]?.trim().toLowerCase(), password: accounts[`NATIVE_TEST_${label}_PASSWORD`] }));
    assert.ok(saved.every(a => a.email && a.password) && saved[0].email !== saved[1].email, 'Existing distinct A/B credentials required');
    // C is neither queried nor used. Do not invoke native harness provisioning.
    for (const key of Object.keys(process.env)) if (!['PATH','HOME','TMPDIR','LANG','TERM','USER','PETALPAL_SOCIAL_CHECKPOINT','PETALPAL_REALTIME_CHECKPOINT','PETALPAL_REVOCATION_CHECKPOINT'].includes(key)) delete process.env[key];
    Object.assign(process.env, config, { DOTENV_CONFIG_PATH: join(root, '.env.native-security.local') });
    privateCwd = mkdtempSync(join(tmpdir(), 'petalpal-social-batches2to5-')); process.chdir(privateCwd);
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
    assert.ok(links.rows[0].n === 0, 'Pre-existing A/B friendship: refuse mutation');
    const contents = (await db.query(`SELECT (SELECT count(*)::int FROM "Flower" WHERE "gardenId"=$1) AS flowers,
      (SELECT count(*)::int FROM "VisitRecord" WHERE "gardenId"=$1) AS visits`, [owner.gardenId])).rows[0];
    assert.ok(contents.flowers === 0 && contents.visits === 0, 'Owner Garden is not empty; refuse access to unrelated fixtures');
    await db.query('ROLLBACK');
    stage = 'registered isolated Firebase app/API-key identity';
    app = initializeApp({ projectId: project, credential: cert(JSON.parse(config.FIREBASE_SERVICE_ACCOUNT_JSON)) }, 'social-acceptance-batches2to5'); auth = getAuth(app);
    const access = await app.options.credential.getAccessToken();
    const registered = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${project}/webApps/${encodeURIComponent(client.EXPO_PUBLIC_FIREBASE_APP_ID)}/config`, {
      headers: { Authorization: 'Bearer ' + access.access_token }, redirect: 'error', signal: AbortSignal.timeout(15000)
    });
    assert.ok(registered.ok, 'Registered isolated Firebase app unavailable');
    const metadata = await registered.json();
    assert.ok(metadata.projectId === project && metadata.appId === client.EXPO_PUBLIC_FIREBASE_APP_ID && metadata.apiKey === client.EXPO_PUBLIC_FIREBASE_API_KEY && metadata.authDomain === client.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, 'Registered app/API-key identity mismatch');
    firebaseMetadata = metadata;
    stage = 'existing verified A/B Firebase authentication';
    for (let i = 0; i < saved.length; i++) {
      const profile = i === 0 ? owner : visitor;
      const existing = await auth.getUserByEmail(saved[i].email);
      assert.ok(existing.uid === profile.firebaseUid && existing.emailVerified === true && !existing.disabled, 'Existing Firebase/profile linkage rejected');
      if (!authenticateExisting) continue; // Read-only A/B preservation for disposable D acceptance.
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
    profileBaseline = await profilesState(); gardenBaseline = await gardensState();
    server.listen(0, '127.0.0.1'); await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    port = server.address().port;
  } catch {
    // Never print SDK errors/URLs/tokens, credential content, emails or user IDs.
    throw new Error('Acceptance BLOCKED at ' + stage + '; no fallback or retry');
  }
}

async function identity() {
  assertNativeSecurityEnvironment(process.env);
  await db.query('BEGIN READ ONLY');
  try {
    assert.equal((await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
    assert.equal((await db.query('SELECT current_database() AS db')).rows[0].db, database);
    assert.equal((await prisma.$queryRawUnsafe('SELECT current_database() AS db'))[0].db, database);
  } finally { await db.query('ROLLBACK'); }
}
async function profilesState() {
  return (await db.query('SELECT row_to_json(u) AS profile FROM "User" u WHERE id=ANY($1::text[]) ORDER BY id', [[owner.id, visitor.id]])).rows;
}
async function gardensState() {
  return (await db.query('SELECT row_to_json(g) AS garden FROM "Garden" g WHERE "ownerId"=ANY($1::text[]) ORDER BY id', [[owner.id, visitor.id]])).rows;
}
async function links() {
  return prisma.friendship.findMany({ where: { OR: [{ userId: owner.id, friendId: visitor.id }, { userId: visitor.id, friendId: owner.id }] } });
}
async function friend() {
  await identity(); assert.equal((await links()).length, 0, 'Refuse existing friendship');
  const ids = [randomUUID(), randomUUID()];
  await prisma.$transaction([
    prisma.friendship.create({ data: { id: ids[0], userId: owner.id, friendId: visitor.id } }),
    prisma.friendship.create({ data: { id: ids[1], userId: visitor.id, friendId: owner.id } })
  ]);
  friendshipIds.push(...ids);
}
async function startBatch(number) {
  activeBatch = number; batchStartRequests = requests; cleanupConfirmed = false;
  await identity(); assert.deepEqual(await profilesState(), profileBaseline);
  assert.equal((await links()).length, 0);
  assert.equal(await prisma.flower.count({ where: { gardenId: owner.gardenId } }), 0);
  assert.equal(await prisma.visitRecord.count({ where: { gardenId: owner.gardenId } }), 0);
  fixtureId = 'social-batch' + number + '-' + randomUUID(); fixtureAttempted = true;
  await prisma.flower.create({ data: { id: fixtureId, userId: owner.id, gardenId: owner.gardenId,
    mood: 'SUNNY_BLOOM', name: 'Disposable acceptance', meaning: 'Isolated acceptance', img: '🌻', left: 0, top: 0,
    event: canary, generationSeed: canary } });
  await friend(); baseline = await fixtureState();
}
async function request(path, actor = 'B', method = 'GET', body) {
  assert.ok(++requests <= 60, 'Bounded acceptance requests');
  const url = new URL(path, `http://127.0.0.1:${port}`);
  assert.ok(url.origin === `http://127.0.0.1:${port}` && (/^\/users\//.test(path) || ['/friends/remove','/visit','/visit/move'].includes(path)));
  if (method !== 'GET') await identity();
  const response = await fetch(url, { method, headers: { Authorization: 'Bearer ' + tokens[actor], ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(15000) });
  const result = { status: response.status, body: await response.json() };
  assert.ok(response.headers.get('cache-control')?.includes('no-store'));
  assert.ok(response.status < 500, 'Unexpected server failure');
  return result;
}
const flowerPath = () => `/users/${owner.id}/flowers/${fixtureId}`;
const gardenPath = () => `/users/${owner.id}/garden`;
async function denied(path, method = 'GET', body, status = 403) {
  const before = await fixtureState(), r = await request(path, 'B', method, body);
  assert.equal(r.status, status);
  assert.ok(Object.keys(r.body).every(key => ['error','code'].includes(key)));
  assert.ok(!JSON.stringify(r.body).includes(canary) && !JSON.stringify(r.body).includes(fixtureId));
  assert.deepEqual(await fixtureState(), before, 'Denied request mutated owned social data');
}
async function allowedRead(path) {
  const before = await fixtureState(), r = await request(path);
  assert.equal(r.status, 200);
  assert.ok(!JSON.stringify(r.body).includes(canary), 'Friend received private canary');
  const flower = path === gardenPath() ? r.body.flowers.find(f => f.id === fixtureId) : r.body;
  assert.equal(flower.id, fixtureId); assert.equal(flower.supportState.isOwner, false);
  for (const key of ['event','generationSeed','dailyCheckIn','sourceEvent','journalEntryId']) assert.ok(!(key in flower), 'Private field leaked');
  assert.deepEqual(await fixtureState(), before);
  return r;
}
async function removeFriend() {
  const current = await links(); assert.ok(current.every(link => friendshipIds.includes(link.id)));
  const r = await request('/friends/remove', 'A', 'POST', { friendId: visitor.id });
  assert.equal(r.status, 200); assert.equal(r.body.success, true); assert.equal((await links()).length, 0);
}
async function privacy(on) {
  const r = await request('/users/me/garden-privacy', 'A', 'PATCH', { allowGardenVisits: on });
  assert.equal(r.status, 200); assert.equal(r.body.allowGardenVisits, on);
  assert.equal((await prisma.user.findUnique({ where: { id: owner.id } })).allowGardenVisits, on);
}
async function visit() {
  const before = (await fixtureState())[0].visits;
  const r = await request('/visit', 'B', 'POST', { hostUserId: owner.id, visitorAvatar: canary, x: 120, y: 520 });
  assert.equal(r.status, 200); assert.equal(r.body.success, true);
  assert.ok(r.body.activeVisitors.some(v => v.visitorId === visitor.id));
  assert.equal((await fixtureState())[0].visits, before + 1);
}
async function cleanupBatch({ actors = [visitor.id] } = {}) {
  if (!fixtureAttempted) return;
  await identity();
  const current = await links(); assert.ok(current.every(link => friendshipIds.includes(link.id)), 'Unowned relationship appeared');
  await prisma.friendship.deleteMany({ where: { id: { in: friendshipIds } } });
  const setting = await prisma.user.findUnique({ where: { id: owner.id } });
  if (setting.allowGardenVisits !== owner.allowGardenVisits) await privacy(owner.allowGardenVisits);
  // Capture exact row IDs and markers; never remove another batch's rows.
  const visits = await prisma.visitRecord.findMany({ where: { gardenId: owner.gardenId } });
  assert.ok(visits.every(v => actors.includes(v.visitorId) && v.userId === v.visitorId && v.visitorAvatar === canary));
  const messages = await prisma.message.findMany({ where: { flowerId: fixtureId } });
  assert.ok(messages.every(m => actors.includes(m.userId) && m.text === canary + '-message'));
  await prisma.$transaction([
    prisma.visitRecord.deleteMany({ where: { id: { in: visits.map(v => v.id) }, gardenId: owner.gardenId, visitorAvatar: canary, visitorId: { in: actors } } }),
    prisma.message.deleteMany({ where: { id: { in: messages.map(m => m.id) }, flowerId: fixtureId, userId: { in: actors }, text: canary + '-message' } }),
    prisma.flower.deleteMany({ where: { id: fixtureId, userId: owner.id, event: canary, generationSeed: canary } })
  ]);
  assert.equal((await fixtureState()).length, 0);
  assert.equal(await prisma.visitRecord.count({ where: { gardenId: owner.gardenId } }), 0);
  assert.equal((await links()).length, 0);
  assert.deepEqual(await profilesState(), profileBaseline);
  assert.deepEqual(await gardensState(), gardenBaseline);
  fixtureAttempted = false; cleanupConfirmed = true;
}

const batches = [
  [2, [
    ['Confirmed-friend Garden read with private fields excluded', () => allowedRead(gardenPath())],
    ['Confirmed-friend direct Flower read with private fields excluded', () => allowedRead(flowerPath())],
    ['Friendship removal revokes Garden access', async () => { await removeFriend(); await denied(gardenPath()); }],
    ['Previously authorized Firebase token cannot read revoked Flower', () => denied(flowerPath())]
  ]],
  [3, [
    ['Privacy OFF denies confirmed-friend Garden access', async () => { await privacy(false); await denied(gardenPath()); }],
    ['Privacy OFF denies previously authorized direct Flower access', () => denied(flowerPath())],
    ['Privacy OFF preserves owner Garden access', async () => { const r = await request(gardenPath(), 'A'); assert.equal(r.status, 200); assert.equal(r.body.flowers[0].event, canary); assert.equal(r.body.owner.id, owner.id); }],
    ['Privacy ON restores confirmed-friend sanitized Garden access', async () => { await privacy(true); await allowedRead(gardenPath()); }]
  ]],
  [4, [
    ['Cross-owner Flower identity mismatch denied without disclosure', () => denied(`/users/${visitor.id}/flowers/${fixtureId}`, 'GET', undefined, 404)],
    ['Friend Support commits once and repeated same-day Support is idempotent', async () => {
      const payload = { visitorAvatar: canary };
      for (let i = 0; i < 2; i++) { const r = await request(flowerPath() + '/support', 'B', 'POST', payload); assert.equal(r.status, 200); assert.equal(r.body.supportCount, 1); assert.equal(r.body.supportState.supportedToday, true); assert.ok(!JSON.stringify(r.body).includes(canary)); }
      const s = (await fixtureState())[0]; assert.equal(s.flower.supportCount, 1); assert.equal(s.visits, 1); assert.equal(s.messages, 0);
      const v = await prisma.visitRecord.findFirst({ where: { flowerId: fixtureId } }); assert.equal(v.visitorId, visitor.id); assert.equal(v.action, 'support');
    }],
    ['Friend Message persists token-derived author and one history row', async () => {
      const r = await request(flowerPath() + '/message', 'B', 'POST', { text: canary + '-message', visitorAvatar: canary });
      assert.equal(r.status, 200); assert.equal(r.body.messages.length, 1); assert.equal(r.body.messages[0].text, canary + '-message');
      assert.ok(!('event' in r.body) && !('generationSeed' in r.body));
      const m = await prisma.message.findFirst({ where: { flowerId: fixtureId } }); assert.equal(m.userId, visitor.id); assert.equal(m.text, canary + '-message');
      const s = (await fixtureState())[0]; assert.equal(s.messages, 1); assert.equal(s.visits, 2); assert.equal(s.flower.supportCount, 1);
    }],
    ['Friendship and privacy revocation reject Support and Message without writes', async () => {
      await removeFriend();
      for (const suffix of ['/support','/message']) await denied(flowerPath() + suffix, 'POST', { text: canary + '-message', visitorAvatar: canary });
      await friend(); await privacy(false);
      for (const suffix of ['/support','/message']) await denied(flowerPath() + suffix, 'POST', { text: canary + '-message', visitorAvatar: canary });
    }]
  ]],
  [5, [
    ['Confirmed friend can visit and move with token-derived identity', async () => { await visit(); const r = await request('/visit/move', 'B', 'POST', { hostUserId: owner.id, x: 121, y: 521, visitorAvatar: canary }); assert.equal(r.status, 200); assert.ok(r.body.activeVisitors.some(v => v.visitorId === visitor.id && v.x === 121)); assert.equal((await fixtureState())[0].visits, 1); }],
    ['Friendship revocation denies new visit and stale visitor movement', async () => { await removeFriend(); await denied('/visit', 'POST', { hostUserId: owner.id, visitorAvatar: canary }); await denied('/visit/move', 'POST', { hostUserId: owner.id, x: 122, y: 522 }); }],
    ['Privacy revocation denies new visit and previously active movement', async () => { await friend(); await visit(); await privacy(false); await denied('/visit', 'POST', { hostUserId: owner.id, visitorAvatar: canary }); await denied('/visit/move', 'POST', { hostUserId: owner.id, x: 123, y: 523 }); }],
    ['Privacy regrant cannot resurrect a stale visitor without a new visit', async () => { await privacy(true); await denied('/visit/move', 'POST', { hostUserId: owner.id, x: 124, y: 524 }, 404); }]
  ]]
];
function checkpoint(number, passed, outcome, count) {
  if (process.env.PETALPAL_SOCIAL_CHECKPOINT !== '1') return;
  const path = join(root, 'SECURITY.md'); let doc = readFileSync(path, 'utf8');
  for (const name of passed) doc = doc.replace(`- [ ] Batch ${number}: ${name}.`, `- [x] Batch ${number}: ${name}.`);
  doc = doc.replace(`**Batch ${number} evidence:** NOT VERIFIED.`, `**Batch ${number} evidence:** ${outcome}; ${passed.length}/4 new cases, ${count} authenticated loopback requests. Real isolated Firebase A/B tokens and PostgreSQL identity gates passed; owned fixture cleanup ${cleanupConfirmed ? 'PASS' : 'NOT CONFIRMED'}. Same real tokens were retained across revocation; no mocked auth or concurrency rerun. Production authenticated status remains NOT VERIFIED.`);
  writeFileSync(path, doc);
}

const checklist = readFileSync(join(root, 'SECURITY.md'), 'utf8');
const complete = batches.every(([number, cases]) => cases.every(([name]) => checklist.includes(`- [x] Batch ${number}: ${name}.`)));
if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) test('Isolated authenticated social acceptance: missing Batches 2–5 only', { skip: complete }, async t => {
  // Deliberately opt-in: never write checklist without the documented explicit flag.
  const checkpointEnabled = process.env.PETALPAL_SOCIAL_CHECKPOINT;
  let failed = false;
  try {
    await setup();
    if (checkpointEnabled === '1') process.env.PETALPAL_SOCIAL_CHECKPOINT = '1';
    for (const [number, cases] of batches) {
      const doc = readFileSync(join(root, 'SECURITY.md'), 'utf8');
      const remaining = cases.filter(([name]) => !doc.includes(`- [x] Batch ${number}: ${name}.`));
      if (!remaining.length) continue;
      const passed = [];
      try { await startBatch(number); }
      catch { failed = true; }
      if (!failed) for (const [name, run] of remaining) {
        await t.test(`Batch ${number}: ${name}`, async () => {
          try { await run(); passed.push(name); }
          catch { failed = true; throw new Error('Confirmed failure or blocked isolated case: ' + name); }
        });
        if (failed) break;
      }
      try { await cleanupBatch(); } catch { failed = true; cleanupConfirmed = false; }
      checkpoint(number, passed, failed ? 'BLOCKED — stop; remaining cases unchecked' : 'PASS', requests - batchStartRequests);
      if (failed) { assert.fail('Stopped at Batch ' + number + '; preserve checkpoint; no later cases run'); }
    }
  } catch (error) {
    if (process.env.PETALPAL_SOCIAL_CHECKPOINT === '1' && !activeBatch) {
      const path = join(root, 'SECURITY.md');
      writeFileSync(path, readFileSync(path, 'utf8').replace('**Batch 2 evidence:** NOT VERIFIED.', '**Batch 2 evidence:** BLOCKED at ' + stage + '; no fixture fallback or later batch executed.'));
    }
    throw error;
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await prisma?.$disconnect(); await db?.end(); if (app) await deleteApp(app);
    tokens = {}; process.chdir(initialCwd); if (privateCwd) rmSync(privateCwd, { recursive: true });
    console.log(`Missing batches only: ${requests} loopback requests; A/B preserved; C untouched; no production target`);
  }
});

// Shared opt-in isolated fixture, not an application hook. Importing it registers
// no completed acceptance tests and performs no authentication or database work.
export const isolatedSocial = {
  setup, identity, startBatch, cleanupBatch, request, friend, privacy, removeFriend, fixtureState,
  get providerAuth() { return auth; }, get firebaseMetadata() { return firebaseMetadata; },
  async preserved() { return JSON.stringify(await profilesState()) === JSON.stringify(profileBaseline) && JSON.stringify(await gardensState()) === JSON.stringify(gardenBaseline); },
  get root() { return root; }, get owner() { return owner; }, get visitor() { return visitor; },
  get tokens() { return tokens; }, get prisma() { return prisma; }, get canary() { return canary; },
  get fixtureId() { return fixtureId; }, get port() { return port; }, get stage() { return stage; },
  get requests() { return requests; }, get cleanupConfirmed() { return cleanupConfirmed; },
  async finish() {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await prisma?.$disconnect(); await db?.end(); if (app) await deleteApp(app);
    tokens = {}; process.chdir(initialCwd); if (privateCwd) rmSync(privateCwd, { recursive: true });
  }
};
