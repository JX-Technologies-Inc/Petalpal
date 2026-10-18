// Lossless WebP copies of the terrain PNGs (identical RGBA pixels, ~31% smaller).
// Regenerate from the PNG sources; never edit the WebP files directly.
export const TERRAIN_ASSETS = {
  scenic: require('./terrain/web/upper-right-scenic-v2.webp'),
  basin: require('./terrain/web/outer-basin-v2.webp'),
  floralBasin: require('./terrain/web/outer-basin-floral-v3.webp'),
  floralRightBank: require('./terrain/web/outer-right-bank-floral-v2.webp'),
  floralPass: require('./terrain/web/entrance-floral-banks-v2.webp'),
  treeCliffs: require('./terrain/web/treehouse-cliff-backing-v1.webp'),
  rightBank: require('./terrain/web/outer-right-bank-v1.webp'),
  upland: require('./terrain/web/outer-upland-v1.webp'),
  inlet: require('./terrain/web/waterfall-source-banks-v1.webp'),
  pass: require('./terrain/web/entrance-mountain-pass-v1.webp'),
} as const;
