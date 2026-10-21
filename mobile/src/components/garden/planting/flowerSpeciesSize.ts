import type { GrowthPiece } from '../flower-density-sandbox/monthly-growth/growthCoverage';
import { growthCatalog } from '../flower-density-sandbox/monthly-growth/growthCatalog';
import { botanicalPresentationPose } from '../flower-visuals/botanicalPresentationPose';

/** Every bloom of one species is drawn at the same visible height (world units,
 * botanical body incl. presentation pose). Measured 2026-10-21 in the approved bed
 * engine at 1x: per month, the median planted flower's largest bloom; the biggest
 * month is kept, so no month's flowers end up smaller than before. */
export const SPECIES_BLOOM_HEIGHT: Readonly<Record<string, number>> = {
  CHAMOMILE: 29.5, TULIP: 41.8, HYDRANGEA: 30.9, COREOPSIS: 18, DAISY: 19.1, GERBERA_DAISY: 26.5,
  SUNFLOWER: 31.2, ANEMONE: 26.7, BLUEBELL: 24.9, HEATHER: 28.6, SNOWDROP: 23.1, GENTIAN: 26.2,
  PETUNIA: 28.8, POPPY: 27.8, BIRD_OF_PARADISE: 36.1, WHITE_ROSE: 29.4, YELLOW_DAFFODIL: 32.3,
  ASTER: 26.1, DANDELION: 26.3, YELLOW_RAPESEED_FLOWER: 25.3, CHINESE_VIOLET_CRESS: 25.8, LAVENDER: 26.3, OLIVE: 24.8,
};
/** Owner-approved Garden flower size, applied to blooms and leaves alike. */
export const GARDEN_FLOWER_SIZE = 1.25;

type SizedComponent = { category?: string; contentBounds: readonly number[] };

/** Positions, rotation and composition stay as the bed engine placed them; only the
 * drawn scale changes. Leaves (foliage) and species without a height keep their
 * relative size and get the Garden size multiplier. */
export function uniformSpeciesSize<T extends GrowthPiece>(pieces: readonly T[],
  component: (piece: T) => SizedComponent = piece => growthCatalog(piece.speciesCode).lookup(piece.componentId),
  poseScale: (id: string) => number = id => (botanicalPresentationPose(id).transform[0] as { scale: number }).scale): T[] {
  return pieces.map(piece => {
    const c = component(piece), height = SPECIES_BLOOM_HEIGHT[piece.speciesCode];
    const body = c.contentBounds[3] - c.contentBounds[1];
    if (c.category === 'foliage' || !height || !(body > 0)) return { ...piece, scale: piece.scale * GARDEN_FLOWER_SIZE };
    return { ...piece, scale: height * GARDEN_FLOWER_SIZE / (body * poseScale(piece.id)) };
  });
}
