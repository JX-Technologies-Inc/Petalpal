export type WaterTopPlacement = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  cliffOffsetX: number;
  cliffOffsetY: number;
  cliffScale: number;
  bankOffsetX: number;
  bankOffsetY: number;
  bankScale: number;
};

/**
 * Authoritative initial world-space placement for the water-top assembly.
 * Positioned around the existing waterfall (x=930, y=45, scale=0.17, rot=-2.5)
 * so upstream water enters from off-screen (y < 0) and converges directly into
 * the waterfall mouth.
 */
export const INITIAL_WATER_TOP_PLACEMENT: WaterTopPlacement = {
  x: 769.4,
  y: -218.96,
  scale: 0.33,
  rotation: -2.5,
  cliffOffsetX: 0,
  cliffOffsetY: 0,
  cliffScale: 1.0,
  bankOffsetX: 0,
  bankOffsetY: 0,
  bankScale: 1.0,
};
