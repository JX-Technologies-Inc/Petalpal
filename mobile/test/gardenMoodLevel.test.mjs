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
