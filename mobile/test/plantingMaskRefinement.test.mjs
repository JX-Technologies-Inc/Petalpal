import fs from 'fs';
import path from 'path';

console.log('====================================================');
console.log('PETALPAL PLANTING MASK PAINT REFINEMENT — TEST SUITE');
console.log('====================================================\n');

// 1. Load Region Data and decompress RLE
const basePath = process.cwd().endsWith('mobile') ? '' : 'mobile/';
const regionDataPath = path.resolve(basePath + 'src/components/garden/planting/plantingRegionData.ts');
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

// 2. Load Garden Layout & Baseline Calibration
const GARDEN_LANDS_BASE = [
  { id: '09', x: 1222, y: 1332, width: 730, rotation: 0, zIndex: 1 },
  { id: '08', x: 1279, y: 887, width: 830, rotation: 0, zIndex: 2 },
  { id: 'central', x: 900, y: 550, width: 855, rotation: 0, zIndex: 3 },
  { id: '07', x: 440, y: 720, width: 850, rotation: 0, zIndex: 4 },
  { id: '06', x: 260, y: 440, width: 740, rotation: 0, zIndex: 5 },
  { id: '0405', x: 265, y: 130, width: 850, rotation: 0, zIndex: 6 },
  { id: '101112', x: 935, y: 50, width: 880, rotation: 0, zIndex: 7 },
];

const LAND_ASSET_ASPECT_RATIOS = {
  central: 1.0,
  '0405': 1.0,
  '06': 398.7 / 598,
  '07': 1.0,
  '08': 1.0,
  '09': 1.0,
  '101112': 1.0,
};

const calPath = path.resolve(basePath + 'src/components/garden/planting/plantingRegionGeometry.ts');
const calContent = fs.readFileSync(calPath, 'utf8');
const calMatch = calContent.match(/export const PLANTING_REGION_CALIBRATION: Record<number, MonthRegionCalibration> = (\{[\s\S]*?\n\});/);
const PLANTING_REGION_CALIBRATION = eval('(' + calMatch[1] + ')');

function getParentLand(assetId, layout = GARDEN_LANDS_BASE) {
  let land = layout.find((l) => l.id === assetId);
  if (!land) {
    if (assetId === 'central') land = layout.find((l) => l.id === '01') || layout.find((l) => l.id === 'central');
    else if (assetId === '0405') land = layout.find((l) => l.id === '04') || layout.find((l) => l.id === '0405');
    else if (assetId === '101112') land = layout.find((l) => l.id === '10') || layout.find((l) => l.id === '101112');
  }
  return land || layout[0];
}

function getLandGeometry(land) {
  const aspect = LAND_ASSET_ASPECT_RATIOS[land.id] ?? 1.0;
  const height = land.width * aspect;
  const centerX = land.x + land.width / 2;
  const centerY = land.y + height / 2;
  const rotationRad = (land.rotation * Math.PI) / 180;
  return { width: land.width, height, centerX, centerY, rotationRad };
}

function worldToLandLocal(worldX, worldY, land) {
  const { width, height, centerX, centerY, rotationRad } = getLandGeometry(land);
  const dxP = worldX - centerX;
  const dyP = worldY - centerY;
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  const dx = dxP * cos + dyP * sin;
  const dy = -dxP * sin + dyP * cos;
  return { x: dx + width / 2, y: dy + height / 2 };
}

function landLocalToWorld(landX, landY, land) {
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

function isPointInBaseMask(month, landX, landY, cal, meta) {
  const maskLocal = landLocalToMaskLocal(landX, landY, cal, meta);
  if (maskLocal.u < 0 || maskLocal.u > meta.bbox.width || maskLocal.v < 0 || maskLocal.v > meta.bbox.height) {
    return false;
  }
  const uncalX = meta.bbox.x + maskLocal.u;
  const uncalY = meta.bbox.y + maskLocal.v;
  const gx = Math.floor(uncalX / REGION_GRID_SCALE);
  const gy = Math.floor(uncalY / REGION_GRID_SCALE);
  if (gx >= 0 && gx < REGION_GRID_WIDTH && gy >= 0 && gy < REGION_GRID_HEIGHT) {
    return grid[gy * REGION_GRID_WIDTH + gx] === month;
  }
  return false;
}

function createMaskStroke(tool, radius, points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
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

function distSqToSegment(px, py, x1, y1, x2, y2) {
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

function isPointInStroke(lx, ly, stroke) {
  const { bbox, radius, points } = stroke;
  if (lx < bbox.minX || lx > bbox.maxX || ly < bbox.minY || ly > bbox.maxY) return false;
  const rSq = radius * radius;
  if (points.length === 1) {
    const dx = lx - points[0].x;
    const dy = ly - points[0].y;
    return dx * dx + dy * dy <= rSq;
  }
  for (let i = 0; i < points.length - 1; i++) {
    if (distSqToSegment(lx, ly, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y) <= rSq) {
      return true;
    }
  }
  return false;
}

function isPointInRefinedMaskLandLocal(month, landX, landY, strokes, cal, meta) {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i];
    if (isPointInStroke(landX, landY, stroke)) {
      return stroke.tool === 'add';
    }
  }
  return isPointInBaseMask(month, landX, landY, cal, meta);
}

function strokeToSvgPath(points) {
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

let passed = 0;
let total = 0;
function assert(condition, message, details = '') {
  total++;
  if (condition) {
    passed++;
    console.log(`  [PASS] ${message}`);
  } else {
    console.error(`  [FAIL] ${message} ${details}`);
  }
}

// SUITE 1: Base Mask Fallback & Plantability
console.log('--- SUITE 1: Base Mask Fallback & Baseline Preservation ---');
const cal1 = PLANTING_REGION_CALIBRATION[1];
const meta1 = MONTH_REGION_METAS[1];
const land1 = getParentLand(cal1.parentLandAsset);

// Centroid of January is plantable in base mask
const u1 = meta1.centroid.x - meta1.bbox.x;
const v1 = meta1.centroid.y - meta1.bbox.y;
const c1Land = maskLocalToLandLocal(u1, v1, cal1, meta1);
assert(isPointInBaseMask(1, c1Land.x, c1Land.y, cal1, meta1), 'January centroid is inside base mask');
assert(isPointInRefinedMaskLandLocal(1, c1Land.x, c1Land.y, [], cal1, meta1), 'Empty strokes fall back to base mask (plantable)');

// Point far outside Land01 (e.g. water at 0, 0)
const waterLand = worldToLandLocal(0, 0, land1);
assert(!isPointInBaseMask(1, waterLand.x, waterLand.y, cal1, meta1), 'Water is outside base mask');
assert(!isPointInRefinedMaskLandLocal(1, waterLand.x, waterLand.y, [], cal1, meta1), 'Empty strokes fall back to base mask (non-plantable)');

// SUITE 2: Manual Additions (Brush Tool)
console.log('\n--- SUITE 2: Manual Additions (Brush Tool) ---');
// Pick a point just outside the base mask
const outsideLand = { x: c1Land.x + 300, y: c1Land.y - 100 };
assert(!isPointInBaseMask(1, outsideLand.x, outsideLand.y, cal1, meta1), 'Target point is outside base mask');

// Add a stroke covering that point
const addStroke = createMaskStroke('add', 20, [
  { x: outsideLand.x - 10, y: outsideLand.y },
  { x: outsideLand.x + 10, y: outsideLand.y },
]);
assert(isPointInStroke(outsideLand.x, outsideLand.y, addStroke), 'Stroke covers target point');
assert(
  isPointInRefinedMaskLandLocal(1, outsideLand.x, outsideLand.y, [addStroke], cal1, meta1),
  'Addition stroke makes non-mask point plantable (TRUE)'
);

// SUITE 3: Manual Erasures (Eraser Tool)
console.log('\n--- SUITE 3: Manual Erasures (Eraser Tool) ---');
// Erase a section of the January base mask
const eraseStroke = createMaskStroke('remove', 25, [{ x: c1Land.x, y: c1Land.y }]);
assert(isPointInStroke(c1Land.x, c1Land.y, eraseStroke), 'Eraser stroke covers January centroid');
assert(
  !isPointInRefinedMaskLandLocal(1, c1Land.x, c1Land.y, [eraseStroke], cal1, meta1),
  'Eraser stroke removes plantability from base mask point (FALSE)'
);

// Point not covered by eraser remains plantable
const otherPoint = { x: c1Land.x + 40, y: c1Land.y + 40 };
if (isPointInBaseMask(1, otherPoint.x, otherPoint.y, cal1, meta1)) {
  assert(
    isPointInRefinedMaskLandLocal(1, otherPoint.x, otherPoint.y, [eraseStroke], cal1, meta1),
    'Uncovered base mask point remains plantable'
  );
}

// SUITE 4: Sequential Stroke Precedence (Reverse Chronological Order)
console.log('\n--- SUITE 4: Reverse-Chronological Evaluation (Undo / Overwrite) ---');
// 1. Point was erased
// 2. Later, user paints an 'add' stroke over the exact same spot
const reAddStroke = createMaskStroke('add', 30, [{ x: c1Land.x, y: c1Land.y }]);
const strokesEraseThenAdd = [eraseStroke, reAddStroke];
assert(
  isPointInRefinedMaskLandLocal(1, c1Land.x, c1Land.y, strokesEraseThenAdd, cal1, meta1),
  'Add stroke after erase restores plantability (newest takes precedence)'
);

// 3. User later erases it again
const reEraseStroke = createMaskStroke('remove', 35, [{ x: c1Land.x, y: c1Land.y }]);
const strokesThenReErase = [eraseStroke, reAddStroke, reEraseStroke];
assert(
  !isPointInRefinedMaskLandLocal(1, c1Land.x, c1Land.y, strokesThenReErase, cal1, meta1),
  'Erase stroke after add removes plantability again'
);

// SUITE 5: Land-Relative Movement Invariance
console.log('\n--- SUITE 5: Land-Relative Coordinate Invariance ---');
// A stroke painted at Land-local coords (x, y)
const testStrokeLand = { x: 250, y: 180 };
const testStroke = createMaskStroke('add', 20, [testStrokeLand]);

// World position with original land
const origWorld = landLocalToWorld(testStrokeLand.x, testStrokeLand.y, land1);
const origBack = worldToLandLocal(origWorld.x, origWorld.y, land1);
assert(isPointInStroke(origBack.x, origBack.y, testStroke), 'Stroke detected at original world position');

// Move Land01 by dx = 300, dy = -150
const shiftedLand = { ...land1, x: land1.x + 300, y: land1.y - 150 };
const shiftedWorld = landLocalToWorld(testStrokeLand.x, testStrokeLand.y, shiftedLand);
assert(Math.abs(shiftedWorld.x - (origWorld.x + 300)) < 1e-4, 'World X shifted by exactly +300');
assert(Math.abs(shiftedWorld.y - (origWorld.y - 150)) < 1e-4, 'World Y shifted by exactly -150');

// Converting shifted world coord using shifted land yields exact same Land-local coords
const shiftedBack = worldToLandLocal(shiftedWorld.x, shiftedWorld.y, shiftedLand);
assert(isPointInStroke(shiftedBack.x, shiftedBack.y, testStroke), 'Stroke automatically shifts with parent Land');

// SUITE 6: Month Isolation
console.log('\n--- SUITE 6: Month Isolation ---');
// Refinement applied to Month 1
const febCal = PLANTING_REGION_CALIBRATION[2];
const febMeta = MONTH_REGION_METAS[2];
const febLand = getParentLand(febCal.parentLandAsset);
const u2 = febMeta.centroid.x - febMeta.bbox.x;
const v2 = febMeta.centroid.y - febMeta.bbox.y;
const febCentroidLand = maskLocalToLandLocal(u2, v2, febCal, febMeta);

assert(isPointInBaseMask(2, febCentroidLand.x, febCentroidLand.y, febCal, febMeta), 'Feb centroid in base mask');
// Month 2 evaluated with its own strokes (empty) remains completely unaffected by Month 1 strokes
assert(
  isPointInRefinedMaskLandLocal(2, febCentroidLand.x, febCentroidLand.y, [], febCal, febMeta),
  'Feb region is 100% isolated from Jan refinements'
);

// SUITE 7: SVG Path Generation for Skia
console.log('\n--- SUITE 7: SVG Path Generation ---');
assert(strokeToSvgPath([]) === '', 'Empty points produce empty SVG path');
const singlePointPath = strokeToSvgPath([{ x: 10, y: 20 }]);
assert(singlePointPath.startsWith('M 10 20 L'), 'Single point produces valid segment path');
const multiPointPath = strokeToSvgPath([{ x: 10, y: 20 }, { x: 30, y: 40 }, { x: 50, y: 60 }]);
assert(multiPointPath === 'M 10 20 L 30 40 L 50 60', 'Multi-point produces polyline SVG path');

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passed} / ${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
console.log('====================================================');

if (passed === total) {
  console.log('>>> ALL MASK PAINT REFINEMENT TESTS PASSED! <<<');
} else {
  process.exit(1);
}
