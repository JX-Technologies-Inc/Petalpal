import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPlantingModules } from './loadPlantingModules.mjs';

const load = loadPlantingModules();
const { scheduleAction, scheduleRest, wanderTarget, wanderPause, USER_HOLD_MS, RETRY_MS, WANDER_PAUSE_MS } = load('../fairy/fairySchedule');
const { FairyNavigation } = load('../fairy/FairyNavigation');
const { WALK_NETWORK, WALK_START, distance } = load('../fairy/walkNetwork');
const { mailboxApproachAnchor } = load('../fairy/mailboxDestination');
const { treehouseInteriorAnchor } = load('../fairy/treehouseDestination');

const plain = value => JSON.parse(JSON.stringify(value)); // VM-realm objects
const base = { navState: 'idle', position: WALK_START, mailboxStand: mailboxApproachAnchor, placed: true, now: 1_000_000,
  userAt: 0, idleSince: 1_000_000, pauseMs: 10_000, retryAt: 0 };
const act = (rest, change = {}) => scheduleAction({ ...base, rest, ...change });

test('every server state maps to a place in the Garden', () => {
  assert.deepEqual(['TEA_TIME', 'SWINGING', 'SLEEPING', 'IN_TREEHOUSE', 'AT_MAILBOX', 'IDLE'].map(scheduleRest),
    ['tea', 'swing', 'moon', 'treehouse', 'mailbox', 'path']);
  assert.equal(scheduleRest('SOMETHING_NEW'), null);
  assert.equal(scheduleRest(undefined), null);
});

test('opening the Garden places her; later changes send her there; settled means wait', () => {
  assert.equal(act('tea', { placed: false }), 'place');
  assert.equal(act('tea'), 'go');
  assert.equal(act('tea', { navState: 'drinkingTea' }), 'wait');
  assert.equal(act('swing', { navState: 'drinkingTea' }), 'go');
  assert.equal(act('moon', { navState: 'sleepingOnMoonBed' }), 'wait');
  assert.equal(act('swing', { navState: 'insideTreehouse' }), 'leaveTreehouse');
  assert.equal(act('treehouse', { navState: 'insideTreehouse' }), 'wait');
  // The mailbox is a place to stand, never the letter sequence.
  assert.equal(act('mailbox', { position: mailboxApproachAnchor }), 'wait');
  assert.equal(act('mailbox'), 'go');
});

test('travel, letters and a recent tap are never interrupted', () => {
  for (const navState of ['walking', 'flyingToTea', 'aligningToSwing', 'enteringTreehouse', 'movingToMailbox', 'presentingMail', 'mailboxTransition']) {
    assert.equal(act('swing', { navState }), 'wait', navState);
  }
  assert.equal(act('tea', { userAt: base.now - USER_HOLD_MS + 1 }), 'wait');
  assert.equal(act('tea', { userAt: base.now - USER_HOLD_MS }), 'go');
  assert.equal(act('tea', { retryAt: base.now + RETRY_MS }), 'wait');
  // Even the first placement waits for a tap's minute to pass.
  assert.equal(act('tea', { placed: false, userAt: base.now }), 'place');
});

test('on a walk she pauses, then strolls; from a seat she sets off at once', () => {
  assert.equal(act('path'), 'wait');
  assert.equal(act('path', { idleSince: base.now - base.pauseMs }), 'wander');
  assert.equal(act('path', { navState: 'sittingOnSwing' }), 'wander');
  const random = (() => { let i = 0; return () => [0.1, 0.5, 0.9][i++ % 3]; })();
  for (let i = 0; i < 6; i++) {
    const target = wanderTarget(WALK_NETWORK.nodes, WALK_START, random);
    assert.ok(WALK_NETWORK.nodes.includes(target) && distance(target, WALK_START) >= 120);
  }
  assert.equal(wanderTarget([WALK_START], WALK_START, Math.random), null);
  // Strolls stay within walking distance whenever such a point exists, and she walks there.
  for (const [i, from] of WALK_NETWORK.nodes.entries()) {
    const target = wanderTarget(WALK_NETWORK.nodes, from, () => (i * 0.37) % 1);
    const near = WALK_NETWORK.nodes.some(node => distance(node, from) >= 120 && distance(node, from) <= 450);
    if (near) assert.ok(distance(target, from) <= 450, `node ${i}`);
  }
  const walker = new FairyNavigation(); walker.place('path', WALK_NETWORK.nodes[3]);
  const stroll = wanderTarget(WALK_NETWORK.nodes, walker.position, () => 0.5);
  assert.equal(walker.move(stroll, () => false), true);
  assert.equal(walker.state, 'walking');
  for (let i = 0; i < 2000 && walker.state !== 'idle'; i++) walker.update(50, () => false);
  assert.equal(walker.state, 'idle');
  assert.ok(distance(walker.position, stroll) < 1, 'she arrives and stands still for her next pause');
  for (const r of [0, 0.5, 0.999]) {
    const pause = wanderPause(() => r);
    assert.ok(pause >= WANDER_PAUSE_MS[0] && pause <= WANDER_PAUSE_MS[1]);
  }
});

test('placing her needs no travel and leaves her able to move on', () => {
  const blocked = () => false;
  const expected = { tea: 'drinkingTea', swing: 'sittingOnSwing', moon: 'sleepingOnMoonBed', treehouse: 'insideTreehouse', mailbox: 'idle', path: 'idle' };
  for (const [rest, state] of Object.entries(expected)) {
    const nav = new FairyNavigation();
    assert.equal(nav.place(rest, WALK_NETWORK.nodes[5]), true);
    assert.equal(nav.state, state, rest);
    assert.deepEqual(plain([nav.remaining.length, nav.lift, nav.airborne]), [0, 0, false], rest);
  }
  const inside = new FairyNavigation(); inside.place('treehouse');
  assert.deepEqual(plain([inside.position, inside.treehouseDepth]), plain([treehouseInteriorAnchor, 1]));
  assert.equal(inside.returnFromTreehouse(), true, 'she can come out of the treehouse');
  const seated = new FairyNavigation(); seated.place('swing');
  assert.equal(seated.move(WALK_NETWORK.nodes[10], blocked), true, 'she can leave the swing');
  assert.equal(seated.state === 'sittingOnSwing', false);
  const path = new FairyNavigation(); path.place('path', WALK_NETWORK.nodes[7]);
  assert.deepEqual(plain(path.position), plain(WALK_NETWORK.nodes[7]));
  const mailbox = new FairyNavigation(); mailbox.place('mailbox');
  assert.deepEqual(plain(mailbox.position), plain(mailboxApproachAnchor));
});
