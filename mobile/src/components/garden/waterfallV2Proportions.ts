// Short-r1 preserves horizontal scale and the complete original artwork.
// Coordinates are on the existing 1024 x 2048 design canvas, including inlet.
// Adjacent bands meet exactly; the entire impact region remains unmoved.
export const WATERFALL_V2_SHORT_BANDS = [
  { start: 0, end: 767, scaleY: 0.58, translateY: 676.14 },
  { start: 767, end: 1652, scaleY: 0.6, translateY: 660.8 },
  { start: 1652, end: 2048, scaleY: 1, translateY: 0 },
] as const;

export const WATERFALL_V2_ORIGINAL_BANDS = [
  { start: 0, end: 2048, scaleY: 1, translateY: 0 },
] as const;
