import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const garden = new URL('../src/components/garden/', import.meta.url);
const entries = file => [...fs.readFileSync(new URL(file, garden), 'utf8')
  .matchAll(/(\w+): require\('\.\/terrain\/([^']+)'\)/g)].map(([, key, asset]) => [key, asset]);

test('web terrain copies are lossless: same keys, sizes and RGBA pixels as the source PNGs', async () => {
  const native = entries('terrainAssets.ts'), web = entries('terrainAssets.web.ts');
  assert.equal(native.length, 10);
  assert.deepEqual(web.map(([key]) => key), native.map(([key]) => key));
  const kit = await require('canvaskit-wasm')({ wasmBinary: fs.readFileSync(new URL('../public/canvaskit.wasm', import.meta.url)) });
  const pixels = asset => {
    const image = kit.MakeImageFromEncoded(fs.readFileSync(new URL('terrain/' + asset, garden)));
    assert.ok(image, asset);
    const info = { width: image.width(), height: image.height(), colorType: kit.ColorType.RGBA_8888,
      alphaType: kit.AlphaType.Unpremul, colorSpace: kit.ColorSpace.SRGB };
    const data = image.readPixels(0, 0, info); image.delete();
    return { width: info.width, height: info.height, data };
  };
  for (const [index, [key, png]] of native.entries()) {
    const webp = web[index][1];
    assert.equal(webp, `web/${png.replace(/\.png$/, '.webp')}`, key);
    const a = pixels(png), b = pixels(webp);
    assert.equal(b.width, a.width, key); assert.equal(b.height, a.height, key);
    assert.ok(Buffer.from(a.data).equals(Buffer.from(b.data)), `${key}: pixels differ`);
    assert.ok(fs.statSync(new URL('terrain/' + webp, garden)).size < fs.statSync(new URL('terrain/' + png, garden)).size, `${key}: not smaller`);
  }
});
