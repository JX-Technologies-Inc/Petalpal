import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPlantingModules } from './loadPlantingModules.mjs';
const prefix = 'petalpal_flower_placements_v1';
const ownerKey = owner => `${prefix}:${encodeURIComponent(owner)}`;
const privateRecord = { id: 'private', flowerId: 'flower', emotion: 'synthetic' };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function setup(web, initial = {}) {
  const items = new Map(Object.entries(initial)); let failure, writeGate;
  const adapter = {
    get length() { return items.size; }, key: i => [...items.keys()][i] ?? null,
    getAllKeys: async () => { if (failure === 'keys') throw new Error('private diagnostic'); return [...items.keys()]; },
    getItem: key => { if (failure === 'read') throw new Error('private diagnostic'); return items.get(key) ?? null; },
    setItem: async (key, value) => { if (failure === 'write') throw new Error('private diagnostic'); if (writeGate) await writeGate.promise; items.set(key, value); },
    removeItem: key => { if (failure === 'erase') throw new Error('private diagnostic'); items.delete(key); },
  };
  // Browser storage writes are synchronous.
  const browser = { ...adapter, get length() { return items.size; }, setItem: (key, value) => {
    if (failure === 'write') throw new Error('private diagnostic'); items.set(key, value);
  } };
  const reload = () => loadPlantingModules(browser, undefined, adapter, web)('plantingPersistence');
  return { items, reload, cache: reload(), fail: value => { failure = value; }, gate: value => { writeGate = value; } };
}
for (const web of [true, false]) {
  const platform = web ? 'browser' : 'native';
  test(`${platform}: logout erases owner/legacy/orphan caches; reload stays empty and globals/Firebase survive`, async () => {
    const globals = { theme: 'dark', background: 'land', petalpal_planting_mask_refinement_v1_month_1: 'mask', 'firebase:authUser:synthetic': 'SDK-owned' };
    const s = setup(web, { ...globals, [prefix]: '[{}]', [ownerKey('orphan')]: '[{}]' });
    await s.cache.scopeFlowerPlacements('alice');
    await s.cache.saveFlowerPlacements([privateRecord]);
    assert.ok(s.items.has(ownerKey('alice')));
    await s.cache.scopeFlowerPlacements(null);
    assert.deepEqual(Object.fromEntries(s.items), globals);
    const restored = s.reload();
    await restored.scopeFlowerPlacements('alice');
    assert.equal((await restored.loadFlowerPlacements()).length, 0);
    assert.deepEqual(Object.fromEntries(s.items), globals);
  });
  test(`${platform}: A to B and A again reject delayed writes/updates/removes/resets`, async () => {
    const s = setup(web); await s.cache.scopeFlowerPlacements('alice');
    const old = s.cache.capturePlacementSession();
    await s.cache.saveFlowerPlacements([privateRecord], old);
    await s.cache.scopeFlowerPlacements('bob');
    await s.cache.saveFlowerPlacements([privateRecord], old);
    assert.equal((await s.cache.addOrUpdateFlowerPlacement(privateRecord, old)).length, 0);
    assert.equal((await s.cache.removeFlowerPlacement('flower', old)).length, 0);
    assert.equal((await s.cache.resetFlowerPlacements(old)).length, 0);
    assert.equal((await s.cache.loadFlowerPlacements()).length, 0);
    await s.cache.scopeFlowerPlacements('alice');
    await s.cache.saveFlowerPlacements([privateRecord], old);
    assert.equal((await s.cache.loadFlowerPlacements()).length, 0);
    assert.equal(s.items.size, 0);
  });
  test(`${platform}: failed erasure gates reads/writes and retries the old owner on next activation`, async () => {
    const s = setup(web); await s.cache.scopeFlowerPlacements('alice');
    await s.cache.saveFlowerPlacements([privateRecord]); s.fail('erase');
    assert.equal(await s.cache.scopeFlowerPlacements('bob'), false);
    await assert.rejects(s.cache.loadFlowerPlacements(), /cache is unavailable/);
    await assert.rejects(s.cache.saveFlowerPlacements([privateRecord]), /cache is unavailable/);
    s.fail(null); assert.equal(await s.cache.scopeFlowerPlacements('bob'), true);
    assert.equal(s.items.size, 0);
  });
  for (const operation of ['read', 'write']) test(`${platform}: ${operation} failure closes storage without memory fallback`, async () => {
    const s = setup(web); await s.cache.scopeFlowerPlacements('alice');
    await s.cache.saveFlowerPlacements([privateRecord]); s.fail(operation);
    await assert.rejects(operation === 'read' ? s.cache.loadFlowerPlacements() : s.cache.saveFlowerPlacements([]), /cache is unavailable/);
    s.fail(null); await assert.rejects(s.cache.loadFlowerPlacements(), /cache is unavailable/);
    await s.cache.scopeFlowerPlacements('alice'); assert.equal((await s.cache.loadFlowerPlacements()).length, 0);
  });
}
test('native: erase waits for an already-started write and removes its durable result', async () => {
  const s = setup(false); await s.cache.scopeFlowerPlacements('alice');
  const gate = deferred(); s.gate(gate);
  const saving = s.cache.saveFlowerPlacements([privateRecord]);
  await new Promise(resolve => setImmediate(resolve));
  const logout = s.cache.scopeFlowerPlacements(null);
  gate.resolve(); await saving; assert.equal(await logout, true); assert.equal(s.items.size, 0);
});
test('native: key enumeration failure fails closed', async () => {
  const s = setup(false); s.fail('keys');
  assert.equal(await s.cache.scopeFlowerPlacements('alice'), false);
  await assert.rejects(s.cache.saveFlowerPlacements([privateRecord]), /cache is unavailable/);
});
