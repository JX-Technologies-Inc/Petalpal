const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const directory = path.join(__dirname, '../src/components/garden');
const compile = code => ts.transpileModule(code, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const networkModule = { exports: {} };
vm.runInNewContext(compile(fs.readFileSync(path.join(directory, 'fairy/walkNetwork.ts'), 'utf8')),
  { module: networkModule, exports: networkModule.exports });
const { WALK_NETWORK, WALK_START, route, nearest, distance } = networkModule.exports;

// Execute the actual scene handlers without mounting the unrelated Garden artwork.
const scene = ts.createSourceFile('GardenScene.tsx', fs.readFileSync(path.join(directory, 'GardenScene.tsx'), 'utf8'),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function expression(name) {
  let result;
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.text === name) result = node.initializer.expression.getText(scene);
    ts.forEachChild(node, visit);
  }
  visit(scene); assert.ok(result, name); return result;
}
function inputHarness(webFairy = true) {
  const calls = [], press = { current: null };
  const context = { enableFairyWalk: webFairy, Platform: { OS: 'web' }, fairyPress: press,
    handleGardenTap: (x, y) => calls.push([x, y]), handlePointerMove() {}, fairyDebug: false };
  const handlers = Object.fromEntries(['onPointerDown', 'onPointerUp', 'onPointerMove', 'onPointerCancel'].map(name =>
    [name, vm.runInNewContext(compile(`(${expression(name)})`), context)]));
  const event = (x, y, overrides = {}) => ({ target: { tagName: 'CANVAS' },
    currentTarget: { getBoundingClientRect: () => ({ left: 202, top: 64 }) },
    nativeEvent: { clientX: x, clientY: y, pointerId: 1, isPrimary: true, button: 0 }, ...overrides });
  return { calls, handlers, event };
}
test('ten web Fairy presses produce one destination each, independent of press duration and canvas backing size', () => {
  const { calls, handlers, event } = inputHarness();
  for (let i = 0; i < 10; i++) {
    const e = event(593 + i, 415);
    handlers.onPointerDown(e);
    // A stationary hold has no duration timeout. Pointer-up reads CSS bounds.
    handlers.onPointerMove(e); handlers.onPointerUp(e); handlers.onPointerUp(e);
    assert.equal(calls.length, i + 1);
    assert.deepEqual(Array.from(calls[i]), [391 + i, 351]);
  }
});
test('controls, right clicks, cancelled presses, drags and multi-touch never select a Fairy destination', () => {
  const { calls, handlers: h, event } = inputHarness();
  const canvas = event(593, 415);
  for (const e of [event(593, 415, { target: { tagName: 'BUTTON' } }),
    event(593, 415, { nativeEvent: { ...canvas.nativeEvent, button: 2 } })]) {
    h.onPointerDown(e); h.onPointerUp(e);
  }
  h.onPointerDown(canvas); h.onPointerCancel(); h.onPointerUp(canvas);
  h.onPointerDown(canvas); h.onPointerMove(event(620, 415)); h.onPointerUp(canvas);
  h.onPointerDown(canvas); h.onPointerDown(event(593, 415, {
    nativeEvent: { ...canvas.nativeEvent, pointerId: 2, isPrimary: false },
  })); h.onPointerUp(canvas);
  assert.equal(calls.length, 0);
  const garden = inputHarness(false);
  garden.handlers.onPointerDown(canvas); garden.handlers.onPointerUp(canvas);
  assert.equal(garden.calls.length, 0, 'Ordinary Garden retains its existing gesture handler');
});
test('measured paving destinations accept first try while lawns, water and narrow-path constraints remain intact', () => {
  const world = (x, y) => ({ x: (x - 202.6666667) / .3644444444, y: (y - 64) / .3644444444 });
  // Observed normal clicks in the 1280×720 browser, including points that
  // the old 8-world-unit corridor silently rejected on visible paving.
  const points = [[639,210],[746,303],[676,423],[521,321],[479,344],[448,357],[418,382],
    [639,420],[544,387],[593,415],[263,340],[356,320],[772,125],[803,268],[805,412],
    [837,560],[276,453],[751,333],[741,230],[631,618]];
  let foot = WALK_START;
  for (const [x,y] of points) {
    const path = route(foot, world(x,y)); assert.ok(path, `${x},${y}`);
    foot = path.at(-1); assert.ok(nearest(foot, WALK_NETWORK, .001));
  }
  assert.equal(nearest(world(639,210), WALK_NETWORK, 8), null, 'Previous hit corridor missed ordinary paving');
  for (const [x,y] of [[680,330],[400,380],[680,120],[900,540],[100,300]])
    assert.equal(route(foot,world(x,y)), null, `Terrain ${x},${y} stays rejected`);
  assert.ok(WALK_NETWORK.edges.some(edge => edge.width === 8), 'Stepping stones keep their narrow restriction');
  assert.ok(WALK_NETWORK.edges.some(edge => edge.width === 12), 'Internal paths stay narrow');
});

function fairyHarness() {
  const slots = [], effects = [], queue = new Map(), host = {}, ref = { current: null };
  let cursor = 0, request = 0, now = 0, props;
  const react = {
    forwardRef: fn => fn,
    useRef: value => { const i = cursor++; return slots[i] ??= { current: value }; },
    useState: value => { const i = cursor++; const slot = slots[i] ??= { value };
      return [slot.value, next => { slot.value = typeof next === 'function' ? next(slot.value) : next; }]; },
    useEffect: (fn, deps) => { const i = cursor++, old = slots[i];
      if (!old || deps.some((d, j) => d !== old.deps[j])) {
        slots[i] = { deps }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); });
      } },
    useImperativeHandle: (target, fn) => { target.current = fn(); },
  };
  const jsx = (type, props) => ({ type, props });
  const module = { exports: {} };
  vm.runInNewContext(compile(fs.readFileSync(path.join(directory, 'fairy/GardenFairy.tsx'), 'utf8')), {
    module, exports: module.exports, __DEV__: true, window: host, performance: { now: () => now },
    requestAnimationFrame: fn => { queue.set(++request, fn); return request; },
    cancelAnimationFrame: id => queue.delete(id),
    require: name => name === 'react' ? react : name === './walkNetwork' ? networkModule.exports
      : name === 'react/jsx-runtime' ? { jsx, jsxs: jsx }
      : name === 'react-native-reanimated' ? {
        useSharedValue: value => react.useRef({ value }).current, useDerivedValue: fn => ({ value: fn() }),
      } : name === '@shopify/react-native-skia' ? { Group: 'Group', Path: 'Path', Circle: 'Circle' } : name,
  });
  props = { active: true, debug: false, blocked: () => false, onStatus: s => { harness.status = s; } };
  const render = () => { cursor = 0; module.exports.default(props, ref); while (effects.length) effects.shift()(); };
  const harness = {
    move: p => { const accepted = ref.current.move(p); render(); return accepted; },
    state: () => host.__fairyDebug.getState(),
    clockAdvance: ms => { now += ms; },
    frameAt: timestamp => { const callbacks = [...queue.values()]; queue.clear(); callbacks.forEach(fn => fn(timestamp)); render(); },
    step: () => { now += 50; const callbacks = [...queue.values()]; queue.clear(); callbacks.forEach(fn => fn(now)); render(); },
    finish: () => { let frames = 0; while (harness.state().remaining.length) {
      harness.step(); assert.ok(nearest(harness.state().position, WALK_NETWORK, .001)); assert.ok(++frames < 5000);
    } assert.equal(harness.state().target, null); assert.equal(harness.state().frame, 4); },
    active: value => { props = { ...props, active: value }; render(); },
  };
  render(); harness.step(); return harness;
}
test('actual Fairy hooks complete ten sequential routes, accept mid-walk retargeting and clear idle state', () => {
  const fairy = fairyHarness();
  for (const index of [1, 4, 0, 7, 11, 2, 5, 0, 3, 1]) {
    const target = WALK_NETWORK.nodes[index]; assert.equal(fairy.move(target), true);
    fairy.finish(); assert.ok(distance(fairy.state().position, target) < .001);
    assert.equal(fairy.status, 'Resting on the path');
  }
  assert.equal(fairy.move(WALK_NETWORK.nodes[8]), true);
  for (let i = 0; i < 5; i++) fairy.step();
  const before = fairy.state().position;
  assert.equal(fairy.move(WALK_START), true);
  assert.deepEqual(fairy.state().position, before, 'Retargeting does not teleport');
  const remaining = JSON.stringify(fairy.state().remaining);
  assert.equal(fairy.move({ x: -100, y: -100 }), false);
  assert.equal(JSON.stringify(fairy.state().remaining), remaining, 'Invalid input preserves the current walk');
  fairy.finish(); assert.ok(distance(fairy.state().position, WALK_START) < .001);
  assert.equal(fairy.move(WALK_START), true);
  assert.equal(fairy.status, 'Resting on the path', 'Selecting the current foot position cannot leave a false moving state');
  fairy.move(WALK_NETWORK.nodes[2]); fairy.active(false);
  assert.equal(fairy.state().remaining.length, 0); assert.equal(fairy.state().target, null);
  fairy.active(true); assert.equal(fairy.move(WALK_NETWORK.nodes[1]), true); fairy.finish();
});
test('actual animation advances at 110 world units per second without teleporting or changing sprite cadence', () => {
  const fairy = fairyHarness(); fairy.move(WALK_NETWORK.nodes[1]);
  for (let i = 0; i < 20; i++) fairy.step();
  assert.ok(Math.abs(distance(WALK_START, fairy.state().position) - 110) < .001);
  assert.ok(fairy.state().remaining.length > 0);
  fairy.finish();
});

test('input accounts for elapsed time immediately without counting it again in an older queued frame', () => {
  const fairy = fairyHarness();
  fairy.move(WALK_NETWORK.nodes[1]);
  fairy.clockAdvance(20); fairy.move(WALK_NETWORK.nodes[1]);
  const immediately = fairy.state().position;
  assert.ok(Math.abs(distance(WALK_START, immediately) - 2.2) < .001);
  fairy.frameAt(60);
  assert.deepEqual(fairy.state().position, immediately, 'An older RAF timestamp cannot rewind movement time');
  fairy.clockAdvance(30); fairy.frameAt(100);
  assert.ok(Math.abs(distance(WALK_START, fairy.state().position) - 5.5) < .001, 'Exactly 50ms of movement was accounted for');
});

test('registered B01 bridge foot chords stay on the actual integrated deck image', async () => {
  const initialize = require('canvaskit-wasm');
  const kit = await initialize({ wasmBinary: fs.readFileSync(path.join(__dirname, '../public/canvaskit.wasm')) });
  const image = kit.MakeImageFromEncoded(fs.readFileSync(path.join(__dirname, '../assets/garden/runtime/infrastructure/final/B01_bridge.png')));
  try {
    const width = image.width(), height = image.height();
    const pixels = image.readPixels(0, 0, { width, height, colorType: kit.ColorType.RGBA_8888,
      alphaType: kit.AlphaType.Premul, colorSpace: kit.ColorSpace.SRGB });
    const deck = [[923,814],[952,790],[982,768],[1015,744]].map(([x,y]) => ({x:(x-76)/.52,y:(y-64)/.52}));
    for (const point of deck) assert.ok(WALK_NETWORK.nodes.some(node => distance(node, point) < .001));
    for (let i = 1; i < deck.length; i++) for (let step = 0; step <= 10; step++) {
      const t = step / 10, a = deck[i-1], b = deck[i];
      const x = Math.floor(a.x + (b.x-a.x)*t - 1571), y = Math.floor(a.y + (b.y-a.y)*t - 1236);
      assert.ok(x >= 0 && x < width && y >= 0 && y < height);
      assert.ok(pixels[(y*width+x)*4+3] >= 250, `Foot is on the deck, not transparent water: ${x},${y}`);
    }
  } finally { image.delete(); }
});
