import { seeded } from '../flower-density-sandbox/tulip-components/tulipComposition';
import { bedDepth } from '../flower-density-sandbox/monthly-growth/layeredBedModel';
import { GROWTH_COMPONENTS, growthCatalog } from '../flower-density-sandbox/monthly-growth/growthCatalog';
import type { GrowthPiece, MaskSample } from '../flower-density-sandbox/monthly-growth/growthCoverage';
import type { MonthlyGrowth } from '../flower-density-sandbox/monthly-growth/monthlyGrowthModel';
import { isFootprintInApprovedMonthMaskWorld } from './approvedPlantingMasks';

type Bounds = { left: number; top: number; right: number; bottom: number };
export type BotanicalBoundsReader = (piece: GrowthPiece) => Bounds | null;
export type ProductionBed = Pick<MonthlyGrowth, 'primary' | 'companions' | 'filler'>;

// These are preferences among flowers the player already planted. They never
// introduce a species, replace a parent, or recolor the approved flower artwork.
const CREAM = ['WHITE_ROSE', 'CHAMOMILE', 'SNOWDROP', 'DAISY'];
const COOL = ['LAVENDER', 'HYDRANGEA', 'HEATHER', 'BLUEBELL', 'GENTIAN', 'ASTER'];
const BLUSH = ['TULIP', 'PETUNIA', 'POPPY', 'ANEMONE'];
const BUTTER = ['COREOPSIS', 'YELLOW_DAFFODIL', 'DANDELION', 'SUNFLOWER'];
const PROFILES: Record<number, { palette: string[]; fullness: number }> = {
  1: { palette: [...CREAM, ...COOL, ...BLUSH], fullness: .93 },
  2: { palette: [...CREAM, ...COOL, ...BLUSH], fullness: .93 },
  3: { palette: [...CREAM, ...COOL, ...BLUSH], fullness: .95 },
  4: { palette: [...COOL, ...CREAM, ...BLUSH], fullness: 1.04 },
  5: { palette: [...CREAM, ...BLUSH, ...BUTTER], fullness: 1.04 },
  6: { palette: ['CHAMOMILE', 'TULIP', 'WHITE_ROSE', 'DAISY', ...BUTTER, ...COOL], fullness: 1.02 },
  7: { palette: [...COOL, ...CREAM, ...BLUSH], fullness: 1.04 },
  8: { palette: ['LAVENDER', 'SNOWDROP', 'WHITE_ROSE', 'HYDRANGEA', 'HEATHER', 'GENTIAN', ...CREAM], fullness: .98 },
  9: { palette: [...BLUSH, ...CREAM, ...BUTTER], fullness: 1.02 },
  10: { palette: ['LAVENDER', 'TULIP', 'HEATHER', 'HYDRANGEA', 'PETUNIA', ...CREAM], fullness: 1.02 },
  11: { palette: [...COOL, ...BLUSH, ...CREAM], fullness: 1.06 },
  12: { palette: ['LAVENDER', 'HEATHER', 'TULIP', 'WHITE_ROSE', 'HYDRANGEA', 'CHAMOMILE', 'BLUEBELL'], fullness: 1.08 },
};
const vertical = new Set(['LAVENDER', 'HEATHER', 'BLUEBELL', 'SUNFLOWER', 'BIRD_OF_PARADISE', 'YELLOW_RAPESEED_FLOWER', 'OLIVE']);
const fields = new WeakMap<MonthlyGrowth['mask'], { points: MaskSample[]; depth: ReturnType<typeof bedDepth>;
  clearance: Map<string, boolean>; cells: Map<string, MaskSample[]>; nearby: Map<string, MaskSample[]> }>();
const distance = (a: MaskSample, b: MaskSample) => Math.hypot(a.x - b.x, a.y - b.y);

function fieldFor(growth: MonthlyGrowth, month: number) {
  let field = fields.get(growth.mask);
  if (!field) {
    // Reuse the approved exclusion holes for rocks, paths and furniture. Keep
    // decorative roots inside usable grass instead of snapping onto its edge.
    const samples = new Set(growth.mask.points.map(p => `${p.x}:${p.y}`));
    const inset = growth.mask.step * 2;
    const points = growth.mask.points.filter(p => [-1, 0, 1].every(dx => [-1, 0, 1].every(dy =>
      samples.has(`${p.x + dx * inset}:${p.y + dy * inset}`))));
    // The cheap raster inset narrows the search. Exact approved-mask footprint
    // checks are cached only for the promising sites that will actually be used.
    const usable = points.length ? points : growth.mask.points, cells = new Map<string, MaskSample[]>();
    for (const p of usable) {
      const key = `${Math.floor(p.x / 16)}:${Math.floor(p.y / 16)}`;
      const bucket = cells.get(key) ?? []; bucket.push(p); cells.set(key, bucket);
    }
    field = { points: usable, depth: bedDepth(growth.mask.points), clearance: new Map(), cells, nearby: new Map() };
    fields.set(growth.mask, field);
  }
  return field;
}

/** A display-only bed. The persisted flowers, primary sprites, stage, growth
 * budgets, collision and hit-test geometry remain the original model's data.
 * All automatic companions and ground-cover are retained. Hierarchy comes from
 * their grouping and approved botanical variants, not from culling the bed. */
export function composeProductionBed(growth: MonthlyGrowth, month: number,
  readBounds?: BotanicalBoundsReader): ProductionBed {
  if (!growth.records.length || (!growth.companions.length && !growth.filler.length)) return growth;
  const { points, depth, clearance, cells, nearby } = fieldFor(growth, month);
  if (!points.length) return { primary: growth.primary, companions: [], filler: [] };
  const profile = PROFILES[month] ?? PROFILES[6];
  const parents = [...growth.records].sort((a, b) => a.id.localeCompare(b.id));
  const owners = new Map(parents.map(p => [p.id, p]));
  const counts = new Map<string, number>();
  for (const p of parents) counts.set(p.speciesCode, (counts.get(p.speciesCode) ?? 0) + 1);
  const preference = (species: string) => {
    const index = profile.palette.indexOf(species);
    return index < 0 ? .22 : 1 / (1 + index * .22);
  };
  const species = [...counts.keys()].sort((a, b) =>
    preference(b) * Math.sqrt(counts.get(b)!) - preference(a) * Math.sqrt(counts.get(a)!) || a.localeCompare(b));
  const dominantCount = parents.length < 8 ? 1 : Math.min(2, species.length);
  const tier = (code: string) => {
    const rank = species.indexOf(code);
    return rank < dominantCount ? 0 : rank < dominantCount + 3 ? 1 : 2;
  };
  const occupied = new Map<string, number>();
  const cell = (p: MaskSample) => `${Math.floor(p.x / 6)}:${Math.floor(p.y / 6)}`;
  const nearest = (target: MaskSample, score: (p: MaskSample) => number = p => distance(p, target), margin = 7): MaskSample | null => {
    const col = Math.floor(target.x / 16), row = Math.floor(target.y / 16), key = `${col}:${row}`;
    let local = nearby.get(key);
    if (!local) {
      local = [];
      for (let ring = 0; ring <= 8; ring++) {
        for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          local.push(...(cells.get(`${col + dx}:${row + dy}`) ?? []));
        }
        if (ring >= 1 && local.length >= 32) break;
      }
      nearby.set(key, local);
    }
    let candidates = local.length ? local : points;
    for (;;) {
      let best: MaskSample | null = null, value = Infinity;
      for (const p of candidates) {
        if (clearance.get(`${p.x}:${p.y}:${margin}`) === false) continue;
        const next = score(p) + (occupied.get(cell(p)) ?? 0) * 5;
        if (next < value) { best = p; value = next; }
      }
      if (!best) {
        if (candidates === points) return null;
        candidates = points; continue;
      }
      const key = `${best.x}:${best.y}:${margin}`;
      let safe = clearance.get(key);
      if (safe === undefined) {
        safe = isFootprintInApprovedMonthMaskWorld(month, best.x, best.y, margin);
        clearance.set(key, safe);
      }
      if (safe) return best;
    }
  };
  const area = growth.mask.points.length * growth.mask.step ** 2;
  const patchCount = parents.length < 8 ? 1 : area > 55000 ? 4 : area > 22000 ? 3 : 2;
  const radius = Math.max(18, Math.sqrt(area / (patchCount * Math.PI)) * .86) * Math.sqrt(profile.fullness);
  const centers: MaskSample[] = [];
  // Fit broad patches to the actual usable bed shape. Equal-area seed slices
  // cover long/curved islands; a few centroid iterations soften the divisions.
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const axis = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys) ? 'x' : 'y';
  const ordered = [...points].sort((a, b) => a[axis] - b[axis]);
  let means = Array.from({ length: patchCount }, (_, i) => ordered[Math.floor((i + .5) * ordered.length / patchCount)]);
  for (let iteration = 0; iteration < 4; iteration++) {
    const sums = means.map(() => ({ x: 0, y: 0, n: 0 }));
    for (const p of points) {
      let best = 0, d = Infinity;
      means.forEach((mean, i) => { const next = (mean.x - p.x) ** 2 + (mean.y - p.y) ** 2;
        if (next < d) { best = i; d = next; } });
      sums[best].x += p.x; sums[best].y += p.y; sums[best].n++;
    }
    means = sums.map((sum, i) => sum.n ? { x: sum.x / sum.n, y: sum.y / sum.n } : means[i]);
  }
  for (const mean of means) { const center = nearest(mean); if (center) centers.push(center); }
  if (!centers.length) return { primary: growth.primary, companions: [], filler: [] };
  const count = parents.length;
  const maturity = Math.max(0, Math.min(1, (count - 5) / 20));
  const companions = [...growth.companions].sort((a, b) => a.id.localeCompare(b.id));
  const filler = [...growth.filler].sort((a, b) => a.id.localeCompare(b.id));
  const place = (piece: GrowthPiece): GrowthPiece | null => {
    const parent = owners.get(piece.parentId);
    if (!parent) return piece;
    const role = tier(piece.speciesCode), rank = species.indexOf(piece.speciesCode);
    const rng = seeded(`bed-pose:${piece.id}`), low = piece.kind === 'filler' || rng() < .66;
    const tall = !low && role === 0 && vertical.has(piece.speciesCode) && rng() < .3;
    const height = (piece.kind === 'filler' ? 12 + maturity * 6 + rng() * 5 : tall ? 35 + rng() * 7
      : low ? (role === 0 ? 24 : role === 1 ? 21 : 18) + rng() * 5
      : (role === 0 ? 32 : role === 1 ? 28 : 24) + rng() * 5) * profile.fullness;
    // Focal companions use existing open-flower variants instead of letting an
    // unlucky run of buds/leaf parts erase the intended flowering mass.
    const flowers = GROWTH_COMPONENTS.filter(c => c.speciesCode === piece.speciesCode
      && !['foliage', 'bud'].includes(c.category) && !/bud|seed/.test(c.componentId));
    const grouped = flowers.filter(c => ['medium', 'full', 'head', 'asymmetric'].includes(c.category));
    const leaves = GROWTH_COMPONENTS.filter(c => c.speciesCode === piece.speciesCode && c.category === 'foliage');
    const pool = piece.kind === 'filler' && leaves.length ? leaves : role === 0 && grouped.length ? grouped : flowers;
    const template = pool.length && (piece.kind === 'filler' || role < 2)
      ? { ...piece, componentId: pool[Math.floor(seeded(`bed-bloom:${piece.id}`)() * pool.length)].componentId } : piece;
    const component = growthCatalog(template.speciesCode).lookup(template.componentId);
    const b = readBounds?.(template), [l, t, r, bottom] = component.contentBounds;
    const w = b ? b.right - b.left : r - l, h = b ? b.bottom - b.top : bottom - t;
    const scale = Math.min(piece.scale * (piece.kind === 'filler' ? 1.8 : role === 0 ? 1.6 : 1.35), height / Math.max(1, h),
      (piece.kind === 'filler' ? 30 : role === 0 ? 46 : 38) / Math.max(1, w));
    // Each species occupies a local lobe, with smaller supporting lobes touching
    // the focal patch. The changing radius and bend avoid circular patch edges.
    const original = { x: piece.worldX, y: piece.worldY };
    let nearestCenter = 0;
    centers.forEach((c, i) => { if (distance(c, original) < distance(centers[nearestCenter], original)) nearestCenter = i; });
    const centerIndex = piece.kind === 'filler' ? nearestCenter
      : (rank + (centers.length > 2 && nearestCenter >= 2 ? 2 : 0)) % centers.length;
    const center = centers[centerIndex], familyAngle = seeded(`bed-lobe:${month}:${piece.speciesCode}`)() * Math.PI * 2;
    const lobe = role === 0 ? 0 : radius * (role === 1 ? .28 : .45);
    const angle = rng() * Math.PI * 2;
    const outer = piece.kind === 'filler' ? Math.sqrt(rng()) * 1.15 : Math.pow(rng(), .65);
    const reach = radius * outer * (role === 0 || piece.kind === 'filler' ? 1 : .82);
    let target = { x: center.x + Math.cos(familyAngle) * lobe + Math.cos(angle) * reach * 1.12,
      y: center.y + Math.sin(familyAngle) * lobe * .62 + Math.sin(angle) * reach * .64
        + Math.sin(angle * 2 + centerIndex) * radius * .14 };
    // Keep much of the existing coverage field as connecting planting. Pulling
    // every leaf into one small focal point is what made the last pass empty.
    const pull = piece.kind === 'filler' ? .32 : .72;
    target = { x: original.x * (1 - pull) + target.x * pull, y: original.y * (1 - pull) + target.y * pull };
    const ownerPoint = { x: parent.worldX, y: parent.worldY };
    const maxTravel = Math.max(55, Math.sqrt(area) * (piece.kind === 'filler' ? .8 : .6));
    const travel = distance(target, ownerPoint);
    if (travel > maxTravel) target = { x: ownerPoint.x + (target.x - ownerPoint.x) * maxTravel / travel,
      y: ownerPoint.y + (target.y - ownerPoint.y) * maxTravel / travel };
    const targetDepth = tall ? .2 : low ? .62 : .4;
    const root = nearest(target, p => distance(p, target) + Math.abs(depth(p) - targetDepth) * radius * .28
      + Math.max(0, distance(p, ownerPoint) - maxTravel) * 4, Math.min(10, Math.ceil(Math.max(7, w * scale * .22))));
    if (!root) return null;
    occupied.set(cell(root), (occupied.get(cell(root)) ?? 0) + 1);
    return { ...template, worldX: root.x, worldY: root.y, scale };
  };
  return { primary: growth.primary, companions: companions.map(place).filter((p): p is GrowthPiece => p !== null),
    filler: filler.map(place).filter((p): p is GrowthPiece => p !== null) };
}
