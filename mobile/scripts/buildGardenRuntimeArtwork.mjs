// Regenerate Web copies from immutable originals and layer registration bounds.
// Requires pngjs, already supplied by Expo's image tooling; no resampling.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { PNG } = createRequire(import.meta.url)('pngjs');
for (const layer of ['GardenInfrastructureLayer.tsx', 'GardenLand09InterfaceLayer.tsx', 'GardenRoadApproachLayer.tsx']) {
  const source = fs.readFileSync(new URL('../src/components/garden/' + layer, import.meta.url), 'utf8');
  for (const [, original, runtime, ...numbers] of source.matchAll(/registeredArtwork\(require\('(@\/assets\/[^']+)'\),\s*require\('(@\/assets\/[^']+)'\), (\d+), (\d+), (\d+), (\d+)\)/g)) {
    if (!runtime.startsWith('@/assets/garden/runtime/')) throw new Error('Runtime output must preserve originals');
    const [x, y, width, height] = numbers.map(Number);
    const image = PNG.sync.read(fs.readFileSync(new URL('../' + original.replace('@/', ''), import.meta.url)));
    if (image.width !== 2400 || image.height !== 1800) throw new Error('Original registration changed');
    const copy = new PNG({ width, height });
    for (let row = 0; row < image.height; row++) for (let col = 0; col < image.width; col++) {
      const pixel = (row * image.width + col) * 4;
      if (col >= x && col < x + width && row >= y && row < y + height) {
        image.data.copy(copy.data, ((row - y) * width + col - x) * 4, pixel, pixel + 4);
      } else if (image.data[pixel + 3]) throw new Error('Bounds would crop visible artwork');
    }
    fs.writeFileSync(new URL('../' + runtime.replace('@/', ''), import.meta.url), PNG.sync.write(copy));
  }
}
