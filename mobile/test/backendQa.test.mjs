import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPlantingModules } from './loadPlantingModules.mjs';
import { hookHarness } from './flowerDetail.test.mjs';

test('backend QA retains only owner-scoped counts, without private source data', async () => {
  const calls = [];
  const load = loadPlantingModules(undefined, undefined, undefined, false, {
    './sessionExperience': { loadSessionExperience: async () => ({ user: { id: 'alice', email: 'private@example.test' }, hasCheckedInToday: true, secret: 'private' }) },
    './garden': { loadGarden: async (...args) => {
      calls.push(args);
      return ['EVENT', 'DAILY', 'HISTORICAL'].map(sourceType => ({ sourceType, secondaryEmotions: sourceType === 'EVENT' ? ['gratitude'] : [], event: 'private journal' }));
    } },
  });
  const summary = await load('../../../services/backendQa').loadBackendQaSummary('alice');
  assert.deepEqual(JSON.parse(JSON.stringify(summary)), {
    ownerId: 'alice', flowers: 3, eventFlowers: 1, historicalOrDailyFlowers: 2,
    flowersWithSecondaryEmotions: 1, checkedInToday: true,
  });
  assert.deepEqual(calls, [['alice', 'alice']]);
});

test('backend QA stops before Garden reads when the authenticated owner changed', async () => {
  let gardenReads = 0;
  const load = loadPlantingModules(undefined, undefined, undefined, false, {
    './sessionExperience': { loadSessionExperience: async () => ({ user: { id: 'bob' } }) },
    './garden': { loadGarden: async () => { gardenReads++; return []; } },
  });
  await assert.rejects(load('../../../services/backendQa').loadBackendQaSummary('alice'), /Session changed/);
  assert.equal(gardenReads, 0);
});

test('backend QA hides previous owner results immediately and rejects late requests after account switch', async () => {
  const hooks = hookHarness();
  let owner = 'alice', finish, requests = 0;
  const load = loadPlantingModules(undefined, hooks.react, undefined, false, {
    '../services/backendQa': { loadBackendQaSummary: async ownerId => {
      if (++requests === 2) return new Promise(resolve => { finish = resolve; });
      return { ownerId, flowers: ownerId === 'alice' ? 5 : 0 };
    } },
  });
  const useQa = load('../../../hooks/useBackendQa').useBackendQa;
  hooks.mount(() => useQa(owner, true));
  assert.equal((await hooks.flush()).summary.flowers, 5);
  const pending = hooks.render().refresh(); await hooks.flush();
  owner = 'bob'; assert.equal(hooks.render().summary, null);
  assert.equal((await hooks.flush()).summary.flowers, 0);
  finish({ ownerId: 'alice', flowers: 5 }); await pending;
  assert.equal((await hooks.flush()).summary.ownerId, 'bob');
});

test('disabled backend QA never makes a request, including manual refresh', async () => {
  const hooks = hookHarness(); let requests = 0;
  const load = loadPlantingModules(undefined, hooks.react, undefined, false, {
    '../services/backendQa': { loadBackendQaSummary: async () => { requests++; } },
  });
  hooks.mount(() => load('../../../hooks/useBackendQa').useBackendQa('alice', false));
  const state = await hooks.flush(); await state.refresh();
  assert.equal(requests, 0); assert.equal(state.summary, null);
});
