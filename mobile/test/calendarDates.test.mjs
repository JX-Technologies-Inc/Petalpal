import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPlantingModules } from './loadPlantingModules.mjs';
const { calendarDateKey, calendarRecordDay, calendarToday } = loadPlantingModules()('../calendarDates');
test('calendar preserves local dates and date-only historical records', () => {
  assert.equal(calendarDateKey(new Date(2026, 9, 5, 23, 59)), '2026-10-05');
  assert.equal(calendarRecordDay('2026-10-05'), '2026-10-05');
  assert.equal(calendarRecordDay('invalid'), null);
  const instant = new Date('2026-10-06T01:00:00Z');
  assert.equal(calendarRecordDay(instant.toISOString()), calendarDateKey(instant));
});
test('release today always ignores a simulated date', () => {
  const device = new Date(2026, 9, 5), simulated = new Date(2027, 0, 1);
  assert.equal(calendarToday(device, simulated, false), device);
  assert.equal(calendarToday(device, simulated, true), simulated);
  assert.equal(calendarToday(device, null, true), device);
});
