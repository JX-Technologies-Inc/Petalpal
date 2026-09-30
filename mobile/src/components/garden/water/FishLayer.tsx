import { Group, Image, useImage } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import {
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Maps fish_overlay.png source pixel coords → 2400×1800 world coords */
const S2W = 2400 / 1448;

export type FishMotionPreset = 'subtle' | 'normal' | 'strong';
export type FishDensity = 'low' | 'normal' | 'high';
export type FishRegion =
  | 'upper-left'
  | 'upper-middle'
  | 'upper-right'
  | 'central'
  | 'lower-middle'
  | 'lower-right'
  | 'lower-left';

// ─── Types ───────────────────────────────────────────────────────────────────

export type FishConfig = {
  id: string;
  /** require() call for sprite PNG */
  source: number;
  /** Source-space dimensions in sprite coords */
  cropW: number;
  cropH: number;

  /** Snout/Head anchor point in sprite coordinates */
  headX: number;
  headY: number;
  /** Forward vector angle: direction from tail to head in sprite radians */
  fwdAngle: number;

  /** Assigned water map region for balanced coverage */
  region: FishRegion;

  /**
   * Continuous elliptical loop orbit in 2400×1800 world coordinates:
   * x(θ) = cx + rx·cos(θ)·cos(tilt) - ry·sin(θ)·sin(tilt)
   * y(θ) = cy + rx·cos(θ)·sin(tilt) + ry·sin(θ)·cos(tilt)
   */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  tilt: number;

  /** Orbit direction: +1 = counter-clockwise, -1 = clockwise */
  direction: 1 | -1;

  /** Initial phase offset in radians (0 to 2π) */
  phase: number;

  /** Orbit period in ms for NORMAL speed preset (40s–54s) */
  durationNormal: number;

  /** Density category */
  density: 'low' | 'normal' | 'high';
};

// ─── 13 Fish Distributed Across All 7 Water Regions ─────────────────────────
//
// Continuous Large Elliptical Orbits Across the Whole Water System:
// - Broad graceful movement covering the entire pond.
// - Mathematically continuous: θ(t) = phase + direction · (2π / T) · t
// - Zero snaps, zero jumps, zero restarts, zero resets.
// - Forward tangent following: heading = atan2(vy, vx)
// - Fish swim at 100% opacity.
// - Passes naturally under land overlays.
//
export const FISH: readonly FishConfig[] = [
  // ── 1. Upper-Left Water (Treehouse / Waterfall Basin) ──────────────────────
  {
    id: 'fish-01',
    source: require('@/assets/garden/water/fish-sprites/fish_01.png'),
    cropW: 128, cropH: 108, headX: 95.0, headY: 51.3, fwdAngle: 0.3414,
    region: 'upper-left',
    cx: 520, cy: 380, rx: 300, ry: 180, tilt: 0.12, direction: 1, phase: 0.00,
    durationNormal: 44000, density: 'low',
  },
  {
    id: 'fish-03',
    source: require('@/assets/garden/water/fish-sprites/fish_03.png'),
    cropW: 84, cropH: 64, headX: 51.3, headY: 34.6, fwdAngle: 0.6164,
    region: 'upper-left',
    cx: 620, cy: 460, rx: 260, ry: 190, tilt: -0.15, direction: -1, phase: 3.14,
    durationNormal: 40000, density: 'normal',
  },

  // ── 2. Upper-Middle Water (North Channel & Waterfall Runoff) ───────────────
  {
    id: 'fish-10',
    source: require('@/assets/garden/water/fish-sprites/fish_10.png'),
    cropW: 120, cropH: 112, headX: 87.8, headY: 65.7, fwdAngle: 0.5835,
    region: 'upper-middle',
    cx: 1180, cy: 340, rx: 330, ry: 150, tilt: 0.08, direction: 1, phase: 1.20,
    durationNormal: 48000, density: 'high',
  },
  {
    id: 'fish-02',
    source: require('@/assets/garden/water/fish-sprites/fish_02.png'),
    cropW: 76, cropH: 60, headX: 32.5, headY: 27.4, fwdAngle: -2.2404,
    region: 'upper-middle',
    cx: 1280, cy: 400, rx: 280, ry: 180, tilt: -0.10, direction: -1, phase: 4.50,
    durationNormal: 42000, density: 'low',
  },

  // ── 3. Upper-Right Water (Tea Island Expanse & NE Shoreline) ───────────────
  {
    id: 'fish-04',
    source: require('@/assets/garden/water/fish-sprites/fish_04.png'),
    cropW: 80, cropH: 56, headX: 52.9, headY: 32.3, fwdAngle: 0.4475,
    region: 'upper-right',
    cx: 1840, cy: 400, rx: 280, ry: 200, tilt: 0.15, direction: 1, phase: 2.10,
    durationNormal: 46000, density: 'low',
  },
  {
    id: 'fish-11',
    source: require('@/assets/garden/water/fish-sprites/fish_11.png'),
    cropW: 136, cropH: 100, headX: 97.1, headY: 70.5, fwdAngle: 0.4636,
    region: 'upper-right',
    cx: 1900, cy: 500, rx: 300, ry: 180, tilt: -0.12, direction: -1, phase: 5.40,
    durationNormal: 50000, density: 'normal',
  },

  // ── 4. Central Surrounding Water (Mid-Map Open Water & Pavilion Reach) ──────
  {
    id: 'fish-06',
    source: require('@/assets/garden/water/fish-sprites/fish_06.png'),
    cropW: 76, cropH: 68, headX: 47.6, headY: 39.8, fwdAngle: 0.7237,
    region: 'central',
    cx: 1200, cy: 880, rx: 350, ry: 230, tilt: 0.05, direction: 1, phase: 0.80,
    durationNormal: 52000, density: 'normal',
  },
  {
    id: 'fish-13',
    source: require('@/assets/garden/water/fish-sprites/fish_13.png'),
    cropW: 132, cropH: 116, headX: 94.6, headY: 68.3, fwdAngle: 0.5799,
    region: 'central',
    cx: 1140, cy: 940, rx: 310, ry: 210, tilt: -0.20, direction: -1, phase: 3.90,
    durationNormal: 46000, density: 'high',
  },

  // ── 5. Lower-Middle Water (South Central Pond & Basin) ─────────────────────
  {
    id: 'fish-07',
    source: require('@/assets/garden/water/fish-sprites/fish_07.png'),
    cropW: 132, cropH: 84, headX: 97.4, headY: 54.9, fwdAngle: 0.4086,
    region: 'lower-middle',
    cx: 1220, cy: 1420, rx: 360, ry: 170, tilt: 0.06, direction: 1, phase: 1.90,
    durationNormal: 54000, density: 'normal',
  },
  {
    id: 'fish-12',
    source: require('@/assets/garden/water/fish-sprites/fish_12.png'),
    cropW: 124, cropH: 96, headX: 84.7, headY: 71.7, fwdAngle: 0.6678,
    region: 'lower-middle',
    cx: 1320, cy: 1460, rx: 320, ry: 190, tilt: -0.08, direction: -1, phase: 4.80,
    durationNormal: 48000, density: 'normal',
  },

  // ── 6. Lower-Right Water (Moon-Bed Side & SE Lagoon) ───────────────────────
  {
    id: 'fish-05',
    source: require('@/assets/garden/water/fish-sprites/fish_05.png'),
    cropW: 120, cropH: 80, headX: 87.4, headY: 43.1, fwdAngle: 0.3023,
    region: 'lower-right',
    cx: 1820, cy: 1360, rx: 290, ry: 210, tilt: 0.14, direction: 1, phase: 2.70,
    durationNormal: 45000, density: 'low',
  },
  {
    id: 'fish-09',
    source: require('@/assets/garden/water/fish-sprites/fish_09.png'),
    cropW: 76, cropH: 68, headX: 48.6, headY: 40.8, fwdAngle: 0.6184,
    region: 'lower-right',
    cx: 1880, cy: 1420, rx: 250, ry: 180, tilt: -0.16, direction: -1, phase: 5.90,
    durationNormal: 41000, density: 'high',
  },

  // ── 7. Lower-Left Outer Water (SW Grand Bay & Shoreline) ───────────────────
  {
    id: 'fish-08',
    source: require('@/assets/garden/water/fish-sprites/fish_08.png'),
    cropW: 128, cropH: 96, headX: 87.4, headY: 56.5, fwdAngle: 0.3381,
    region: 'lower-left',
    cx: 540, cy: 1380, rx: 340, ry: 210, tilt: -0.10, direction: 1, phase: 0.50,
    durationNormal: 49000, density: 'low',
  },
] as const;

// ─── Density Selection ───────────────────────────────────────────────────────

function getFishForDensity(density: FishDensity): readonly FishConfig[] {
  const rank: Record<FishDensity, number> = { low: 0, normal: 1, high: 2 };
  const threshold = rank[density];
  return FISH.filter((f) => rank[f.density] <= threshold);
}

// ─── Speed Multipliers (Translational) ──────────────────────────────────────
const SPEED_MULTIPLIER: Record<FishMotionPreset, number> = {
  subtle: 0.65,
  normal: 1.0,
  strong: 1.45,
};

// ─── FishSprite Component ───────────────────────────────────────────────────

type FishSpriteProps = {
  config: FishConfig;
  animTime: SharedValue<number>;
  opacity: number;
};

const FishSprite = memo(function FishSprite({
  config,
  animTime,
  opacity,
}: FishSpriteProps) {
  const image = useImage(config.source);

  // World-space sprite metrics
  const worldW = config.cropW * S2W;
  const worldH = config.cropH * S2W;
  const worldHx = config.headX * S2W;
  const worldHy = config.headY * S2W;

  // Single mathematical continuous transform worklet
  // - Monotonic time progression: θ(t) = phase + dir · ω · t
  // - True elliptical trajectory with tilt
  // - Heading follows the velocity tangent vector (atan2(vy, vx))
  // - Anchors sprite head at (px, py) with zero wagging, twitching, or bobbing
  // - Zero resets or modulo discontinuities: 100% smooth forever
  const fishTransform = useDerivedValue(() => {
    const tSec = animTime.value;
    const omega = (2 * Math.PI) / (config.durationNormal / 1000);
    const theta = config.phase + config.direction * omega * tSec;

    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const cosTilt = Math.cos(config.tilt);
    const sinTilt = Math.sin(config.tilt);

    // 1. Position on tilted elliptical orbit
    const px = config.cx + config.rx * cosT * cosTilt - config.ry * sinT * sinTilt;
    const py = config.cy + config.rx * cosT * sinTilt + config.ry * sinT * cosTilt;

    // 2. Velocity vector along path tangent
    const dxdt = -config.rx * sinT * cosTilt - config.ry * cosT * sinTilt;
    const dydt = -config.rx * sinT * sinTilt + config.ry * cosT * cosTilt;
    const vx = config.direction * dxdt;
    const vy = config.direction * dydt;
    const heading = Math.atan2(vy, vx);

    // 3. Combined transform: aligns sprite head at (px, py) pointing along heading
    const netRot = heading - config.fwdAngle;
    return [
      { translateX: px },
      { translateY: py },
      { rotate: netRot },
      { translateX: -worldHx },
      { translateY: -worldHy },
    ];
  }, [worldHx, worldHy]);

  if (!image) return null;

  return (
    <Group transform={fishTransform} opacity={opacity}>
      <Image
        image={image}
        x={0}
        y={0}
        width={worldW}
        height={worldH}
        fit="fill"
      />
    </Group>
  );
});

// ─── FishLayer ───────────────────────────────────────────────────────────────

export type FishLayerProps = {
  active: boolean;
  enabled?: boolean;
  opacity?: number;
  motionPreset?: FishMotionPreset;
  density?: FishDensity;
};

function FishLayer({
  active,
  enabled = true,
  opacity = 1.0,
  motionPreset = 'normal',
  density = 'normal',
}: FishLayerProps) {
  const reducedMotion = useReducedMotion();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
    });
    return () => sub.remove();
  }, []);

  const isActive = active && foreground && !reducedMotion;
  const speedMultiplier = SPEED_MULTIPLIER[motionPreset];

  // Master monotonic time accumulator: strictly increases on UI thread
  // Never resets, never snaps, never loops back
  const animTime = useSharedValue(0);

  const frame = useFrameCallback((frameInfo) => {
    if (!isActive) return;
    const dt = (frameInfo.timeSincePreviousFrame ?? 16.667) / 1000;
    // Guard against backgrounding leaps (clamp to max 100ms)
    const safeDt = Math.min(Math.max(dt, 0), 0.1);
    animTime.value += safeDt * speedMultiplier;
  }, false);

  useEffect(() => {
    frame.setActive(enabled && isActive);
    return () => frame.setActive(false);
  }, [enabled, isActive, frame]);

  const visibleFish = useMemo(() => getFishForDensity(density), [density]);

  if (!enabled) return null;

  return (
    <Group>
      {visibleFish.map((config) => (
        <FishSprite
          key={config.id}
          config={config}
          animTime={animTime}
          opacity={opacity}
        />
      ))}
    </Group>
  );
}

export default memo(FishLayer);
export { getFishForDensity };

