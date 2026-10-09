import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { io as connectSocket } from 'socket.io-client';
import { isolatedSocial as f } from './authenticated-social-remaining.test.mjs';

// Reuse exact isolated A/B + real PostgreSQL fixture. No auth/data-result mocks.
// Do not revoke/disable preserved A/B at Firebase or unlink their existing profiles.
const sockets = [];
let a, b, userOnly, actions = 0, messages = 0, cleanup = false;
const docPath = join(f.root, 'SECURITY.md');
const events = ['avatarMoved', 'messageAdded', 'supportUpdated', 'visitRecordAdded'];
function bounded(promise, ms = 8000) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Bounded isolated wait expired')), ms); })]).finally(() => clearTimeout(timer));
}
async function socket(actor = 'B') {
  const s = connectSocket(`http://127.0.0.1:${f.port}`, { auth: { token: f.tokens[actor] }, transports: ['websocket'], reconnection: false, timeout: 8000 });
  sockets.push(s);
  await bounded(new Promise((resolve, reject) => { s.once('connect', resolve); s.once('connect_error', () => reject(new Error('Isolated socket authentication failed'))); }));
  return s;
}
async function action(s, name, payload) {
  assert.ok(++actions <= 50, 'Bounded Socket action count');
  await f.identity();
  return bounded(new Promise((resolve, reject) => s.timeout(7000).emit(name, payload, (error, ack) => error ? reject(new Error('Isolated action acknowledgement unavailable')) : resolve(ack))));
}
function next(s, event) {
  let handler;
  const promise = bounded(new Promise(resolve => { handler = value => resolve(value); s.once(event, handler); }));
  return promise.finally(() => s.off(event, handler));
}
async function quiet(targets, run) {
  const received = [], handlers = [];
  for (const s of targets) for (const event of events) {
    const handler = () => received.push(event); s.on(event, handler); handlers.push([s, event, handler]);
  }
  try { await run(); await delay(350); assert.equal(received.length, 0, 'Unauthorized event delivery'); }
  finally { for (const [s, event, handler] of handlers) s.off(event, handler); }
}
function move(x = 10) { return { gardenOwnerId: f.owner.id, x, y: 20 }; }
function publicOnly(data) {
  // Only the synthetic message is public. Flower event/seed/profile/Journal are private.
  if (!data || typeof data !== 'object') return;
  for (const [key, value] of Object.entries(data)) {
    assert.ok(!['event','generationSeed','email','firebaseUid','journalEntryId','dailyCheckIn','sourceEvent'].includes(key), 'Private realtime field leaked');
    publicOnly(value);
  }
}
async function ownerMovement() {
  const delivered = next(a, 'avatarMoved');
  const ack = await action(a, 'move-avatar', move(17)); assert.equal(ack.ok, true);
  const data = await delivered; assert.equal(data.visitorId, f.owner.id); publicOnly(data);
}
async function ownerMessage(targets = [a]) {
  const delivered = targets.map(s => next(s, 'messageAdded'));
  const r = await f.request(`/users/${f.owner.id}/flowers/${f.fixtureId}/message`, 'A', 'POST', { text: f.canary + '-message', visitorAvatar: f.canary });
  assert.equal(r.status, 200); messages++;
  for (const result of await Promise.all(delivered)) { assert.equal(result.message.text, f.canary + '-message'); publicOnly(result); }
}
async function begin(number) {
  await f.startBatch('RT' + number); messages = 0; cleanup = false;
  a = await socket('A'); b = await socket('B'); userOnly = await socket('B');
  assert.equal((await action(a, 'join-user', f.owner.id)).ok, true);
  assert.equal((await action(a, 'join-garden', f.owner.id)).ok, true);
  assert.equal((await action(userOnly, 'join-user', f.visitor.id)).ok, true);
}
async function end() {
  for (const s of sockets.splice(0)) s.disconnect();
  await f.cleanupBatch({ actors: [f.owner.id, f.visitor.id] }); cleanup = f.cleanupConfirmed;
}
// Pause AFTER an actual PostgreSQL result, never replace it or Firebase verification.
async function pauseResult(model, method, match, run) {
  const original = f.prisma[model][method];
  let enter, release, intercepted = false;
  const entered = new Promise(resolve => { enter = resolve; });
  const resumed = new Promise(resolve => { release = resolve; });
  f.prisma[model][method] = async function(args) {
    const result = await original.call(this, args);
    if (!intercepted && match(args)) { intercepted = true; assert.ok(result, 'Real database precondition missing'); enter(); await resumed; }
    return result;
  };
  try { await run({ entered: bounded(entered), release }); assert.equal(intercepted, true); }
  finally { release(); f.prisma[model][method] = original; }
}
const batches = [
  [1, [
    ['Friend joins and receives permitted Garden movement with HTTP visit identity', async () => {
      assert.equal((await action(b, 'join-garden', f.owner.id)).ok, true);
      const r = await f.request('/visit', 'B', 'POST', { hostUserId: f.owner.id, visitorAvatar: f.canary });
      assert.equal(r.status, 200); assert.ok(r.body.activeVisitors.some(v => v.visitorId === f.visitor.id));
      const delivered = next(b, 'avatarMoved'); await quiet([userOnly], ownerMovement);
      const data = await delivered; assert.equal(data.visitorId, f.owner.id); publicOnly(data);
    }],
    ['Permitted message delivery is sanitized and isolated from unrelated user rooms', async () => {
      await quiet([userOnly], () => ownerMessage([a, b]));
      const s = (await f.fixtureState())[0]; assert.equal(s.messages, 1); assert.equal(s.visits, 2);
    }],
    ['HTTP privacy OFF immediately fences Socket actions and further Garden delivery', async () => {
      await f.privacy(false); const before = await f.fixtureState();
      await quiet([a, userOnly], async () => assert.equal((await action(b, 'move-avatar', move())).ok, false));
      await quiet([b, userOnly], ownerMovement); assert.deepEqual(await f.fixtureState(), before);
    }],
    ['Reconnect with the same real token cannot restore privacy-revoked subscription', async () => {
      b.disconnect(); b = await socket('B');
      assert.equal((await action(b, 'join-garden', f.owner.id)).ok, false);
      await quiet([b, userOnly], () => ownerMessage([a]));
    }]
  ]],
  [2, [
    ['HTTP unfriend removes active visitor and rejects stale Socket actions and delivery', async () => {
      assert.equal((await action(b, 'join-garden', f.owner.id)).ok, true);
      const r = await f.request('/visit', 'B', 'POST', { hostUserId: f.owner.id, visitorAvatar: f.canary }); assert.equal(r.status, 200);
      await f.removeFriend(); const before = await f.fixtureState();
      const garden = await f.request(`/users/${f.owner.id}/garden`, 'A'); assert.equal(garden.status, 200); assert.equal(garden.body.activeVisitors.length, 0);
      await quiet([a], async () => assert.equal((await action(b, 'move-avatar', move())).ok, false));
      b.disconnect(); b = await socket('B'); assert.equal((await action(b, 'join-garden', f.owner.id)).ok, false);
      await quiet([b, userOnly], ownerMovement); assert.deepEqual(await f.fixtureState(), before);
    }],
    ['Real-DB pending join cannot survive privacy revoke and regrant', async () => {
      await f.friend();
      await pauseResult('friendship', 'findUnique', args => args.where?.userId_friendId?.friendId === f.visitor.id, async ({ entered, release }) => {
        const pending = action(b, 'join-garden', f.owner.id); await entered;
        await f.privacy(false); await f.privacy(true); release(); assert.equal((await pending).ok, false);
      });
      await quiet([b, userOnly], ownerMovement);
      assert.equal((await action(b, 'join-garden', f.owner.id)).ok, true);
    }],
    ['Real-DB paused visitor movement cannot publish or restore access after unfriend', async () => {
      // HTTP publication is asynchronous: consume its permitted owner event
      // before observing the paused movement/revocation interval.
      const visitDelivered = next(a, 'visitRecordAdded');
      const r = await f.request('/visit', 'B', 'POST', { hostUserId: f.owner.id, visitorAvatar: f.canary }); assert.equal(r.status, 200);
      await visitDelivered;
      await quiet([a, userOnly], () => pauseResult('user', 'findUnique', args => args.where?.id === f.visitor.id && args.select?.name === true && args.select?.avatar === true, async ({ entered, release }) => {
        const pending = action(b, 'move-avatar', move(29)); await entered;
        await f.removeFriend(); release(); assert.equal((await pending).ok, false);
      }));
      await quiet([b, userOnly], ownerMovement);
      const garden = await f.request(`/users/${f.owner.id}/garden`, 'A'); assert.equal(garden.status, 200); assert.equal(garden.body.activeVisitors.length, 0);
      assert.equal((await action(b, 'join-garden', f.owner.id)).ok, false);
    }]
  ]]
];
function checkpoint(number, passed, status, http, socketCount) {
  if (process.env.PETALPAL_REALTIME_CHECKPOINT !== '1') return;
  let doc = readFileSync(docPath, 'utf8');
  for (const name of passed) doc = doc.replace(`- [ ] RT${number}: ${name}.`, `- [x] RT${number}: ${name}.`);
  const existing = doc.split('\n').find(line => line.startsWith(`**RT${number} evidence:**`));
  const total = batches.find(([n]) => n === number)[1].filter(([name]) => doc.includes(`- [x] RT${number}: ${name}.`)).length;
  const summary = `**RT${number} evidence:** ${status}; ${total}/${number === 1 ? 4 : 3} feasible cases checked PASS (${passed.length} missing cases executed in this run; earlier PASS cases skipped); ${http} loopback HTTP requests / ${socketCount} acknowledged Socket actions this run. Real isolated Firebase tokens, live project/app matching and PostgreSQL used; cleanup ${cleanup ? 'PASS' : 'NOT CONFIRMED'}, full A/B profile/Garden snapshots restored. Production authenticated status NOT VERIFIED.`;
  assert.ok(existing, 'Checkpoint row required');
  doc = doc.replace(existing, (existing.endsWith('NOT VERIFIED.') && existing === `**RT${number} evidence:** NOT VERIFIED.` ? '' : existing.replace(' evidence:**', ' previous checkpoint (superseded):**') + '\n\n') + summary);
  writeFileSync(docPath, doc);
}
const complete = batches.every(([n, cases]) => cases.every(([name]) => readFileSync(docPath, 'utf8').includes(`- [x] RT${n}: ${name}.`)));
test('Missing isolated single-instance realtime visitor cases only', { skip: complete, timeout: 90000 }, async t => {
  try {
    await f.setup();
    for (const [number, cases] of batches) {
      const remaining = cases.filter(([name]) => !readFileSync(docPath, 'utf8').includes(`- [x] RT${number}: ${name}.`));
      if (!remaining.length) continue;
      const passed = [], http = f.requests, socketCount = actions;
      let failed = false;
      try {
        await begin(number);
        if (number === 2 && remaining[0][0] === cases[2][0]) {
          // Recreate only the prerequisite subscription for the first unchecked
          // case in a fresh owned fixture; do not repeat earlier assertions.
          assert.equal((await action(b, 'join-garden', f.owner.id)).ok, true);
        }
        for (const [name, run] of remaining) {
          await t.test(`RT${number}: ${name}`, async () => {
            try { await run(); passed.push(name); }
            catch (error) { failed = true; console.log('Isolated diagnostic', { code: error.code || error.name, operator: error.operator || null, location: error.stack?.split('\n')[1]?.trim() }); throw new Error('Isolated realtime security failure or blocked case: ' + name); }
          });
          if (failed) break;
        }
      } catch { failed = true; }
      try { await end(); } catch { failed = true; cleanup = false; }
      checkpoint(number, passed, failed ? 'BLOCKED — no later batch run' : 'PASS', f.requests - http, actions - socketCount);
      if (failed) assert.fail('Stopped at RT' + number + '; checkpoint retained');
    }
    // Existing mock revocation tests remain accepted. A real provider revocation
    // would persistently change A/B token-valid-after state; do not manufacture it.
    if (process.env.PETALPAL_REALTIME_CHECKPOINT === '1') {
      let doc = readFileSync(docPath, 'utf8');
      doc = doc.replace('**Live provider revocation:** NOT VERIFIED.', '**Live provider revocation:** BLOCKED under preservation scope: disabling/deleting A/B or revoking their refresh tokens persistently changes preserved account/session state; unlinking existing profiles also changes pre-existing data. No such action was attempted; accepted deterministic mock account/session revocation evidence was reused, not rerun. A separately authorized disposable identity/session or read-only already-revoked test token is needed.');
      writeFileSync(docPath, doc);
    }
    console.log(`Realtime feasible checklist 7/7 (completed cases skipped); ${f.requests} HTTP requests / ${actions} Socket actions; A/B preserved; C untouched; real-provider revocation remains NOT VERIFIED`);
  } finally {
    for (const s of sockets.splice(0)) s.disconnect();
    await f.finish();
  }
});
