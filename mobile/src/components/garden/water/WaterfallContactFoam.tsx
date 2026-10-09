import { Blur, Group, Image, Path, useImage } from '@shopify/react-native-skia';
import { memo, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { cancelAnimation, Easing, useDerivedValue, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { INITIAL_WATERFALL_IMPACT_PLACEMENT, type WaterfallImpactPlacement } from '../waterfallImpactPlacement';
import { WATER_ASSETS } from './waterAssets';
export const RIPPLE_CYCLE_MS = 2800;
const CONTACT_MOTION_ENABLED = true;
export type WaterfallContactFoamProps = {
  active?: boolean; enabled?: boolean; opacity?: number; placement?: WaterfallImpactPlacement;
};
const PATCHES = [
  { path: 'M -14 -5 Q -10 -11 -4 -8 L 1 -10 Q 9 -7 10 -1 L 15 3 10 8 7 7 5 14 0 17 -4 12 -9 14 -11 7 -15 4 Z', alpha: .84 },
  { path: 'M -30 -1 L -26 -4 -23 -2 -21 2 -25 5 -29 3 Z', alpha: .38 },
  { path: 'M 22 2 L 27 0 30 3 27 7 23 6 20 8 Z', alpha: .34 },
  { path: 'M -12 11 L -6 8 0 12 -3 16 -10 15 Z', alpha: .32 },
  { path: 'M 9 10 L 16 7 21 11 18 15 12 14 Z', alpha: .29 },
] as const;

const RIPPLE_PHASES = [0.0, 0.33, 0.67] as const;

function ExpandingRipple({
  clock,
  phase,
  opacity,
}: {
  clock: SharedValue<number>;
  phase: number;
  opacity: number;
}) {
  const transform = useDerivedValue(() => {
    const p = (clock.value + phase) % 1;
    // Ease-out expansion: starts at ~0.28 (snug to contact foot) and expands outward to ~1.10
    const s = 0.28 + 0.82 * (p * (2 - p));
    // Downstream expansion at lower water impact position
    const tx = 5 * p;
    const ty = 4 + 7 * p;
    return [
      { translateX: tx },
      { translateY: ty },
      { scaleX: s },
      { scaleY: s * 0.82 },
    ];
  });

  // General soft fade: smooth Hermite entrance, gradual decay to 0
  const fadeGeneral = useDerivedValue(() => {
    const p = (clock.value + phase) % 1;
    const enter = Math.min(1, p / 0.12);
    const decay = (1 - p) ** 1.5;
    return enter * enter * (3 - 2 * enter) * decay * 0.65 * opacity;
  });

  // Dense white foam crest: concentrated on the inner ring, thins out by p ~ 0.52
  const fadeInnerFoam = useDerivedValue(() => {
    const p = (clock.value + phase) % 1;
    const enter = Math.min(1, p / 0.10);
    const innerDecay = Math.max(0, 1 - p / 0.52) ** 1.4;
    return enter * enter * (3 - 2 * enter) * innerDecay * 0.78 * opacity;
  });

  // Outer airy traces that persist farther out
  const fadeOuterFoam = useDerivedValue(() => {
    const p = (clock.value + phase) % 1;
    const enter = Math.min(1, p / 0.14);
    const decay = (1 - p) ** 1.8;
    return enter * decay * 0.45 * opacity;
  });

  // Dynamic stroke widths for the broken feathered tendrils (thins as it expands)
  const swCrest = useDerivedValue(() => {
    const p = (clock.value + phase) % 1;
    const s = 0.28 + 0.82 * (p * (2 - p));
    return (2.2 - 1.1 * p) / s;
  });

  const swFilament = useDerivedValue(() => {
    const p = (clock.value + phase) % 1;
    const s = 0.28 + 0.82 * (p * (2 - p));
    return (1.4 - 0.7 * p) / s;
  });

  return (
    <Group transform={transform}>
      {/* 1. Soft Aerated Water-Foam Wash (#DDF3F5 / #9DDEE3, blur 1.1 - eliminates hard wire outline) */}
      <Group opacity={fadeGeneral}>
        <Path
          path="M -26 6 C -22 17 -10 26 8 28 C 24 29 40 22 50 12 C 42 18 26 23 8 22 C -8 20 -20 13 -26 6 Z"
          color="#DDF3F5"
          opacity={0.4}
        >
          <Blur blur={1.1} />
        </Path>
        <Path
          path="M 16 24 C 26 26 38 23 48 17 C 56 12 60 8 62 6 C 54 11 42 17 30 20 C 22 22 16 24 16 24 Z"
          color="#9DDEE3"
          opacity={0.3}
        >
          <Blur blur={1.0} />
        </Path>
      </Group>

      {/* 2. Tapered Broken Frothy Foam Tufts (#EAF7F8 / #DDF3F5, blur 0.55 - variable thickness, feathered) */}
      <Group opacity={fadeGeneral}>
        {/* Forward frothy foam crest tuft (tapered, variable thickness) */}
        <Path
          path="M -24 8 C -18 18 -8 25 4 27 C 16 28 28 25 38 19 C 28 23 16 24 4 23 C -6 22 -16 16 -24 8 Z"
          color="#EAF7F8"
          opacity={0.7}
        >
          <Blur blur={0.55} />
        </Path>

        {/* Downstream branching foam arm (feathered tendril) */}
        <Path
          path="M 18 24 C 28 26 38 23 48 18 C 54 14 58 10 60 7 C 52 12 42 16 32 19 C 24 21 18 24 18 24 Z"
          color="#EAF7F8"
          opacity={0.65}
        >
          <Blur blur={0.5} />
        </Path>

        {/* Left flank broken foam spray */}
        <Path
          path="M -28 9 C -24 16 -17 21 -10 23 C -16 19 -22 14 -28 9 Z"
          color="#DDF3F5"
          opacity={0.6}
        >
          <Blur blur={0.5} />
        </Path>
      </Group>

      {/* 3. High-Density White Bubbly Crest (Inner foam, fades by p ~ 0.52, #F2FBFB / #FFFFFF) */}
      <Group opacity={fadeInnerFoam}>
        {/* Broken, feathered frothy highlight arcs */}
        <Path
          path="M -20 12 C -15 19 -6 25 6 26 C 16 27 26 24 34 19"
          color="#F2FBFB"
          style="stroke"
          strokeWidth={swCrest}
          strokeCap="round"
        >
          <Blur blur={0.35} />
        </Path>
        {/* Overlapping secondary break */}
        <Path
          path="M -8 24 C 2 27 14 27 24 23 C 32 20 38 16 44 12"
          color="#FFFFFF"
          style="stroke"
          strokeWidth={swFilament}
          strokeCap="round"
          opacity={0.85}
        >
          <Blur blur={0.25} />
        </Path>
        {/* Fine frothy dabs & bubbly flecks clustered along the crest */}
        <Path
          path="M -18 15 L -16 16 M -12 20 L -10 21 M -4 24 L -2 25 M 3 26 L 6 27 M 11 26 L 14 26 M 19 24 L 22 23 M 27 22 L 30 20 M 35 18 L 38 16 M 43 14 L 45 12"
          color="#FFFFFF"
          style="stroke"
          strokeWidth={swFilament}
          strokeCap="round"
        >
          <Blur blur={0.25} />
        </Path>
      </Group>

      {/* 4. Outer Airy Trailing Flecks & Wisps (#DDF3F5 / #9DDEE3, blur 0.35) */}
      <Group opacity={fadeOuterFoam}>
        {/* Broken airy wisps that feather and dissolve into the outer pond */}
        <Path
          path="M -16 23 L -13 24 M 8 28 L 12 28 M 30 25 L 34 24 M 44 20 L 47 18"
          color="#DDF3F5"
          style="stroke"
          strokeWidth={swFilament}
          strokeCap="round"
        >
          <Blur blur={0.35} />
        </Path>
        {/* Soft outer filament wisp */}
        <Path
          path="M 22 25 C 32 26 42 22 50 17"
          color="#9DDEE3"
          style="stroke"
          strokeWidth={swFilament}
          strokeCap="round"
          opacity={0.5}
        >
          <Blur blur={0.4} />
        </Path>
      </Group>
    </Group>
  );
}

function WaterfallContactFoam({ active=true, enabled=true, opacity=1, placement=INITIAL_WATERFALL_IMPACT_PLACEMENT }: WaterfallContactFoamProps) {
  const reduced = useReducedMotion();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const clock = useSharedValue(0.2);
  const sprite = useImage(WATER_ASSETS.impactFoam);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    cancelAnimation(clock);
    if (!CONTACT_MOTION_ENABLED) {
      clock.value = 0.2;
      return;
    }
    if (enabled && active && foreground && !reduced) {
      clock.value = 0;
      clock.value = withRepeat(
        withTiming(1, { duration: RIPPLE_CYCLE_MS, easing: Easing.linear }),
        -1,
        false
      );
    }
    return () => cancelAnimation(clock);
  }, [active, enabled, foreground, reduced, clock]);
  if (!enabled || !sprite) return null;
  return <Group transform={[{translateX:placement.x},{translateY:placement.y},{rotate:placement.rotation*Math.PI/180},{scaleX:placement.width/110},{scaleY:placement.height/57}]}>
    {/* Broken narrow water glaze touches only the bottom contact edge. */}
    <Path path="M -40 -3 Q -30 -7 -22 -3 L -12 -5 2 -2 12 -5 29 -2 38 1 28 5 15 3 4 7 -10 3 -25 5 Z" color="#6BBFC8" opacity={.34*opacity}><Blur blur={1.3}/></Path>
    <Path path="M -33 2 Q -27 0 -23 2 M 17 3 Q 23 1 29 3" color="#84D1D8" style="stroke" strokeWidth={1.3} opacity={.36*opacity}><Blur blur={.6}/></Path>
    {/* Small textured forward tongue covers only the exposed stream end. */}
    <Group clip="M -6 7 Q 0 4 6 8 L 9 13 5 17 1 16 -2 19 -7 15 -8 11 Z" opacity={.88*opacity}>
      <Image image={sprite} x={-15} y={5} width={30} height={17} fit="fill"/>
    </Group>
    <Path path="M -35 4 L -33 2 -30 4 -32 6 Z M 32 5 L 35 3 37 5 35 7 Z" color="#9DDEE3" opacity={.36*opacity}/>
    {/* Persistent disconnected texture patches: stable impact foam core. */}
    {PATCHES.map((patch, i) => <Group key={i} clip={patch.path} opacity={patch.alpha*opacity}>
      <Image image={sprite} x={-43} y={-12} width={86} height={33} fit="fill"/>
    </Group>)}
    {/* Expanding water ripples: originates directly under waterfall base to cover tail, then spreads outward */}
    {RIPPLE_PHASES.map((phase, i) => (
      <ExpandingRipple key={`ripple-${i}`} clock={clock} phase={phase} opacity={opacity} />
    ))}
  </Group>;
}
export default memo(WaterfallContactFoam);
