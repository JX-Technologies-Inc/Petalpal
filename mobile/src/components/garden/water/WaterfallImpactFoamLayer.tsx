import { Blur, Group, Image, Oval, useImage } from '@shopify/react-native-skia';
import { memo, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {
  INITIAL_WATERFALL_IMPACT_PLACEMENT,
  type WaterfallImpactPlacement,
} from '../waterfallImpactPlacement';
import { WATER_ASSETS } from './waterAssets';

export const FOAM_CYCLE_MS = 2800;

export type WaterfallImpactFoamLayerProps = {
  active?: boolean;
  enabled?: boolean;
  opacity?: number;
  placement?: WaterfallImpactPlacement;
};

// Subtle angle & jitter offsets per instance for an organic, hand-crafted feel
const INSTANCE_CONFIGS = [
  { phaseOffset: 0.0, angleDeg: 0, jitterX: 0, jitterY: 0, scaleMultiplier: 1.0 },
  { phaseOffset: 0.3333, angleDeg: 2.2, jitterX: 2.5, jitterY: -1.5, scaleMultiplier: 1.05 },
  { phaseOffset: 0.6667, angleDeg: -2.0, jitterX: -2.0, jitterY: 1.5, scaleMultiplier: 0.98 },
] as const;

function WaterfallImpactFoamLayer({
  active = true,
  enabled = true,
  opacity = 1.0,
  placement = INITIAL_WATERFALL_IMPACT_PLACEMENT,
}: WaterfallImpactFoamLayerProps) {
  const reducedMotion = useReducedMotion();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const progress = useSharedValue(0);

  const foamSprite = useImage(WATER_ASSETS.impactFoam);

  const { x: cx, y: cy, width: baseW, height: baseH, rotation } = placement;
  const rad = (rotation * Math.PI) / 180;

  // Base sprite dimensions inside the calibrated impact zone
  const spriteW = baseW * 1.05;
  const spriteH = baseH * 0.72;
  const spriteHalfW = spriteW / 2;
  const spriteHalfH = spriteH / 2;

  const shouldAnimate = enabled && active && foreground && !reducedMotion;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    cancelAnimation(progress);
    if (reducedMotion) {
      progress.value = 0.33;
    } else if (shouldAnimate) {
      progress.value = withRepeat(
        withTiming(1, { duration: FOAM_CYCLE_MS, easing: Easing.linear }),
        -1,
        false
      );
    }
    return () => cancelAnimation(progress);
  }, [progress, reducedMotion, shouldAnimate]);

  // ─── 1. Aerated Water Underlay (soft luminous glow at impact site) ────────
  const underlayOpacity = useDerivedValue(() => {
    'worklet';
    if (reducedMotion) return 0.24 * opacity;
    const shimmer = Math.sin(progress.value * Math.PI * 2);
    return (0.24 + 0.03 * shimmer) * opacity;
  });

  // ─── 2. Core Persistent Foam (anchor directly under falling stream, spatially stable) ───────
  const coreTransform = [
    { translateX: cx },
    { translateY: cy },
    { scale: 0.65 },
    { translateX: -spriteHalfW },
    { translateY: -spriteHalfH },
  ];

  const coreOpacity = useDerivedValue(() => {
    'worklet';
    if (reducedMotion) return 0.74 * opacity;
    const shimmer = Math.sin(progress.value * Math.PI * 2);
    return (0.74 + 0.04 * shimmer) * opacity;
  });

  // ─── 3. Staggered Expanding Lobes (3 instances) ───────────────────────────
  // Instance 0
  const transform0 = useDerivedValue(() => {
    'worklet';
    const p = (progress.value + INSTANCE_CONFIGS[0].phaseOffset) % 1.0;
    const s = (0.58 + 0.62 * Math.sin(p * Math.PI * 0.5)) * INSTANCE_CONFIGS[0].scaleMultiplier;
    const driftX = p * 11;
    const driftY = p * 3;
    return [
      { translateX: cx + driftX + INSTANCE_CONFIGS[0].jitterX },
      { translateY: cy + driftY + INSTANCE_CONFIGS[0].jitterY },
      { scaleX: s * 1.06 },
      { scaleY: s * 0.94 },
      { translateX: -spriteHalfW },
      { translateY: -spriteHalfH },
    ];
  });

  const opacity0 = useDerivedValue(() => {
    'worklet';
    const p = (progress.value + INSTANCE_CONFIGS[0].phaseOffset) % 1.0;
    const fade = p < 0.22 ? p / 0.22 : (1.0 - p) / 0.78;
    return Math.sin(fade * Math.PI * 0.5) * 0.76 * opacity;
  });

  // Instance 1
  const transform1 = useDerivedValue(() => {
    'worklet';
    const p = (progress.value + INSTANCE_CONFIGS[1].phaseOffset) % 1.0;
    const s = (0.58 + 0.62 * Math.sin(p * Math.PI * 0.5)) * INSTANCE_CONFIGS[1].scaleMultiplier;
    const driftX = p * 12;
    const driftY = p * 3.5;
    return [
      { translateX: cx + driftX + INSTANCE_CONFIGS[1].jitterX },
      { translateY: cy + driftY + INSTANCE_CONFIGS[1].jitterY },
      { rotate: (INSTANCE_CONFIGS[1].angleDeg * Math.PI) / 180 },
      { scaleX: s * 1.08 },
      { scaleY: s * 0.92 },
      { translateX: -spriteHalfW },
      { translateY: -spriteHalfH },
    ];
  });

  const opacity1 = useDerivedValue(() => {
    'worklet';
    const p = (progress.value + INSTANCE_CONFIGS[1].phaseOffset) % 1.0;
    const fade = p < 0.22 ? p / 0.22 : (1.0 - p) / 0.78;
    return Math.sin(fade * Math.PI * 0.5) * 0.76 * opacity;
  });

  // Instance 2
  const transform2 = useDerivedValue(() => {
    'worklet';
    const p = (progress.value + INSTANCE_CONFIGS[2].phaseOffset) % 1.0;
    const s = (0.58 + 0.62 * Math.sin(p * Math.PI * 0.5)) * INSTANCE_CONFIGS[2].scaleMultiplier;
    const driftX = p * 10.5;
    const driftY = p * 2.8;
    return [
      { translateX: cx + driftX + INSTANCE_CONFIGS[2].jitterX },
      { translateY: cy + driftY + INSTANCE_CONFIGS[2].jitterY },
      { rotate: (INSTANCE_CONFIGS[2].angleDeg * Math.PI) / 180 },
      { scaleX: s * 1.05 },
      { scaleY: s * 0.95 },
      { translateX: -spriteHalfW },
      { translateY: -spriteHalfH },
    ];
  });

  const opacity2 = useDerivedValue(() => {
    'worklet';
    const p = (progress.value + INSTANCE_CONFIGS[2].phaseOffset) % 1.0;
    const fade = p < 0.22 ? p / 0.22 : (1.0 - p) / 0.78;
    return Math.sin(fade * Math.PI * 0.5) * 0.76 * opacity;
  });

  if (!enabled || !foamSprite) return null;

  return (
    <Group origin={{ x: cx, y: cy }} transform={[{ rotate: rad }]}>
      {/* 1. Soft Aerated Water Underlay */}
      <Oval
        x={cx - baseW * 0.45}
        y={cy - baseH * 0.45}
        width={baseW * 0.9}
        height={baseH * 0.9}
        color="rgba(215, 245, 255, 0.35)"
        opacity={underlayOpacity}
      >
        <Blur blur={7} />
      </Oval>

      {/* 2. Persistent Central Impact Foam Core */}
      <Group transform={coreTransform} opacity={coreOpacity}>
        <Image
          image={foamSprite}
          x={0}
          y={0}
          width={spriteW}
          height={spriteH}
          fit="fill"
        />
      </Group>

      {/* 3. Staggered Expanding Foam Instances (UI thread animated) */}
      <Group transform={transform0} opacity={opacity0}>
        <Image
          image={foamSprite}
          x={0}
          y={0}
          width={spriteW}
          height={spriteH}
          fit="fill"
        />
      </Group>

      <Group transform={transform1} opacity={opacity1}>
        <Image
          image={foamSprite}
          x={0}
          y={0}
          width={spriteW}
          height={spriteH}
          fit="fill"
        />
      </Group>

      <Group transform={transform2} opacity={opacity2}>
        <Image
          image={foamSprite}
          x={0}
          y={0}
          width={spriteW}
          height={spriteH}
          fit="fill"
        />
      </Group>
    </Group>
  );
}

export default memo(WaterfallImpactFoamLayer);
