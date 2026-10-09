import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPlantingModules } from './loadPlantingModules.mjs';

test('history adapter requests owner metadata and preserves date/navigation/display fields', async () => {
  const paths = [];
  const load = loadPlantingModules({}, null, null, true, { './api': { apiRequest: async path => {
    paths.push(path); return { owner: { id: path.includes('/other/') ? 'other' : 'owner' }, flowers: [{ id: 'flower', createdAt: '2026-10-01', name: 'Rose', sourceEventId: 'event', sourceEvent: { secondaryEmotions: ['joy'] } }] };
  } } });
  const { loadGarden } = load('../../../services/garden');
  const rows = await loadGarden('owner', 'owner');
  assert.equal(paths[0], '/users/owner/garden?view=metadata'); assert.equal(rows[0].sourceEventId, 'event'); assert.equal(rows[0].createdAt, '2026-10-01'); assert.equal(rows[0].sourceType, 'EVENT'); assert.equal(rows[0].secondaryEmotions[0], 'joy');
  const social = await loadGarden('other', 'owner'); assert.equal(paths[1], '/users/other/garden'); assert.equal(social[0].sourceEventId, undefined); assert.equal(social[0].secondaryEmotions.length, 0);
});
test('session adapter consumes reduced check-in and owner metadata', async () => {
  const load = loadPlantingModules({}, null, null, true, { './api': { apiRequest: async path => {
    assert.equal(path, '/session?view=metadata'); return { user: { id: 'owner' }, fairyState: null, todayCheckIn: { id: 'checkin', localDate: '2026-10-01' }, hasCheckedInToday: true, garden: { owner: { id: 'owner' } } };
  } } });
  const data = await load('../../../services/sessionExperience').loadSessionExperience(); assert.equal(data.gardenOwnerId, 'owner'); assert.equal(data.todayCheckIn.id, 'checkin'); assert.equal(data.hasCheckedInToday, true);
});
