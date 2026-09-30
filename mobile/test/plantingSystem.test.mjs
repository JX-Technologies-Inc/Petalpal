import fs from 'fs';
import path from 'path';
import { runApprovedRuntimeTests } from './approvedPlantingRuntime.test.mjs';

console.log('====================================================');
console.log('PETALPAL FLOWER PLANTING SYSTEM V1 — TEST SUITE');
console.log('====================================================\n');

// 1. Load Region Data and decompress RLE
const regionDataPath = path.resolve(process.cwd().endsWith('mobile') ? 'src/components/garden/planting/plantingRegionData.ts' : 'mobile/src/components/garden/planting/plantingRegionData.ts');
const regionDataContent = fs.readFileSync(regionDataPath, 'utf8');

const metasMatch = regionDataContent.match(/MONTH_REGION_METAS: Record<number, MonthRegionMeta> = (\{[\s\S]*?\n\});/);
const MONTH_REGION_METAS = JSON.parse(metasMatch[1]);

const rleMatch = regionDataContent.match(/const RLE_BASE64 = "([^"]+)";/);
const rleBase64 = rleMatch[1];

function decodeBase64ToBytes(b64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  let len = b64.length;
  if (b64.endsWith('==')) len -= 2;
  else if (b64.endsWith('=')) len -= 1;
  const bytes = new Uint8Array(Math.floor((len * 3) / 4));
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const b0 = lookup[b64.charCodeAt(i)];
    const b1 = lookup[b64.charCodeAt(i + 1)];
    const b2 = lookup[b64.charCodeAt(i + 2)];
    const b3 = lookup[b64.charCodeAt(i + 3)];
    bytes[p++] = (b0 << 2) | (b1 >> 4);
    if (p < bytes.length) bytes[p++] = ((b1 & 15) << 4) | (b2 >> 2);
    if (p < bytes.length) bytes[p++] = ((b2 & 3) << 6) | b3;
  }
  return bytes;
}

const decompressedBytes = decodeBase64ToBytes(rleBase64);
const REGION_GRID_WIDTH = 1200;
const REGION_GRID_HEIGHT = 900;
const REGION_GRID_SCALE = 2;
const grid = new Uint8Array(REGION_GRID_WIDTH * REGION_GRID_HEIGHT);

let writeOffset = 0;
for (let i = 0; i < decompressedBytes.length; i += 3) {
  const val = decompressedBytes[i];
  const count = decompressedBytes[i + 1] | (decompressedBytes[i + 2] << 8);
  for (let c = 0; c < count; c++) {
    grid[writeOffset++] = val;
  }
}

function getRegionAtWorld(worldX, worldY) {
  if (worldX < 0 || worldX >= 2400 || worldY < 0 || worldY >= 1800) return 0;
  const gx = Math.floor(worldX / REGION_GRID_SCALE);
  const gy = Math.floor(worldY / REGION_GRID_SCALE);
  if (gx < 0 || gx >= REGION_GRID_WIDTH || gy < 0 || gy >= REGION_GRID_HEIGHT) return 0;
  return grid[gy * REGION_GRID_WIDTH + gx];
}

// Validator implementation replica matching placementValidator.ts
function validateFlowerPlacement({
  flowerId,
  month,
  worldX,
  worldY,
  existingPlacements = [],
  ignorePlacementId,
  footprintRadius = 22,
}) {
  if (worldX < 0 || worldX >= 2400 || worldY < 0 || worldY >= 1800) {
    return { isValid: false, reason: 'OUT_OF_WORLD', userFeedback: 'Stay inside the garden.' };
  }

  const centerRegion = getRegionAtWorld(worldX, worldY);
  if (centerRegion === 0) {
    return { isValid: false, reason: 'NOT_PLANTABLE_GRASS', userFeedback: 'Choose a grassy spot.', detectedMonth: 0 };
  }

  if (centerRegion !== month) {
    const meta = MONTH_REGION_METAS[month];
    return {
      isValid: false,
      reason: 'WRONG_MONTH_REGION',
      userFeedback: `This flower belongs in the ${meta?.monthName || 'Month ' + month} garden.`,
      detectedMonth: centerRegion,
    };
  }

  // Entire footprint check (radius = footprintRadius)
  const SAMPLE_ANGLES = 16;
  for (let i = 0; i < SAMPLE_ANGLES; i++) {
    const angle = (i * 2 * Math.PI) / SAMPLE_ANGLES;
    const sx = worldX + Math.cos(angle) * footprintRadius;
    const sy = worldY + Math.sin(angle) * footprintRadius;
    const r = getRegionAtWorld(sx, sy);
    if (r !== month) {
      if (worldX === c1.x && worldY === c1.y) {
        console.log(`C1 failing sample angle ${i}: (${sx.toFixed(1)}, ${sy.toFixed(1)}) -> region ${r}`);
      }
      return { isValid: false, reason: 'FOOTPRINT_OUTSIDE_REGION', userFeedback: 'Choose a little more space around the flower.' };
    }
  }

  // Inner ring check
  const innerR = footprintRadius * 0.5;
  for (let i = 0; i < 8; i++) {
    const angle = (i * 2 * Math.PI) / 8;
    const sx = worldX + Math.cos(angle) * innerR;
    const sy = worldY + Math.sin(angle) * innerR;
    const r = getRegionAtWorld(sx, sy);
    if (r !== month) {
      return { isValid: false, reason: 'FOOTPRINT_OUTSIDE_REGION', userFeedback: 'Choose a little more space around the flower.' };
    }
  }

  // Collision check
  for (const existing of existingPlacements) {
    if (ignorePlacementId && existing.id === ignorePlacementId) continue;
    const existingRadius = existing.footprintRadius || 22;
    const minDistance = footprintRadius + existingRadius;
    const dx = worldX - existing.worldX;
    const dy = worldY - existing.worldY;
    if (dx * dx + dy * dy < minDistance * minDistance) {
      return {
        isValid: false,
        reason: 'COLLIDES_WITH_FLOWER',
        conflictingPlacementId: existing.id,
        userFeedback: 'Another flower is already planted here.',
      };
    }
  }

  return { isValid: true, userFeedback: 'Ready to plant!', detectedMonth: month };
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName, detail = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName} ${detail ? '(' + detail + ')' : ''}`);
  } else {
    console.error(`  [FAIL] ${testName} ${detail ? '(' + detail + ')' : ''}`);
  }
}

// TEST A: Month Region Resolution (All 12 Centroids & Non-Zero Area)
console.log('--- TEST SUITE A: Month Centroid Resolution & Area (12/12) ---');
for (let m = 1; m <= 12; m++) {
  const meta = MONTH_REGION_METAS[m];
  const detected = getRegionAtWorld(meta.centroid.x, meta.centroid.y);
  assert(detected === m, `Month ${m} Centroid -> Land ${meta.landId}`, `Detected: ${detected}, Expected: ${m}`);
  assert(meta.pixelArea > 10000, `Month ${m} has substantial plantable area`, `${meta.pixelArea} px`);
}

// TEST B: Multi-land Partition Isolation
console.log('\n--- TEST SUITE B: Multi-land Partition Isolation ---');
// Central partition: Month 1 vs Month 2 vs Month 3
const c1 = MONTH_REGION_METAS[1].centroid;
const c2 = MONTH_REGION_METAS[2].centroid;
const c3 = MONTH_REGION_METAS[3].centroid;
assert(getRegionAtWorld(c1.x, c1.y) === 1, 'Central Top is strictly Month 1 (Jan)');
assert(getRegionAtWorld(c2.x, c2.y) === 2, 'Central Left is strictly Month 2 (Feb)');
assert(getRegionAtWorld(c3.x, c3.y) === 3, 'Central Right is strictly Month 3 (Mar)');

// Land0405 partition: Month 4 vs Month 5
const c4 = MONTH_REGION_METAS[4].centroid;
const c5 = MONTH_REGION_METAS[5].centroid;
assert(getRegionAtWorld(c4.x, c4.y) === 4, 'Land0405 Upper is strictly Month 4 (Apr)');
assert(getRegionAtWorld(c5.x, c5.y) === 5, 'Land0405 Lower is strictly Month 5 (May)');

// Land101112 partition: Month 10 vs Month 11 vs Month 12
const c10 = MONTH_REGION_METAS[10].centroid;
const c11 = MONTH_REGION_METAS[11].centroid;
const c12 = MONTH_REGION_METAS[12].centroid;
assert(getRegionAtWorld(c10.x, c10.y) === 10, 'Land101112 South is strictly Month 10 (Oct)');
assert(getRegionAtWorld(c11.x, c11.y) === 11, 'Land101112 Mid is strictly Month 11 (Nov)');
assert(getRegionAtWorld(c12.x, c12.y) === 12, 'Land101112 North is strictly Month 12 (Dec)');

// TEST C: Non-Plantable Terrain Rejection
console.log('\n--- TEST SUITE C: Non-Plantable Terrain Rejection ---');
assert(getRegionAtWorld(100, 100) === 0, 'Open Water rejected (0, 0)');
assert(getRegionAtWorld(1200, 1000) === 0, 'Waterfall plunge pool rejected');
// Authoritative non-grass exclusions:
assert(getRegionAtWorld(1845, 435) === 0, 'Land06 Tea Table paved courtyard is strictly non-plantable (0)');
assert(getRegionAtWorld(1816, 1078) === 0, 'Land08 Moon Bed platform/terrace is strictly non-plantable (0)');
assert(getRegionAtWorld(1150, 700) === 0, 'Central Gazebo structure is strictly non-plantable (0)');
assert(getRegionAtWorld(1850, 1375) === 0, 'Land08 interior rock obstacle hole is non-plantable (0)');
assert(getRegionAtWorld(740, 1025) === 0, 'Land10 interior rock obstacle hole is non-plantable (0)');
// Bridges & Roads
assert(getRegionAtWorld(1740, 1364) === 0, 'Bridge B01 footprint rejected');
assert(getRegionAtWorld(1680, 570) === 0, 'Bridge B02 footprint rejected');
assert(getRegionAtWorld(1650, 935) === 0, 'Stairs ST01 footprint rejected');
assert(getRegionAtWorld(790, 740) === 0, 'Road junction rejected');

// TEST D: Out of Bounds Rejection
console.log('\n--- TEST SUITE D: Out of Bounds Rejection ---');
const oobLeft = validateFlowerPlacement({ flowerId: 'f1', month: 1, worldX: -15, worldY: 800 });
assert(!oobLeft.isValid && oobLeft.reason === 'OUT_OF_WORLD', 'X < 0 rejected as OUT_OF_WORLD');
const oobRight = validateFlowerPlacement({ flowerId: 'f1', month: 1, worldX: 2450, worldY: 800 });
assert(!oobRight.isValid && oobRight.reason === 'OUT_OF_WORLD', 'X >= 2400 rejected as OUT_OF_WORLD');
const oobTop = validateFlowerPlacement({ flowerId: 'f1', month: 1, worldX: 1000, worldY: -10 });
assert(!oobTop.isValid && oobTop.reason === 'OUT_OF_WORLD', 'Y < 0 rejected as OUT_OF_WORLD');
const oobBottom = validateFlowerPlacement({ flowerId: 'f1', month: 1, worldX: 1000, worldY: 1850 });
assert(!oobBottom.isValid && oobBottom.reason === 'OUT_OF_WORLD', 'Y >= 1800 rejected as OUT_OF_WORLD');

// TEST E: Wrong Month Region Rejection
console.log('\n--- TEST SUITE E: Month Region Boundary Enforcement ---');
const wrongMonthRes = validateFlowerPlacement({
  flowerId: 'f-jan',
  month: 1, // Target: January
  worldX: c2.x, // February location
  worldY: c2.y,
});
assert(!wrongMonthRes.isValid && wrongMonthRes.reason === 'WRONG_MONTH_REGION', 'Month 1 flower on Month 2 land rejected as WRONG_MONTH_REGION');
assert(wrongMonthRes.detectedMonth === 2, 'Detected month matches actual location');

const correctMonthRes = validateFlowerPlacement({
  flowerId: 'f-jan',
  month: 1,
  worldX: c1.x,
  worldY: c1.y,
});
console.log('correctMonthRes debug:', correctMonthRes);
assert(correctMonthRes.isValid && correctMonthRes.reason === undefined, 'Month 1 flower on Month 1 land accepted as VALID');

// TEST F: "One Hole, One Flower" Collision Rule
console.log('\n--- TEST SUITE F: "One Hole, One Flower" Collision Rule ---');
const existingFlower = { id: 'fl-1', flowerId: 'fl-1', worldX: c1.x, worldY: c1.y, footprintRadius: 22 };

// Distance = 30 < 44 -> Collision!
const collideRes = validateFlowerPlacement({
  flowerId: 'fl-2',
  month: 1,
  worldX: c1.x + 30,
  worldY: c1.y,
  existingPlacements: [existingFlower],
});
assert(!collideRes.isValid && collideRes.reason === 'COLLIDES_WITH_FLOWER', 'Distance 30px (< 44px) rejected as COLLIDES_WITH_FLOWER');
assert(collideRes.conflictingPlacementId === 'fl-1', 'Identifies conflicting flower ID correctly');

// Distance = 48 >= 44 -> Allowed!
const allowRes = validateFlowerPlacement({
  flowerId: 'fl-2',
  month: 1,
  worldX: c1.x + 48,
  worldY: c1.y,
  existingPlacements: [existingFlower],
});
assert(allowRes.isValid, 'Distance 48px (>= 44px) accepted without collision');

// TEST G: Entire Footprint Boundary Containment
console.log('\n--- TEST SUITE G: Entire Footprint Containment Check ---');
// Find an edge point where center is Month 1, but perimeter (radius 22) extends onto water/forbidden
let edgeX = c1.x;
let edgeY = c1.y;
// Move west until we find an edge
while (getRegionAtWorld(edgeX - 1, edgeY) === 1 && edgeX > 770) {
  edgeX -= 2;
}
const edgePlacement = validateFlowerPlacement({
  flowerId: 'edge-test',
  month: 1,
  worldX: edgeX + 5, // Center is grass, but radius 22 reaches water/boundary
  worldY: edgeY,
});
assert(
  !edgePlacement.isValid && edgePlacement.reason === 'FOOTPRINT_OUTSIDE_REGION',
  'Boundary grass point with footprint crossing edge rejected as FOOTPRINT_OUTSIDE_REGION'
);

// TEST H: Adjust Position Ignores Own Footprint
console.log('\n--- TEST SUITE H: Adjust Position Self-Footprint Handling ---');
const selfIgnoreRes = validateFlowerPlacement({
  flowerId: 'fl-1',
  month: 1,
  worldX: c1.x, // Exact same position as existing flower fl-1
  worldY: c1.y,
  existingPlacements: [existingFlower],
  ignorePlacementId: 'fl-1',
});
assert(selfIgnoreRes.isValid, 'Adjust Position ignores own previous footprint');

const otherFlower = { id: 'fl-other', flowerId: 'fl-other', worldX: c1.x + 25, worldY: c1.y, footprintRadius: 22 };
const moveNearOtherRes = validateFlowerPlacement({
  flowerId: 'fl-1',
  month: 1,
  worldX: c1.x + 15, // Distance to fl-other is 10px (< 44px) -> collision!
  worldY: c1.y,
  existingPlacements: [existingFlower, otherFlower],
  ignorePlacementId: 'fl-1',
});
assert(!moveNearOtherRes.isValid && moveNearOtherRes.reason === 'COLLIDES_WITH_FLOWER', 'Adjust Position still collides with other flowers');

// TEST I: Fullness Detection
console.log('\n--- TEST SUITE I: Fullness Evaluation ---');
function evaluateRegionFullnessTest(month, existing = [], gridStep = 24) {
  const meta = MONTH_REGION_METAS[month];
  const bbox = meta.bbox;
  let count = 0;
  for (let y = bbox.y; y <= bbox.y + bbox.height; y += gridStep) {
    for (let x = bbox.x; x <= bbox.x + bbox.width; x += gridStep) {
      if (getRegionAtWorld(x, y) !== month) continue;
      const res = validateFlowerPlacement({
        flowerId: 'full-test',
        month,
        worldX: x,
        worldY: y,
        existingPlacements: existing,
      });
      if (res.isValid) count++;
    }
  }
  return { validSpots: count, isFull: count === 0 };
}

const emptyFullness = evaluateRegionFullnessTest(1, []);
assert(emptyFullness.validSpots >= 20, 'Empty Month 1 has abundant planting space (>= 20 coarse spots)', `Found: ${emptyFullness.validSpots}`);
assert(!emptyFullness.isFull, 'Empty Month 1 is not full');

// ====================================================
// TEST SUITE J: Month Region Calibration Math & Roundtrip Parity
// ====================================================
console.log('\n--- TEST SUITE J: Month Region Calibration Math & Roundtrip Parity ---');

const calFilePath = path.resolve(process.cwd().endsWith('mobile') ? 'src/components/garden/planting/plantingRegionGeometry.ts' : 'mobile/src/components/garden/planting/plantingRegionGeometry.ts');
const calContent = fs.readFileSync(calFilePath, 'utf8');
const calMatch = calContent.match(/export const PLANTING_REGION_CALIBRATION: Record<number, MonthRegionCalibration> = (\{[\s\S]*?\n\});/);
const PLANTING_REGION_CALIBRATION = eval('(' + calMatch[1] + ')');

const LAND_ASSET_ASPECT_RATIOS = {
  central: 1.0,
  '0405': 1.0,
  '06': 398.7 / 598,
  '07': 1.0,
  '08': 1.0,
  '09': 1.0,
  '101112': 1.0,
};

const GARDEN_LANDS_BASE = [
  { id: '09', x: 1222, y: 1332, width: 730, rotation: 0, zIndex: 1 },
  { id: '08', x: 1279, y: 887, width: 830, rotation: 0, zIndex: 2 },
  { id: 'central', x: 900, y: 550, width: 855, rotation: 0, zIndex: 3 },
  { id: '07', x: 440, y: 720, width: 850, rotation: 0, zIndex: 4 },
  { id: '06', x: 260, y: 440, width: 740, rotation: 0, zIndex: 5 },
  { id: '0405', x: 265, y: 130, width: 850, rotation: 0, zIndex: 6 },
  { id: '101112', x: 935, y: 50, width: 880, rotation: 0, zIndex: 7 },
];

function getLandGeom(land) {
  const aspect = LAND_ASSET_ASPECT_RATIOS[land.id] ?? 1.0;
  const height = land.width * aspect;
  const centerX = land.x + land.width / 2;
  const centerY = land.y + height / 2;
  const rotationRad = (land.rotation * Math.PI) / 180;
  return { width: land.width, height, centerX, centerY, rotationRad };
}

function worldToLandLocal(worldX, worldY, land) {
  const { width, height, centerX, centerY, rotationRad } = getLandGeom(land);
  const dxP = worldX - centerX;
  const dyP = worldY - centerY;
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  const dx = dxP * cos + dyP * sin;
  const dy = -dxP * sin + dyP * cos;
  return { x: dx + width / 2, y: dy + height / 2 };
}

function landLocalToWorld(landX, landY, land) {
  const { width, height, centerX, centerY, rotationRad } = getLandGeom(land);
  const dx = landX - width / 2;
  const dy = landY - height / 2;
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  return {
    x: centerX + dx * cos - dy * sin,
    y: centerY + dx * sin + dy * cos,
  };
}

function landLocalToMaskLocal(landX, landY, cal, meta) {
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
  return { u: rx / scaleX + cu, v: ry / scaleY + cv };
}

function maskLocalToLandLocal(u, v, cal, meta) {
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

function worldToMaskLocal(worldX, worldY, month, calMap, layout = GARDEN_LANDS_BASE) {
  const meta = MONTH_REGION_METAS[month];
  const cal = (calMap && calMap[month]) || PLANTING_REGION_CALIBRATION[month];
  const land = layout.find((l) => l.id === cal.parentLandAsset);
  const ll = worldToLandLocal(worldX, worldY, land);
  const ml = landLocalToMaskLocal(ll.x, ll.y, cal, meta);
  const insideBBox =
    ml.u >= 0 && ml.u <= meta.bbox.width && ml.v >= 0 && ml.v <= meta.bbox.height;
  return { u: ml.u, v: ml.v, insideBBox };
}

function maskLocalToWorld(u, v, month, calMap, layout = GARDEN_LANDS_BASE) {
  const meta = MONTH_REGION_METAS[month];
  const cal = (calMap && calMap[month]) || PLANTING_REGION_CALIBRATION[month];
  const land = layout.find((l) => l.id === cal.parentLandAsset);
  const ll = maskLocalToLandLocal(u, v, cal, meta);
  return landLocalToWorld(ll.x, ll.y, land);
}

function getCalibratedCentroid(month, calMap, layout = GARDEN_LANDS_BASE) {
  const meta = MONTH_REGION_METAS[month];
  const u = meta.centroid.x - meta.bbox.x;
  const v = meta.centroid.y - meta.bbox.y;
  return maskLocalToWorld(u, v, month, calMap, layout);
}

function getCalibratedRegionAtWorld(worldX, worldY, targetMonth, calMap, layout = GARDEN_LANDS_BASE) {
  if (worldX < 0 || worldX >= 2400 || worldY < 0 || worldY >= 1800) return 0;
  if (targetMonth && targetMonth >= 1 && targetMonth <= 12) {
    const { u, v, insideBBox } = worldToMaskLocal(worldX, worldY, targetMonth, calMap, layout);
    if (insideBBox) {
      const meta = MONTH_REGION_METAS[targetMonth];
      const uncalWorldX = meta.bbox.x + u;
      const uncalWorldY = meta.bbox.y + v;
      const gx = Math.floor(uncalWorldX / REGION_GRID_SCALE);
      const gy = Math.floor(uncalWorldY / REGION_GRID_SCALE);
      if (gx >= 0 && gx < REGION_GRID_WIDTH && gy >= 0 && gy < REGION_GRID_HEIGHT) {
        if (grid[gy * REGION_GRID_WIDTH + gx] === targetMonth) return targetMonth;
      }
    }
  }
  for (let m = 1; m <= 12; m++) {
    if (m === targetMonth) continue;
    const { u, v, insideBBox } = worldToMaskLocal(worldX, worldY, m, calMap, layout);
    if (insideBBox) {
      const meta = MONTH_REGION_METAS[m];
      const uncalWorldX = meta.bbox.x + u;
      const uncalWorldY = meta.bbox.y + v;
      const gx = Math.floor(uncalWorldX / REGION_GRID_SCALE);
      const gy = Math.floor(uncalWorldY / REGION_GRID_SCALE);
      if (gx >= 0 && gx < REGION_GRID_WIDTH && gy >= 0 && gy < REGION_GRID_HEIGHT) {
        if (grid[gy * REGION_GRID_WIDTH + gx] === m) return m;
      }
    }
  }
  return 0;
}

// Check roundtrips for all 12 months
for (let m = 1; m <= 12; m++) {
  const meta = MONTH_REGION_METAS[m];
  const origWx = meta.centroid.x;
  const origWy = meta.centroid.y;
  const { u, v } = worldToMaskLocal(origWx, origWy, m);
  const back = maskLocalToWorld(u, v, m);
  const err = Math.hypot(back.x - origWx, back.y - origWy);
  assert(err < 1e-6, `Month ${m} World <-> MaskLocal roundtrip precision (err: ${err.toExponential(2)})`);
}

// TEST SUITE K: Land-Relative Movement
console.log('\n--- TEST SUITE K: Land-Relative Movement & Anchoring ---');
// When Land moves, the region must move with it
const testLayoutMoved = GARDEN_LANDS_BASE.map((l) =>
  l.id === '06' ? { ...l, x: l.x + 400, y: l.y - 200 } : { ...l }
);
const origC6 = getCalibratedCentroid(6);
const movedC6 = getCalibratedCentroid(6, null, testLayoutMoved);
const deltaX = movedC6.x - origC6.x;
const deltaY = movedC6.y - origC6.y;
assert(Math.abs(deltaX - 400) < 1e-6 && Math.abs(deltaY - (-200)) < 1e-6, 'Month 6 region strictly moves with Land06 (dx=400, dy=-200)');

// Test region detection moves with Land
const detectedAtOld = getCalibratedRegionAtWorld(origC6.x, origC6.y, 6, null, testLayoutMoved);
const detectedAtNew = getCalibratedRegionAtWorld(movedC6.x, movedC6.y, 6, null, testLayoutMoved);
assert(detectedAtOld !== 6, 'Original coordinates are no longer inside Month 6 after Land moved', `Detected: ${detectedAtOld}`);
assert(detectedAtNew === 6, 'Shifted coordinates are detected as Month 6 with parent Land shift');

// TEST SUITE L: Calibration Override & Parity
console.log('\n--- TEST SUITE L: Calibration Override & Precision ---');
// Modify Month 1 calibration localX by +25px
const customCal = {
  ...PLANTING_REGION_CALIBRATION,
  1: { ...PLANTING_REGION_CALIBRATION[1], localX: PLANTING_REGION_CALIBRATION[1].localX + 25 },
};
const c1Orig = getCalibratedCentroid(1);
const c1Custom = getCalibratedCentroid(1, customCal);
assert(Math.abs(c1Custom.x - (c1Orig.x + 25)) < 1e-6, 'Nudging localX +25 shifts centroid X by exactly +25');
assert(Math.abs(c1Custom.y - c1Orig.y) < 1e-6, 'Nudging localX does not alter centroid Y');

await runApprovedRuntimeTests(assert);

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} assertions passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('====================================================');

if (passedTests === totalTests) {
  console.log('>>> ALL PRODUCTION FLOWER PLANTING TESTS PASSED! <<<');
} else {
  process.exit(1);
}
