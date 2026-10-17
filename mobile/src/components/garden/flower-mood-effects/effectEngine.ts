import type { BlossomAnchorPoint, FlowerEffectConfig, GlowState, RainParticle, RaindropPlacement, SparkleParticle } from './types';

/**
 * 32-bit Mulberry32 PRNG.
 * Produces uniform, deterministic floats in [0, 1) from an integer seed.
 */
export function createRng(seed: number): () => number {
  let s = (Math.floor(Math.abs(seed)) || 1) >>> 0;
  return function next(): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Check if a point is strictly confined to a cluster's localized effect bounds */
export function isPointWithinClusterBounds(
  x: number,
  y: number,
  worldX: number,
  worldY: number,
  radius: number,
  height: number
): boolean {
  const dx = x - worldX;
  const dy = worldY - y; // height extends upwards from worldY
  return Math.abs(dx) <= radius && dy >= -5 && dy <= height + 5;
}

/**
 * Generate deterministic sparkle particles localized around flower blossoms.
 */
export function generateSparkleParticles(
  config: FlowerEffectConfig,
  worldX: number,
  worldY: number,
  seed: number
): SparkleParticle[] {
  if (config.effectType !== 'sparkle' || config.particleCount <= 0) return [];

  const rng = createRng(seed ^ 0x5a17e);
  const particles: SparkleParticle[] = [];
  const palette = [
    config.color || '#FFF3C4',
    '#F9E8B0',
    config.secondaryColor || '#E7D7FF',
  ];

  const count = Math.min(60, Math.max(1, config.particleCount));
  const r = config.effectRadius * 0.95;
  const h = config.effectHeight * 0.9;
  // Center of the flower cluster blossoms is roughly 40px above ground anchor
  const blossomCenterY = worldY - 42;

  for (let i = 0; i < count; i++) {
    // Elliptical distribution around the blossom center
    const angle = rng() * Math.PI * 2;
    const distRatio = Math.sqrt(rng());
    const xOffset = Math.cos(angle) * r * distRatio;
    const yOffset = Math.sin(angle) * (h * 0.45) * distRatio;

    const x = worldX + xOffset;
    const y = blossomCenterY + yOffset;
    const size = (2.2 + rng() * 2.6) * config.scale;
    const phase = rng() * Math.PI * 2;
    const speed = (0.75 + rng() * 0.5) * config.animationSpeed;
    const color = palette[Math.floor(rng() * palette.length)];
    const rotation = rng() * Math.PI;

    particles.push({
      id: i,
      x,
      y,
      size,
      phase,
      speed,
      color,
      rotation,
    });
  }

  return particles;
}

/**
 * Generate deterministic localized rain particles directly above the flower cluster.
 * Uses soft bell-curve horizontal distribution, layered depth, and varied continuous streaks.
 */
export function generateRainParticles(
  config: FlowerEffectConfig,
  worldX: number,
  worldY: number,
  seed: number
): RainParticle[] {
  if (config.effectType !== 'light_rain' || config.particleCount <= 0) return [];

  const rng = createRng(seed ^ 0x7a39b);
  const particles: RainParticle[] = [];
  const palette = [
    config.color || '#B2CED6',
    config.secondaryColor || '#98B8C4',
    '#A6C4CD',
  ];

  const count = Math.min(60, Math.max(1, config.particleCount));
  const r = config.effectRadius * 0.88;
  const h = config.effectHeight;

  for (let i = 0; i < count; i++) {
    // Soft bell-curve horizontal distribution (denser at center, tapering at edges)
    const curveOffset = (rng() + rng() - 1); // triangular distribution in [-1, 1]
    const x = worldX + curveOffset * r;

    // Asynchronous initial height offset and phase
    const baseY = worldY - h + rng() * h;
    const phaseOffset = rng() * 1000;

    // Fine semi-transparent rain streaks with natural variation
    const length = (12.0 + rng() * 8.5) * config.scale;
    const speed = (140 + rng() * 75) * config.animationSpeed;
    const slant = -0.045 + rng() * 0.025; // gentle, unified natural slant (~ -2° to -3°)
    const strokeWidth = 0.75 + rng() * 0.3; // very fine, delicate streaks
    const opacity = (0.32 + rng() * 0.30) * config.opacity;
    const color = palette[Math.floor(rng() * palette.length)];

    // Layering: ~60% pass behind blossoms (background), ~40% pass in front (foreground)
    const layer = (i % 5 === 0 || i % 5 === 3) ? 'foreground' : 'background';

    particles.push({
      id: i,
      x,
      baseY,
      length,
      speed,
      slant,
      opacity,
      color,
      layer,
      phaseOffset,
      strokeWidth,
    });
  }

  return particles;
}

/**
 * Generate deterministic water droplets resting as delicate moisture beads directly on flower petals.
 * Uses small irregular elliptical shapes, subtle translucency, and avoids floating in air.
 */
export function generateRaindropPlacements(
  config: FlowerEffectConfig,
  anchors: BlossomAnchorPoint[],
  seed: number
): RaindropPlacement[] {
  if (config.effectType !== 'raindrop' || config.particleCount <= 0 || anchors.length === 0) {
    return [];
  }

  const rng = createRng(seed ^ 0x3d91f);
  const placements: RaindropPlacement[] = [];
  const count = Math.min(anchors.length, Math.max(1, config.particleCount));

  // Deterministically shuffle anchor indices to pick primary petal surfaces
  const indices = anchors.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = indices[i];
    indices[i] = indices[j];
    indices[j] = temp;
  }

  for (let i = 0; i < count; i++) {
    const anchorIdx = indices[i];
    const anchor = anchors[anchorIdx];

    // Tight adhesion to petal surface (subtle sub-pixel variation <= 0.8px, never floating)
    const normal = anchor.normalAngle ?? -Math.PI / 2;
    const jitterDist = rng() * 0.8;
    const x = anchor.x + Math.cos(normal) * jitterDist;
    const y = anchor.y + Math.sin(normal) * jitterDist;

    // Small, irregular elliptical bead dimensions conforming to petal tension
    const baseScale = config.scale;
    const width = (1.4 + rng() * 0.7) * baseScale; // subtle horizontal bead
    const height = (0.9 + rng() * 0.45) * baseScale; // slightly flattened on petal
    const radius = Math.max(width, height);
    const tiltAngle = (anchor.tiltAngle ?? 0) + (rng() * 0.12 - 0.06);

    const shimmerPhase = rng() * Math.PI * 2;
    const shimmerSpeed = (0.4 + rng() * 0.4) * config.animationSpeed;
    const opacity = (0.45 + rng() * 0.18) * config.opacity;

    placements.push({
      id: i,
      anchorIndex: anchorIdx,
      x,
      y,
      radius,
      width,
      height,
      tiltAngle,
      shimmerPhase,
      shimmerSpeed,
      opacity,
    });
  }

  return placements;
}

/**
 * Calculate the localized breathing glow parameters for a flower cluster.
 */
export function calculateGlowParameters(
  config: FlowerEffectConfig,
  timeSeconds: number
): GlowState {
  if (config.effectType !== 'glow' || config.opacity <= 0) {
    return { opacity: 0, radius: 0, color: config.color || '#FFF5D6' };
  }

  // Smooth breathing wave with ~3.6s cycle
  const speed = config.animationSpeed || 0.8;
  const cycle = (timeSeconds * speed * 2 * Math.PI) / 3.6;
  const breath = 0.5 + 0.5 * Math.sin(cycle);

  // Keep opacity gentle and low (subtle illumination, not neon bloom)
  const minOpacity = config.opacity * 0.5;
  const maxOpacity = config.opacity * 1.1;
  const currentOpacity = minOpacity + (maxOpacity - minOpacity) * breath;

  // Gentle breathing in radius
  const currentRadius = config.effectRadius * (0.92 + 0.08 * breath) * config.scale;

  return {
    opacity: Math.max(0, Math.min(1, currentOpacity)),
    radius: currentRadius,
    color: config.color || '#FFF5D6',
  };
}
