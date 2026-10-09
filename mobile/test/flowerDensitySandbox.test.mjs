import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { loadPlantingModules } from './loadPlantingModules.mjs';

let storageAccesses = 0;
const storage = new Proxy({}, { get() { storageAccesses++; throw new Error('Sandbox accessed storage'); } });
const load = loadPlantingModules(storage);
const model = load('../flower-density-sandbox/flowerDensityModel');
const variants = load('../flower-density-sandbox/flowerClusterVariants');
const approved = load('approvedPlantingMasks');
const { DEFAULT_TUNING, generateDensityLayout, getRegionInfo, sortByGroundY } = model;
const plain = (value) => JSON.parse(JSON.stringify(value));
const started = performance.now();
const report = [];
let checkedFlowers = 0;
const snapshot = JSON.stringify([approved.APPROVED_MASK_CALIBRATION, approved.APPROVED_MASK_REFINEMENTS]);
assert.deepEqual(plain(Object.values(DEFAULT_TUNING).map((tuning) => tuning.footprintRadius)), [9, 12, 16],
  'V2 visual changes must not resize the S/M/L ground footprints');

for (const flowerClass of ['S', 'M', 'L']) {
  const compositions = variants.CLUSTER_VARIANTS[flowerClass];
  assert.equal(compositions.length, 5, `${flowerClass} needs five V2 compositions`);
  assert.equal(new Set(compositions.map((variant) => JSON.stringify(variant.components))).size, 5,
    `${flowerClass} compositions must differ in artwork arrangement, not only their names`);
  for (const variant of compositions) {
    let heads = 0;
    for (const component of variant.components) {
      assert(Number.isFinite(component.x) && Number.isFinite(component.y) && Number.isFinite(component.rotationDegrees));
      for (const piece of component.pieces) {
        const source = variants.SOURCE_PIECES[piece.source];
        assert(source, `Unknown source piece ${piece.source}`);
        assert(piece.width > 0 && piece.height > 0);
        assert(Number.isFinite(piece.x) && Number.isFinite(piece.y));
        if (/Head|Secondary/.test(piece.source)) heads++;
        for (const [x, y] of source.clip) assert(x >= 0 && x <= 1254 && y >= 0 && y <= 1254);
      }
    }
    assert.equal(heads, variant.bloomCount, 'The declared bloom count must match the source heads actually drawn');
  }
}
assert.deepEqual(plain(variants.CLUSTER_VARIANTS.S.map((v) => v.bloomCount)).sort(), [3, 3, 4, 4, 5]);
assert.deepEqual([...new Set(variants.CLUSTER_VARIANTS.M.map((v) => v.bloomCount))].sort(), [1, 2, 3]);
assert(variants.CLUSTER_VARIANTS.L.every((v) => v.bloomCount === 1 || v.bloomCount === 2));
const tulipPalettes = variants.CLUSTER_VARIANTS.M.map((v) => v.components.flatMap((c) => c.pieces)
  .filter((piece) => /Head/.test(piece.source)).map((piece) => piece.source));
assert(tulipPalettes.some((heads) => heads.every((source) => source === 'tulipRedHead')));
assert(tulipPalettes.some((heads) => heads.every((source) => source === 'tulipYellowHead')));
assert(tulipPalettes.some((heads) => new Set(heads).size === 2), 'Tulip variants must break the repeated red/yellow pair');
assert(variants.CLUSTER_VISUALS.S.height / variants.LEGACY_CLUSTER_VISUALS.S.height >= 0.75);
assert(variants.CLUSTER_VISUALS.S.height / variants.LEGACY_CLUSTER_VISUALS.S.height <= 0.85);
assert(variants.CLUSTER_VISUALS.S.width > variants.LEGACY_CLUSTER_VISUALS.S.width);
for (const dimension of ['width', 'height']) {
  const ratio = variants.CLUSTER_VISUALS.L[dimension] / variants.LEGACY_CLUSTER_VISUALS.L[dimension];
  assert(ratio >= 0.8 && ratio <= 0.85, 'Hydrangea reference size must decrease by approximately 15–20%');
}
// Measure the composed clip geometry, so a metadata-only size change cannot pass.
const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const chamomileHeightRatio = average(variants.CLUSTER_VARIANTS.S.map((variant) =>
  variants.getClusterVariantBounds(variant).height)) / (46 * 0.94);
assert(chamomileHeightRatio >= 0.75 && chamomileHeightRatio <= 0.85,
  'Actual Chamomile compositions should be 15–25% shorter than the original anchored artwork');
const hydrangeaSizeRatio = average(variants.CLUSTER_VARIANTS.L.map((variant) => {
  const bounds = variants.getClusterVariantBounds(variant);
  return Math.sqrt(bounds.width * bounds.height / (48 * 46.08));
}));
assert(hydrangeaSizeRatio >= 0.8 && hydrangeaSizeRatio <= 0.85,
  'Average Hydrangea composition bounds should decrease by approximately 15–20% in equivalent linear size');
const tulipWidths = variants.CLUSTER_VARIANTS.M.map((variant) => variants.getClusterVariantBounds(variant).width);
assert(Math.max(...tulipWidths) > DEFAULT_TUNING.M.footprintRadius * 2,
  'Visual width must remain independent of the Tulip collision footprint');
assert(Math.max(...tulipWidths) > Math.min(...tulipWidths) * 1.5,
  'Tulip variants need a meaningful range of narrow and wide silhouettes');

for (let month = 1; month <= 12; month++) {
  const region = getRegionInfo(month);
  assert.equal(region.month, month);
  assert.equal(region.landId, `Land${month.toString().padStart(2, '0')}`);
  assert(region.estimatedArea > 0);
  const row = { month, monthName: region.monthName, landId: region.landId, estimatedArea: region.estimatedArea };
  for (const mode of ['S', 'M', 'L', 'mixed']) {
    const thirty = generateDensityLayout(month, 30, mode);
    const forty = generateDensityLayout(month, 40, mode);
    assert.equal(thirty.requested, 30);
    assert.equal(forty.requested, 40);
    assert.equal(forty.failed + forty.placed, 40);
    assert.deepEqual(plain(thirty.flowers), plain(forty.flowers.filter((f) => Number(f.id.split('-').at(-1)) < 30)));
    assert.deepEqual(plain(forty), plain(generateDensityLayout(month, 40, mode)));
    assert.equal(new Set(forty.flowers.map((f) => f.id)).size, forty.placed);
    for (const [index, flower] of forty.flowers.entries()) {
      assert(approved.isFootprintInApprovedMonthMaskWorld(month, flower.worldX, flower.worldY, flower.footprintRadius),
        `${region.monthName} ${mode} footprint escaped approved mask`);
      assert(flower.scaleVariation >= 0.9 && flower.scaleVariation <= 1.1);
      assert(flower.rotationDegrees >= -12 && flower.rotationDegrees <= 12);
      assert([0, 1, 2].includes(flower.compositionVariant));
      assert.equal(flower.footprintRadius, DEFAULT_TUNING[flower.flowerClass].footprintRadius);
      for (const other of forty.flowers.slice(index + 1)) {
        assert(Math.hypot(flower.worldX - other.worldX, flower.worldY - other.worldY) + 1e-8 >=
          flower.footprintRadius + other.footprintRadius, `${region.monthName} ${mode} footprints overlap`);
      }
      checkedFlowers++;
    }
    const sorted = sortByGroundY(forty.flowers);
    assert.deepEqual(plain(sorted), plain(sortByGroundY([...forty.flowers].reverse())));
    for (let i = 1; i < sorted.length; i++) assert(sorted[i - 1].worldY <= sorted[i].worldY);
    row[mode] = { placedAt30: thirty.placed, placedAt40: forty.placed };
  }
  report.push(row);
}

const modifiedVisuals = Object.fromEntries(Object.entries(DEFAULT_TUNING).map(([key, value]) =>
  [key, { ...value, visualScale: 3, anchorX: 0.1, anchorY: 0.2 }]));
assert.deepEqual(plain(generateDensityLayout(6, 40, 'mixed', modifiedVisuals)),
  plain(generateDensityLayout(6, 40, 'mixed')), 'Visual tuning moved ground positions');
const hugeFootprints = Object.fromEntries(Object.entries(DEFAULT_TUNING).map(([key, value]) =>
  [key, { ...value, footprintRadius: 500 }]));
assert.equal(generateDensityLayout(6, 30, 'mixed', hugeFootprints).placed, 0, 'Footprints were silently shrunk');
assert.equal(generateDensityLayout(1, 0, 'mixed').placed, 0);
assert.deepEqual(plain(sortByGroundY([{ id: 'z', worldY: 5 }, { id: 'a', worldY: 5 }, { id: 'b', worldY: 2 }]))
  .map((f) => f.id), ['b', 'a', 'z']);
assert.equal(snapshot, JSON.stringify([approved.APPROVED_MASK_CALIBRATION, approved.APPROVED_MASK_REFINEMENTS]));
assert.equal(storageAccesses, 0);
const freshModel = loadPlantingModules(storage)('../flower-density-sandbox/flowerDensityModel');
assert.deepEqual(plain(generateDensityLayout(6, 40, 'mixed')), plain(freshModel.generateDensityLayout(6, 40, 'mixed')),
  'Fresh module load changed the fixed-seed comparison');
assert.equal(storageAccesses, 0);
const freshVariants = loadPlantingModules(storage)('../flower-density-sandbox/flowerClusterVariants');
for (const flowerClass of ['S', 'M', 'L']) {
  const flowers = generateDensityLayout(10, 30, flowerClass).flowers;
  const selected = flowers.map((flower) => variants.getClusterVariantIndex(flower.id));
  assert.equal(new Set(selected).size, 5, `${flowerClass}: all five variants should appear in the 30-object October comparison`);
  assert.deepEqual(selected, flowers.map((flower) => freshVariants.getClusterVariantIndex(flower.id)));
  for (const flower of [...flowers].reverse()) assert.equal(variants.getClusterVariantIndex(flower.id),
    freshVariants.getClusterVariantIndex(flower.id), 'Appearance must be independent of render order and reload');
}
assert.equal(storageAccesses, 0);

function groupingMetrics(month, mode) {
  const flowers = generateDensityLayout(month, 30, mode).flowers;
  const nearestGaps = flowers.map((flower) => Math.min(...flowers.filter((other) => other.id !== flower.id)
    .map((other) => Math.hypot(flower.worldX - other.worldX, flower.worldY - other.worldY)
      - flower.footprintRadius - other.footprintRadius))).sort((a, b) => a - b);
  const unseen = new Set(flowers);
  const connectedSizes = [];
  while (unseen.size) {
    const first = unseen.values().next().value;
    const group = [first];
    unseen.delete(first);
    for (let i = 0; i < group.length; i++) {
      for (const other of unseen) {
        const flower = group[i];
        const gap = Math.hypot(flower.worldX - other.worldX, flower.worldY - other.worldY)
          - flower.footprintRadius - other.footprintRadius;
        if (gap <= 8) { unseen.delete(other); group.push(other); }
      }
    }
    connectedSizes.push(group.length);
  }
  return { month, mode, placed: flowers.length,
    medianNearestGap: nearestGaps[Math.floor(nearestGaps.length / 2)],
    nearbyObjects: nearestGaps.filter((gap) => gap <= 8).length,
    interiorObjects: flowers.filter((flower) => approved.isFootprintInApprovedMonthMaskWorld(month,
      flower.worldX, flower.worldY, flower.footprintRadius + 6)).length,
    looseGroups: connectedSizes.filter((size) => size >= 2 && size <= 4).length,
    singles: connectedSizes.filter((size) => size === 1).length,
  };
}
const grouping = [groupingMetrics(6, 'mixed'), groupingMetrics(10, 'mixed'), groupingMetrics(10, 'M')];
assert(grouping[0].interiorObjects >= grouping[0].placed * 0.4,
  'June should use the actual grass interior instead of disproportionately lining its edges');
for (const sample of grouping.slice(1)) {
  assert(sample.medianNearestGap < 8, 'October should have neighboring clusters, not mostly isolated stamps');
  assert(sample.looseGroups >= 3 && sample.singles >= 2, 'Keep loose mini-groups and separate open grass gaps');
}

console.log(`Flower density sandbox: 12 months × 4 modes × 30/40; ${checkedFlowers} full footprints verified; ${(performance.now() - started).toFixed(0)} ms.`);
console.log(`V2: 15 distinct source-art compositions; ID-stable selection; actual visual bounds and natural grouping checks passed.`);
console.table(report.map(({ monthName, S, M, L, mixed }) => ({ Month: monthName,
  'S 30/40': `${S.placedAt30}/${S.placedAt40}`, 'M 30/40': `${M.placedAt30}/${M.placedAt40}`,
  'L 30/40': `${L.placedAt30}/${L.placedAt40}`, 'Mixed 30/40': `${mixed.placedAt30}/${mixed.placedAt40}` })));
if (process.argv.includes('--report')) {
  const payload = {
    description: 'V2 observed deterministic sandbox packing; visual grouping only, not capacity optimization or a mathematical maximum.',
    reproduce: 'From mobile: node ./test/flowerDensitySandbox.test.mjs --report',
    method: {
      candidates: 'Fixed-seed 64 × 64 jittered candidates; loose 2–4-object groups with variable neighbor gaps and occasional singles. Continuous interior clearance from the same 2 px Final Mask samples ranks candidates only; canonical full-circle validation decides acceptance.',
      containment: 'Canonical isFootprintInApprovedMonthMaskWorld; full reserved circles, unchanged approved masks.',
      mixedClassOrder: ['S', 'M', 'L'],
      area: 'Approximate final-mask world area in px², sampled at 2 px cell centers.',
      variation: 'Visual scale 0.9–1.1, rotation ±12°, five ID-selected V2 compositions per species; original V1 composition toggle does not move anchors. No footprint shrinking.',
      interpretation: 'placedAt30 and placedAt40 are accepted objects for the corresponding requested count. Failed = requested minus placed.',
    },
    tuning: DEFAULT_TUNING,
    visualBounds: { chamomileHeightRatio, hydrangeaEquivalentLinearSizeRatio: hydrangeaSizeRatio },
    grouping,
    report,
  };
  const json = JSON.stringify(payload, null, 2) + '\n';
  writeFileSync(new URL('./flowerDensitySandbox.capacity.json', import.meta.url), json);
  console.log(json);
}
