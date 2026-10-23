import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPlantingModules } from './loadPlantingModules.mjs';

const load = loadPlantingModules();
const { TAP_LINES, RECENT_TAP_LINES, tapActivity, hitsFairySprite, pickTapLine, zhHans } = load('../fairy/tapLines');
const ACTIVITY_OF = { SWINGING: 'sittingOnSwing', SLEEPING: 'sleepingOnMoonBed', TEA_TIME: 'seatedAtTea', IDLE: 'idle' };

test('only resting states answer a tap', () => {
  assert.equal(tapActivity('sittingOnSwing'), 'SWINGING');
  assert.equal(tapActivity('drinkingTea'), 'TEA_TIME');
  for (const moving of ['walking', 'flying', 'flyingToSwing', 'retrievingMail', 'insideTreehouse'])
    assert.equal(pickTapLine(moving, 'en', []), null);
});

test('every bundled line is valid and each activity has its own lines', () => {
  const ids = new Set();
  for (const line of TAP_LINES) {
    assert.ok(!ids.has(line.id), line.id); ids.add(line.id);
    assert.ok(['SWINGING', 'SLEEPING', 'TEA_TIME', 'IDLE', 'ANY'].includes(line.activity));
    assert.ok(line.en.length > 0 && line.en.length <= 60, line.id);
    assert.ok([...line.zh].length > 0 && [...line.zh].length <= 24, line.id);
    assert.ok(!line.zh.includes('小仙女'), line.id);
  }
  for (const activity of Object.keys(ACTIVITY_OF)) assert.ok(TAP_LINES.some(line => line.activity === activity));
});

test('a tap picks a line for her activity or a general one, in the owner language', () => {
  for (const [activity, state] of Object.entries(ACTIVITY_OF)) {
    for (let i = 0; i < 20; i++) {
      const line = pickTapLine(state, 'en', [], () => i / 20);
      const source = TAP_LINES.find(item => item.id === line.id);
      assert.ok(source.activity === activity || source.activity === 'ANY');
      assert.equal(line.text, source.en);
    }
  }
  const zh = pickTapLine('idle', 'zh-Hans', [], () => 0);
  assert.equal(zh.text, TAP_LINES.find(item => item.id === zh.id).zh);
  assert.equal(zhHans('zh-Hant'), false);
  assert.equal(zhHans('zh-CN'), true);
});

test('recent lines are skipped while others remain, and reused once all were shown', () => {
  const pool = TAP_LINES.filter(line => line.activity === 'SWINGING' || line.activity === 'ANY').map(line => line.id);
  const recent = pool.slice(0, RECENT_TAP_LINES);
  for (let i = 0; i < 20; i++) assert.ok(!recent.includes(pickTapLine('sittingOnSwing', 'en', recent, () => i / 20).id));
  assert.ok(pool.includes(pickTapLine('sittingOnSwing', 'en', pool, () => 0.5).id));
});

test('her activity lines weigh three times a general line', () => {
  const lines = [{ id: 'a', activity: 'IDLE', source: 'seed', en: 'a', zh: 'a' }, { id: 'b', activity: 'ANY', source: 'seed', en: 'b', zh: 'b' }];
  assert.equal(pickTapLine('idle', 'en', [], () => 0.74, lines).id, 'a');
  assert.equal(pickTapLine('idle', 'en', [], () => 0.76, lines).id, 'b');
});

test('the tap target covers her sprite above the foot pivot only', () => {
  const at = { x: 1000, y: 800 };
  assert.ok(hitsFairySprite({ x: 1000, y: 730 }, at));
  assert.ok(!hitsFairySprite({ x: 1000, y: 600 }, at));
  assert.ok(!hitsFairySprite({ x: 1100, y: 760 }, at));
  assert.ok(!hitsFairySprite({ x: 1000, y: 760 }, null));
});
