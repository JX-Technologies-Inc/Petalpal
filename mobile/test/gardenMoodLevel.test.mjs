import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPlantingModules } from './loadPlantingModules.mjs';
const { gardenMoodLevel, moodEffectActiveToday, PRIMARY_MOOD_LEVELS } = loadPlantingModules()('../flower-mood-effects/gardenMoodLevel');

test('each Primary Garden Mood maps to the owner-approved effect level', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(PRIMARY_MOOD_LEVELS)), {
    SUNNY_BLOOM: 'very_positive', WONDER_BLOOM: 'positive', GENTLE_BLOOM: 'positive',
    PEACEFUL_BLOOM: 'neutral', HEALING_BLOOM: 'neutral', DRIFTING_BLOOM: 'neutral', FIRE_BLOOM: 'neutral',
    QUIET_BLOOM: 'negative' });
  for (const legacy of ['happy', 'sad', 'Peaceful', '', undefined]) assert.equal(gardenMoodLevel(legacy), 'neutral');
});

test('secondary emotions strengthen one step in the same direction only', () => {
  assert.equal(gardenMoodLevel('QUIET_BLOOM', ['disappointment']), 'very_negative');
  assert.equal(gardenMoodLevel('QUIET_BLOOM', ['remorse', 'love']), 'very_negative');
  assert.equal(gardenMoodLevel('QUIET_BLOOM', ['joy']), 'negative');
  assert.equal(gardenMoodLevel('WONDER_BLOOM', ['excitement']), 'very_positive');
  assert.equal(gardenMoodLevel('GENTLE_BLOOM', ['gratitude']), 'very_positive');
  assert.equal(gardenMoodLevel('GENTLE_BLOOM', ['sadness']), 'positive');
  assert.equal(gardenMoodLevel('SUNNY_BLOOM', ['sadness', 'remorse']), 'very_positive');
  for (const mood of ['FIRE_BLOOM', 'HEALING_BLOOM', 'PEACEFUL_BLOOM', 'DRIFTING_BLOOM']) {
    assert.equal(gardenMoodLevel(mood, ['joy', 'excitement', 'sadness', 'remorse']), 'neutral', mood);
  }
});

test('an effect lasts only for the planting day in the account timezone', () => {
  const planted = '2026-10-20T06:30:00.000Z'; // Oct 19, 23:30 in Vancouver; Oct 20 in UTC
  assert.equal(moodEffectActiveToday(planted, 'America/Vancouver', new Date('2026-10-20T06:59:00Z')), true);
  assert.equal(moodEffectActiveToday(planted, 'America/Vancouver', new Date('2026-10-20T07:00:00Z')), false); // local midnight
  assert.equal(moodEffectActiveToday(planted, 'UTC', new Date('2026-10-20T23:59:00Z')), true);
  assert.equal(moodEffectActiveToday(planted, 'UTC', new Date('2026-10-21T00:00:00Z')), false);
  for (const zone of [undefined, '', 'Not/AZone']) assert.equal(moodEffectActiveToday(planted, zone, new Date(planted)), false);
  assert.equal(moodEffectActiveToday('not-a-date', 'UTC'), false);
});

const adapter = loadPlantingModules(undefined, undefined, undefined, true, {
  '@shopify/react-native-skia': {}, 'react-native-reanimated': {}, 'react-native': { AppState: {} },
})('../flower-mood-effects/GardenMoodEffects');
const now = new Date('2026-10-20T18:00:00Z');
const flower = (overrides = {}) => ({ id: 'f1', flowerId: 'f1', sourceEventId: 'e1', mood: 'SUNNY_BLOOM', secondaryEmotions: [],
  plantedDate: '2026-10-20T16:00:00Z', worldX: 100, worldY: 200, month: 10, ...overrides });
const types = list => JSON.parse(JSON.stringify(list.map(item => item.effects.map(effect => effect.effectType))));

test('garden effects: the partner\'s effect pair per level, today only, Event flowers only', () => {
  assert.deepEqual(types(adapter.gardenMoodEffectsFor([flower()], 'UTC', now)), [['sparkle', 'glow']]);
  assert.deepEqual(types(adapter.gardenMoodEffectsFor([flower({ mood: 'WONDER_BLOOM' })], 'UTC', now)), [['sparkle']]);
  assert.deepEqual(types(adapter.gardenMoodEffectsFor([flower({ mood: 'QUIET_BLOOM' })], 'UTC', now)), [['light_rain']]);
  assert.deepEqual(types(adapter.gardenMoodEffectsFor([flower({ mood: 'QUIET_BLOOM', secondaryEmotions: ['remorse'] })], 'UTC', now)), [['light_rain', 'raindrop']]);
  for (const mood of ['FIRE_BLOOM', 'PEACEFUL_BLOOM', 'HEALING_BLOOM', 'DRIFTING_BLOOM', 'happy']) {
    assert.deepEqual(adapter.gardenMoodEffectsFor([flower({ mood })], 'UTC', now).length, 0, mood);
  }
  assert.equal(adapter.gardenMoodEffectsFor([flower({ plantedDate: '2026-10-19T16:00:00Z' })], 'UTC', now).length, 0); // yesterday
  assert.equal(adapter.gardenMoodEffectsFor([flower({ sourceEventId: undefined })], 'UTC', now).length, 0); // sample/local flower
  assert.equal(adapter.gardenMoodEffectsFor([flower()], undefined, now).length, 0); // no account timezone
});

test('garden effects keep the secondary-emotion accent colour and a stable per-flower seed', () => {
  const [tinted] = adapter.gardenMoodEffectsFor([flower({ colorAccent: 'SOFT_PINK' })], 'UTC', now);
  assert.ok(tinted.effects.every(effect => effect.color === '#eba2bd'));
  const [plain] = adapter.gardenMoodEffectsFor([flower()], 'UTC', now);
  assert.ok(plain.effects.every(effect => effect.color && effect.color !== '#eba2bd'));
  const again = adapter.gardenMoodEffectsFor([flower()], 'UTC', now)[0];
  assert.equal(again.effects[0].seed, plain.effects[0].seed);
  assert.notEqual(adapter.gardenMoodEffectsFor([flower({ id: 'f2' })], 'UTC', now)[0].effects[0].seed, plain.effects[0].seed);
});
