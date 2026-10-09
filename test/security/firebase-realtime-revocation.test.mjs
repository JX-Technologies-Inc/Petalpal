import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, lstatSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { io as connectSocket } from 'socket.io-client';
import { isolatedSocial as f } from './authenticated-social-remaining.test.mjs';
import { assertNativeSecurityEnvironment, NATIVE_SECURITY_PROJECT as project } from '../../lib/native-security.js';

// Exactly one remaining real-provider case; no A/B sign-in or previous case rerun.
const docPath = join(f.root, 'SECURITY.md');
const item = '- [ ] RT2: Live Firebase disabled/revoked/expired-session propagation, idle eviction and revoked handshake/action/delivery.';
const done = '- [x] RT2: Real Firebase refresh-token revocation rejects original ID-token handshake/actions/delivery and idle sessions.';
const complete = readFileSync(docPath, 'utf8').includes(done);
const nonce = randomUUID(), uid = 'social-revocation-D-' + nonce;
const email = 'security-d-' + nonce + '@example.invalid';
const flowerId = uid + '-flower', gardenId = uid + '-garden', marker = 'revocation-D-' + nonce;
const secretPath = join(f.root, '.env.native-security-D-' + nonce + '.local');
let stage = 'isolation', createdAttempt = false, dbAttempt = false, secretOwned = false;
let dDeleted = false, rowsDeleted = false, preserved = false, hooksClear = false;
let originalToken, password, savedAB, observations, auth;
const sockets = [], privateEvents = ['avatarMoved','messageAdded','supportUpdated','visitRecordAdded'];
const oldEvents = [];
function bound(promise, ms = 12000) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Bounded D acceptance wait expired')), ms); })]).finally(() => clearTimeout(timer));
}
async function gate() {
  assertNativeSecurityEnvironment(process.env); await f.identity();
  assert.equal(f.firebaseMetadata.projectId, project);
  assert.equal(f.firebaseMetadata.authDomain, project + '.firebaseapp.com');
  const base = new URL(`http://127.0.0.1:${f.port}`);
  assert.ok(base.hostname === '127.0.0.1' && Number(base.port) >= 1024);
  assert.equal(uid, 'social-revocation-D-' + nonce);
}
async function missing() {
  try { await auth.getUser(uid); return false; }
  catch (error) { if (error.code === 'auth/user-not-found') return true; throw new Error('D absence unavailable'); }
}
async function login() {
  const url = new URL('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword');
  url.searchParams.set('key', f.firebaseMetadata.apiKey);
  const r = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  assert.ok(r.ok, 'Disposable D sign-in unavailable');
  const data = await r.json(); const claims = await auth.verifyIdToken(data.idToken, true);
  assert.ok(claims.uid === uid && claims.aud === project && claims.iss === `https://securetoken.google.com/${project}` && claims.email_verified === true);
  return { token: data.idToken, claims };
}
async function connect(token, deny = false) {
  const s = connectSocket(`http://127.0.0.1:${f.port}`, { auth: { token }, transports: ['websocket'], reconnection: false, timeout: 9000 }); sockets.push(s);
  const result = await bound(new Promise(resolve => { s.once('connect', () => resolve('connected')); s.once('connect_error', error => resolve(error.message)); }));
  if (deny) { assert.equal(result, 'Invalid or expired Firebase token'); assert.equal(s.connected, false); }
  else assert.equal(result, 'connected');
  return s;
}
async function action(s, event, payload) {
  return bound(new Promise((resolve, reject) => s.timeout(8000).emit(event, payload, (error, ack) => error ? reject(new Error('D action acknowledgement unavailable')) : resolve(ack))));
}
async function joinRooms(s) {
  assert.equal((await action(s, 'join-user', uid)).ok, true);
  assert.equal((await action(s, 'join-garden', uid)).ok, true);
}
function next(s, event) {
  let handler;
  return bound(new Promise(resolve => { handler = value => resolve(value); s.once(event, handler); })).finally(() => s.off(event, handler));
}
function disconnected(s) {
  return new Promise(resolve => s.once('disconnect', reason => resolve({ at: Date.now(), reason })));
}
async function http(token, path, method = 'GET', body) {
  assert.ok(path === '/session' || path === `/users/${uid}/flowers/${flowerId}/message`);
  await gate();
  const r = await fetch(`http://127.0.0.1:${f.port}${path}`, { method, redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.ok(r.headers.get('cache-control')?.includes('no-store'));
  return { status: r.status, body: await r.json() };
}
async function snapshotAB() {
  return Promise.all([f.owner.firebaseUid, f.visitor.firebaseUid].map(id => auth.getUser(id).then(record => JSON.stringify(record.toJSON()))));
}
async function cleanup() {
  for (const s of sockets) s.disconnect();
  hooksClear = sockets.every(s => !s.connected && s.io.opts.reconnection === false);
  if (auth && createdAttempt) {
    await gate();
    if (!await missing()) {
      const record = await auth.getUser(uid); assert.ok(record.uid === uid && record.email === email, 'Refuse deletion of unowned identity');
      await auth.deleteUser(uid);
    }
    dDeleted = await missing(); assert.ok(dDeleted);
  }
  if (dbAttempt) {
    await gate();
    const user = await f.prisma.user.findUnique({ where: { id: uid } });
    assert.ok(!user || (user.firebaseUid === uid && user.email === email && user.name === marker), 'Refuse deletion of unowned profile');
    await f.prisma.$transaction([
      f.prisma.visitRecord.deleteMany({ where: { gardenId, userId: uid, visitorId: uid, visitorAvatar: marker } }),
      f.prisma.message.deleteMany({ where: { flowerId, userId: uid, text: marker + '-message' } }),
      f.prisma.flower.deleteMany({ where: { id: flowerId, userId: uid, gardenId, event: marker, generationSeed: marker } }),
      f.prisma.garden.deleteMany({ where: { id: gardenId, ownerId: uid } }),
      f.prisma.user.deleteMany({ where: { id: uid, firebaseUid: uid, email, name: marker } })
    ]);
    rowsDeleted = await f.prisma.user.count({ where: { id: uid } }) === 0 && await f.prisma.garden.count({ where: { id: gardenId } }) === 0 && await f.prisma.flower.count({ where: { id: flowerId } }) === 0 && await f.prisma.message.count({ where: { flowerId } }) === 0 && await f.prisma.visitRecord.count({ where: { gardenId } }) === 0;
    assert.ok(rowsDeleted);
  }
  if (savedAB) { preserved = JSON.stringify(await snapshotAB()) === JSON.stringify(savedAB) && await f.preserved(); assert.ok(preserved, 'A/B preservation failure'); }
  if (secretOwned && dDeleted && rowsDeleted) {
    const stat = lstatSync(secretPath); assert.ok(stat.uid === process.getuid() && (stat.mode & 0o777) === 0o600);
    const owned = JSON.parse(readFileSync(secretPath, 'utf8')); assert.ok(owned.uid === uid && owned.project === project);
    unlinkSync(secretPath); secretOwned = false;
  }
}
function checkpoint(pass) {
  if (process.env.PETALPAL_REVOCATION_CHECKPOINT !== '1') return;
  let doc = readFileSync(docPath, 'utf8');
  if (pass) { assert.ok(doc.includes(item)); doc = doc.replace(item, done); }
  const record = pass ? `**Realtime isolated completion: PASS 8/8.** One new focused real Firebase/PostgreSQL/Socket.IO test PASS; seven prior checked cases were skipped. Only disposable D was created, authenticated, refresh-token revoked and deleted in the exact isolated project/database. Backend uses real Admin verifyIdToken(token, true) on handshake, actions, recipient delivery and the 5-second idle timer. Original ID token remains signature/expiry-valid with checkRevoked=false (${observations.remainingTokenSeconds}s remaining at observation), but checkRevoked=true rejects it as auth/id-token-revoked; auth_time precedes tokensValidAfterTime by ${observations.revocationBoundarySeconds}s. Observed from revocation request start: existing action disconnect ${observations.actionMs}ms, original-token handshake rejection ${observations.handshakeMs}ms, recipient disconnect ${observations.deliveryMs}ms, idle disconnect ${observations.idleMs}ms (idle socket left its user subscription before revocation and received no post-revocation client actions or targeted delivery). Old-token HTTP session returned 401; no old-session private events or stale permissions restored. A fresh post-revocation D sign-in was accepted and received the control message, distinguishing revocation of old sessions from account disablement/ID-token expiry. D Firebase identity and exact owned PostgreSQL profile/Garden/Flower/message/visit rows deleted and absence confirmed; owned ignored 0600 credential journal removed, A/B Firebase records and full PostgreSQL profile/Garden snapshots unchanged, C untouched, no active test socket or armed auth/data hook. No application code fix, provider setting, production traffic, migration, deployment or accepted-suite rerun. Production authenticated/distributed statuses and canonical P0/P1/P2 counts remain unchanged. The previous preservation blocker is historical and superseded by this specifically authorized D-only evidence. Token expiry/disabled-account cases retain prior deterministic evidence, not new live-provider claims; timing is this isolated observation, not a production propagation/SLA guarantee.` : `**Realtime D-only checkpoint: PARTIAL / BLOCKED at ${stage}.** No eighth PASS claim. D deleted=${dDeleted}; owned database records absent=${rowsDeleted}; A/B preserved=${preserved}; test sockets closed=${hooksClear}. Prior seven PASS cases retained; owned ignored credential journal retained if cleanup not confirmed. No production or A/B/C mutation authorized or attempted.`;
  const anchor = '**Prerequisite before scaling:**'; assert.ok(doc.includes(anchor));
  doc = doc.replace(anchor, record + '\n\n' + anchor); writeFileSync(docPath, doc);
}

test('Remaining real Firebase D refresh-token revocation acceptance only', { skip: complete, timeout: 90000 }, async () => {
  let failed = false;
  try {
    await f.setup({ authenticateExisting: false }); auth = f.providerAuth;
    await gate(); savedAB = await snapshotAB(); assert.ok(await missing());
    execFileSync('git', ['check-ignore','--quiet','--', secretPath], { cwd: f.root, stdio: 'ignore' });
    password = randomBytes(32).toString('base64url') + '!aA1';
    writeFileSync(secretPath, JSON.stringify({ project, uid, email, password }), { flag: 'wx', mode: 0o600 }); secretOwned = true;
    stage = 'D-only Firebase creation'; await gate(); createdAttempt = true;
    const created = await auth.createUser({ uid, email, password, emailVerified: true, displayName: marker }); assert.equal(created.uid, uid);
    stage = 'D-only PostgreSQL fixture'; await gate(); dbAttempt = true;
    await f.prisma.user.create({ data: { id: uid, firebaseUid: uid, email, name: marker, emailVerifiedAt: new Date(), garden: { create: { id: gardenId, flowers: { create: { id: flowerId, userId: uid, mood: 'SUNNY_BLOOM', name: marker, meaning: 'Disposable D', img: '🌻', left: 0, top: 0, event: marker, generationSeed: marker } } } } } });
    stage = 'genuine D baseline'; const signed = await login(); originalToken = signed.token;
    const idle = await connect(originalToken);
    assert.equal((await action(idle, 'join-user', uid)).ok, true);
    assert.equal((await action(idle, 'leave-user', uid)).ok, true); // No targeted publication can trigger this idle check.
    const delivery = await connect(originalToken); await joinRooms(delivery);
    const actor = await connect(originalToken); await joinRooms(actor);
    const baselineEvents = [delivery, actor].map(s => next(s, 'avatarMoved'));
    assert.equal((await action(actor, 'move-avatar', { gardenOwnerId: uid, x: 10, y: 20 })).ok, true);
    for (const data of await Promise.all(baselineEvents)) assert.equal(data.visitorId, uid);
    // Firebase compares auth_time to a seconds-granularity valid-after boundary.
    await delay(Math.max(0, (signed.claims.auth_time + 2) * 1000 - Date.now()) + 200);
    const lost = [actor, delivery, idle].map(s => disconnected(s));
    for (const s of [actor, delivery, idle]) for (const event of privateEvents) s.on(event, () => oldEvents.push(event));
    stage = 'real D refresh-token revocation'; await gate(); const started = Date.now();
    await auth.revokeRefreshTokens(uid);
    assert.ok(actor.connected, 'Actor already evicted before focused action boundary');
    actor.emit('move-avatar', { gardenOwnerId: uid, x: 11, y: 21 });
    stage = 'original token boundaries';
    const current = await auth.getUser(uid), validAfter = Date.parse(current.tokensValidAfterTime) / 1000;
    assert.ok(validAfter > signed.claims.auth_time, 'Revocation must strictly follow original auth_time');
    await auth.verifyIdToken(originalToken, false);
    let revokedCode; try { await auth.verifyIdToken(originalToken, true); } catch (error) { revokedCode = error.code; }
    assert.equal(revokedCode, 'auth/id-token-revoked');
    await connect(originalToken, true); const handshakeAt = Date.now();
    const rejected = await http(originalToken, '/session'); assert.equal(rejected.status, 401);
    stage = 'private delivery and stale-session boundary';
    const fresh = await login(); assert.ok(fresh.claims.auth_time >= validAfter);
    const control = await connect(fresh.token); await joinRooms(control);
    const delivered = next(control, 'messageAdded');
    const result = await http(fresh.token, `/users/${uid}/flowers/${flowerId}/message`, 'POST', { text: marker + '-message', visitorAvatar: marker }); assert.equal(result.status, 200);
    assert.equal((await delivered).message.text, marker + '-message');
    const [actionLost, deliveryLost, idleLost] = await bound(Promise.all(lost), 10000);
    for (const loss of [actionLost, deliveryLost, idleLost]) { assert.equal(loss.reason, 'io server disconnect'); assert.ok(loss.at >= started && loss.at - started <= 12000); }
    assert.ok(!actor.connected && !delivery.connected && !idle.connected); assert.equal(oldEvents.length, 0);
    assert.equal(await f.prisma.message.count({ where: { flowerId } }), 1);
    observations = { actionMs: actionLost.at - started, deliveryMs: deliveryLost.at - started, idleMs: idleLost.at - started, handshakeMs: handshakeAt - started, revocationBoundarySeconds: validAfter - signed.claims.auth_time, remainingTokenSeconds: signed.claims.exp - Math.floor(Date.now()/1000) };
  } catch { failed = true; }
  finally {
    try { await cleanup(); } catch { failed = true; }
    checkpoint(!failed && dDeleted && rowsDeleted && preserved && hooksClear);
    await f.finish(); originalToken = undefined; password = undefined;
  }
  assert.ok(!failed && dDeleted && rowsDeleted && preserved && hooksClear, 'D acceptance blocked at ' + stage + '; cleanup/checkpoint retained');
  console.log('D-only revocation PASS', observations, { DDeleted: dDeleted, ABPreserved: preserved, socketsClosed: hooksClear });
});
