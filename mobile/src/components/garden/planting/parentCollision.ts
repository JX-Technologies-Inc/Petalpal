/** Production logical parent anchors; independent of botanical drawing bounds. */
export type ParentCollisionClass = 'S' | 'M' | 'L';
export const PARENT_COLLISION_RADII = { S: 9, M: 12, L: 16 } as const;
export const PARENT_COLLISION_CLASSES: Readonly<Record<string, ParentCollisionClass>> = {
  CHAMOMILE:'S', COREOPSIS:'S', DAISY:'S', BLUEBELL:'S', HEATHER:'S', SNOWDROP:'S',
  ASTER:'S', DANDELION:'S', YELLOW_RAPESEED_FLOWER:'S', CHINESE_VIOLET_CRESS:'S', LAVENDER:'S',
  TULIP:'M', GERBERA_DAISY:'M', ANEMONE:'M', GENTIAN:'M', PETUNIA:'M', POPPY:'M',
  WHITE_ROSE:'M', YELLOW_DAFFODIL:'M', OLIVE:'M', HYDRANGEA:'L', SUNFLOWER:'L', BIRD_OF_PARADISE:'L',
};
export const UNRESOLVED_PARENT_COLLISION_RADIUS = 22;
function normalize(value: string) { return value.trim().toUpperCase().replace(/[\s-]+/g, '_'); }
export function resolveParentCollision(speciesCode?: string, flowerName?: string) {
  // An explicit canonical code takes precedence; never reinterpret an unknown
  // code as another species merely because its display label happens to match.
  let code = normalize(speciesCode || flowerName || '');
  // Preserve the established legacy Tulip-name aliases, without broad substring
  // matching (Gerbera Daisy must not resolve as Daisy).
  if (!speciesCode && ['ORANGE_TULIP','FEBRUARY_TULIP'].includes(code)) code = 'TULIP';
  const collisionClass = PARENT_COLLISION_CLASSES[code];
  return collisionClass
    ? { speciesCode:code, status:'CLASSIFIED' as const, collisionClass, radius:PARENT_COLLISION_RADII[collisionClass] }
    : { speciesCode:code || 'UNKNOWN', status:'UNRESOLVED' as const, collisionClass:null,
      radius:UNRESOLVED_PARENT_COLLISION_RADIUS };
}
