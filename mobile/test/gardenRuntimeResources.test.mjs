import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPlantingModules } from './loadPlantingModules.mjs';

test('Web surface context keeps its identity and receives a bounded texture budget', () => {
  const { configureGardenWebCanvasCache, GARDEN_WEB_TEXTURE_CACHE_BYTES } = loadPlantingModules()('../webCanvasCache');
  const limits = [], handles = [];
  const context = { setResourceCacheLimitBytes: value => limits.push(value) };
  const kit = { MakeWebGLContext(handle) { assert.equal(this, kit); handles.push(handle); return handle ? context : null; } };
  configureGardenWebCanvasCache(kit);
  assert.equal(kit.MakeWebGLContext(42), context);
  assert.equal(kit.MakeWebGLContext(0), null);
  assert.deepEqual(handles, [42, 0]);
  assert.deepEqual(limits, [640 * 1024 * 1024]);
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
