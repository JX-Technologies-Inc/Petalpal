import type { PreviewSettings } from '../flower-visuals/FlowerEmotionPreview';
import { DEFAULT_TUNING } from './flowerDensityModel';
import type { Composition } from '../flower-visuals/flowerVisualTypes';

export type TulipScaleMode = 'current' | 'tuned';
export const TULIP_REVIEW_SCALES: Record<TulipScaleMode, Record<Composition, number>> = {
  current: { sparse: 1, normal: 1, full: 1 },
  tuned: { sparse: .95, normal: .89, full: .82 },
};
// Visual-only preview multipliers. Never change the asset metadata, placement or identity.
export function tulipReviewTuning(settings: PreviewSettings, composition: Composition, mode: TulipScaleMode) {
  return { ...settings, scaleMultiplier: settings.scaleMultiplier *
    (settings.speciesCode === 'TULIP' ? TULIP_REVIEW_SCALES[mode][composition] : 1) };
}

// DEV only. Reuses the existing M-class radius; production Tulip radius remains 20.
export const TULIP_REVIEW_RADIUS = DEFAULT_TUNING.M.footprintRadius;
export const TULIP_REVIEW_SETTINGS: PreviewSettings = {
  primaryBloom: 'SUNNY_BLOOM', speciesCode: 'TULIP', composition: 'auto', main: '', accent: '',
  selected: false, anchorOffsetX: 0, anchorOffsetY: 0, scaleMultiplier: 1,
};
export const TULIP_REVIEW_PRESETS = [
  { label: 'October · Tulip Garden art · 30', month: 10, count: 30 },
  { label: 'June · Tulip Garden art · 30', month: 6, count: 30 },
] as const;
