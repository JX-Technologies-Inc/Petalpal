import { GARDEN_LANDS, type GardenLand, type GardenLandLayout } from '../gardenMapLayout';
import {
  GARDEN_WORLD_HEIGHT,
  GARDEN_WORLD_WIDTH,
  MONTH_REGION_METAS,
  MonthRegionMeta,
  REGION_GRID_HEIGHT,
  REGION_GRID_SCALE,
  REGION_GRID_WIDTH,
  getRegionGrid,
} from './plantingRegionData';
import {
  type MonthRegionCalibration,
  type ParentLandAssetId,
  PLANTING_REGION_CALIBRATION,
  getLandGeometry,
  getParentLand,
  landLocalToMaskLocal,
  worldToLandLocal,
} from './plantingRegionGeometry';

export type MaskTool = 'add' | 'remove';

export interface MaskPoint {
  x: number; // Land-local coordinates
  y: number; // Land-local coordinates
}

export interface MaskStroke {
  id: string;
  tool: MaskTool;
  radius: number; // Land-local pixels (radius = diameter / 2)
  points: MaskPoint[];
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface MonthMaskRefinement {
  version: 1;
  month: number;
  landId: string;
  parentLandAsset: ParentLandAssetId;
  strokes: MaskStroke[];
  savedAt: string;
}

const STORAGE_KEY_PREFIX = 'petalpal_planting_mask_refinement_v1_month_';

// In-memory cache of active refinements per month
const activeRefinements: Record<number, MonthMaskRefinement | null> = {};
let isStorageLoaded = false;

export function loadAllMaskRefinementsFromStorage(): Record<number, MonthMaskRefinement | null> {
  if (typeof localStorage === 'undefined') return activeRefinements;
  try {
    for (let m = 1; m <= 12; m++) {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${m}`);
      if (raw) {
        const parsed = JSON.parse(raw) as MonthMaskRefinement;
        if (parsed && parsed.version === 1 && parsed.month === m) {
          activeRefinements[m] = parsed;
        }
      }
    }
  } catch (err) {
    console.warn('[MaskRefinement] Failed to load from localStorage:', err);
  }
  isStorageLoaded = true;
  return activeRefinements;
}

export function getMonthMaskRefinement(month: number): MonthMaskRefinement | null {
  if (!isStorageLoaded) {
    loadAllMaskRefinementsFromStorage();
  }
  return activeRefinements[month] ?? null;
}

export const loadMonthMaskRefinement = getMonthMaskRefinement;

export function saveMonthMaskRefinement(
  month: number,
  strokes: MaskStroke[],
  landId: string,
  parentLandAsset: ParentLandAssetId
): MonthMaskRefinement {
  const refinement: MonthMaskRefinement = {
    version: 1,
    month,
    landId,
    parentLandAsset,
    strokes: [...strokes],
    savedAt: new Date().toISOString(),
  };

  activeRefinements[month] = refinement;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${month}`, JSON.stringify(refinement));
    }
  } catch (err) {
    console.warn(`[MaskRefinement] Failed to save month ${month} to localStorage:`, err);
  }

  return refinement;
}

export function resetMonthMaskRefinement(month: number): void {
  activeRefinements[month] = null;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${month}`);
    }
  } catch (err) {
    console.warn(`[MaskRefinement] Failed to clear month ${month} from localStorage:`, err);
  }
}

export function createMaskStroke(tool: MaskTool, radius: number, points: MaskPoint[]): MaskStroke {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pt of points) {
    if (pt.x - radius < minX) minX = pt.x - radius;
    if (pt.y - radius < minY) minY = pt.y - radius;
    if (pt.x + radius > maxX) maxX = pt.x + radius;
    if (pt.y + radius > maxY) maxY = pt.y + radius;
  }

  return {
    id: `stroke-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    tool,
    radius,
    points: [...points],
    bbox: { minX, minY, maxX, maxY },
  };
}

/**
 * Returns distance squared from point (px, py) to line segment (x1, y1)-(x2, y2).
 */
function distSqToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) {
    const dx = px - x1;
    const dy = py - y1;
    return dx * dx + dy * dy;
  }
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  const dx = px - projX;
  const dy = py - projY;
  return dx * dx + dy * dy;
}

/**
 * Checks if point (lx, ly) in Land-local coordinates falls within a stroke.
 */
export function isPointInStroke(lx: number, ly: number, stroke: MaskStroke): boolean {
  const { bbox, radius, points } = stroke;
  if (lx < bbox.minX || lx > bbox.maxX || ly < bbox.minY || ly > bbox.maxY) {
    return false;
  }

  const rSq = radius * radius;
  if (points.length === 1) {
    const dx = lx - points[0].x;
    const dy = ly - points[0].y;
    return dx * dx + dy * dy <= rSq;
  }

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (distSqToSegment(lx, ly, p1.x, p1.y, p2.x, p2.y) <= rSq) {
      return true;
    }
  }

  return false;
}

/**
 * Evaluates whether (lx, ly) in Land-local coordinates hits the locked Base Mask.
 */
export function isPointInBaseMask(
  month: number,
  landX: number,
  landY: number,
  cal: MonthRegionCalibration,
  meta: MonthRegionMeta
): boolean {
  const maskLocal = landLocalToMaskLocal(landX, landY, cal, meta);
  if (
    maskLocal.u < 0 ||
    maskLocal.u > meta.bbox.width ||
    maskLocal.v < 0 ||
    maskLocal.v > meta.bbox.height
  ) {
    return false;
  }

  const grid = getRegionGrid();
  const uncalX = meta.bbox.x + maskLocal.u;
  const uncalY = meta.bbox.y + maskLocal.v;
  const gx = Math.floor(uncalX / REGION_GRID_SCALE);
  const gy = Math.floor(uncalY / REGION_GRID_SCALE);

  if (gx >= 0 && gx < REGION_GRID_WIDTH && gy >= 0 && gy < REGION_GRID_HEIGHT) {
    return grid[gy * REGION_GRID_WIDTH + gx] === month;
  }

  return false;
}

/**
 * Evaluates plantability of a Land-local point (lx, ly) using:
 * FINAL MASK = LOCKED BASE MASK + ADD STROKES - REMOVE STROKES
 * Evaluated in reverse chronological order for accurate sequential editing.
 */
export function isPointInRefinedMaskLandLocal(
  month: number,
  landX: number,
  landY: number,
  strokes: MaskStroke[],
  cal: MonthRegionCalibration,
  meta: MonthRegionMeta
): boolean {
  // Check strokes in reverse chronological order (newest stroke takes precedence)
  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i];
    if (isPointInStroke(landX, landY, stroke)) {
      return stroke.tool === 'add';
    }
  }

  // If no manual stroke covered this point, fall back to the locked base mask
  return isPointInBaseMask(month, landX, landY, cal, meta);
}

/**
 * Evaluates plantability of a Garden world coordinate (worldX, worldY).
 * Returns true if plantable in Month m.
 */
export function isPointInMonthRefinedMaskWorld(
  month: number,
  worldX: number,
  worldY: number,
  strokes?: MaskStroke[],
  calMap?: Record<number, MonthRegionCalibration>,
  layout?: GardenLandLayout
): boolean {
  if (
    worldX < 0 ||
    worldX >= GARDEN_WORLD_WIDTH ||
    worldY < 0 ||
    worldY >= GARDEN_WORLD_HEIGHT
  ) {
    return false;
  }

  const meta = MONTH_REGION_METAS[month];
  if (!meta) return false;

  const cal = calMap?.[month] ?? PLANTING_REGION_CALIBRATION[month];
  const land = getParentLand(cal.parentLandAsset, layout);
  const landLocal = worldToLandLocal(worldX, worldY, land);

  // If explicit strokes provided (e.g. active editing session), use them
  if (strokes) {
    return isPointInRefinedMaskLandLocal(month, landLocal.x, landLocal.y, strokes, cal, meta);
  }

  // Otherwise check if a saved refinement exists for this month
  const savedRefinement = getMonthMaskRefinement(month);
  if (savedRefinement && savedRefinement.strokes.length > 0) {
    return isPointInRefinedMaskLandLocal(
      month,
      landLocal.x,
      landLocal.y,
      savedRefinement.strokes,
      cal,
      meta
    );
  }

  // Fall back to locked base mask
  return isPointInBaseMask(month, landLocal.x, landLocal.y, cal, meta);
}

/**
 * Converts stroke points to SVG path format for Skia <Path>.
 */
export function strokeToSvgPath(points: MaskPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}
