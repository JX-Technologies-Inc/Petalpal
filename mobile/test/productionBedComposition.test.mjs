import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadPlantingModules } from './loadPlantingModules.mjs';

const require = createRequire(import.meta.url);
const CK = await require('canvaskit-wasm')({
  wasmBinary: fs.readFileSync(new URL('../public/canvaskit.wasm', import.meta.url)),
});
const mobile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storage = new Proxy({}, { get() { throw new Error('Composition must not access storage'); } });
const load = loadPlantingModules(storage);
const { composeProductionBed: compose } = load('productionBedComposition');
const api = load('productionGrowth');
const model = load('../flower-density-sandbox/monthly-growth/monthlyGrowthModel');
const { growthCatalog } = load('../flower-density-sandbox/monthly-growth/growthCatalog');
const { isFootprintInApprovedMonthMaskWorld: validFootprint } = load('approvedPlantingMasks');
const plain = value => JSON.parse(JSON.stringify(value));
const decorations = bed => [...bed.companions, ...bed.filler];
const byId = pieces => plain([...pieces].sort((a, b) => a.id.localeCompare(b.id)));
const fixture = (month, count) => model.monthlyGrowthRecords(month, count).map(p => ({
  id: p.id, flowerId: `flower-${p.id}`, ownerUserId: 'synthetic-owner',
  journalEntryId: `synthetic-${p.id}`, plantedDate: '2026-06-01', month,
  landId: `Land${String(month).padStart(2, '0')}`, worldX: p.worldX, worldY: p.worldY,
  scale: 1, rotation: 0, placementVersion: 1, speciesCode: p.speciesCode, flowerName: p.speciesCode,
}));

// Read approved current artwork directly. Frozen interaction alpha is not an
// accurate measure of the rebuilt plants' visual size and is never changed.
const artwork = new Map();
function art(piece) {
  const key = `${piece.speciesCode}:${piece.componentId}`;
  if (artwork.has(key)) return artwork.get(key);
  const source = growthCatalog(piece.speciesCode).images[piece.componentId];
  const asset = source.slice(source.indexOf('assets/garden/flowers/'));
  assert.ok(asset.startsWith('assets/garden/flowers/'));
  const image = CK.MakeImageFromEncoded(fs.readFileSync(path.join(mobile, asset)));
  assert.ok(image, `Approved artwork decodes: ${key}`);
  const width = image.width(), height = image.height();
  const pixels = image.readPixels(0, 0, { width, height, colorType: CK.ColorType.RGBA_8888,
    alphaType: CK.AlphaType.Unpremul, colorSpace: CK.ColorSpace.SRGB });
  let left = width, top = height, right = 0, bottom = 0, alphaArea = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const alpha = pixels[(y * width + x) * 4 + 3];
    alphaArea += alpha / 255;
    if (alpha <= 4) continue;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
  }
  image.delete();
  const result = { left, top, right, bottom, alphaArea };
  artwork.set(key, result);
  return result;
}
const mass = pieces => pieces.reduce((sum, p) => sum + art(p).alphaArea * p.scale ** 2, 0);
const summary = [];
const cases = [...Array.from({ length: 12 }, (_, i) => [i + 1, 12]), [6, 5], [6, 30],
  [6, 5, 'TULIP'], [12, 30, 'LAVENDER']];
for (const [month, count, onlySpecies] of cases) {
  const records = fixture(month, count).map(p => onlySpecies
    ? { ...p, speciesCode: onlySpecies, flowerName: onlySpecies } : p);
  const recordSnapshot = JSON.stringify(records);
  const growth = api.productionGrowth(records)[0].growth, snapshot = JSON.stringify(growth);
  const original = new Map(growth.pieces.map(p => [p.id, p]));
  const fallback = compose(growth, month);
  const bed = compose(growth, month, art), children = decorations(bed);
  assert.equal(bed.primary, growth.primary, 'The original primary array and every primary instance stay fixed');
  assert.equal(JSON.stringify(growth), snapshot, 'Renderer composition cannot mutate gameplay growth data');
  assert.equal(JSON.stringify(records), recordSnapshot, 'Persisted planting records remain unchanged');
  assert.equal(new Set([...bed.primary, ...children].map(p => p.id)).size, bed.primary.length + children.length);
  assert.deepEqual(children.map(p => p.id), decorations(fallback).map(p => p.id),
    'Image readiness does not alter selected flower identities');
  for (const piece of children) {
    const previous = original.get(piece.id);
    assert.ok(previous, 'Composition only draws existing decorative identities');
    assert.ok(records.some(p => p.id === piece.parentId), 'Every decoration retains a live owner');
    assert.equal(piece.interactive, false);
    assert.deepEqual(plain({ ...piece, worldX: previous.worldX, worldY: previous.worldY,
      scale: previous.scale, componentId: previous.componentId }),
      plain(previous), 'Only decorative position, scale and an approved same-species component may change');
    assert.ok(growthCatalog(piece.speciesCode).images[piece.componentId],
      'A decorative variant must be existing approved artwork for the same species');
    assert.ok([piece.worldX, piece.worldY, piece.scale].every(Number.isFinite) && piece.scale > 0);
    const bounds = art(piece), clearance = Math.min(10, Math.ceil(Math.max(7, (bounds.right - bounds.left) * piece.scale * .22)));
    assert.ok(validFootprint(month, piece.worldX, piece.worldY, clearance),
      'Decorative roots preserve clearance within the approved grass and exclusion holes');
  }
  const reordered = { ...growth, records: [...growth.records].reverse(), pieces: [...growth.pieces].reverse(),
    primary: [...growth.primary].reverse(), companions: [...growth.companions].reverse(), filler: [...growth.filler].reverse() };
  const reorderedBed = compose(reordered, month, art);
  assert.equal(reorderedBed.primary, reordered.primary);
  assert.deepEqual(byId(decorations(reorderedBed)), byId(children), 'Record and draw-array order cannot change composition');
  const fresh = loadPlantingModules(storage)('productionBedComposition').composeProductionBed;
  assert.deepEqual(byId(decorations(fresh(growth, month, art))), byId(children), 'Fresh runtime reconstructs the same bed');
  assert.equal(children.length, decorations(growth).length,
    'The lush correction retains every automatic companion and filler instead of suppressing fullness');
  const beforeMass = mass(decorations(growth)), afterMass = mass(children);
  // Additive source alpha area is diagnostic only: overlapping focal masses can
  // grow while the rendered bed still exposes more grass between groups.
  summary.push({ month, parents: count, onlySpecies, decorationsBefore: decorations(growth).length,
    decorationsAfter: children.length, artworkAreaRatio: +(afterMass / beforeMass).toFixed(3) });
}

const parents = fixture(6, 12), removedId = parents[0].id;
const reduced = api.productionGrowth(parents.slice(1))[0].growth;
assert.ok(decorations(compose(reduced, 6, art)).every(p => p.parentId !== removedId),
  'Deleting a planted flower cannot leave orphan decorations');
const primaryOnly = { ...reduced, companions: [], filler: [] };
assert.equal(compose(primaryOnly, 6, art), primaryOnly, 'Placement preview keeps its original primary-only drawing');
const noRoom = { ...reduced, mask: { ...reduced.mask, points: [] } };
const emptyBed = compose(noRoom, 6, art);
assert.equal(emptyBed.primary, reduced.primary);
assert.equal(decorations(emptyBed).length, 0, 'No safe decorative space cannot remove primary flowers');
assert.deepEqual(plain(compose({ ...reduced, records: [], primary: [], companions: [], filler: [] }, 6, art).primary), []);

console.log(JSON.stringify({ test: 'productionBedComposition', fixtures: summary, decodedApprovedComponents: artwork.size }));
console.log('Production composition: fixed primaries, immutable gameplay data, original child identities/species, approved variants, safe mask clearance, deterministic reload/order, image readiness and deletion passed.');
