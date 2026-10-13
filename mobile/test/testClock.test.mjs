// T01/T02 client side: TEST-only logical Event date. Pure module tests; no network.
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPlantingModules } from './loadPlantingModules.mjs';

const response = (data, status = 201) => ({ ok: status < 400, status, json: async () => data });
const HEADER = 'X-PetalPal-Simulated-Time';

function setup(development) {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, options });
    return response({ event: { id: 'event-1', localDate: '2026-10-08' }, flower: { id: 'flower-1' }, memoryJob: null });
  };
  const load = loadPlantingModules(undefined, undefined, { getItem: async () => null }, false, { fetch }, development);
  const api = load('../../../services/api');
  api.configureApi({ apiBaseUrl: '', getAccessToken: async () => 'test-token' });
  return { calls, load, clock: load('../../../services/testClock'), events: load('../../../services/events'),
    dates: load('../calendarDates') };
}

test('release builds ignore TEST dates: no header, no synthetic placement, device calendar day', async () => {
  const { calls, clock, events, dates } = setup(false);
  clock.setSimulatedEventDate('2026-10-08');
  assert.equal(clock.simulatedEventDate(), null);
  assert.equal(Object.keys(clock.simulatedTimeHeaders()).length, 0);
  await events.createEvent('Event', 'FIRE_BLOOM', 'release-key-1');
  assert.equal(Object.hasOwn(calls[0].options.headers, HEADER), false);
  assert.equal(clock.syntheticFlowerDay('flower-1'), null);
  assert.equal(dates.calendarPlacementDay('2026-10-12T19:00:00.000Z', '2026-10-08', false),
    dates.calendarRecordDay('2026-10-12T19:00:00.000Z'));
});

test('development TEST date is sent, places the Flower on the Event day, and resets to device time', async () => {
  const { calls, clock, events, dates } = setup(true);
  assert.equal(Object.keys(clock.simulatedTimeHeaders()).length, 0);
  await events.createEvent('Before TEST date', 'FIRE_BLOOM', 'dev-key-0');
  assert.equal(Object.hasOwn(calls[0].options.headers, HEADER), false);
  assert.equal(clock.syntheticFlowerDay('flower-1'), null, 'real-time Events are never remembered as synthetic');

  const before = clock.testClockSnapshot();
  clock.setSimulatedEventDate('2026-10-08');
  assert.ok(clock.testClockSnapshot() > before);
  await events.createEvent('Exam week', 'FIRE_BLOOM', 'dev-key-1');
  assert.equal(calls[1].options.headers[HEADER], '2026-10-08');
  assert.equal(calls[1].options.headers['Idempotency-Key'], 'dev-key-1');
  assert.deepEqual(JSON.parse(calls[1].options.body), { content: 'Exam week', primaryGardenMood: 'FIRE_BLOOM' });
  assert.equal(clock.syntheticFlowerDay('flower-1'), '2026-10-08');
  assert.equal(dates.calendarPlacementDay('2026-10-12T19:00:00.000Z', clock.syntheticFlowerDay('flower-1'), true), '2026-10-08');

  clock.setSimulatedEventDate(null);
  assert.equal(Object.keys(clock.simulatedTimeHeaders()).length, 0);
  await events.createEvent('After reset', 'FIRE_BLOOM', 'dev-key-2');
  assert.equal(Object.hasOwn(calls[2].options.headers, HEADER), false);
});

test('TEST dates are validated and repeatable', () => {
  const { clock, dates } = setup(true);
  assert.throws(() => clock.setSimulatedEventDate('2026-02-30'), /YYYY-MM-DD/);
  assert.throws(() => clock.setSimulatedEventDate('2026-10-08T00:00:00Z'), /YYYY-MM-DD/);
  for (const key of ['2026-09-29', '2026-10-31', '2026-11-01']) {
    clock.setSimulatedEventDate(key);
    assert.equal(clock.simulatedEventDate(), key);
    assert.equal(dates.calendarDateKey(dates.calendarToday(new Date(2026, 9, 12), dates.localDateValue(key), true)), key);
  }
  let notified = 0;
  const unsubscribe = clock.subscribeTestClock(() => { notified += 1; });
  clock.setSimulatedEventDate(null);
  unsubscribe();
  clock.setSimulatedEventDate('2026-10-05');
  assert.equal(notified, 1);
});
