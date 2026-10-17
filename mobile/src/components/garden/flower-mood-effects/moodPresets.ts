import { clampEffectConfig, createDefaultEffectConfig } from './effectConfig';
import type { FlowerEffectConfig, FlowerEffectType, MoodCategory } from './types';

export interface MoodPreset {
  category: MoodCategory;
  displayName: string;
  description: string;
  primaryEffectType: FlowerEffectType;
  secondaryEffectType: FlowerEffectType;
  defaultIntensity: number;
}

export const MOOD_PRESETS: Record<MoodCategory, MoodPreset> = {
  very_positive: {
    category: 'very_positive',
    displayName: 'Very Positive',
    description: 'Subtle twinkling stars and warm breathing glow',
    primaryEffectType: 'sparkle',
    secondaryEffectType: 'glow',
    defaultIntensity: 0.75,
  },
  positive: {
    category: 'positive',
    displayName: 'Positive',
    description: 'Delicate twinkling stars around the flower cluster',
    primaryEffectType: 'sparkle',
    secondaryEffectType: 'none',
    defaultIntensity: 0.45,
  },
  neutral: {
    category: 'neutral',
    displayName: 'Neutral',
    description: 'Natural undisturbed flower appearance with no extra effect',
    primaryEffectType: 'none',
    secondaryEffectType: 'none',
    defaultIntensity: 0.0,
  },
  negative: {
    category: 'negative',
    displayName: 'Negative',
    description: 'Gentle, peaceful localized rain above the flower cluster',
    primaryEffectType: 'light_rain',
    secondaryEffectType: 'none',
    defaultIntensity: 0.35,
  },
  very_negative: {
    category: 'very_negative',
    displayName: 'Very Negative',
    description: 'Gentle localized rain with tiny droplets resting on petals',
    primaryEffectType: 'light_rain',
    secondaryEffectType: 'raindrop',
    defaultIntensity: 0.65,
  },
};

/** Scale an effect config according to mood intensity without breaking aesthetic bounds */
export function applyIntensityToConfig(
  base: FlowerEffectConfig,
  intensity: number
): FlowerEffectConfig {
  if (base.effectType === 'none' || intensity <= 0) {
    return createDefaultEffectConfig('none', base.seed);
  }

  // Linear / curve scaling factors based on intensity [0..1]
  const intensityFactor = Math.max(0.2, Math.min(1.5, intensity / (base.intensity || 0.5)));
  const scaledCount = Math.round(base.particleCount * Math.sqrt(intensityFactor));
  const scaledOpacity = Math.min(1, base.opacity * Math.min(1.2, 0.7 + intensity * 0.5));

  return clampEffectConfig({
    ...base,
    intensity,
    particleCount: scaledCount,
    opacity: scaledOpacity,
  });
}

/**
 * Resolves the primary and secondary effect configs for a given mood category,
 * applying optional intensity and seed overrides.
 */
export function resolveMoodPreset(
  category: MoodCategory,
  options: {
    intensityOverride?: number;
    seed?: number;
  } = {}
): {
  primaryEffect: FlowerEffectConfig;
  secondaryEffect: FlowerEffectConfig;
} {
  const preset = MOOD_PRESETS[category] ?? MOOD_PRESETS.neutral;
  const intensity = options.intensityOverride !== undefined
    ? Math.max(0, Math.min(1, options.intensityOverride))
    : preset.defaultIntensity;

  const baseSeed = options.seed !== undefined ? options.seed : 42;

  const rawPrimary = createDefaultEffectConfig(preset.primaryEffectType, baseSeed);
  const rawSecondary = createDefaultEffectConfig(preset.secondaryEffectType, (baseSeed * 1664525 + 1013904223) >>> 0);

  const primaryEffect = applyIntensityToConfig(rawPrimary, intensity);
  const secondaryEffect = applyIntensityToConfig(rawSecondary, intensity * 0.85);

  return { primaryEffect, secondaryEffect };
}
