import type { AreaProfileName } from './tulipAreaProfiles';

// DEV rendering state only. Intentionally separate from composition weights,
// spread, seed inputs, asset metadata and planting/collision configuration.
export const DEFAULT_CLUSTER_VISUAL_SCALES: Readonly<Record<AreaProfileName, number>> = {
  SMALL: 1, MEDIUM: 1.08, LARGE: 1.22,
};
export const cloneClusterVisualScales = () => ({ ...DEFAULT_CLUSTER_VISUAL_SCALES });
export function clusterVisualScale(baseScale: number, areaAware: boolean, profile: AreaProfileName,
  scales: Readonly<Record<AreaProfileName, number>> = DEFAULT_CLUSTER_VISUAL_SCALES) {
  return baseScale * (areaAware ? scales[profile] : 1);
}
