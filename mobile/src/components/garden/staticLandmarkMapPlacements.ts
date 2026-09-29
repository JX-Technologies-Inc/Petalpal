export type StaticLandmarkMapPlacement = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

// Approved world-space placements. These remain independent from land and all
// other landmark transforms.
export const STATIC_LANDMARK_MAP_PLACEMENTS: {
  gardenArch: StaticLandmarkMapPlacement;
  pavilion: StaticLandmarkMapPlacement;
} = {
  gardenArch: { x: 1380, y: 1450, scale: 0.3, rotation: -6 },
  pavilion: { x: 1086, y: 514, scale: 0.17, rotation: 0 },
};
