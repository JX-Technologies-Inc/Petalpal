import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { loadPlantingModules } from './loadPlantingModules.mjs';

const { PNG } = createRequire(import.meta.url)('pngjs'); // Expo's existing image tooling.
const layers = ['GardenInfrastructureLayer.tsx', 'GardenLand09InterfaceLayer.tsx', 'GardenRoadApproachLayer.tsx'];
const pairs = layers.flatMap(file => [...fs.readFileSync(new URL('../src/components/garden/' + file, import.meta.url), 'utf8')
  .matchAll(/registeredArtwork\(require\('(@\/assets\/[^']+)'\),\s*require\('(@\/assets\/[^']+)'\), (\d+), (\d+), (\d+), (\d+)\)/g)]
  .map(([, original, web, ...bounds]) => ({ original, web, bounds: bounds.map(Number) })));

function read(asset) { return PNG.sync.read(fs.readFileSync(new URL('../' + asset.replace('@/', ''), import.meta.url))); }

test('all runtime copies preserve source pixels and remove only transparent padding', () => {
  assert.equal(pairs.length, 17);
  let before = 0, after = 0;
  for (const { original, web, bounds: [x, y, width, height] } of pairs) {
    assert.ok(web.startsWith('@/assets/garden/runtime/'));
    const source = read(original), copy = read(web);
    assert.equal(source.width, 2400); assert.equal(source.height, 1800);
    assert.equal(copy.width, width); assert.equal(copy.height, height);
    before += source.width * source.height * 4; after += width * height * 4;
    for (let row = 0; row < source.height; row++) {
      for (let col = 0; col < source.width; col++) {
        const offset = (row * source.width + col) * 4;
        if (col < x || col >= x + width || row < y || row >= y + height) {
          assert.equal(source.data[offset + 3], 0, original + ': cropped visible pixel');
        } else {
          const target = ((row - y) * width + col - x) * 4;
          for (let channel = 0; channel < 4; channel++) assert.equal(copy.data[target + channel], source.data[offset + channel], original + ': source pixel changed');
          // Guard against edge sampling at the exact source registration.
          if ((col < x + 8 || col >= x + width - 8 || row < y + 8 || row >= y + height - 8) && width > 1)
            assert.equal(copy.data[target + 3], 0, original + ': missing transparent sampling guard');
        }
      }
    }
  }
  assert.ok(after / before < 0.025, 'full-world transparent images decoded again');
});

test('Web registration preserves every source pixel at all pan/zoom/DPR transforms', () => {
  const load = loadPlantingModules(undefined, undefined, undefined, true, { 'react-native': { Platform: { OS: 'web' } } });
  const { registeredArtwork } = load('../registeredArtwork');
  for (const { bounds: [x, y, width, height] } of pairs) {
    const rect = registeredArtwork(1, 2, x, y, width, height);
    assert.equal(rect.source, 2);
    for (const [pixelX, pixelY] of [[0, 0], [width / 2, height / 2], [width, height]]) {
      for (const scale of [0.1, 0.3041666667, 0.9, 3]) for (const dpr of [1, 2, 3]) {
        const expected = [(x + pixelX) * scale * dpr + 71, (y + pixelY) * scale * dpr - 13];
        const actual = [(rect.x + pixelX * rect.width / width) * scale * dpr + 71,
          (rect.y + pixelY * rect.height / height) * scale * dpr - 13];
        assert.ok(Math.abs(actual[0] - expected[0]) < 1e-6);
        assert.ok(Math.abs(actual[1] - expected[1]) < 1e-6);
      }
    }
  }
});

test('native platforms retain the original full-world artwork', () => {
  for (const OS of ['ios', 'android']) {
    const { registeredArtwork } = loadPlantingModules(undefined, undefined, undefined, false,
      { 'react-native': { Platform: { OS } } })('../registeredArtwork');
    assert.deepEqual(JSON.parse(JSON.stringify(registeredArtwork(1, 2, 31, 47, 101, 203))),
      { source: 1, x: 0, y: 0, width: 2400, height: 1800 });
  }
});


test('CanvasKit linear sampling renders original and cropped artwork equivalently', async () => {
  const initialize = createRequire(import.meta.url)('canvaskit-wasm');
  const kit = await initialize({ wasmBinary: fs.readFileSync(new URL('../public/canvaskit.wasm', import.meta.url)) });
  const surface = kit.MakeSurface(420, 420), paint = new kit.Paint();
  try {
    for (const { original, web, bounds: [x, y, width, height] } of pairs) {
      const full = kit.MakeImageFromEncoded(fs.readFileSync(new URL('../' + original.replace('@/', ''), import.meta.url)));
      const trim = kit.MakeImageFromEncoded(fs.readFileSync(new URL('../' + web.replace('@/', ''), import.meta.url)));
      try {
        for (const scale of [0.2341666667, 0.6083333333, 1.825]) {
          const canvas = surface.getCanvas();
          const render = (image, rect) => {
            canvas.clear(kit.Color(0, 0, 0, 0)); canvas.save();
            canvas.translate(210 - (x + width / 2) * scale, 210 - (y + height / 2) * scale);
            canvas.scale(scale, scale);
            canvas.drawImageRectOptions(image, kit.XYWHRect(0, 0, image.width(), image.height()), rect,
              kit.FilterMode.Linear, kit.MipmapMode.None, paint); canvas.restore();
            const snapshot = surface.makeImageSnapshot();
            try { return snapshot.readPixels(0, 0, { width: 420, height: 420, colorType: kit.ColorType.RGBA_8888,
              alphaType: kit.AlphaType.Premul, colorSpace: kit.ColorSpace.SRGB }); }
            finally { snapshot.delete(); }
          };
          const before = render(full, kit.XYWHRect(0, 0, 2400, 1800));
          const after = render(trim, kit.XYWHRect(x, y, width, height));
          let difference = 0, large = 0;
          for (let i = 0; i < before.length; i++) {
            const error = Math.abs(before[i] - after[i]); difference += error; if (error > 2) large++;
          }
          assert.ok(difference / before.length < 0.01, original + ': sampling registration differs');
          assert.ok(large / before.length < 0.0001, original + ': visible sampling regression');
        }
      } finally { full.delete(); trim.delete(); }
    }
  } finally { paint.delete(); surface.delete(); }
});
