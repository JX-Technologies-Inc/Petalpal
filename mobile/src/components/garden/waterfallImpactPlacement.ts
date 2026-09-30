// Approved waterfall impact zone calibration coordinates in the 2400 × 1800 garden world.
// Derived from the foot of the falling water in WaterfallEntity and structure-final-version.png.

export type WaterfallImpactPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export const INITIAL_WATERFALL_IMPACT_PLACEMENT: WaterfallImpactPlacement = {
  x: 1040,
  y: 250,
  width: 110,
  height: 57,
  rotation: 2.25,
};
