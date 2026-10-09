import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPlantingModules } from './loadPlantingModules.mjs';

function service(apiRequest) {
  return loadPlantingModules({}, null, null, true, { './api': { apiRequest } })('../../../services/bookhouse');
}
const entry = (id, localDate) => ({ id, localDate, createdAt: `${localDate}T00:00:00.000Z`, journal: { id, content: `Entry ${id}` }, emotionResult: null, flower: null });

test('Journal client traverses all pages for older shelf/month/day navigation and refresh/empty history', async () => {
  const newest = Array.from({ length: 50 }, (_, i) => entry(`new-${i}`, '2026-10-01'));
  const oldest = entry('old', '2023-12-31');
  const calls = [];
  const api = service(async (path, method, body, options) => {
    calls.push({ path, method, body, options });
    if (path.includes('cursor=')) return { journals: [oldest], nextCursor: null };
    return { journals: newest, nextCursor: 'cursor_2' };
  });
  const rows = await api.readJournals('owner');
  assert.equal(rows.length, 51); assert.equal(new Set(rows.map(row => row.id)).size, 51);
  assert.equal(calls[0].path, '/users/owner/journals?view=page&limit=50');
  assert.equal(calls[1].path, '/users/owner/journals?view=page&limit=50&cursor=cursor_2');
  assert.ok(Array.from(api.journalYears(rows)).includes(2023));
  assert.deepEqual(Array.from(rows.filter(row => row.localDate === api.monthKey(2023, 12) + '-31'), row => row.id), ['old']);
  await api.readJournals('owner'); assert.equal(calls[2].path, calls[0].path); // Refresh starts at page one.
  assert.equal((await service(async () => ({ journals: [], nextCursor: null })).readJournals('owner')).length, 0);
});

test('Journal client preserves complete legacy-server arrays without fallback truncation', async () => {
  const legacy = Array.from({ length: 123 }, (_, i) => entry(`legacy-${i}`, '2023-01-01'));
  let requests = 0;
  const api = service(async () => { requests++; return legacy; });
  assert.equal(await api.readJournals('owner'), legacy); assert.equal(requests, 1);
});

test('Journal client stops cancelled or malformed/repeating pages and never returns incomplete history', async () => {
  const controller = new AbortController(); let calls = 0;
  const api = service(async (_path, _method, _body, { signal }) => {
    assert.equal(signal, controller.signal); calls++; controller.abort();
    return { journals: [entry('one', '2026-10-01')], nextCursor: 'next' };
  });
  await assert.rejects(api.readJournals('owner', controller.signal), /cancelled/); assert.equal(calls, 1);
  for (const response of [{ journals: [], nextCursor: 'next' }, { journals: [], nextCursor: undefined },
    { journals: Array(51).fill(entry('one', '2026-10-01')), nextCursor: null }]) {
    await assert.rejects(service(async () => response).readJournals('owner'), /complete Journal history/);
  }
  let repeated = 0;
  await assert.rejects(service(async () => { repeated++; return { journals: [entry('one', '2026-10-01')], nextCursor: 'repeat' }; }).readJournals('owner'), /complete Journal history/);
  assert.equal(repeated, 2);
  let failures = 0;
  await assert.rejects(service(async () => {
    if (failures++) throw new Error('page unavailable');
    return { journals: [entry('one', '2026-10-01')], nextCursor: 'next' };
  }).readJournals('owner'), /page unavailable/);
});
