export type MoodCategory =
  | 'very_negative'
  | 'negative'
  | 'neutral'
  | 'positive'
  | 'very_positive';

export interface DailyMood {
  date: string; // YYYY-MM-DD
  moodScore: number; // 0..1
  moodCategory: MoodCategory;
  primaryEmotion?: string;
  emotionIntensity: number; // 0..1
}

export type FlowerEffectType =
  | 'none'
  | 'sparkle'
  | 'glow'
  | 'light_rain'
  | 'raindrop';

export interface FlowerEffectConfig {
  effectType: FlowerEffectType;

  intensity: number; // 0..1
  density: number; // 0..2
  opacity: number; // 0..1

  color: string;
  secondaryColor?: string;

  animationSpeed: number; // 0.1..3.0
  scale: number; // 0.2..2.5

  effectRadius: number; // localized horizontal bounds (px)
  effectHeight: number; // localized vertical bounds (px)

  particleCount: number; // safe bounded count
  spawnInterval: number; // ms
  particleLifetime: number; // ms
  randomness: number; // 0..1

  seed: number; // deterministic seed
}

export interface DailyFlowerEffect {
  clusterId: string;
  date: string;

  primaryEffect: FlowerEffectConfig;
  secondaryEffect?: FlowerEffectConfig;

  startAt: string; // ISO 8601 UTC
  expiresAt: string; // ISO 8601 UTC (local midnight boundary)
}

/** Mock or explicit blossom anchor point relative to flower cluster center */
export interface BlossomAnchorPoint {
  id: number;
  x: number;
  y: number;
  normalAngle?: number;
  tiltAngle?: number;
  petalIndex?: number;
}

/** Future backend / Garden adapter interface */
export interface FlowerMoodClusterContext {
  userId?: string;
  clusterId: string;
  date: string;
  mood: DailyMood;
  primaryEffect: FlowerEffectConfig;
  secondaryEffect?: FlowerEffectConfig;
  startAt: string;
  expiresAt: string;
}

/** Particle runtime structures */
export interface SparkleParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  phase: number;
  speed: number;
  color: string;
  rotation: number;
}

export interface RainParticle {
  id: number;
  x: number;
  baseY: number;
  length: number;
  speed: number;
  slant: number;
  opacity: number;
  color: string;
  layer: 'background' | 'foreground';
  phaseOffset: number;
  strokeWidth: number;
}

export interface RaindropPlacement {
  id: number;
  anchorIndex: number;
  x: number;
  y: number;
  radius: number; // base scale
  width: number;
  height: number;
  tiltAngle: number;
  shimmerPhase: number;
  shimmerSpeed: number;
  opacity: number;
}

export interface GlowState {
  opacity: number;
  radius: number;
  color: string;
}
