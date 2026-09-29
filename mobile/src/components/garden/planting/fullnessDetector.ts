import {
  MONTH_REGION_METAS,
  MonthRegionMeta,
  getRegionAtWorld,
} from './plantingRegionData';
import {
  FlowerPlacement,
  validateFlowerPlacement,
} from './placementValidator';

export interface RegionFullnessReport {
  month: number;
  monthName: string;
  landId: string;
  totalGrassAreaPixels: number;
  placedFlowerCount: number;
  validCandidateSpotsCount: number;
  isFull: boolean;
  isLowSpace: boolean;
  sampleValidSpot?: { x: number; y: number };
}

/**
 * Evaluates whether a month region has room for planting new flowers.
 * Performs a deterministic coarse spatial sampling over the region's bounding box.
 */
export function evaluateRegionFullness(
  month: number,
  existingPlacements: FlowerPlacement[],
  flowerName?: string,
  gridStep: number = 24,
  speciesCode?: string
): RegionFullnessReport {
  const meta: MonthRegionMeta | undefined = MONTH_REGION_METAS[month];
  if (!meta) {
    return {
      month,
      monthName: `Month ${month}`,
      landId: 'Unknown',
      totalGrassAreaPixels: 0,
      placedFlowerCount: 0,
      validCandidateSpotsCount: 0,
      isFull: true,
      isLowSpace: true,
    };
  }

  const flowersInMonth = existingPlacements.filter((p) => p.month === month);
  const bbox = meta.bbox;

  let validCount = 0;
  let sampleValidSpot: { x: number; y: number } | undefined = undefined;

  for (let y = bbox.y; y <= bbox.y + bbox.height; y += gridStep) {
    for (let x = bbox.x; x <= bbox.x + bbox.width; x += gridStep) {
      if (getRegionAtWorld(x, y) !== month) {
        continue;
      }

      const res = validateFlowerPlacement({
        flowerId: '__fullness_test__',
        month,
        worldX: x,
        worldY: y,
        existingPlacements: flowersInMonth,
        flowerName,
        speciesCode,
      });

      if (res.isValid) {
        validCount++;
        if (!sampleValidSpot) {
          sampleValidSpot = { x, y };
        }
      }
    }
  }

  const isFull = validCount === 0;
  const isLowSpace = validCount > 0 && validCount <= 3;

  return {
    month,
    monthName: meta.monthName,
    landId: meta.landId,
    totalGrassAreaPixels: meta.pixelArea,
    placedFlowerCount: flowersInMonth.length,
    validCandidateSpotsCount: validCount,
    isFull,
    isLowSpace,
    sampleValidSpot,
  };
}
