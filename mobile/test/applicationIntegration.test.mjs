import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPlantingModules } from './loadPlantingModules.mjs';
import { hookHarness } from './flowerDetail.test.mjs';
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
function setup(fetch, extras = {}, react) {
  const load = loadPlantingModules(undefined, react, {}, false, { fetch, ...extras });
  return { api: load('../../../services/api'), events: load('../../../services/events'), load };
}
test('authenticated requests refresh once on 401, preserve idempotency and reject anonymous requests', async () => {
  const calls = [], refreshes = [];
  const { api, events } = setup(async (url, options) => {
    calls.push({ url, options }); return response(calls.length === 1 ? { error: 'expired' } : { event: { id: 'event-1' } }, calls.length === 1 ? 401 : 201);
  });
  api.configureApi({ apiBaseUrl: 'https://petalpal.example/', getAccessToken: async (force) => {
    refreshes.push(force); return force ? 'fresh-test-token' : 'initial-test-token';
  } });
  await events.createEvent('  My own Event  ', 'FIRE_BLOOM', 'test-key');
  assert.deepEqual(refreshes, [false, true]);
  assert.equal(calls[1].url, 'https://petalpal.example/events');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer fresh-test-token');
  assert.equal(calls[0].options.headers['Idempotency-Key'], calls[1].options.headers['Idempotency-Key']);
  assert.deepEqual(JSON.parse(calls[1].options.body), { content: 'My own Event', primaryGardenMood: 'FIRE_BLOOM' });
  api.configureApi(null);
  await assert.rejects(events.readEvent('event-1'), /Sign in/);
  assert.equal(calls.length, 2);
});
test('403 consent/ownership failures do not refresh or retry', async () => {
  let calls = 0;
  const { api, events } = setup(async () => { calls++; return response({ error: 'Consent required', code: 'CONSENT_REQUIRED' }, 403); });
  api.configureApi({ apiBaseUrl: '', getAccessToken: async () => 'test-token' });
  await assert.rejects(events.readEvent('event-1'), (err) => err.status === 403 && err.code === 'CONSENT_REQUIRED');
  assert.equal(calls, 1);
});
test('logout discards a private response that was already in flight', async () => {
  let finish, started;
  const ready = new Promise((resolve) => { started = resolve; });
  const { api, events } = setup(async () => { started(); return new Promise((resolve) => { finish = resolve; }); });
  api.configureApi({ apiBaseUrl: '', getAccessToken: async () => 'test-token' });
  const pending = events.readEvent('event-1'); await ready;
  api.configureApi(null); finish(response({ content: 'Private owner content' }));
  await assert.rejects(pending, /session changed/);
});
test('garden reads only owner Event flowers; canonical species/modifiers survive layout adaptation', async () => {
  const flower = { id: 'flower-1', userId: 'owner', sourceEventId: 'event-1', speciesCode: 'SUNFLOWER',
    name: 'Sunflower', mood: 'SUNNY_BLOOM', img: 'sunflower.png', createdAt: '2026-10-01T01:00:00Z',
    colorAccent: 'WARM_GOLD', visualEffect: 'SUBTLE_MIST', event: 'Private text', supportCount: 3,
    sourceEvent: { secondaryEmotions: ['gratitude','fear'] } };
  const { api, events } = setup(async (url) => {
    assert.equal(url, '/users/owner/garden'); return response({ flowers: [flower, { id: 'journal-flower' }] });
  });
  api.configureApi({ apiBaseUrl: '', getAccessToken: async () => 'test-token' });
  const flowers = await events.eventFlowers('owner'); assert.equal(flowers.length, 1);
  const record = events.plantingRecord(flowers[0], 'America/Vancouver');
  assert.equal(record.month, 9); assert.equal(record.speciesCode, 'SUNFLOWER');
  assert.equal(record.colorAccent, 'WARM_GOLD'); assert.equal(record.visualEffect, 'SUBTLE_MIST');
  assert.deepEqual(Array.from(record.secondaryEmotions), ['gratitude','fear']);
  assert.equal(record.notes, undefined); assert.equal(record.event, undefined);
  assert.equal(events.plantingRecord(flower, 'UTC', '2026-02-28').month, 2);
});
test('layout storage isolates accounts and rejects a save across an account switch', async () => {
  const items = new Map();
  let deferredRead = null;
  // Native AsyncStorage is injected, never stores a Firebase bearer token here.
  const nativeLoad = loadPlantingModules(undefined, undefined, {
    getItem: async (key) => deferredRead ? await deferredRead : items.get(key) || null,
    setItem: async (key, value) => items.set(key, value),
  }, false);
  const storage = nativeLoad('plantingPersistence');
  storage.scopeFlowerPlacements('alice'); await storage.saveFlowerPlacements([{ id: 'alice-flower', flowerId: 'a' }]);
  storage.scopeFlowerPlacements('bob'); assert.equal((await storage.loadFlowerPlacements()).length, 0);
  storage.scopeFlowerPlacements('alice'); assert.equal((await storage.loadFlowerPlacements())[0].id, 'alice-flower');
  let resolve; deferredRead = new Promise((done) => { resolve = done; });
  const saving = storage.addOrUpdateFlowerPlacement({ id: 'a2', flowerId: 'a2' });
  storage.scopeFlowerPlacements('bob'); resolve(null);
  await assert.rejects(saving, /account changed/);
  assert.equal(items.has('petalpal_flower_placements_v1:bob'), false);
});
test('emotion pending, success and safe fallback remain distinct', () => {
  const { events } = setup(async () => response({}));
  assert.match(events.emotionMessage('PENDING'), /pending/);
  assert.match(events.emotionMessage('SUCCESS'), /ready/);
  assert.match(events.emotionMessage('FAILED'), /Event is saved/);
  assert.match(events.emotionMessage('SKIPPED'), /skipped/);
  assert.match(events.memoryMessage({ id: 'job', status: 'PENDING' }), /pending/);
  assert.match(events.memoryMessage({ id: 'job', status: 'SUCCEEDED' }), /completed/);
  assert.match(events.memoryMessage({ id: 'job', status: 'FAILED' }), /Event remains saved/);
  assert.match(events.memoryMessage(null), /No memory work/);
});
test('Firebase auth lifecycle syncs backend identity, signs out, and prevents late session restoration', async () => {
  const hooks = hookHarness();
  let changed, signedOut = false;
  const user = { getIdToken: async () => 'firebase-test-token' };
  const auth = { currentUser: user, authStateReady: async () => {} };
  const firebase = {
    onAuthStateChanged: (_auth, cb) => { changed = cb; return () => {}; },
    signInWithEmailAndPassword: async () => { auth.currentUser = user; changed(); },
    signOut: async () => { signedOut = true; auth.currentUser = null; changed(); },
  };
  let calls = 0, finish, started;
  const ready = new Promise((resolve) => { started = resolve; });
  const { load } = setup(async (url, options) => {
    assert.equal(url, '/auth/session');
    assert.deepEqual(JSON.parse(options.body), { deferProfileCreation: true });
    if (++calls === 2) { started(); return new Promise((resolve) => { finish = resolve; }); }
    return response({ user: { id: 'owner' } });
  }, { 'firebase/auth': firebase, './firebase': { firebaseAuth: () => auth } }, hooks.react);
  const provider = load('../../../services/auth');
  hooks.mount(() => provider.AuthProvider({ children: null }).props.value);
  changed(); let state = await hooks.flush();
  assert.equal(state.session.user.id, 'owner');
  const syncing = state.retry(); await ready;
  await state.logout(); finish(response({ user: { id: "owner" } })); await syncing; state = await hooks.flush();
  assert.equal(signedOut, true); assert.equal(state.session, null);
});

test('Event screen requires a user-selected Primary and retries a failed save without duplicating its key', async () => {
  const hooks = hookHarness(); const calls = [];
  const fakeEvent = { id: 'event-ui', primaryGardenMood: 'SUNNY_BLOOM', secondaryEmotions: [], emotionStatus: 'FAILED' };
  const { load } = setup(async () => response({}), {
    'react-native': { ActivityIndicator: 'ActivityIndicator', Button: 'Button', Image: 'Image', Pressable: 'Pressable',
      ScrollView: 'ScrollView', Text: 'Text', TextInput: 'TextInput', View: 'View', StyleSheet: { create: (styles) => styles } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-router': { router: { push() {} }, useFocusEffect() {} },
    '../services/auth': { useAuth: () => ({ session: { user: { id: 'owner' } } }) },
    '../services/events': {
      PRIMARY_MOODS: ['SUNNY_BLOOM','QUIET_BLOOM'], memoryMessage: () => 'Memory pending', emotionMessage: () => 'Event saved with safe fallback',
      createEvent: async (content, mood, key) => {
        calls.push({ content, mood, key }); if (calls.length === 1) throw new Error('Temporary network failure');
        return { event: fakeEvent, flower: null, memoryJob: { id: 'job-ui', status: 'PENDING' } };
      },
    },
    '../components/garden/planting/flowerDetailApi': { sourceFlowerImageUri: (path) => path },
  }, hooks.react);
  const screen = load('../../../app/journal');
  const nodes = (tree) => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object'
    ? [tree, ...nodes(tree.props?.children)] : [];
  let tree = hooks.mount(() => screen.default());
  nodes(tree).find((n) => n.type === 'TextInput').props.onChangeText('Explicit owner Event'); tree = await hooks.flush();
  assert.equal(nodes(tree).find((n) => n.props.title === 'Save Event').props.disabled, true);
  nodes(tree).find((n) => n.props.accessibilityRole === 'radio').props.onPress(); tree = await hooks.flush();
  assert.equal(nodes(tree).find((n) => n.props.title === 'Save Event').props.disabled, false);
  await nodes(tree).find((n) => n.props.title === 'Save Event').props.onPress(); tree = await hooks.flush();
  await nodes(tree).find((n) => n.props.title === 'Save Event').props.onPress(); tree = await hooks.flush();
  assert.equal(calls.length, 2); assert.equal(calls[0].key, calls[1].key);
  assert.equal(calls[1].mood, 'SUNNY_BLOOM'); assert.equal(calls[1].content, 'Explicit owner Event');
  assert.equal(nodes(tree).find((n) => n.type === 'TextInput').props.value, '');
});
