import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPlantingModules } from './loadPlantingModules.mjs';

test('Garden root releases unique image handles only after successful reconciler unmount', async () => {
  const { configureGardenWebRootCleanup } = loadPlantingModules()('../webNativeHandles');
  const deleted = [];
  const handle = name => ({ isDeleted() { return deleted.includes(name); }, delete() { deleted.push(name); } });
  const shared = handle('image'), cachedOnly = handle('cached-only'), disposed = handle('already-disposed'); disposed.delete();
  const nodes = [{ props: { image: { __typename__: 'Image', ref: shared } }, children: [
    { props: { image: { __typename__: 'Image', ref: shared } } },
    { props: { image: { __typename__: 'Image', ref: disposed } } },
    { props: { gardenImageReferences: [{ __typename__: 'Image', ref: shared }, { __typename__: 'Image', ref: cachedOnly }, { __typename__: 'Image', ref: disposed }] } },
  ] }];
  let finish;
  const teardown = [];
  const prototype = { unmount() {
    this.container.unmounted = true;
    return new Promise(resolve => { finish = resolve; });
  } };
  configureGardenWebRootCleanup(prototype, id => id === 1);
  const garden = Object.assign(Object.create(prototype), { container: {
    nativeId: 1, root: nodes, mapperId: 42, redraw() {
      assert.equal(this.unmounted, true); assert.equal(shared.isDeleted(), false);
      this.mapperId = null; teardown.push('mapper stopped');
    },
  } });
  const result = garden.unmount(); assert.deepEqual(deleted, ['already-disposed']);
  assert.deepEqual(teardown, ['mapper stopped']); assert.equal(garden.container.mapperId, null);
  finish(true); assert.equal(await result, true); assert.deepEqual(deleted, ['already-disposed', 'image', 'cached-only']);
  const otherHandle = handle('other');
  const other = Object.assign(Object.create(prototype), { container: { nativeId: 2, root: [{ props: { image: { __typename__: 'Image', ref: otherHandle } } }] } });
  const unrelated = other.unmount(); finish(true); await unrelated; assert.equal(otherHandle.isDeleted(), false);
  const failing = { unmount() { return Promise.reject(new Error('unmount failed')); } };
  configureGardenWebRootCleanup(failing, () => true);
  const failedHandle = handle('failed');
  const failed = Object.assign(Object.create(failing), { container: { nativeId: 1, root: [{ props: { image: { __typename__: 'Image', ref: failedHandle } } }] } });
  await assert.rejects(failed.unmount(), /unmount failed/); assert.equal(failedHandle.isDeleted(), false);
});

test('Web image ownership works with a bound loader, nullable decode and explicit disposal', () => {
  const { configureGardenWebNativeOwnership } = loadPlantingModules()('../webNativeHandles');
  let finalized, deleted = 0;
  const registry = new Map();
  const image = { ref: { delete() { deleted++; }, isDeleted() { return deleted > 0; } } };
  const decoder = { MakeImageFromEncoded(bytes) {
    assert.equal(this, decoder); return bytes ? image : null;
  } };
  configureGardenWebNativeOwnership({}, [[decoder, ['MakeImageFromEncoded']]], release => {
    finalized = release;
    return { register(owner, ref, token) { registry.set(token, ref); }, unregister(token) { return registry.delete(token); } };
  });
  const load = decoder.MakeImageFromEncoded.bind(decoder);
  assert.equal(load(new Uint8Array([1])), image); assert.equal(load(null), null);
  assert.equal(registry.get(image), image.ref); assert.equal(deleted, 0);
  finalized(registry.get(image)); assert.equal(deleted, 1);
  finalized(image.ref); assert.equal(deleted, 1);
});

test('Web native ownership preserves live pooled handles and retires replaced Paint refs', () => {
  const { configureGardenWebNativeOwnership } = loadPlantingModules()('../webNativeHandles');
  const deleted = [], registrations = new Map();
  let finalize;
  const handle = id => ({ deleted: false, delete() {
    assert.equal(this.deleted, false); this.deleted = true; deleted.push(id);
  }, isDeleted() { return this.deleted; } });
  const prototype = {
    assign(value) { if (value.fail) throw new Error('copy failed'); this.ref = value.ref; },
    reset() { this.ref = handle('reset'); },
    copy() { return Object.assign(Object.create(prototype), { ref: handle('copy') }); },
  };
  const factory = {
    Paint() { assert.equal(this, factory); return Object.assign(Object.create(prototype), { ref: handle('original') }); },
    Nullable() { return null; },
  };
  const registry = { register(owner, ref, token) {
    assert.equal(owner, token); registrations.set(token, ref);
  }, unregister(token) { return registrations.delete(token); } };
  const configure = () => configureGardenWebNativeOwnership(prototype,
    [[factory, ['Paint', 'Nullable']], [prototype, ['copy']]], callback => { finalize = callback; return registry; });
  configure();
  const wrapped = factory.Paint; configure(); assert.equal(factory.Paint, wrapped);
  const paint = factory.Paint(), copy = paint.copy();
  assert.deepEqual(deleted, []); // A live paint/pool reference is never eagerly deleted.
  assert.equal(registrations.get(copy), copy.ref);
  const next = handle('assigned'); paint.assign({ ref: next });
  assert.deepEqual(deleted, ['original']); assert.equal(registrations.get(paint), next);
  paint.assign({ ref: next }); assert.deepEqual(deleted, ['original']);
  assert.throws(() => paint.assign({ fail: true }), /copy failed/);
  assert.equal(registrations.get(paint), next); assert.equal(next.isDeleted(), false);
  paint.reset(); assert.deepEqual(deleted, ['original', 'assigned']);
  const retired = registrations.get(copy); registrations.delete(copy); finalize(retired);
  assert.equal(copy.ref.isDeleted(), true); assert.equal(paint.ref.isDeleted(), false);
  paint.ref.delete(); finalize(paint.ref); // Explicit disposal before GC does not double-delete.
  assert.deepEqual(deleted, ['original', 'assigned', 'copy', 'reset']);
  assert.equal(factory.Nullable(), null);
});

test('retired Garden rejects late unmount pictures while other/live/reused IDs work', () => {
  const { ownGardenWebView } = loadPlantingModules()('../webCanvasCache');
  const deleted = [], shown = [];
  const picture = id => ({ dispose() { deleted.push(id); } });
  const api = {
    views: { 1: { setPicture(value) { shown.push(value); } }, 2: { setPicture(value) { shown.push(value); } } },
    deferedPictures: {}, deferedOnSize: {},
    setJsiProperty(id, name, value) {
      assert.equal(this, api);
      if (name !== 'picture') return;
      if (this.views[id]) this.views[id].setPicture(value);
      else this.deferedPictures[id] = value;
    },
  };
  const release = ownGardenWebView(api, 1);
  api.setJsiProperty(1, 'picture', picture('live'));
  release();
  api.setJsiProperty(1, 'picture', picture('late-unmount'));
  api.setJsiProperty(1, 'picture', picture('late-mapper'));
  assert.deepEqual(deleted, ['live', 'late-unmount', 'late-mapper']);
  assert.equal(api.deferedPictures[1], undefined);
  const other = picture('other'); api.setJsiProperty(2, 'picture', other);
  const deferred = picture('unrelated'); api.setJsiProperty(3, 'picture', deferred);
  assert.equal(shown.at(-1), other); assert.equal(api.deferedPictures[3], deferred);
  api.views[1] = { setPicture(value) { shown.push(value); } };
  const releaseAgain = ownGardenWebView(api, 1);
  const remounted = picture('remounted'); api.setJsiProperty(1, 'picture', remounted);
  assert.equal(shown.at(-1), remounted); assert.equal(deleted.includes('remounted'), false);
  releaseAgain(); assert.equal(deleted.at(-1), 'remounted');
});

test('Garden Web view releases replaced pictures and unregisters only its own view', () => {
  const { ownGardenWebView } = loadPlantingModules()('../webCanvasCache');
  const deleted = [], shown = [];
  const picture = id => ({ dispose() { deleted.push(id); } });
  const deferred = picture('deferred'), first = picture('first'), second = picture('second');
  const other = { setPicture() {} };
  const api = { views: { 1: { setPicture(value) { shown.push(value); } }, 2: other },
    deferedPictures: { 1: deferred, 2: picture('other') }, deferedOnSize: { 1: {}, 2: {} } };
  const release = ownGardenWebView(api, 1);
  api.views[1].setPicture(first);
  api.views[1].setPicture(first);
  api.views[1].setPicture(second);
  assert.deepEqual(deleted, ['deferred', 'first']);
  assert.deepEqual(shown, [first, first, second]);
  release(); release();
  assert.deepEqual(deleted, ['deferred', 'first', 'second']);
  assert.equal(api.views[1], undefined);
  assert.equal(api.deferedPictures[1], undefined);
  assert.equal(api.deferedOnSize[1], undefined);
  assert.equal(api.views[2], other);
  assert.ok(api.deferedPictures[2]); assert.ok(api.deferedOnSize[2]);
  ownGardenWebView(undefined, 1)();
});

test('Web surface context keeps its identity and receives a bounded texture budget', () => {
  const { configureGardenWebCanvasCache, GARDEN_WEB_TEXTURE_CACHE_BYTES } = loadPlantingModules()('../webCanvasCache');
  const limits = [], handles = [];
  const context = { setResourceCacheLimitBytes: value => limits.push(value) };
  const kit = { MakeWebGLContext(handle) { assert.equal(this, kit); handles.push(handle); return handle ? context : null; } };
  configureGardenWebCanvasCache(kit);
  assert.equal(kit.MakeWebGLContext(42), context);
  assert.equal(kit.MakeWebGLContext(0), null);
  assert.deepEqual(handles, [42, 0]);
  assert.deepEqual(limits, [384 * 1024 * 1024]);
  assert.equal(GARDEN_WEB_TEXTURE_CACHE_BYTES, limits[0]);
});

test('Fish callback stops on blur, background, reduced motion, disable and unmount', () => {
  let state = 'active', reduced = false, callback, autoStart, cursor = 0;
  const slots = [], listeners = new Set(), activity = [];
  const frame = { setActive: value => activity.push(value) };
  const react = {
    memo: fn => fn,
    useMemo: fn => fn(),
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: initial };
      return [slots[index].value, value => { slots[index].value = value; }];
    },
    useEffect(fn, deps) {
      const index = cursor++, old = slots[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        old?.cleanup?.(); slots[index] = { deps, cleanup: fn() };
      }
    },
  };
  const load = loadPlantingModules(undefined, react, undefined, true, {
    '@shopify/react-native-skia': { Group: 'Group', Image: 'Image', useImage: () => null },
    'react-native': { AppState: {
      get currentState() { return state; },
      addEventListener(_event, listener) { listeners.add(listener); return { remove: () => listeners.delete(listener) }; },
    } },
    'react-native-reanimated': {
      useReducedMotion: () => reduced,
      useSharedValue: value => ({ value }),
      useFrameCallback(fn, start) { callback = fn; autoStart = start; return frame; },
    },
  });
  const Fish = load('../water/FishLayer').default;
  const render = props => { cursor = 0; Fish({ active: true, ...props }); };
  render(); assert.equal(autoStart, false); assert.equal(activity.at(-1), true); assert.equal(listeners.size, 1);
  render({ active: false }); assert.equal(activity.at(-1), false);
  render(); assert.equal(activity.at(-1), true);
  state = 'background'; for (const listener of listeners) listener(state);
  render(); assert.equal(activity.at(-1), false);
  state = 'active'; for (const listener of listeners) listener(state);
  render(); assert.equal(activity.at(-1), true);
  reduced = true; render(); assert.equal(activity.at(-1), false);
  reduced = false; render({ enabled: false }); assert.equal(activity.at(-1), false);
  render(); assert.equal(activity.at(-1), true); assert.equal(typeof callback, 'function');
  for (const slot of slots) slot?.cleanup?.();
  assert.equal(activity.at(-1), false); assert.equal(listeners.size, 0);
});

test('Web resize releases previous surface/context once, including failure and unmount', () => {
  const { configureGardenWebCanvasCache } = loadPlantingModules()('../webCanvasCache');
  const retired = [], deleted = [], contexts = [];
  let handle = 0, fail = false;
  const kit = {
    MakeWebGLContext(id) {
      const context = { setResourceCacheLimitBytes() {}, delete() { deleted.push(id); } };
      contexts.push(context); return context;
    },
    MakeWebGLCanvasSurface() {
      const id = ++handle;
      this.MakeWebGLContext(id);
      if (fail) throw new Error('surface failed');
      return { delete() { retired.push(id); } };
    },
    deleteContext: id => deleted.push(`registry:${id}`),
  };
  configureGardenWebCanvasCache(kit);
  const canvas = {}, other = {};
  const first = kit.MakeWebGLCanvasSurface(canvas);
  const second = kit.MakeWebGLCanvasSurface(canvas);
  assert.deepEqual(retired, [1]); assert.deepEqual(deleted, [1, 'registry:1']);
  first.delete(); assert.deepEqual(retired, [1]);
  const separate = kit.MakeWebGLCanvasSurface(other);
  assert.deepEqual(retired, [1]);
  second.delete(); second.delete(); separate.delete();
  assert.deepEqual(retired, [1, 2, 3]);
  assert.deepEqual(deleted, [1, 'registry:1', 2, 'registry:2', 3, 'registry:3']);
  fail = true;
  assert.throws(() => kit.MakeWebGLCanvasSurface(canvas), /surface failed/);
  assert.deepEqual(deleted.slice(-2), [4, 'registry:4']);
  assert.equal(contexts.length, 4);
});
