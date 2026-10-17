import type { FlowerEffectConfig, FlowerEffectType } from './types';

export const EFFECT_BOUNDS = {
  intensity: { min: 0, max: 1 },
  density: { min: 0.1, max: 2 },
  opacity: { min: 0, max: 1 },
  animationSpeed: { min: 0.1, max: 3 },
  scale: { min: 0.2, max: 2.5 },
  effectRadius: { min: 10, max: 150 },
  effectHeight: { min: 10, max: 200 },
  particleCount: { min: 0, max: 60 },
  spawnInterval: { min: 50, max: 5000 },
  particleLifetime: { min: 200, max: 10000 },
  randomness: { min: 0, max: 1 },
} as const;

export const DEFAULT_CONFIGS: Record<FlowerEffectType, FlowerEffectConfig> = {
  none: {
    effectType: 'none',
    intensity: 0,
    density: 1,
    opacity: 0,
    color: '#000000',
    secondaryColor: undefined,
    animationSpeed: 1,
    scale: 1,
    effectRadius: 40,
    effectHeight: 60,
    particleCount: 0,
    spawnInterval: 1000,
    particleLifetime: 1000,
    randomness: 0,
    seed: 0,
  },
  sparkle: {
    effectType: 'sparkle',
    intensity: 0.6,
    density: 1.0,
    opacity: 0.85,
    color: '#FFF3C4', // warm champagne
    secondaryColor: '#E7D7FF', // soft lavender accent
    animationSpeed: 1.0,
    scale: 1.0,
    effectRadius: 52,
    effectHeight: 76,
    particleCount: 16,
    spawnInterval: 280,
    particleLifetime: 2200,
    randomness: 0.55,
    seed: 42,
  },
  glow: {
    effectType: 'glow',
    intensity: 0.5,
    density: 1.0,
    opacity: 0.22, // low opacity breathing glow
    color: '#FFF5D6', // warm ivory glow
    secondaryColor: '#FFEBB0',
    animationSpeed: 0.8,
    scale: 1.0,
    effectRadius: 42,
    effectHeight: 48,
    particleCount: 4,
    spawnInterval: 1200,
    particleLifetime: 4000,
    randomness: 0.25,
    seed: 101,
  },
  light_rain: {
    effectType: 'light_rain',
    intensity: 0.45,
    density: 1.0,
    opacity: 0.48, // delicate, soft semi-transparency
    color: '#B2CED6', // soft peaceful blue-grey
    secondaryColor: '#98B8C4',
    animationSpeed: 1.15,
    scale: 1.0,
    effectRadius: 44,
    effectHeight: 88,
    particleCount: 16,
    spawnInterval: 220,
    particleLifetime: 1200,
    randomness: 0.4,
    seed: 202,
  },
  raindrop: {
    effectType: 'raindrop',
    intensity: 0.5,
    density: 1.0,
    opacity: 0.55, // subtle translucency, not bright white
    color: '#C8DFE7', // soft translucent water bead
    secondaryColor: '#FFFFFF', // microscopic specular glint
    animationSpeed: 0.85,
    scale: 1.0,
    effectRadius: 36,
    effectHeight: 36,
    particleCount: 4, // fewer droplets resting on petals
    spawnInterval: 600,
    particleLifetime: 3200,
    randomness: 0.35,
    seed: 303,
  },
};

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

/** Validate and clamp numeric values to safe ranges */
export function clampEffectConfig(config: FlowerEffectConfig): FlowerEffectConfig {
  const b = EFFECT_BOUNDS;
  const def = DEFAULT_CONFIGS[config.effectType] ?? DEFAULT_CONFIGS.none;

  return {
    effectType: config.effectType,
    intensity: clamp(config.intensity, b.intensity.min, b.intensity.max, def.intensity),
    density: clamp(config.density, b.density.min, b.density.max, def.density),
    opacity: clamp(config.opacity, b.opacity.min, b.opacity.max, def.opacity),
    color: typeof config.color === 'string' && config.color.length > 0 ? config.color : def.color,
    secondaryColor: typeof config.secondaryColor === 'string' ? config.secondaryColor : def.secondaryColor,
    animationSpeed: clamp(config.animationSpeed, b.animationSpeed.min, b.animationSpeed.max, def.animationSpeed),
    scale: clamp(config.scale, b.scale.min, b.scale.max, def.scale),
    effectRadius: clamp(config.effectRadius, b.effectRadius.min, b.effectRadius.max, def.effectRadius),
    effectHeight: clamp(config.effectHeight, b.effectHeight.min, b.effectHeight.max, def.effectHeight),
    particleCount: Math.round(clamp(config.particleCount, b.particleCount.min, b.particleCount.max, def.particleCount)),
    spawnInterval: clamp(config.spawnInterval, b.spawnInterval.min, b.spawnInterval.max, def.spawnInterval),
    particleLifetime: clamp(config.particleLifetime, b.particleLifetime.min, b.particleLifetime.max, def.particleLifetime),
    randomness: clamp(config.randomness, b.randomness.min, b.randomness.max, def.randomness),
    seed: Number.isFinite(config.seed) ? Math.floor(Math.abs(config.seed)) : def.seed,
  };
}

export function createDefaultEffectConfig(type: FlowerEffectType, seed?: number): FlowerEffectConfig {
  const base = DEFAULT_CONFIGS[type] ?? DEFAULT_CONFIGS.none;
  return {
    ...base,
    seed: seed !== undefined ? Math.floor(Math.abs(seed)) : base.seed,
  };
}

export function validateEffectConfig(config: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Configuration must be a non-null object'] };
  }
  const c = config as Record<string, unknown>;

  const validTypes: FlowerEffectType[] = ['none', 'sparkle', 'glow', 'light_rain', 'raindrop'];
  if (!validTypes.includes(c.effectType as FlowerEffectType)) {
    errors.push(`Invalid effectType: ${String(c.effectType)}`);
  }

  for (const [key, bounds] of Object.entries(EFFECT_BOUNDS)) {
    const val = c[key];
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      errors.push(`Field ${key} must be a finite number`);
    } else if (val < bounds.min || val > bounds.max) {
      errors.push(`Field ${key} (${val}) outside safe bounds [${bounds.min}, ${bounds.max}]`);
    }
  }

  if (typeof c.color !== 'string' || !c.color.trim()) {
    errors.push('color must be a non-empty string');
  }

  return { valid: errors.length === 0, errors };
}
