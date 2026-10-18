// Native and tooling load the source PNGs. Web loads pixel-identical lossless
// WebP copies (terrainAssets.web.ts); see test/terrainWebAssets.test.mjs.
export const TERRAIN_ASSETS = {
  scenic: require('./terrain/upper-right-scenic-v2.png'),
  basin: require('./terrain/outer-basin-v2.png'),
  floralBasin: require('./terrain/outer-basin-floral-v3.png'),
  floralRightBank: require('./terrain/outer-right-bank-floral-v2.png'),
  floralPass: require('./terrain/entrance-floral-banks-v2.png'),
  treeCliffs: require('./terrain/treehouse-cliff-backing-v1.png'),
  rightBank: require('./terrain/outer-right-bank-v1.png'),
  upland: require('./terrain/outer-upland-v1.png'),
  inlet: require('./terrain/waterfall-source-banks-v1.png'),
  pass: require('./terrain/entrance-mountain-pass-v1.png'),
} as const;
