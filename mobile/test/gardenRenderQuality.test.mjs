import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPlantingModules } from './loadPlantingModules.mjs';
const load = loadPlantingModules(undefined, undefined, undefined, true, {
  '@shopify/react-native-skia/lib/module/skia/web/JsiSkImage': { JsiSkImage: class { constructor(kit, ref) { this.ref = ref; } } },
});
const { backingSize, qualityMode, GardenQualitySelector, frameSample } = load('../gardenRenderQuality');
const retina = { width: 730, height: 664, dpr: 2, cores: 8, memoryGB: 8 };
const fast = { count: 140, p90FrameMs: 17, p90DrawMs: 3 };
const slow = { count: 80, p90FrameMs: 45, p90DrawMs: 22 };
test('HIGH/BALANCED retain Retina detail, PERFORMANCE only changes raster size', () => {
  assert.equal(JSON.stringify(backingSize('HIGH', retina)), JSON.stringify({ width: 1460, height: 1328 }));
  assert.equal(JSON.stringify(backingSize('BALANCED', retina)), JSON.stringify(backingSize('HIGH', retina)));
  const lower = backingSize('PERFORMANCE', retina);
  assert.equal(lower.width, 913); assert.equal(lower.height, 830);
  assert.equal(retina.width, 730); assert.equal(retina.height, 664);
});
test('bounds extreme DPR, area and texture dimensions without hardware-dependent geometry', () => {
  for (const tier of ['HIGH', 'BALANCED', 'PERFORMANCE']) {
    const size = backingSize(tier, { width: 8000, height: 5000, dpr: 10 });
    assert.ok(size.width <= 4096 && size.height <= 4096);
    assert.ok(size.width * size.height <= 8_010_000);
  }
  assert.equal(backingSize('HIGH', { ...retina, dpr: NaN }).width, 1460);
});
test('re-reads DPR instead of keeping startup DPR after changing displays', () => {
  assert.equal(backingSize('HIGH', { ...retina, dpr: 2 }).width, 1460);
  assert.equal(backingSize('HIGH', { ...retina, dpr: 3 }).width, 2190);
});
test('AUTO starts BALANCED; warm-up, sustained headroom and cooldown precede upgrade', () => {
  const selector = new GardenQualitySelector(0);
  assert.equal(selector.tier, 'BALANCED');
  for (let now = 2500; now < 20000; now += 2500) assert.equal(selector.observe(fast, retina, now, false), 'BALANCED');
  assert.equal(selector.observe(fast, retina, 20000, false), 'HIGH');
  assert.equal(selector.observe(slow, retina, 22500, false), 'HIGH');
  assert.equal(selector.observe(slow, retina, 25000, false), 'HIGH');
});
test('runtime downgrade wins over strong hardware; isolated stalls do not downgrade', () => {
  const selector = new GardenQualitySelector(0);
  assert.equal(selector.observe(slow, retina, 21000, false), 'BALANCED');
  assert.equal(selector.observe(fast, retina, 23500, false), 'BALANCED');
  selector.observe(slow, retina, 26000, false);
  assert.equal(selector.observe(slow, retina, 28500, false), 'PERFORMANCE');
});
test('active gestures and insufficient samples cannot trigger a switch', () => {
  const selector = new GardenQualitySelector(0);
  for (let now = 30000; now < 60000; now += 2500) assert.equal(selector.observe(slow, retina, now, true), 'BALANCED');
  assert.equal(selector.observe({ ...slow, count: 3 }, retina, 62500, false), 'BALANCED');
});
test('hardware hints never select lower quality alone and absent hints allow runtime upgrades', () => {
  const constrained = new GardenQualitySelector(0);
  const unknown = new GardenQualitySelector(0);
  for (let now = 21000; now <= 31000; now += 2500) {
    constrained.observe(fast, { ...retina, memoryGB: 4 }, now, false);
    unknown.observe(fast, { ...retina, memoryGB: undefined, cores: undefined }, now, false);
  }
  assert.equal(constrained.tier, 'BALANCED'); assert.equal(unknown.tier, 'HIGH');
});
test('upgrades account for the candidate pixel cost instead of trusting CPU labels', () => {
  const selector = new GardenQualitySelector(0);
  for (let now = 21000; now <= 31000; now += 2500) selector.observe({ ...fast, p90DrawMs: 8 }, { ...retina, dpr: 3 }, now, false);
  assert.equal(selector.tier, 'BALANCED');
  assert.equal(qualityMode('PERFORMANCE'), 'PERFORMANCE'); assert.equal(qualityMode('garbage'), 'AUTO');
  assert.equal(frameSample([16, 16, 17, 18, 100], [2, 3]).p90FrameMs, 100);
});
function rendererFixture() {
  const operations = [], surfaces = [];
  const canvas = { width: 0, height: 0, getContext: () => ({ getExtension: () => ({ loseContext: () => operations.push('lose') }) }) };
  const kit = { TRANSPARENT: 0, XYWHRect: (...args) => args, MakeWebGLCanvasSurface() {
    const surface = { delete() { operations.push('delete'); }, flush() { operations.push('flush'); },
      makeImageSnapshot(bounds) { return bounds; }, getCanvas: () => ({ clear() {}, save() {},
        scale(x, y) { operations.push(['scale', x, y]); }, drawPicture(p) { operations.push(['picture', p]); }, restore() {} }) };
    surfaces.push(surface); return surface;
  } };
  const { GardenWebRenderer } = load('../gardenWebRenderer');
  return { renderer: new GardenWebRenderer(kit, canvas), canvas, operations, surfaces, kit };
}
test('tier/DPR resize retires old surface once, keeps pictures and logical scaling independent', () => {
  const { renderer, operations, surfaces, canvas } = rendererFixture();
  renderer.resize('HIGH', retina); renderer.draw({ ref: 'same-picture' });
  assert.equal(renderer.resize('HIGH', retina), false); assert.equal(surfaces.length, 1);
  renderer.resize('PERFORMANCE', retina); renderer.draw({ ref: 'same-picture' });
  assert.equal(operations.filter(x => x === 'delete').length, 1);
  const scales = operations.filter(x => Array.isArray(x) && x[0] === 'scale');
  assert.equal(scales[0][1], 2); assert.equal(scales[1][1], canvas.width / retina.width);
  assert.equal(operations.filter(x => Array.isArray(x) && x[0] === 'picture').length, 2);
  renderer.dispose(); renderer.dispose(); assert.equal(operations.filter(x => x === 'delete').length, 2);
});
test('failed and zero-sized surface creation cannot retain the previous surface', () => {
  const { renderer, kit, operations } = rendererFixture();
  renderer.resize('HIGH', retina);
  assert.equal(renderer.resize('HIGH', { ...retina, width: 0 }), false);
  kit.MakeWebGLCanvasSurface = () => null;
  assert.throws(() => renderer.resize('PERFORMANCE', retina), /Could not create/);
  renderer.dispose(); assert.equal(operations.filter(x => x === 'delete').length, 1);
});
test('very low FPS can still downgrade instead of failing the minimum sample gate', () => {
  const selector = new GardenQualitySelector(0);
  const stalled = { count: 12, p90FrameMs: 180, p90DrawMs: 80 };
  selector.observe(stalled, retina, 21000, false);
  assert.equal(selector.observe(stalled, retina, 23500, false), 'PERFORMANCE');
});
test('HIGH draws the identical recorded artwork at the safe 2x scale in actual CanvasKit', async () => {
  const { createRequire } = await import('node:module');
  const fs = await import('node:fs');
  const initialize = createRequire(import.meta.url)('canvaskit-wasm');
  const kit = await initialize({ wasmBinary: fs.readFileSync(new URL('../public/canvaskit.wasm', import.meta.url)) });
  const image = kit.MakeImageFromEncoded(fs.readFileSync(new URL('../assets/garden/infrastructure/final/ST01_approved.png', import.meta.url)));
  const paint = new kit.Paint(), recorder = new kit.PictureRecorder();
  const recorded = recorder.beginRecording(kit.XYWHRect(0, 0, 210, 210));
  recorded.drawImageRectOptions(image, kit.XYWHRect(0, 0, image.width(), image.height()), kit.XYWHRect(0, 0, 210, 210), kit.FilterMode.Linear, kit.MipmapMode.None, paint);
  const picture = recorder.finishRecordingAsPicture(); recorder.delete();
  const reference = kit.MakeSurface(420, 420), referenceCanvas = reference.getCanvas();
  referenceCanvas.clear(kit.TRANSPARENT); referenceCanvas.save(); referenceCanvas.scale(2, 2);
  referenceCanvas.drawPicture(picture); referenceCanvas.restore(); reference.flush();
  let output;
  kit.MakeWebGLCanvasSurface = canvas => (output = kit.MakeSurface(canvas.width, canvas.height));
  const canvas = { width: 0, height: 0, getContext: () => null };
  const { GardenWebRenderer } = load('../gardenWebRenderer');
  const renderer = new GardenWebRenderer(kit, canvas);
  const pixels = surface => {
    const snapshot = surface.makeImageSnapshot();
    try { return snapshot.readPixels(0, 0, { width: 420, height: 420,
      colorType: kit.ColorType.RGBA_8888, alphaType: kit.AlphaType.Premul, colorSpace: kit.ColorSpace.SRGB }); }
    finally { snapshot.delete(); }
  };
  try {
    renderer.resize('HIGH', { width: 210, height: 210, dpr: 1 });
    renderer.draw({ ref: picture });
    assert.deepEqual(pixels(output), pixels(reference));
  } finally { renderer.dispose(); reference.delete(); picture.delete(); image.delete(); paint.delete(); }
});
test('inactive Garden frees GPU surface and resumes with the same recorded picture', () => {
  const { renderer, operations, surfaces } = rendererFixture();
  renderer.resize('HIGH', retina); renderer.draw({ ref: 'retained-picture' });
  renderer.suspend(); renderer.suspend();
  assert.equal(operations.filter(x => x === 'delete').length, 1);
  renderer.resize('HIGH', retina); renderer.draw({ ref: 'retained-picture' });
  assert.equal(surfaces.length, 2);
  assert.equal(operations.filter(x => Array.isArray(x) && x[1] === 'retained-picture').length, 2);
  renderer.dispose(); assert.equal(operations.filter(x => x === 'delete').length, 2);
});
