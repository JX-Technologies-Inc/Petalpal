// Independent preview variant. Never replaces the locked legacy placement.
export const WATERFALL_V2_WIDTH = 1024;
export const WATERFALL_V2_HEIGHT = 2048;
// Short inlet extension relative to the compact-r2 contact coordinates.
export const WATERFALL_V2_CONTENT_OFFSET_Y = 192;
export const INITIAL_WATERFALL_V2_PLACEMENT = {
  x: 742.6,
  y: -656,
  scale: 0.5,
  rotation: -2.5,
} as const;
export type WaterfallVersion = 'legacy' | 'v2';
