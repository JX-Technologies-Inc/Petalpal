import { GARDEN_LANDS, type GardenLand, type GardenLandLayout } from '../gardenMapLayout';
import { type MonthRegionMeta } from './plantingRegionData';

export type ParentLandAssetId = 'central' | '0405' | '06' | '07' | '08' | '09' | '101112';

export interface MonthRegionCalibration {
  month: number;
  landId: string;
  parentLandAsset: ParentLandAssetId;
  localX: number;
  localY: number;
  scaleX: number;
  scaleY: number;
  rotation: number; // degrees clockwise
}

// Natural aspect ratios of the 7 land source assets (height / width)
export const LAND_ASSET_ASPECT_RATIOS: Record<ParentLandAssetId, number> = {
  central: 1.0,
  '0405': 1.0,
  '06': 398.7 / 598,
  '07': 1.0,
  '08': 1.0,
  '09': 1.0,
  '101112': 1.0,
};

export function getParentLand(
  parentAssetId: ParentLandAssetId,
  layout?: GardenLandLayout
): GardenLand {
  const currentLayout = layout || GARDEN_LANDS;
  const land = currentLayout.find((item) => item.id === parentAssetId);
  if (!land) {
    const fallback = GARDEN_LANDS.find((item) => item.id === parentAssetId);
    if (!fallback) {
      throw new Error(`Parent Land asset not found: ${parentAssetId}`);
    }
    return fallback;
  }
  return land;
}

export function getLandGeometry(land: GardenLand): {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  rotationRad: number;
} {
  const aspect = LAND_ASSET_ASPECT_RATIOS[land.id as ParentLandAssetId] ?? 1.0;
  const height = land.width * aspect;
  const centerX = land.x + land.width / 2;
  const centerY = land.y + height / 2;
  const rotationRad = (land.rotation * Math.PI) / 180;
  return { width: land.width, height, centerX, centerY, rotationRad };
}

export function worldToLandLocal(
  worldX: number,
  worldY: number,
  land: GardenLand
): { x: number; y: number } {
  const { width, height, centerX, centerY, rotationRad } = getLandGeometry(land);
  const dxP = worldX - centerX;
  const dyP = worldY - centerY;
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  const dx = dxP * cos + dyP * sin;
  const dy = -dxP * sin + dyP * cos;
  return {
    x: dx + width / 2,
    y: dy + height / 2,
  };
}

export function landLocalToWorld(
  landX: number,
  landY: number,
  land: GardenLand
): { x: number; y: number } {
  const { width, height, centerX, centerY, rotationRad } = getLandGeometry(land);
  const dx = landX - width / 2;
  const dy = landY - height / 2;
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  return {
    x: centerX + dx * cos - dy * sin,
    y: centerY + dx * sin + dy * cos,
  };
}

export function landLocalToMaskLocal(
  landX: number,
  landY: number,
  cal: MonthRegionCalibration,
  meta: MonthRegionMeta
): { u: number; v: number } {
  const cu = meta.bbox.width / 2;
  const cv = meta.bbox.height / 2;
  const relX = landX - cal.localX;
  const relY = landY - cal.localY;
  const mx = relX - cu;
  const my = relY - cv;
  const rotRad = (cal.rotation * Math.PI) / 180;
  const cos = Math.cos(rotRad);
  const sin = Math.sin(rotRad);
  const rx = mx * cos + my * sin;
  const ry = -mx * sin + my * cos;
  const scaleX = cal.scaleX || 1.0;
  const scaleY = cal.scaleY || 1.0;
  return {
    u: rx / scaleX + cu,
    v: ry / scaleY + cv,
  };
}

export function maskLocalToLandLocal(
  u: number,
  v: number,
  cal: MonthRegionCalibration,
  meta: MonthRegionMeta
): { x: number; y: number } {
  const cu = meta.bbox.width / 2;
  const cv = meta.bbox.height / 2;
  const mx = u - cu;
  const my = v - cv;
  const scaleX = cal.scaleX || 1.0;
  const scaleY = cal.scaleY || 1.0;
  const rx = mx * scaleX;
  const ry = my * scaleY;
  const rotRad = (cal.rotation * Math.PI) / 180;
  const cos = Math.cos(rotRad);
  const sin = Math.sin(rotRad);
  const lx = rx * cos - ry * sin + cu + cal.localX;
  const ly = rx * sin + ry * cos + cv + cal.localY;
  return { x: lx, y: ly };
}

export const PARENT_LAND_ASSET_BY_MONTH: Record<number, ParentLandAssetId> = {
  1: 'central',
  2: 'central',
  3: 'central',
  4: '0405',
  5: '0405',
  6: '06',
  7: '07',
  8: '08',
  9: '09',
  10: '101112',
  11: '101112',
  12: '101112',
};

// Initial deterministic calibration values anchored to parent Lands
export const PLANTING_REGION_CALIBRATION: Record<number, MonthRegionCalibration> = {
  1: {
    month: 1,
    landId: 'Land01',
    parentLandAsset: 'central',
    localX: 214.0,
    localY: 193.0,
    scaleX: 1.0,
    scaleY: 1.0,
    rotation: 0.0,
  },
  2: {
    month: 2,
    landId: 'Land02',
    parentLandAsset: 'central',
    localX: 114.0,
    localY: 329.0,
    scaleX: 1.0,
    scaleY: 1.0,
    rotation: 0.0,
  },
  3: {
    month: 3,
    landId: 'Land03',
    parentLandAsset: 'central',
    localX: 424.0,
    localY: 339.0,
    scaleX: 1.0,
    scaleY: 1.0,
    rotation: 0.0,
  },
  4: {
    month: 4,
    landId: 'Land04',
    parentLandAsset: '0405',
    localX: 47.83,
    localY: 180.52,
    scaleX: 1.0,
    scaleY: 1.0,
    rotation: 0.0,
  },
  5: {
    month: 5,
    landId: 'Land05',
    parentLandAsset: '0405',
    localX: 288.47,
    localY: 278.26,
    scaleX: 1.0,
    scaleY: 1.0,
    rotation: 0.0,
  },
  6: {
    month: 6,
    landId: 'Land06',
    parentLandAsset: '06',
    localX: 73.57,
    localY: 42.73,
    scaleX: 1.0,
    scaleY: 1.0,
    rotation: 0.0,
  },
  7: {
    month: 7,
    landId: 'Land07',
    parentLandAsset: '07',
    localX: 19.67,
    localY: 259.26,
    scaleX: 1.0,
    scaleY: 1.0,
    rotation: 0.0,
  },
  8: {
    month: 8,
    landId: 'Land08',
    parentLandAsset: '08',
    localX: 107.9,
    localY: 332.27,
    scaleX: 1.0,
    scaleY: 1.0,
    rotation: 0.0,
  },
  9: {
    month: 9,
    landId: 'Land09',
    parentLandAsset: '09',
    localX: 70.93,
    localY: 126.98,
    scaleX: 1.0,
    scaleY: 1.0,
    rotation: 0.0,
  },
  10: {
    month: 10,
    landId: 'Land10',
    parentLandAsset: '101112',
    localX: 291.0,
    localY: 501.0,
    scaleX: 1.0,
    scaleY: 1.0,
    rotation: 0.0,
  },
  11: {
    month: 11,
    landId: 'Land11',
    parentLandAsset: '101112',
    localX: 169.0,
    localY: 375.0,
    scaleX: 1.0,
    scaleY: 1.0,
    rotation: 0.0,
  },
  12: {
    month: 12,
    landId: 'Land12',
    parentLandAsset: '101112',
    localX: 187.0,
    localY: 105.0,
    scaleX: 1.0,
    scaleY: 1.0,
    rotation: 0.0,
  },
};
