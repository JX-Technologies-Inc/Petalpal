// World-space composition, intentionally unequal clusters with open water between them.
// These anchors sit in the existing water mask; no garden geometry is changed.
export const PETAL_GROUPS = [
  { x: 74, y: 457, count: 2, seed: 11, region: 'left', lengthMaxPx: 8.5, points: [[83, 430], [59, 494]] },
  { x: 56, y: 258, count: 1, seed: 27, region: 'left', lengthMaxPx: 8.5, points: [[56, 257]] },
  { x: 62, y: 1414, count: 1, seed: 43, region: 'left', lengthMaxPx: 8.5, points: [[-110, 625]] },
  { x: 90, y: 1284, count: 1, seed: 59, region: 'left', lengthMaxPx: 8.5, points: [[-245, 880]] },
  { x: 121, y: 1697, count: 3, seed: 71, region: 'lower-left', lengthMaxPx: 13, points: [[-115, 1100], [-205, 1170], [-265, 1060]] },
  { x: 550, y: 1476, count: 5, seed: 89, region: 'lower-left', lengthMaxPx: 13, points: [[-335, 690], [-300, 970], [2305, 1668], [2660, 1190], [2720, 1090]] },
  { x: 820, y: 1454, count: 5, seed: 103, region: 'lower-left', lengthMaxPx: 13, points: [[784, 1354], [819, 1429], [869, 1374], [1229, 1699], [1335, 1739]] },
  { x: 866, y: 1300, count: 1, seed: 127, region: 'lower-left', lengthMaxPx: 13, points: [[868, 1279]] },
  { x: 1680, y: 734, count: 2, seed: 139, region: 'central', lengthMaxPx: 8.5, points: [[1677, 759], [1686, 697]] },
  { x: 1577, y: 1175, count: 5, seed: 157, region: 'central', lengthMaxPx: 13, points: [[1587, 1162], [1650, 1190], [1558, 1120], [1594, 1230], [1518, 1169]] },
  { x: 1522, y: 1210, count: 3, seed: 163, region: 'central', lengthMaxPx: 11, points: [[1530, 1226], [1544, 1281], [1486, 1115]] },
  { x: 922, y: 1597, count: 5, seed: 173, region: 'lower-center', lengthMaxPx: 17, points: [[1039, 1689], [974, 1649], [963, 1545], [1035, 1609], [1129, 1699]] },
  { x: 1136, y: 1702, count: 2, seed: 191, region: 'lower-center', lengthMaxPx: 13, points: [[1180, 1742], [1378, 1679]] },
  { x: 1491, y: 1660, count: 3, seed: 211, region: 'lower-center', lengthMaxPx: 13, points: [[1449, 1639], [1474, 1719], [1569, 1659]] },
  { x: 2293, y: 84, count: 2, seed: 229, region: 'right', lengthMaxPx: 8.5, points: [[1829, 80], [1812, 174]] },
  { x: 2292, y: 1015, count: 4, seed: 251, region: 'right', lengthMaxPx: 13, points: [[2251, 991], [2266, 1046], [2309, 976], [2342, 1044]] },
  { x: 2320, y: 1102, count: 2, seed: 283, region: 'right', lengthMaxPx: 8.5, points: [[2339, 1118], [2296, 1090]] },
  { x: 2243, y: 1659, count: 6, seed: 307, region: 'lower-right', lengthMaxPx: 17, points: [[2239, 1649], [2269, 1729], [2170, 1649], [2309, 1599], [2190, 1719], [2343, 1546]] },
  { x: 1668, y: 1659, count: 4, seed: 331, region: 'lower-right', lengthMaxPx: 13, points: [[2538, 470], [2624, 554], [2546, 1260], [2672, 1306]] },
  { x: 1882, y: 103, count: 3, seed: 353, region: 'right', lengthMaxPx: 13, points: [[2550, 715], [2630, 785], [2570, 1010]] },
] as const;

// Muted warm pigment. The wet edges pick up a little reflected pond light below.
export const PETAL_TONES = [
  ['#F0CEC5', '#D8A59A'],
  ['#EDC3BB', '#D39E94'],
  ['#F5DAC2', '#DFB79A'],
  ['#EFBEAE', '#D9A18E'],
  ['#F1CFC2', '#DBADA0'],
  ['#F4DDC0', '#DDBB98'],
  ['#F7ECD5', '#DFD2B9'],
] as const;

// Asymmetric cupped, notched, slender, curved and folded petals, in a 14-unit box.
export const PETAL_PATHS = [
  'M -6.7 0.5 C -4.6 -0.6 -4.7 -2.6 -1.2 -3.2 C 1.4 -3.9 5.7 -3 6.3 -0.9 C 6.9 1.3 3.3 3.4 0.6 2.7 C -2.8 2.4 -4.2 0.4 -6.7 0.5 Z',
  'M -6.6 0.2 C -3.8 -0.7 -3.3 -3.6 0.2 -3.6 C 2.3 -3.8 4.8 -2.9 5.2 -1.5 L 4.2 -0.8 C 6.1 -1.4 6.8 0.2 5.7 1.4 C 3.3 3.7 -0.5 3 -2.7 1.6 C -4 0.6 -5.2 0.3 -6.6 0.2 Z',
  'M -6.9 0.5 C -3.9 -0.2 -0.5 -2.7 3.6 -1.8 C 5 -1.5 6.4 -0.6 6.6 0.1 C 4.5 1.6 1.8 1.8 -0.9 1.1 C -3 0.4 -4.9 0.7 -6.9 0.5 Z',
  'M -6.6 0.9 C -4 -2.9 1.2 -4.1 4.9 -1.9 C 6.1 -1.2 6.6 -0.1 6.3 0.7 C 3.5 -1.5 0.8 -0.6 -1 1.1 C -3.1 2.4 -5.2 2.2 -6.6 0.9 Z',
  'M -6.7 0.2 C -2.5 -0.4 -1.3 -3.9 2.1 -3 C 4.7 -2.5 6.3 -0.8 6.4 1.1 C 3.7 0.6 2.8 2.6 -0.2 2 C -2.9 1.7 -4.6 0.4 -6.7 0.2 Z',
  'M -6.7 0.5 C -3.9 -1.9 -0.9 -3.1 2.2 -2.5 C 4.2 -2.3 6.1 -0.5 6.6 0.8 C 4.8 0.1 3.7 1.9 1.7 2.3 C 2.8 0.7 1.4 -0.3 -0.2 0.4 C -2.9 1.9 -4.8 1.5 -6.7 0.5 Z',
] as const;
export const PETAL_FOLDS = [
  'M -3 0.4 Q 0.5 0.8 3.8 -0.6',
  'M -3.4 0.4 Q 0.8 -0.9 4.2 -0.8',
  'M -4 0.4 Q 0.7 -0.6 4 -0.1',
  'M -4.2 0 Q 0.3 -2.6 3.8 -1.2',
  'M -4.3 0.2 Q 1.2 -1 5.1 0.6',
  'M -4 0.6 Q -0.3 -1.8 3.5 -0.1',
] as const;

function wetPigment(hex: string, waterMix: number, alpha: number): string {
  const pigment = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
  const waterLight = [159, 203, 198];
  const color = pigment.map((value, i) => Math.round(value * (1 - waterMix) + waterLight[i] * waterMix));
  return `rgba(${color.join(',')},${alpha})`;
}

// Broad buffer around both waterfall versions, upstream stream and impact/spray.
// The renderer clips this area too, even if a future placement is misconfigured.
export const PETAL_WATERFALL_EXCLUSION = { x: 740, y: -900, width: 560, height: 1420 };
export const PETAL_MAX_DRIFT = 12;

export const FLOATING_PETALS = PETAL_GROUPS.flatMap(group => {
  let state: number = group.seed;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  return Array.from({ length: group.count }, (_, index) => {
    // Preserve the seeded pigment/motion variation independently of the authored anchors.
    random();
    if (index > 0) random();
    const large = (group.seed === 173 || group.seed === 307) && index === 0;
    return {
      id: `${group.seed}-${index}`,
      region: group.region,
      x: group.points[index][0],
      y: group.points[index][1],
      // Retain the seeded size variation at a delicate normal-zoom scale:
      // most are 6–9 px, with only two larger accents below 12 px.
      lengthPx: Math.min(group.lengthMaxPx, large ? 15 + random() * 2 : 8.5 + random() * 4.5) * 0.7,
      rotation: random() * Math.PI * 2,
      // Folded shapes are accents; most remain single, narrow or gently curved.
      shape: index === 2 && group.seed % 3 === 1 ? 4 + Math.floor(group.seed / 6) % 2 : (group.seed + index) % 4,
      tone: (group.seed + index * 7) % 17 === 0 ? 6 : (group.seed + index) % 6,
      opacity: 0.82 + random() * 0.12,
      seed: group.seed + index * 37.17,
      driftPeriod: 19 + random() * 18,
      groupSeed: group.seed,
      sharedDrift: group.count > 1 ? 0.4 + (group.seed % 4) * 0.1 : 0,
      widthScale: 0.9 + ((group.seed + index * 3) % 7) * 0.017,
      softness: (group.seed + index) % 5 === 0 ? 0.46 : 0.18,
      contact: (group.seed + index) % 3 !== 0,
      glint: (group.seed + index * 3) % 7 === 0,
    };
  });
}).map(petal => {
  const [light, shade] = PETAL_TONES[petal.tone];
  return {
    ...petal,
    // A warm readable middle with wet translucent edges, not an opaque sticker.
    pigment: [wetPigment(light, 0.11, 0.72), wetPigment(light, 0.035, 1),
      wetPigment(shade, 0.07, 0.98), wetPigment(shade, 0.19, 0.62)],
  };
});
export type FloatingPetal = typeof FLOATING_PETALS[number];

export function petalWorldLength(lengthPx: number, fit: number): number {
  'worklet';
  // Fit compensation is local to the petals. Pinch zoom still scales them with
  // the water, and neither camera nor scene layout needs any adjustment.
  return lengthPx / Math.max(fit, 0.15);
}

function driftNoise(time: number, seed: number): number {
  'worklet';
  const cell = Math.floor(time);
  const fraction = time - cell;
  const ease = fraction * fraction * fraction * (fraction * (fraction * 6 - 15) + 10);
  const a = Math.sin(cell * 127.1 + seed * 311.7) * 43758.5453;
  const b = Math.sin((cell + 1) * 127.1 + seed * 311.7) * 43758.5453;
  return ((a - Math.floor(a)) * (1 - ease) + (b - Math.floor(b)) * ease) * 2 - 1;
}

export function getPetalPose(petal: FloatingPetal, seconds: number) {
  'worklet';
  const t = seconds / petal.driftPeriod + petal.seed * 0.13;
  const current = seconds / 43 + petal.groupSeed * 0.11;
  const shared = petal.sharedDrift;
  // Nearby petals share some slow current, with independent slip and rotation.
  // Combined bounds stay inside the original clearance budget; no wrap or orbit.
  const dx = driftNoise(current, petal.groupSeed) * shared + driftNoise(t, petal.seed) * (1 - shared);
  const dy = driftNoise(current * 0.81, petal.groupSeed + 19) * shared +
    driftNoise(t * 0.83, petal.seed + 19) * (1 - shared);
  return {
    x: petal.x + dx * PETAL_MAX_DRIFT,
    y: petal.y + dy * PETAL_MAX_DRIFT * 0.61 + Math.sin(seconds * 0.52 + petal.seed) * 0.24,
    rotation: petal.rotation + driftNoise(t * 0.61, petal.seed + 47) * 0.065,
  };
}
