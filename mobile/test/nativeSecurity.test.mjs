import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPlantingModules } from './loadPlantingModules.mjs';
const env = { EXPO_PUBLIC_NATIVE_SECURITY_TEST: '1', EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'petalpal-native-security-test',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'petalpal-native-security-test.firebaseapp.com', EXPO_PUBLIC_FIREBASE_API_KEY: 'synthetic',
  EXPO_PUBLIC_FIREBASE_APP_ID: 'synthetic', EXPO_PUBLIC_API_BASE_URL: 'https://synthetic-test.trycloudflare.com' };
function load(environment, development, globals = {}, storage = {}) {
  return loadPlantingModules(undefined, undefined, storage, false, { env: environment, globalThis: globals }, development);
}
test('hooks are absent in normal development and production', () => {
  for (const dev of [true, false]) {
    const globals = {};
    load({}, dev, globals)('plantingPersistence');
    assert.equal(globals.__PETALPAL_NATIVE_SECURITY__, undefined);
  }
});
test('production build rejects test flag before adapter use', () => {
  assert.throws(() => load(env, false)('plantingPersistence'), /isolation cannot be confirmed/);
});
test('native test hooks available but unarmed; inspection contains metadata only and does not mutate storage', async () => {
  const items = new Map([['petalpal_flower_placements_v1:production', 'PRIVATE'], ['firebase:synthetic', 'SECRET']]);
  let mutations = 0;
  const storage = { getAllKeys: async () => [...items.keys()], getItem: async key => items.get(key) ?? null,
    setItem: async () => { mutations++; }, removeItem: async () => { mutations++; } };
  const globals = {};
  load(env, true, globals, storage)('plantingPersistence');
  const hooks = globals.__PETALPAL_NATIVE_SECURITY__;
  for (const key of ['inspect', 'failNext', 'holdNextWrite', 'releaseWrite', 'resetHooks', 'prepareGlobalPreference', 'removeGlobalPreference']) {
    assert.equal(typeof hooks[key], 'function');
  }
  const snapshot = await hooks.inspect();
  assert.equal(snapshot.available, true);
  assert.equal(snapshot.namespaceKeyCount, 0);
  assert.equal(snapshot.failureArmed, null);
  assert.equal(snapshot.writeHeld, false);
  assert.equal(mutations, 0);
  assert.ok(!JSON.stringify(snapshot).includes('PRIVATE'));
  assert.ok(!JSON.stringify(snapshot).includes('SECRET'));
  assert.ok(!JSON.stringify(snapshot).includes('production'));
});
test('native diagnostics observe memory and durable cleanup without exposing records', async () => {
  const items = new Map();
  const storage = { getAllKeys: async () => [...items.keys()], getItem: async key => items.get(key) ?? null,
    setItem: async (key, value) => { items.set(key, value); }, removeItem: async key => { items.delete(key); } };
  const globals = {};
  const cache = load(env, true, globals, storage)('plantingPersistence');
  const hooks = globals.__PETALPAL_NATIVE_SECURITY__;
  await cache.scopeFlowerPlacements('synthetic-owner');
  await cache.saveFlowerPlacements([{ id: 'synthetic-private-marker' }]);
  const before = await hooks.inspect();
  assert.equal(before.memoryCachePresent, true);
  assert.equal(before.memoryRecordCount, 1);
  assert.equal(before.scopedRecordCount, 1);
  assert.ok(!JSON.stringify(before).includes('synthetic-private-marker'));
  const cleanup = cache.scopeFlowerPlacements(null);
  const during = await hooks.inspect();
  assert.equal(during.memoryCachePresent, false);
  assert.equal(during.memoryRecordCount, 0);
  assert.equal(await cleanup, true);
  const after = await hooks.inspect();
  assert.equal(after.namespaceKeyCount, 0);
  assert.equal(after.memoryCachePresent, false);
  assert.equal(after.memoryRecordCount, 0);
});
test('mobile guard refuses malformed flag, missing fields, production Firebase and production API', () => {
  for (const change of [{ EXPO_PUBLIC_NATIVE_SECURITY_TEST: '2' }, { EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'petalpal-b212c' },
    { EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: '' }, { EXPO_PUBLIC_FIREBASE_API_KEY: '' }, { EXPO_PUBLIC_FIREBASE_APP_ID: '' },
    { EXPO_PUBLIC_API_BASE_URL: 'https://petalpal-v2.onrender.com' }, { EXPO_PUBLIC_API_BASE_URL: 'http://localhost:3108' }]) {
    assert.throws(() => load({ ...env, ...change }, true)('plantingPersistence'));
  }
});
test('active API connection cannot override the verified test origin', () => {
  const api = load(env, true)('../../../services/api');
  assert.throws(() => api.configureApi({ apiBaseUrl: 'https://different-test.trycloudflare.com', getAccessToken: async () => null }), /boundary mismatch/);
});
