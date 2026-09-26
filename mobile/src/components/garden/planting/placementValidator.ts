// Authoritative Single Placement Validator for PetalPal Flower Planting System V1.
// Used identically by initial planting and adjust position.

import {
  GARDEN_WORLD_HEIGHT,
  GARDEN_WORLD_WIDTH,
  MONTH_REGION_METAS,
  getRegionAtWorld,
} from './plantingRegionData';
import {
  FlowerPlacementDefinition,
  getFlowerPlacementDefinition,
} from './flowerFootprintConfig';
import {
  MonthRegionCalibration,
  getCalibratedRegionAtWorld,
} from './plantingRegionCalibration';
import type { GardenLandLayout } from '../gardenMapLayout';

export interface FlowerPlacement {
  id: string;
  flowerId: string;
  journalEntryId: string;
  plantedDate: string;
  month: number;
  worldX: number;
  worldY: number;
  scale: number;
  rotation: number;
  placementVersion: number;
  flowerName?: string;
  speciesCode?: string;
  mood?: string;
}

export type InvalidPlacementReason =
  | 'OUT_OF_WORLD'
  | 'NOT_PLANTABLE_GRASS'
  | 'WRONG_MONTH_REGION'
  | 'FOOTPRINT_OUTSIDE_REGION'
  | 'COLLIDES_WITH_FLOWER'
  | 'MISSING_FLOWER_DEFINITION'
  | 'MISSING_MONTH_REGION';

export interface ValidationResult {
  isValid: boolean;
  reason?: InvalidPlacementReason;
  userFeedback: string;
  detectedMonth?: number;
  conflictingPlacementId?: string;
}

export interface ValidatePlacementParams {
  flowerId: string;
  month: number;
  worldX: number;
  worldY: number;
  existingPlacements: FlowerPlacement[];
  ignorePlacementId?: string;
  definition?: FlowerPlacementDefinition;
  flowerName?: string;
  calibrationMap?: Record<number, MonthRegionCalibration>;
  landLayout?: GardenLandLayout;
}

const SAMPLE_ANGLES_COUNT = 16;
const INTERIOR_SAMPLE_COUNT = 8;

export function validateFlowerPlacement({
  flowerId,
  month,
  worldX,
  worldY,
  existingPlacements,
  ignorePlacementId,
  definition,
  flowerName,
  calibrationMap,
  landLayout,
}: ValidatePlacementParams): ValidationResult {
  const def = definition || getFlowerPlacementDefinition(flowerName);
  const targetMeta = MONTH_REGION_METAS[month];
  const targetMonthName = targetMeta?.monthName || `Month ${month}`;

  // 1. World Bounds Check
  if (
    worldX < 0 ||
    worldX >= GARDEN_WORLD_WIDTH ||
    worldY < 0 ||
    worldY >= GARDEN_WORLD_HEIGHT
  ) {
    return {
      isValid: false,
      reason: 'OUT_OF_WORLD',
      userFeedback: 'Stay inside the garden.',
    };
  }

  // 2. Center Check: Grass & Month Region
  const centerRegion = getCalibratedRegionAtWorld(
    worldX,
    worldY,
    month,
    calibrationMap,
    landLayout
  );

  if (centerRegion === 0) {
    return {
      isValid: false,
      reason: 'NOT_PLANTABLE_GRASS',
      userFeedback: 'Choose a grassy spot.',
      detectedMonth: 0,
    };
  }

  if (centerRegion !== month) {
    return {
      isValid: false,
      reason: 'WRONG_MONTH_REGION',
      userFeedback: `This flower belongs in the ${targetMonthName} garden.`,
      detectedMonth: centerRegion,
    };
  }

  // 3. Entire Footprint Containment Check
  // The entire logical footprint (circle of radius footprintRadius) must fit inside the target month region.
  const r = def.footprintRadius;

  // Perimeter points
  for (let i = 0; i < SAMPLE_ANGLES_COUNT; i++) {
    const angle = (i * 2 * Math.PI) / SAMPLE_ANGLES_COUNT;
    const sx = worldX + Math.cos(angle) * r;
    const sy = worldY + Math.sin(angle) * r;

    const sampleRegion = getCalibratedRegionAtWorld(
      sx,
      sy,
      month,
      calibrationMap,
      landLayout
    );
    if (sampleRegion !== month) {
      return {
        isValid: false,
        reason: 'FOOTPRINT_OUTSIDE_REGION',
        userFeedback: 'Choose a little more space around the flower.',
        detectedMonth: sampleRegion,
      };
    }
  }

  // Inner ring points (at 50% radius)
  const innerR = r * 0.5;
  for (let i = 0; i < INTERIOR_SAMPLE_COUNT; i++) {
    const angle = (i * 2 * Math.PI) / INTERIOR_SAMPLE_COUNT;
    const sx = worldX + Math.cos(angle) * innerR;
    const sy = worldY + Math.sin(angle) * innerR;

    const sampleRegion = getCalibratedRegionAtWorld(
      sx,
      sy,
      month,
      calibrationMap,
      landLayout
    );
    if (sampleRegion !== month) {
      return {
        isValid: false,
        reason: 'FOOTPRINT_OUTSIDE_REGION',
        userFeedback: 'Choose a little more space around the flower.',
        detectedMonth: sampleRegion,
      };
    }
  }

  // 4. One Hole, One Flower: Footprint-to-Footprint Collision
  // Visual overlap is allowed, but logical planting footprints must not intersect.
  for (const existing of existingPlacements) {
    if (ignorePlacementId && existing.id === ignorePlacementId) {
      continue;
    }

    const existingDef = getFlowerPlacementDefinition(existing.flowerName);
    const minDistance = r + existingDef.footprintRadius;

    const dx = worldX - existing.worldX;
    const dy = worldY - existing.worldY;
    const distSq = dx * dx + dy * dy;

    if (distSq < minDistance * minDistance) {
      return {
        isValid: false,
        reason: 'COLLIDES_WITH_FLOWER',
        conflictingPlacementId: existing.id,
        userFeedback: 'Another flower is already planted here.',
      };
    }
  }

  // All checks passed!
  return {
    isValid: true,
    userFeedback: 'Ready to plant!',
    detectedMonth: month,
  };
}
