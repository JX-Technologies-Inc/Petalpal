import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPlantingModules } from './loadPlantingModules.mjs';

test('REST and Socket client share the configured origin and refresh bearer identity', async () => {
  const origin = 'https://petalpal-v2.onrender.com';
  const requests = [], sockets = [], refreshes = [];
  const load = loadPlantingModules(undefined, undefined, undefined, true, {
    env: { EXPO_PUBLIC_API_BASE_URL: origin },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: requests.length > 1, status: requests.length > 1 ? 200 : 401, json: async () => ({ ok: true }) };
    },
    'socket.io-client': { io: (url, options) => {
      sockets.push({ url, options }); return { on() {}, off() {}, disconnect() {}, emit() {} };
    } }
  });
  const api = load('../../../services/api');
  api.configureApi({ apiBaseUrl: api.apiBaseUrl(), getAccessToken: async force => {
    refreshes.push(Boolean(force)); return force ? 'synthetic-new' : 'synthetic-current';
  } });
  await api.apiRequest('/auth/session', 'POST', { deferProfileCreation: true });
  assert.deepEqual(requests.map(r => r.url), [`${origin}/auth/session`, `${origin}/auth/session`]);
  assert.equal(requests[1].options.headers.Authorization, 'Bearer synthetic-new');
  assert.equal(requests[0].options.credentials, undefined); // No cross-site cookie dependency.
  assert.deepEqual(refreshes, [false, true]);
  const flowers = load('flowerDetailApi');
  const unsubscribe = flowers.subscribeToFlowerUpdates('synthetic-owner', 'synthetic-flower', () => {});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sockets[0].url, origin);
  let auth;
  await sockets[0].options.auth(value => { auth = value; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(auth.token, 'synthetic-current');
  api.configureApi(null);
  await sockets[0].options.auth(value => { auth = value; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(auth.token, null); unsubscribe();
});
