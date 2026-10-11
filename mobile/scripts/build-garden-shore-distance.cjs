// Run from mobile: node scripts/build-garden-shore-distance.cjs
// Rebuild after a deliberate change to gardenMapLayout.ts or island artwork.
// This is numeric shore-distance data, not new Garden geometry.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const mobile = path.resolve(__dirname, '..');
const init = require('canvaskit-wasm/bin/full/canvaskit.js');
init({ locateFile: f => require.resolve('canvaskit-wasm/bin/full/' + f) }).then(CK => {
  const width = 1200, height = 900;
  const surface = CK.MakeSurface(width, height);
  assert.ok(surface, 'Shore-distance raster surface');
  const canvas = surface.getCanvas(), paint = new CK.Paint();
  paint.setAntiAlias(true); canvas.scale(0.5, 0.5);
  const layout = fs.readFileSync(path.join(mobile, 'src/components/garden/gardenMapLayout.ts'), 'utf8');
  const lands = [...layout.matchAll(/source: require\('(@[^']+)'\), x: ([-\d.]+), y: ([-\d.]+), width: ([-\d.]+), rotation: ([-\d.]+)/g)];
  assert.equal(lands.length, [...layout.matchAll(/id: '/g)].length, 'Every island must have an explicit transform');
  assert.ok(lands.length > 0);
  for (const m of lands) {
    const image = CK.MakeImageFromEncoded(fs.readFileSync(path.join(mobile, m[1].replace('@/', ''))));
    assert.ok(image, m[1]);
    const x = +m[2], y = +m[3], w = +m[4], h = w * image.height() / image.width();
    canvas.save(); canvas.rotate(+m[5], x + w / 2, y + h / 2);
    canvas.drawImageRect(image, CK.XYWHRect(0, 0, image.width(), image.height()), CK.XYWHRect(x, y, w, h), paint);
    canvas.restore(); image.delete();
  }
  surface.flush(); const snapshot = surface.makeImageSnapshot();
  const info = { width, height, colorType: CK.ColorType.RGBA_8888, alphaType: CK.AlphaType.Unpremul, colorSpace: CK.ColorSpace.SRGB };
  const pixels = snapshot.readPixels(0, 0, info);
  const distance = new Float32Array(width * height);
  for (let i = 0; i < distance.length; i++) distance[i] = pixels[i * 4 + 3] > 100 ? 0 : 160;
  const diagonal = Math.SQRT2;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (x) distance[i] = Math.min(distance[i], distance[i - 1] + 1);
    if (y) {
      distance[i] = Math.min(distance[i], distance[i - width] + 1);
      if (x) distance[i] = Math.min(distance[i], distance[i - width - 1] + diagonal);
      if (x + 1 < width) distance[i] = Math.min(distance[i], distance[i - width + 1] + diagonal);
    }
  }
  for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
    const i = y * width + x;
    if (x + 1 < width) distance[i] = Math.min(distance[i], distance[i + 1] + 1);
    if (y + 1 < height) {
      distance[i] = Math.min(distance[i], distance[i + width] + 1);
      if (x) distance[i] = Math.min(distance[i], distance[i + width - 1] + diagonal);
      if (x + 1 < width) distance[i] = Math.min(distance[i], distance[i + width + 1] + diagonal);
    }
  }
  for (let i = 0; i < distance.length; i++) {
    const value = Math.floor(Math.min(1, distance[i] / 160) * 255);
    pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = value; pixels[i * 4 + 3] = 255;
  }
  const result = CK.MakeImage(info, pixels, width * 4);
  const out = path.join(mobile, 'src/components/garden/water/assets/garden-shore-distance.png');
  fs.writeFileSync(out, result.encodeToBytes());
  result.delete(); snapshot.delete(); paint.delete(); surface.dispose();
  console.log('Baked shore distance from ' + lands.length + ' unchanged island transforms: ' + out);
}).catch(e => { console.error(e); process.exitCode = 1; });
