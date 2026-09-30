import type { FlowerClass } from './flowerDensityModel';

export const LEGACY_CLUSTER_VISUALS = {
  S: { width: 36, height: 46, name: 'Chamomile', description: 'Five small blooms in one airy clump' },
  M: { width: 34, height: 50, name: 'Tulip', description: 'Two stems sharing one leafy base' },
  L: { width: 48, height: 48, name: 'Hydrangea', description: 'One primary cluster with a short leafy base' },
} as const;

export const CLUSTER_VISUALS = {
  S: { width: 40, height: 37, name: 'Chamomile', description: 'Three to five readable blooms over a low, airy base' },
  M: { width: 38, height: 50, name: 'Tulip', description: 'One to three stems with varied spacing and height' },
  L: { width: 40, height: 40, name: 'Hydrangea', description: 'Smaller heads with varied foliage and silhouette' },
} as const;

interface SourcePiece {
  /** Source pixel coordinates; these polygons only clip the existing artwork. */
  clip: readonly (readonly [number, number])[];
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
}

export const SOURCE_PIECES = {
  chamomileHeadTop: {
    clip: [[574, 75], [747, 75], [752, 179], [573, 179]],
    anchorX: 654, anchorY: 171, width: 179, height: 104,
  },
  chamomileHeadLeft: {
    clip: [[271, 261], [437, 261], [440, 342], [393, 378], [273, 372]],
    anchorX: 364, anchorY: 348, width: 169, height: 117,
  },
  chamomileHeadRight: {
    clip: [[895, 327], [1050, 327], [1050, 431], [895, 431]],
    anchorX: 967, anchorY: 417, width: 155, height: 104,
  },
  chamomileStem: {
    clip: [[588, 466], [604, 464], [617, 570], [624, 689], [631, 838], [629, 997],
      [619, 1138], [627, 1163], [600, 1163], [603, 1100], [610, 998], [612, 837],
      [610, 689], [602, 570]],
    anchorX: 612, anchorY: 1160, width: 43, height: 699,
  },
  chamomileBase: {
    clip: [[375, 877], [433, 811], [507, 828], [565, 774], [635, 790], [696, 798],
      [790, 846], [844, 922], [799, 975], [819, 1045], [727, 1098], [633, 1169],
      [581, 1169], [498, 1117], [414, 1080], [405, 996], [359, 940]],
    anchorX: 612, anchorY: 1160, width: 485, height: 395,
  },
  tulipRedHead: {
    clip: [[301, 60], [679, 60], [680, 332], [651, 376], [634, 432], [583, 452],
      [427, 450], [311, 402], [299, 330]],
    anchorX: 583, anchorY: 426, width: 381, height: 392,
  },
  tulipYellowHead: {
    clip: [[648, 380], [687, 374], [715, 333], [788, 328], [824, 367], [882, 353],
      [922, 404], [921, 450], [965, 449], [968, 505], [916, 579], [824, 627], [729, 635],
      [679, 596], [652, 507], [642, 435]],
    anchorX: 733, anchorY: 618, width: 326, height: 307,
  },
  tulipRedStem: {
    clip: [[570, 416], [598, 416], [622, 475], [645, 556], [654, 639], [653, 773],
      [639, 933], [632, 1055], [630, 1179], [600, 1191], [604, 1036], [612, 920],
      [626, 771], [630, 634], [620, 559], [601, 495]],
    anchorX: 615, anchorY: 1190, width: 84, height: 774,
  },
  tulipYellowStem: {
    clip: [[721, 613], [746, 613], [729, 668], [710, 731], [700, 801], [691, 882],
      [679, 977], [655, 1078], [637, 1151], [620, 1194], [600, 1193], [612, 1143],
      [635, 1063], [652, 974], [665, 882], [676, 793], [687, 723], [705, 663]],
    anchorX: 615, anchorY: 1190, width: 146, height: 577,
  },
  tulipBase: {
    clip: [[325, 580], [352, 575], [509, 737], [551, 579], [577, 581], [629, 846],
      [646, 922], [674, 875], [699, 875], [824, 744], [952, 709], [958, 733],
      [863, 809], [784, 943], [727, 1090], [654, 1194], [586, 1201], [507, 1147],
      [468, 1076], [423, 1002], [330, 897], [221, 824], [218, 802], [274, 801],
      [415, 853], [496, 916], [436, 786]],
    anchorX: 615, anchorY: 1190, width: 740, height: 626,
  },
  hydrangeaHead: {
    clip: [[405, 255], [448, 245], [457, 219], [545, 204], [603, 211], [661, 225],
      [694, 258], [734, 254], [781, 277], [786, 312], [817, 326], [835, 380],
      [828, 435], [805, 477], [772, 499], [708, 520], [690, 548], [602, 559],
      [541, 549], [506, 560], [469, 532], [444, 501], [410, 485], [391, 434],
      [396, 403], [385, 364], [389, 323]],
    anchorX: 625, anchorY: 550, width: 450, height: 356,
  },
  hydrangeaSecondary: {
    clip: [[316, 211], [350, 178], [401, 166], [458, 178], [487, 206], [506, 238],
      [490, 271], [450, 288], [398, 285], [361, 279], [309, 282], [302, 248]],
    anchorX: 406, anchorY: 284, width: 204, height: 122,
  },
  hydrangeaStem: {
    clip: [[611, 535], [637, 533], [645, 661], [648, 785], [642, 953], [637, 1100],
      [633, 1174], [601, 1174], [607, 1100], [615, 957], [619, 782], [619, 665]],
    anchorX: 620, anchorY: 1173, width: 47, height: 640,
  },
  hydrangeaBase: {
    clip: [[525, 760], [597, 745], [657, 758], [718, 786], [768, 833], [716, 912],
      [706, 983], [828, 1060], [837, 1155], [677, 1110], [655, 1173], [591, 1173],
      [571, 1099], [467, 1143], [465, 1076], [526, 1004], [541, 942], [494, 864]],
    anchorX: 610, anchorY: 1173, width: 372, height: 428,
  },
} as const satisfies Record<string, SourcePiece>;

export type SourcePieceName = keyof typeof SOURCE_PIECES;
export interface ClusterSourcePlacement {
  source: SourcePieceName;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface ClusterComponent {
  x: number;
  y: number;
  rotationDegrees: number;
  mirror: boolean;
  /** Related heads and stems share this transform, preserving their join. */
  pieces: readonly ClusterSourcePlacement[];
}
export interface ClusterVariant {
  name: string;
  description: string;
  bloomCount: number;
  components: readonly ClusterComponent[];
}

const piece = (source: SourcePieceName, width: number, height: number, x = 0, y = 0): ClusterSourcePlacement =>
  ({ source, width, height, x, y });
const component = (pieces: readonly ClusterSourcePlacement[], x = 0, y = 0, rotationDegrees = 0, mirror = false): ClusterComponent =>
  ({ pieces, x, y, rotationDegrees, mirror });
const base = (source: SourcePieceName, width: number, height: number, rotation = 0, x = 0): ClusterComponent =>
  component([piece(source, width, height)], x, 0, rotation);

function chamomile(head: 'chamomileHeadTop' | 'chamomileHeadLeft' | 'chamomileHeadRight', x: number,
  stemHeight: number, headWidth: number, rotation: number, mirror = false): ClusterComponent {
  return component([piece('chamomileStem', 1.9, stemHeight),
    piece(head, headWidth, headWidth * 0.62, (597 - 612) * 1.9 / 43, -stemHeight + 1.2)], x, 0, rotation, mirror);
}
function tulip(color: 'red' | 'yellow', x: number, stemHeight: number, headWidth: number,
  rotation: number, mirror = false): ClusterComponent {
  const red = color === 'red';
  const stemWidth = red ? 3.7 : 5;
  // Head attachment uses the actual top of each curved source stem.
  const headX = red ? (583 - 615) * stemWidth / 84 : (733 - 615) * stemWidth / 146;
  const headY = red ? -(1190 - 426) * stemHeight / 774 : -(1190 - 618) * stemHeight / 577;
  return component([piece(red ? 'tulipRedStem' : 'tulipYellowStem', stemWidth, stemHeight),
    piece(red ? 'tulipRedHead' : 'tulipYellowHead', headWidth, headWidth * (red ? 1.03 : 0.94), headX, headY)],
  x, 0, rotation, mirror);
}
function hydrangea(x: number, headWidth: number, headHeight: number, stemHeight: number,
  rotation: number, secondary = false): ClusterComponent {
  return component([piece('hydrangeaStem', 2.2, stemHeight + 2),
    piece(secondary ? 'hydrangeaSecondary' : 'hydrangeaHead', headWidth, headHeight, 0, -stemHeight)], x, 0, rotation);
}

function scaleComposition(variant: ClusterVariant, factor: number): ClusterVariant {
  return { ...variant, components: variant.components.map(branch => ({ ...branch,
    x: branch.x * factor, y: branch.y * factor,
    pieces: branch.pieces.map(placement => ({ ...placement, x: placement.x * factor, y: placement.y * factor,
      width: placement.width * factor, height: placement.height * factor })),
  })) };
}

/** Each list changes source parts, counts, spacing, height hierarchy, and foliage. */
export const CLUSTER_VARIANTS: Record<FlowerClass, readonly ClusterVariant[]> = {
  S: [
    { name: 'Sparse three', description: 'Three readable heads above a low, open base', bloomCount: 3,
      components: [chamomile('chamomileHeadRight', -2, 24, 9.4, -15), chamomile('chamomileHeadTop', 0, 30, 10.4, 2),
        chamomile('chamomileHeadLeft', 2, 22, 10, 18), base('chamomileBase', 29, 12)] },
    { name: 'Four-level clump', description: 'Four heads at staggered heights', bloomCount: 4,
      components: [chamomile('chamomileHeadLeft', -2, 23, 9.4, -18), chamomile('chamomileHeadTop', -1, 30, 10, -5),
        chamomile('chamomileHeadRight', 1, 26, 9.3, 13), chamomile('chamomileHeadLeft', 2, 18, 10.6, 25, true),
        base('chamomileBase', 31, 12)] },
    { name: 'Five-bloom fan', description: 'Five heads with an airy middle', bloomCount: 5,
      components: [chamomile('chamomileHeadRight', -3, 23, 9, -25), chamomile('chamomileHeadTop', -1, 29, 9.6, -12),
        chamomile('chamomileHeadLeft', 0, 31, 10, 4), chamomile('chamomileHeadTop', 2, 25, 9.5, 20),
        chamomile('chamomileHeadRight', 3, 18, 9.8, 31), base('chamomileBase', 33, 13)] },
    { name: 'Low meadow spread', description: 'Four low heads extending over neighboring grass', bloomCount: 4,
      components: [chamomile('chamomileHeadLeft', -4, 23, 10.5, -32), chamomile('chamomileHeadTop', -1, 28, 11, -8),
        chamomile('chamomileHeadRight', 2, 25, 10.4, 22), chamomile('chamomileHeadLeft', 4, 19, 10.4, 35),
        base('chamomileBase', 37, 11)] },
    { name: 'Leaning three', description: 'A tall side head and two lower companions', bloomCount: 3,
      components: [chamomile('chamomileHeadTop', -1, 30, 10.8, -18), chamomile('chamomileHeadLeft', 1, 23, 10.4, 4),
        chamomile('chamomileHeadRight', 3, 18, 10.5, 25), base('chamomileBase', 31, 13, 6)] },
  ],
  M: [
    { name: 'Simple red stem', description: 'One red bloom with a small leafy base', bloomCount: 1,
      components: [tulip('red', 0, 30, 15, -4), base('tulipBase', 24, 22)] },
    { name: 'Asymmetric yellow pair', description: 'Two yellow stems with unequal height and spacing', bloomCount: 2,
      components: [tulip('yellow', -3, 30, 16, -13, true), tulip('yellow', 3, 23, 13.5, 13), base('tulipBase', 30, 24, 3)] },
    { name: 'Three-stem gathering', description: 'Two red heights around one smaller yellow bloom', bloomCount: 3,
      components: [tulip('red', -3, 31, 15.4, -15), tulip('yellow', 1, 25, 13.7, 2),
        tulip('red', 4, 23, 13, 17, true), base('tulipBase', 33, 25)] },
    { name: 'Dominant yellow with red', description: 'One high yellow bloom and a smaller red companion', bloomCount: 2,
      components: [tulip('yellow', -1, 32, 17, -7), tulip('red', 3, 21, 11.5, 16, true), base('tulipBase', 29, 23, -4)] },
    { name: 'Low open trio', description: 'Three lower stems with a wider spread', bloomCount: 3,
      components: [tulip('yellow', -4, 22, 14, -24, true), tulip('red', 0, 26, 13.8, -3),
        tulip('yellow', 4, 19, 13, 25), base('tulipBase', 37, 21)] },
  ],
  L: [
    { name: 'Medium blue head', description: 'One medium head over a compact leafy base', bloomCount: 1,
      components: [hydrangea(0, 38, 25, 16, -2), base('hydrangeaBase', 26, 18)] },
    { name: 'Blue head with small companion', description: 'A medium blue head and a smaller pale-green source head', bloomCount: 2,
      components: [hydrangea(4, 14, 10, 22, 16, true), hydrangea(-3, 34, 24, 16, -7), base('hydrangeaBase', 29, 18)] },
    { name: 'Low wide bloom', description: 'A lower, wider head with open foliage', bloomCount: 1,
      components: [hydrangea(0, 42, 22, 14, 3), base('hydrangeaBase', 32, 16)] },
    { name: 'Foliage-led clump', description: 'A smaller blue bloom above a broader leaf base', bloomCount: 1,
      components: [hydrangea(-1, 29, 21, 17, -5), base('hydrangeaBase', 38, 23, 5)] },
    { name: 'Offset blue crown', description: 'A sideward head balanced by foliage on the other side', bloomCount: 1,
      components: [hydrangea(-3, 37, 25, 17, -13), base('hydrangeaBase', 29, 20, 11, 2)] },
  ].map(variant => scaleComposition(variant, 0.96)),
};

/** FNV-1a uses only the stable object ID; no render order or mutable random state. */
export function getClusterVariantIndex(id: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index += 1) hash = Math.imul(hash ^ id.charCodeAt(index), 0x01000193) >>> 0;
  return hash % 5;
}

/** Conservative visual bounds from the actual source clips and composition transforms. */
export function getClusterVariantBounds(variant: ClusterVariant): { x: number; y: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const branch of variant.components) {
    const radians = branch.rotationDegrees * Math.PI / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    for (const placement of branch.pieces) {
      const source = SOURCE_PIECES[placement.source];
      for (const [sourceX, sourceY] of source.clip) {
        const x = (placement.x + (sourceX - source.anchorX) * placement.width / source.width) * (branch.mirror ? -1 : 1);
        const y = placement.y + (sourceY - source.anchorY) * placement.height / source.height;
        const worldX = branch.x + x * cosine - y * sine;
        const worldY = branch.y + x * sine + y * cosine;
        minX = Math.min(minX, worldX);
        minY = Math.min(minY, worldY);
        maxX = Math.max(maxX, worldX);
        maxY = Math.max(maxY, worldY);
      }
    }
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
