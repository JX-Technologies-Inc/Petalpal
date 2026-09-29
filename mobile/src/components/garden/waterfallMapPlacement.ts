// Approved landmark placement in the 2400 × 1800 garden world.
// World-space placement is independent of lands and internal waterfall layers.
export const WATERFALL_MAP_X = 930;
export const WATERFALL_MAP_Y = 45;
export const WATERFALL_MAP_SCALE = 0.17;
export const WATERFALL_MAP_ROTATION = -2.5;
export const WATERFALL_MAP_SCALE_X = 1;
export const WATERFALL_MAP_SCALE_Y = 0.96;

export type WaterfallMapPlacement = { x: number; y: number; scale: number; rotation: number; scaleX: number; scaleY: number };
export const INITIAL_WATERFALL_PLACEMENT: WaterfallMapPlacement = {
  x: WATERFALL_MAP_X, y: WATERFALL_MAP_Y,
  scale: WATERFALL_MAP_SCALE, rotation: WATERFALL_MAP_ROTATION,
  scaleX: WATERFALL_MAP_SCALE_X, scaleY: WATERFALL_MAP_SCALE_Y,
};
