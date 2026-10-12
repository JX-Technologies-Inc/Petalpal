export type FishDensity = 'low' | 'normal' | 'high';
export type FishMotionPreset = 'subtle' | 'normal' | 'strong';
export type FishConfig = {
  id: string; cx: number; cy: number; rx: number; ry: number; tilt: number;
  length: number; palette: number; phase: number; direction: 1 | -1;
  durationNormal: number; density: FishDensity;
};

// Reservations follow the actual painted shore/bridge clearance, not the
// islands' rectangular canvases. The small eastern passages use smaller koi.
const ROUTES = [
  ['fish-01',580,1530,250,85,-.04,96,0,'low'],
  ['fish-03',765,1510,165,85,.06,82,2,'normal'],
  ['fish-10',1940,123,100,17,.05,80,3,'high'],
  ['fish-02',1955,122,95,17,.05,88,1,'low'],
  ['fish-04',2190,203,15,50,-.38,72,0,'low'],
  ['fish-11',480,1510,160,60,-.12,102,3,'normal'],
  ['fish-06',1680,750,8,50,.06,66,1,'normal'],
  ['fish-13',2266,1030,12,35,-.15,65,2,'high'],
  ['fish-07',1565,1185,24,48,-.05,82,0,'normal'],
  ['fish-12',855,1580,140,55,.16,90,1,'normal'],
  ['fish-05',2120,1670,100,12,-.09,86,2,'low'],
  ['fish-09',1815,1640,25,32,.3,75,0,'high'],
  ['fish-08',400,1485,130,43,.05,86,1,'low'],
] as const;

export const FISH: readonly FishConfig[] = ROUTES.map((r, i) => ({
  id:r[0], cx:r[1], cy:r[2], rx:r[3], ry:r[4], tilt:r[5], length:r[6], palette:r[7], density:r[8],
  phase:i*1.731, direction:i%2 ? 1 : -1, durationNormal:(100+i*7)*1000,
}));

export function getFishForDensity(density: FishDensity): readonly FishConfig[] {
  const rank = { low:0, normal:1, high:2 };
  return FISH.filter(f => rank[f.density] <= rank[density]);
}

function fishPoint(f: FishConfig, seconds: number) {
  'worklet';
  // Incommensurate, bounded breathing changes the course from lap to lap.
  // Unequal speeds, directions and phases prevent synchronized schooling.
  const phase = f.phase;
  const theta = phase + f.direction * (seconds * Math.PI * 2 / (f.durationNormal / 1000)
    + .08 * Math.sin(seconds * .027 + phase));
  const a = f.rx * (1 + .04 * Math.sin(seconds * .031 + phase));
  const b = f.ry * (1 + .065 * Math.sin(seconds * .019 + phase * .7));
  const u = a * (Math.cos(theta) + .06 * Math.sin(2 * theta + phase));
  const v = b * (Math.sin(theta) + .07 * Math.sin(3 * theta + phase * .4));
  return { x:f.cx + u*Math.cos(f.tilt) - v*Math.sin(f.tilt),
    y:f.cy + u*Math.sin(f.tilt) + v*Math.cos(f.tilt) };
}

export function getFishPose(f: FishConfig, seconds: number) {
  'worklet';
  const p = fishPoint(f, seconds);
  const before = fishPoint(f, seconds - .06);
  const after = fishPoint(f, seconds + .06);
  return { ...p, heading:Math.atan2(after.y-before.y, after.x-before.x) };
}
