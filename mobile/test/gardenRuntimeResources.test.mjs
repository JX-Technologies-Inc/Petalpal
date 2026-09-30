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

test('Web layout keeps picture context alive, separates backing size, and cleans up on unmount', () => {
  const { configureGardenWebCanvasCache } = loadPlantingModules()('../webCanvasCache');
  const retired = [], deleted = [], surfaces = [], budgets = [];
  let handle = 0;
  const kit = {
    MakeWebGLContext(id) { return { id, setResourceCacheLimitBytes: bytes => budgets.push([id, bytes]),
      delete: () => deleted.push(id) }; },
    MakeWebGLCanvasSurface(canvas, colorSpace) {
      return this.MakeOnScreenGLSurface(this.MakeWebGLContext(++handle), canvas.width, canvas.height, colorSpace ?? null);
    },
    MakeOnScreenGLSurface(context, width, height, colorSpace) {
      const id = surfaces.length + 1;
      const surface = { context, width, height, colorSpace, delete: () => retired.push(id) };
      surfaces.push(surface); return surface;
    },
    deleteContext: id => deleted.push(`registry:${id}`),
  };
  configureGardenWebCanvasCache(kit);
  const canvas = { width: 638, height: 1328, style: { width: '100%', height: '100%' } };
  const first = kit.MakeWebGLCanvasSurface(canvas);
  const pictureContext = first.context;
  canvas.width = 0; canvas.height = 0;
  const hidden = kit.MakeWebGLCanvasSurface(canvas);
  assert.equal(hidden, first); assert.equal(hidden.context, pictureContext); assert.deepEqual(deleted, []);
  canvas.width = 638; canvas.height = 1328;
  assert.equal(kit.MakeWebGLCanvasSurface(canvas), first, 'Same viewport return reuses the native surface');
  assert.equal(budgets.at(-1)[1], 640 * 1024 * 1024, 'Route blur preserves the bounded picture texture cache');
  canvas.width = 1276; canvas.height = 2656;
  const returned = kit.MakeWebGLCanvasSurface(canvas);
  assert.equal(returned.context, pictureContext); assert.equal(handle, 1);
  assert.deepEqual([returned.width, returned.height], [1276, 2656]);
  assert.deepEqual(canvas.style, { width: '100%', height: '100%' });
  assert.equal(returned.colorSpace, null, 'Keep the original helper color-space default');
  assert.equal(budgets.at(-1)[1], 640 * 1024 * 1024);
  assert.deepEqual(retired, [1]); assert.deepEqual(deleted, []);
  first.delete(); hidden.delete(); assert.deepEqual(deleted, [], 'Old renderer disposal cannot retire live context');
  returned.delete(); returned.delete();
  assert.deepEqual(retired, [1, 2]); assert.deepEqual(deleted, [1, 'registry:1']);
  const replacement = kit.MakeWebGLCanvasSurface(canvas);
  assert.notEqual(replacement.context, pictureContext); assert.equal(handle, 2);
  const other = kit.MakeWebGLCanvasSurface({ width: 640, height: 480 });
  assert.notEqual(other.context, replacement.context);
  replacement.delete(); other.delete();
  assert.deepEqual(deleted, [1, 'registry:1', 2, 'registry:2', 3, 'registry:3']);
});

test('Failed Web replacement releases its retained context and registry', () => {
  const { configureGardenWebCanvasCache } = loadPlantingModules()('../webCanvasCache');
  const deleted = [], retired = [];
  let fail = false;
  const kit = {
    MakeWebGLContext() { return { setResourceCacheLimitBytes() {}, delete: () => deleted.push('context') }; },
    MakeWebGLCanvasSurface() { this.MakeWebGLContext(42); return { delete: () => retired.push('surface') }; },
    MakeOnScreenGLSurface() { if (fail === 'throw') throw new Error('surface failed'); return null; },
    deleteContext: id => deleted.push(id),
  };
  configureGardenWebCanvasCache(kit);
  for (const failure of ['throw', 'null']) {
    const canvas = { width: 638, height: 1328 };
    const original = kit.MakeWebGLCanvasSurface(canvas);
    fail = failure;
    canvas.width = 640;
    if (failure === 'throw') assert.throws(() => kit.MakeWebGLCanvasSurface(canvas), /surface failed/);
    else assert.equal(kit.MakeWebGLCanvasSurface(canvas), null);
    original.delete();
  }
  assert.deepEqual(retired, ['surface', 'surface']);
  assert.deepEqual(deleted, ['context', 42, 'context', 42]);
});


test('Web frame ownership retires superseded pictures and unregisters the disposed view', () => {
  const { configureGardenWebCanvasCache } = loadPlantingModules()('../webCanvasCache');
  const disposed = [], drawn = [], cleanup = [];
  const frame = id => ({ ref: { deleted: false, isDeleted() { return this.deleted; } },
    dispose() { assert.equal(this.ref.deleted, false); this.ref.deleted = true; disposed.push(id); } });
  let displayed;
  const api = { views: { 7: {}, 8: {} }, deferedPictures: { 7: 'initial', 8: 'other' },
    deferedOnSize: { 7: {}, 8: {} },
    setJsiProperty(id, name, value) { assert.equal(this, api); if (name === 'picture') displayed = value; } };
  const nativeCanvas = { drawPicture(picture) { assert.equal(picture.deleted, false); drawn.push(picture); } };
  const kit = {
    MakeWebGLContext() { return { setResourceCacheLimitBytes() {}, delete: () => cleanup.push('context') }; },
    MakeWebGLCanvasSurface() { this.MakeWebGLContext(42); return { getCanvas: () => Object.create(nativeCanvas),
      delete: () => cleanup.push('surface') }; },
    deleteContext: id => cleanup.push(id),
  };
  configureGardenWebCanvasCache(kit, () => api);
  const target = { width: 638, height: 1328 }, surface = kit.MakeWebGLCanvasSurface(target);
  const first = frame('first'), second = frame('second'), cachedChild = frame('cached child');
  api.setJsiProperty(7, 'picture', first); surface.getCanvas().drawPicture(first.ref);
  api.setJsiProperty(7, 'picture', second);
  assert.equal(displayed, second); assert.deepEqual(disposed, ['first']);
  surface.getCanvas().drawPicture(second.ref);
  api.setJsiProperty(7, 'picture', second); surface.getCanvas().drawPicture(second.ref);
  surface.getCanvas().drawPicture(cachedChild.ref);
  assert.equal(cachedChild.ref.deleted, false, 'Cached child pictures are not frame-owned');
  target.width = 0; target.height = 0;
  assert.equal(kit.MakeWebGLCanvasSurface(target), surface);
  assert.equal(second.ref.deleted, false, 'Route blur retains the current picture');
  surface.delete(); surface.delete();
  assert.deepEqual(disposed, ['first', 'second']);
  assert.deepEqual(cleanup, ['surface', 'context', 42]);
  assert.equal(api.views[7], undefined); assert.equal(api.deferedPictures[7], undefined);
  assert.equal(api.deferedOnSize[7], undefined); assert.equal(api.deferedPictures[8], 'other');
  assert.equal(drawn.length, 4);
});

test('Web paint copies retain visual properties while retiring overwritten raw handles', () => {
  const { configureGardenWebPaintResources } = loadPlantingModules()('../webCanvasCache');
  const handles = [];
  class NativePaint {
    constructor(style = {}) { this.style = { ...style }; this.deleted = false; handles.push(this); }
    copy() { assert.equal(this.deleted, false); return new NativePaint(this.style); }
    delete() { assert.equal(this.deleted, false); this.deleted = true; }
    isDeleted() { return this.deleted; }
  }
  class Paint {
    constructor(ref = new NativePaint({ antiAlias: true })) { this.ref = ref; }
    assign(source) { this.ref = source.ref.copy(); }
    reset() { this.ref = new NativePaint(); }
    copy() { return new Paint(this.ref.copy()); }
    dispose() { this.ref.delete(); }
  }
  const skia = { Paint: () => new Paint() };
  configureGardenWebPaintResources({ Paint: NativePaint }, skia);
  const source = skia.Paint(), target = skia.Paint();
  source.ref.style = { antiAlias: true, color: '#79b5b1', alpha: 0.6, strokeWidth: 2 };
  const old = target.ref;
  target.assign(source);
  assert.equal(old.deleted, true); assert.deepEqual(target.ref.style, source.ref.style);
  assert.equal(source.ref.deleted, false);
  const self = target.ref;
  target.assign(target);
  assert.equal(self.deleted, true); assert.deepEqual(target.ref.style, source.ref.style);
  const copied = target.copy(); assert.notEqual(copied.ref, target.ref);
  assert.deepEqual(copied.ref.style, target.ref.style);
  const reset = target.ref;
  target.reset(); assert.equal(reset.deleted, true); assert.deepEqual(target.ref.style, {});
  source.dispose(); target.dispose(); copied.dispose();
  assert.ok(handles.every(handle => handle.deleted), 'Every created raw paint was retired once');
});
