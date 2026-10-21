import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { PRIMARY_GARDEN_MOOD_CONFIG } from '../../lib/flower-variant-config.js';

const ts = createRequire(import.meta.url)('typescript');
const source = fs.readFileSync(new URL('../src/components/garden/planting/flowerSpeciesSize.ts', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { exports, require: () => ({}) });
const { SPECIES_BLOOM_HEIGHT, GARDEN_FLOWER_SIZE, uniformSpeciesSize } = exports;

// Every species a mood can grow has a bloom height.
const pooled = new Set(Object.values(PRIMARY_GARDEN_MOOD_CONFIG).flatMap(config => config.speciesPool ?? []));
for (const species of pooled) assert.ok(SPECIES_BLOOM_HEIGHT[species] > 0, `${species} has a bloom height`);
assert.equal(GARDEN_FLOWER_SIZE, 1.75);

// Same species, different components, scales and poses -> one visible height at 1.75x.
const components = {
  'tulip/single': { category: 'single', contentBounds: [0, 40, 100, 440] },
  'tulip/small': { category: 'small', contentBounds: [0, 100, 60, 220] },
  'tulip/cluster': { category: 'medium', contentBounds: [0, 10, 300, 410] },
  'tulip/leaf': { category: 'foliage', contentBounds: [0, 0, 80, 100] },
};
const poses = { a: 0.95, b: 1.03, c: 1, d: 0.98, e: 1 };
const pieces = [
  { id: 'a', speciesCode: 'TULIP', componentId: 'tulip/single', kind: 'primary', worldX: 10, worldY: 20, scale: 0.1, rotation: 0.1 },
  { id: 'b', speciesCode: 'TULIP', componentId: 'tulip/small', kind: 'companion', worldX: 30, worldY: 25, scale: 0.05, rotation: 0 },
  { id: 'c', speciesCode: 'TULIP', componentId: 'tulip/cluster', kind: 'filler', worldX: 50, worldY: 28, scale: 0.02, rotation: -0.1 },
  { id: 'd', speciesCode: 'TULIP', componentId: 'tulip/leaf', kind: 'filler', worldX: 60, worldY: 30, scale: 0.08, rotation: 0 },
  { id: 'e', speciesCode: 'NOT_A_SPECIES', componentId: 'tulip/single', kind: 'primary', worldX: 70, worldY: 31, scale: 0.1, rotation: 0 },
];
const sized = uniformSpeciesSize(pieces, piece => components[piece.componentId], id => poses[id]);
const visible = piece => (components[piece.componentId].contentBounds[3] - components[piece.componentId].contentBounds[1]) * piece.scale * poses[piece.id];
for (const piece of sized.slice(0, 3)) assert.ok(Math.abs(visible(piece) - SPECIES_BLOOM_HEIGHT.TULIP * 1.75) < 1e-9, piece.id);
assert.ok(Math.abs(sized[3].scale - 0.08 * 1.75) < 1e-12, 'leaves keep their relative size, times 1.75');
assert.ok(Math.abs(sized[4].scale - 0.1 * 1.75) < 1e-12, 'unknown species keeps its size, times 1.75');
sized.forEach((piece, index) => {
  for (const key of ['id', 'worldX', 'worldY', 'rotation', 'componentId', 'kind']) assert.equal(piece[key], pieces[index][key], `${key} unchanged`);
});
assert.equal(pieces[0].scale, 0.1, 'input pieces are not mutated');
console.log('flowerSpeciesSize tests passed');
