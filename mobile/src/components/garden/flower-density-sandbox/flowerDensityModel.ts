import {
  APPROVED_MASK_CALIBRATION,
  APPROVED_MASK_REFINEMENTS,
  isFootprintInApprovedMonthMaskWorld,
  isPointInApprovedMonthMaskWorld,
} from '../planting/approvedPlantingMasks';
import { getMaskRefinementOffset } from '../planting/plantingMaskRefinement';
import { GARDEN_WORLD_HEIGHT, GARDEN_WORLD_WIDTH, MONTH_REGION_METAS } from '../planting/plantingRegionData';
import { getParentLand, landLocalToWorld, maskLocalToLandLocal } from '../planting/plantingRegionGeometry';

export type FlowerClass = 'S' | 'M' | 'L';
export type PreviewMode = FlowerClass | 'mixed';

export interface ClassTuning {
  visualScale: number;
  footprintRadius: number;
  anchorX: number;
  anchorY: number;
}

export const DEFAULT_TUNING: Record<FlowerClass, ClassTuning> = {
  S: { visualScale: 1, footprintRadius: 9, anchorX: 0.5, anchorY: 0.94 },
  M: { visualScale: 1, footprintRadius: 12, anchorX: 0.5, anchorY: 0.95 },
  L: { visualScale: 1, footprintRadius: 16, anchorX: 0.5, anchorY: 0.96 },
};

export interface DensityFlower {
  id: string;
  flowerClass: FlowerClass;
  worldX: number;
  worldY: number;
  footprintRadius: number;
  scaleVariation: number;
  rotationDegrees: number;
  compositionVariant: number;
}

export interface DensityLayout {
  flowers: DensityFlower[];
  requested: number;
  placed: number;
  failed: number;
}

export interface DensityRegionInfo {
  month: number;
  monthName: string;
  landId: string;
  bounds: { x: number; y: number; width: number; height: number };
  /** Approximate final-mask area in world px², sampled on a 2 px grid. */
  estimatedArea: number;
}

interface Candidate { x: number; y: number }
const FLOWER_CLASSES: FlowerClass[] = ['S', 'M', 'L'];
const AREA_STEP = 2;
const CANDIDATE_AXIS = 64;
const regionCache = new Map<number, DensityRegionInfo>();
const interiorCache = new Map<number, { x: number; y: number; stride: number; distance: Float32Array }>();
const candidateCache = new Map<number, Candidate[]>();
// Disposable computation caches only: no production placement state or storage.
const eligibleCache = new Map<string, Uint8Array>();

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let n = state;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

export function getRegionInfo(month: number): DensityRegionInfo {
  const cached = regionCache.get(month);
  if (cached) return cached;
  const calibration = APPROVED_MASK_CALIBRATION[month];
  const refinement = APPROVED_MASK_REFINEMENTS[month];
  const meta = MONTH_REGION_METAS[month];
  if (!calibration || !refinement || !meta) throw new Error(`Invalid sandbox month: ${month}`);
  const land = getParentLand(calibration.parentLandAsset);
  const offset = getMaskRefinementOffset(refinement);
  const localCorners = [
    [0, 0], [meta.bbox.width, 0], [0, meta.bbox.height], [meta.bbox.width, meta.bbox.height],
  ].map(([u, v]) => maskLocalToLandLocal(u, v, calibration, meta));
  // ADD strokes can extend beyond the calibrated baseline. REMOVE strokes cannot
  // extend the final mask. These bounds are only a search window, never a mask.
  for (const stroke of refinement.strokes) {
    if (stroke.tool !== 'add') continue;
    const { minX, minY, maxX, maxY } = stroke.bbox;
    localCorners.push({ x: minX, y: minY }, { x: minX, y: maxY },
      { x: maxX, y: minY }, { x: maxX, y: maxY });
  }
  const worldCorners = localCorners.map(({ x, y }) =>
    landLocalToWorld(x + offset.offsetX, y + offset.offsetY, land));
  const x = Math.max(0, Math.floor(Math.min(...worldCorners.map((p) => p.x))));
  const y = Math.max(0, Math.floor(Math.min(...worldCorners.map((p) => p.y))));
  const right = Math.min(GARDEN_WORLD_WIDTH, Math.ceil(Math.max(...worldCorners.map((p) => p.x))));
  const bottom = Math.min(GARDEN_WORLD_HEIGHT, Math.ceil(Math.max(...worldCorners.map((p) => p.y))));
  const columns = Math.ceil((right - x) / AREA_STEP);
  const rows = Math.ceil((bottom - y) / AREA_STEP);
  const stride = columns + 2;
  const distance = new Float32Array(stride * (rows + 2));
  let estimatedArea = 0;
  for (let gy = y; gy < bottom; gy += AREA_STEP) {
    for (let gx = x; gx < right; gx += AREA_STEP) {
      const cellWidth = Math.min(AREA_STEP, right - gx);
      const cellHeight = Math.min(AREA_STEP, bottom - gy);
      if (isPointInApprovedMonthMaskWorld(month, gx + cellWidth / 2, gy + cellHeight / 2)) {
        estimatedArea += cellWidth * cellHeight;
        distance[(1 + Math.floor((gy - y) / AREA_STEP)) * stride + 1 + Math.floor((gx - x) / AREA_STEP)] = 1e9;
      }
    }
  }
  // A cheap continuous preference field from the same sampled FinalMask, including
  // its holes. This approximate distance is NEVER used to admit a footprint;
  // canonical full-circle validation remains the placement authority below.
  const diagonal = AREA_STEP * Math.SQRT2;
  for (let row = 1; row <= rows; row++) {
    for (let column = 1; column <= columns; column++) {
      const i = row * stride + column;
      distance[i] = Math.min(distance[i], distance[i - 1] + AREA_STEP, distance[i - stride] + AREA_STEP,
        distance[i - stride - 1] + diagonal, distance[i - stride + 1] + diagonal);
    }
  }
  for (let row = rows; row >= 1; row--) {
    for (let column = columns; column >= 1; column--) {
      const i = row * stride + column;
      distance[i] = Math.min(distance[i], distance[i + 1] + AREA_STEP, distance[i + stride] + AREA_STEP,
        distance[i + stride - 1] + diagonal, distance[i + stride + 1] + diagonal);
    }
  }
  interiorCache.set(month, { x, y, stride, distance });
  const info = { month, monthName: meta.monthName, landId: meta.landId,
    bounds: { x, y, width: right - x, height: bottom - y }, estimatedArea };
  regionCache.set(month, info);
  return info;
}

function getCandidates(month: number): Candidate[] {
  const cached = candidateCache.get(month);
  if (cached) return cached;
  const { bounds } = getRegionInfo(month);
  const random = seededRandom(0x50455441 ^ Math.imul(month, 0x9e3779b1));
  const candidates: Candidate[] = [];
  // Jittered stratification covers narrow sections while avoiding a visible grid.
  for (let row = 0; row < CANDIDATE_AXIS; row++) {
    for (let column = 0; column < CANDIDATE_AXIS; column++) {
      const x = bounds.x + (column + random()) * bounds.width / CANDIDATE_AXIS;
      const y = bounds.y + (row + random()) * bounds.height / CANDIDATE_AXIS;
      if (isPointInApprovedMonthMaskWorld(month, x, y)) candidates.push({ x, y });
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  candidateCache.set(month, candidates);
  return candidates;
}

function getEligibility(month: number, radius: number): Uint8Array {
  const key = `${month}:${radius}`;
  const cached = eligibleCache.get(key);
  if (cached) return cached;
  // 0 = untested, 1 = contained, 2 = rejected. Compute only candidates actually
  // needed, so a normal 30-object preview does not test thousands of circles.
  const eligibility = new Uint8Array(getCandidates(month).length);
  if (eligibleCache.size >= 48) eligibleCache.delete(eligibleCache.keys().next().value!);
  eligibleCache.set(key, eligibility);
  return eligibility;
}

function chooseCandidate(month: number, radius: number, flowers: DensityFlower[], random: () => number,
  neighbor?: DensityFlower): Candidate | undefined {
  const candidates = getCandidates(month);
  const eligibility = getEligibility(month, radius);
  const interiorField = interiorCache.get(month)!;
  const contains = (index: number, testRadius: number, cache: Uint8Array): boolean => {
    const { x, y } = candidates[index];
    if (cache[index] === 0) cache[index] =
      isFootprintInApprovedMonthMaskWorld(month, x, y, testRadius) ? 1 : 2;
    return cache[index] === 1;
  };
  const start = Math.floor(random() * candidates.length);
  const angle = random() * Math.PI * 2;
  const distance = neighbor ? radius + neighbor.footprintRadius + 2 + random() * 8 : 0;
  const target = neighbor ? { x: neighbor.worldX + Math.cos(angle) * distance,
    y: neighbor.worldY + Math.sin(angle) * distance } : undefined;
  // Neighbor proposals stay loose and close to an existing valid anchor. The
  // target angle and ground gap vary; there is no grid or fixed radial pattern.
  const order = candidates.map((_, index) => (start + index) % candidates.length);
  if (target) order.sort((a, b) =>
    (candidates[a].x - target.x) ** 2 + (candidates[a].y - target.y) ** 2 -
    ((candidates[b].x - target.x) ** 2 + (candidates[b].y - target.y) ** 2));
  let best: Candidate | undefined;
  let bestScore = -Infinity;
  let considered = 0;
  for (const index of order) {
    const candidate = candidates[index];
    if (neighbor && Math.hypot(candidate.x - neighbor.worldX, candidate.y - neighbor.worldY) >
      radius + neighbor.footprintRadius + 12) continue;
    if (eligibility[index] === 2) continue;
    let nearestGap = Infinity;
    for (const other of flowers) {
      const squaredDistance = (candidate.x - other.worldX) ** 2 + (candidate.y - other.worldY) ** 2;
      const separation = radius + other.footprintRadius;
      if (squaredDistance < separation ** 2) { nearestGap = -1; break; }
      nearestGap = Math.min(nearestGap, Math.sqrt(squaredDistance) - separation);
    }
    if (nearestGap < 0 || !contains(index, radius, eligibility)) continue;
    // Soft, continuous preference for the grass body; no fixed inset, outer ring,
    // bounding-box center, or hard exclusion of otherwise legal edge candidates.
    const cell = (1 + Math.floor((candidate.y - interiorField.y) / AREA_STEP)) * interiorField.stride +
      1 + Math.floor((candidate.x - interiorField.x) / AREA_STEP);
    const interior = Math.max(0, Math.min(1, (interiorField.distance[cell] - AREA_STEP / 2 - radius) / 18));
    const score = target ? interior * 0.75 - Math.hypot(candidate.x - target.x, candidate.y - target.y) / 35 :
      interior * 2 + Math.min(1, nearestGap / 40) * 1.2;
    if (score > bestScore) { best = candidate; bestScore = score; }
    // Bounded look-ahead creates small open gaps between group seeds without
    // exhaustively packing the region or steering toward its bounding-box center.
    if (++considered >= (neighbor ? 6 : 16)) break;
  }
  return best;
}

export function generateDensityLayout(month: number, count: number, mode: PreviewMode,
  tuning: Record<FlowerClass, ClassTuning> = DEFAULT_TUNING,
  mixedClasses: readonly FlowerClass[] = FLOWER_CLASSES): DensityLayout {
  getRegionInfo(month);
  if (!Number.isInteger(count) || count < 0 || count > 40) throw new Error('Sandbox count must be 0–40.');
  if (mode !== 'mixed' && !FLOWER_CLASSES.includes(mode)) throw new Error('Invalid sandbox preview mode.');
  if (!mixedClasses.length || mixedClasses.some(value=>!FLOWER_CLASSES.includes(value))) throw new Error('Invalid sandbox species mix.');
  for (const flowerClass of FLOWER_CLASSES) {
    if (!Number.isFinite(tuning[flowerClass].footprintRadius) || tuning[flowerClass].footprintRadius <= 0) {
      throw new Error('Sandbox footprints must have a positive finite radius.');
    }
  }
  const flowers: DensityFlower[] = [];
  let group: DensityFlower[] = [];
  let groupSlots = 0;
  for (let index = 0; index < count; index++) {
    const flowerClass = mode === 'mixed' ? mixedClasses[index % mixedClasses.length] : mode;
    const radius = tuning[flowerClass].footprintRadius;
    const placementRandom = seededRandom(0x47524f55 ^ Math.imul(month, 65537) ^ Math.imul(index + 1, 7919));
    if (groupSlots === 0) {
      group = [];
      // A few singles punctuate loose mini-groups of two to four objects.
      groupSlots = placementRandom() < 0.2 ? 1 : 2 + Math.floor(placementRandom() * 3);
    }
    groupSlots--;
    const neighbor = group[Math.floor(placementRandom() * group.length)];
    let candidate = neighbor ? chooseCandidate(month, radius, flowers, placementRandom, neighbor) : undefined;
    if (!candidate) {
      candidate = chooseCandidate(month, radius, flowers, placementRandom);
      group = [];
    }
    if (!candidate) continue;
    const random = seededRandom(0x464c4f57 ^ Math.imul(month, 65537) ^ Math.imul(index + 1, 7919));
    const flower: DensityFlower = {
      id: `density-${month.toString().padStart(2, '0')}-${mode}-${index.toString().padStart(2, '0')}`,
      flowerClass, worldX: candidate.x, worldY: candidate.y, footprintRadius: radius,
      scaleVariation: 0.9 + random() * 0.2,
      rotationDegrees: -12 + random() * 24,
      compositionVariant: Math.floor(random() * 3),
    };
    flowers.push(flower);
    group.push(flower);
  }
  return { flowers, requested: count, placed: flowers.length, failed: count - flowers.length };
}

/** Draw rear anchors first. IDs break exact Y ties without relying on array order. */
export function sortByGroundY(flowers: readonly DensityFlower[]): DensityFlower[] {
  return [...flowers].sort((a, b) => a.worldY - b.worldY || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
