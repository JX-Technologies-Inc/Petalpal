import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPlantingModules } from './loadPlantingModules.mjs';
test('Reflection discovers metadata then reads the selected report through existing authenticated GET', async () => {
  const calls = [];
  const load = loadPlantingModules(undefined, undefined, undefined, false, { fetch: async (url, options) => {
    calls.push({ url, options }); return { ok: true, status: 200, json: async () => ({ reports: [], nextCursor: null }) };
  } });
  load('../../../services/api').configureApi({ apiBaseUrl: 'http://localhost:3107', getAccessToken: async () => 'test-token' });
  const service = load('../../../services/reflections');
  await service.listReflections();
  await service.listReflections('next-cursor');
  await service.readReflection({ type: 'weekly', id: 'weekly-1' });
  await service.readReflection({ type: 'monthly', id: 'monthly-2' });
  assert.deepEqual(calls.map(call => call.url), [
    'http://localhost:3107/ai/reports?limit=20', 'http://localhost:3107/ai/reports?limit=20&cursor=next-cursor',
    'http://localhost:3107/ai/reports/weekly/weekly-1', 'http://localhost:3107/ai/reports/monthly/monthly-2',
  ]);
  for (const call of calls) {
    assert.equal(call.options.method, 'GET');
    assert.equal(call.options.body, undefined);
    assert.equal(call.options.headers.Authorization, 'Bearer test-token');
  }
});
