const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const directory = path.join(__dirname, '../src/components/garden');
const compile = file => ts.transpileModule(fs.readFileSync(path.join(directory, file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
function harness() {
  const slots = [], effects = [], frames = [], recordings = [];
  let cursor = 0;
  const react = {
    useState(initial) { const i = cursor++; const slot = slots[i] ??= { value: initial };
      return [slot.value, next => { slot.value = next; }]; },
    useEffect(fn, deps) { const i = cursor++; const old = slots[i];
      if (!old || deps.some((value, index) => value !== old.deps[index])) {
        const slot = slots[i] = { deps };
        effects.push(() => { old?.cleanup?.(); slot.cleanup = fn(); });
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const module = { exports: {} };
  vm.runInNewContext(compile('GardenStaticPicture.web.tsx'), {
    module, exports: module.exports, __DEV__: false,
    requestAnimationFrame: fn => { frames.push(fn); },
    require: name => name === 'react' ? react : name === 'react/jsx-runtime' ? { jsx } : {
      Picture: 'Picture', drawAsPicture: (source, bounds) => new Promise(resolve => recordings.push({ source, bounds, resolve })),
    },
  });
  return {
    recordings,
    render(source) { cursor = 0; const drawing = module.exports.default({ children: source, images: [] });
      while (effects.length) effects.shift()(); return drawing; },
    unmount() { slots.forEach(slot => slot.cleanup?.()); },
    flushFrames() { while (frames.length) frames.shift()(); },
  };
}
const picture = () => ({ retired: 0, dispose() { this.retired++; } });

test('static commands are reused, source changes render immediately, and replaced pictures retire safely', async () => {
  const h = harness(), first = { originalImagesAndShaders: true }, second = { changedPlacement: true };
  assert.equal(h.render(first), first);
  const a = picture(); h.recordings[0].resolve(a); await Promise.resolve();
  assert.equal(h.render(first).props.picture, a);
  assert.ok(h.render(first).props.gardenImageReferences, 'Cached artwork keeps root-owned image references');
  h.render(first); assert.equal(h.recordings.length, 1, 'No per-frame rerecording of stable artwork');
  assert.equal(h.recordings[0].source, first, 'Original commands and sampling are retained, with no raster snapshot');
  assert.equal(h.render(second), second, 'New placement/image source cannot display stale cached artwork');
  const b = picture(); h.recordings[1].resolve(b); await Promise.resolve();
  assert.equal(h.render(second).props.picture, b);
  assert.equal(a.retired, 0, 'A handle stays alive through the replacement commit');
  h.flushFrames(); assert.equal(a.retired, 1);
  h.unmount(); h.flushFrames(); assert.equal(b.retired, 1);
});

test('cancelled recordings never replace current artwork or leak pictures', async () => {
  const h = harness(), first = {}, second = {};
  h.render(first); h.render(second);
  const abandoned = picture(); h.recordings[0].resolve(abandoned); await Promise.resolve();
  assert.equal(abandoned.retired, 1);
  assert.equal(h.render(second), second);
  h.unmount(); const last = picture(); h.recordings[1].resolve(last); await Promise.resolve();
  assert.equal(last.retired, 1);
});

test('native rendering retains the original elements and animation renderer', () => {
  const module = { exports: {} };
  vm.runInNewContext(compile('GardenStaticPicture.tsx'), { module, exports: module.exports });
  const source = { nativeDrawing: true };
  assert.equal(module.exports.default({ children: source }), source);
});

test('vector caching keeps original asset pixels and fine detail identical at Retina DPR, pan, zoom and rotation', async () => {
  const initialize = require('canvaskit-wasm');
  const kit = await initialize({ wasmBinary: fs.readFileSync(path.join(__dirname, '../public/canvaskit.wasm')) });
  const image = kit.MakeImageFromEncoded(fs.readFileSync(path.join(__dirname, '../assets/garden/infrastructure/final/ST01_approved.png')));
  const paint = new kit.Paint(); paint.setAntiAlias(true);
  const draw = canvas => {
    canvas.drawImageRectOptions(image, kit.XYWHRect(0, 0, image.width(), image.height()),
      kit.XYWHRect(17, 23, 210, 210), kit.FilterMode.Linear, kit.MipmapMode.None, paint);
    const detail = new kit.Paint(); detail.setAntiAlias(true); detail.setColor(kit.Color(40, 215, 210, .4));
    detail.setStyle(kit.PaintStyle.Stroke); detail.setStrokeWidth(.4);
    canvas.drawCircle(93, 87, 21.5, detail); detail.delete();
  };
  const recorder = new kit.PictureRecorder();
  draw(recorder.beginRecording(kit.XYWHRect(-5000, -5000, 10000, 10000)));
  const picture = recorder.finishRecordingAsPicture(); recorder.delete();
  const pixels = surface => {
    const snapshot = surface.makeImageSnapshot();
    try { return snapshot.readPixels(0, 0, { width: 512, height: 512, colorType: kit.ColorType.RGBA_8888,
      alphaType: kit.AlphaType.Premul, colorSpace: kit.ColorSpace.SRGB }); }
    finally { snapshot.delete(); }
  };
  try {
    for (const camera of [{ zoom: 1, pan: [0, 0], rotation: 0 },
      { zoom: 1.83, pan: [-80.25, -16.75], rotation: 0 }, { zoom: 1.2, pan: [10.5, 5.25], rotation: 11 }]) {
      const original = kit.MakeSurface(512, 512), cached = kit.MakeSurface(512, 512);
      try {
        for (const [surface, render] of [[original, draw], [cached, canvas => canvas.drawPicture(picture)]]) {
          const canvas = surface.getCanvas(); canvas.clear(kit.TRANSPARENT); canvas.save();
          canvas.scale(2, 2); canvas.translate(...camera.pan); canvas.scale(camera.zoom, camera.zoom);
          canvas.rotate(camera.rotation, 93, 87); render(canvas); canvas.restore(); surface.flush();
        }
        assert.deepEqual(pixels(cached), pixels(original));
      } finally { original.delete(); cached.delete(); }
    }
  } finally { picture.delete(); image.delete(); paint.delete(); }
});

