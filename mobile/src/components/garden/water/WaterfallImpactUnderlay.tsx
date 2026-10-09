import { Blur, Group, LinearGradient, Path } from '@shopify/react-native-skia';
import { memo, useEffect } from 'react';
import { INITIAL_WATERFALL_IMPACT_PLACEMENT, type WaterfallImpactPlacement } from '../waterfallImpactPlacement';
export type WaterfallImpactUnderlayProps = {
  active?: boolean; enabled?: boolean; opacity?: number; strength?: number; placement?: WaterfallImpactPlacement;
  onRuntimeStrength?: (strength: number) => void;
};
function WaterfallImpactUnderlay({ enabled=true, opacity=1, strength=1.0, placement=INITIAL_WATERFALL_IMPACT_PLACEMENT, onRuntimeStrength }: WaterfallImpactUnderlayProps) {
  useEffect(() => {
    if (__DEV__) {
      onRuntimeStrength?.(strength);
      console.log(`[WaterfallImpactUnderlay] Runtime strength received: ${strength}x`);
    }
  }, [strength, onRuntimeStrength]);

  if (!enabled || strength === 0) return null;
  // Strength scales paint alpha: 1.0 = NORMAL, 1.5 = STRONG, 0 = OFF
  const alpha = (reviewAlpha: number) => Math.min(1, reviewAlpha * strength);

  return (
    <Group
      opacity={opacity}
      transform={[
        { translateX: placement.x },
        { translateY: placement.y },
        { rotate: (placement.rotation * Math.PI) / 180 },
        { scaleX: placement.width / 110 },
        { scaleY: placement.height / 57 },
      ]}
    >
      {/* 1. Deep turbulent water base / veil wrapping around sides & below the foam (blur 1.8) */}
      <Path
        path="M -52 -2 C -54 10 -45 22 -38 27 C -22 35 2 37 25 35 C 50 33 75 35 90 25 C 98 20 92 10 74 6 C 52 2 32 -4 14 -2 C -2 -4 -25 -10 -40 -8 Z"
        opacity={alpha(0.55)}
      >
        <LinearGradient
          start={{ x: 0, y: 5 }}
          end={{ x: 85, y: 30 }}
          colors={['#3E8792', '#4FA7B2', '#6BBFC8', 'rgba(132,209,216,0.3)', 'rgba(157,222,227,0)']}
          positions={[0, 0.28, 0.58, 0.82, 1.0]}
        />
        <Blur blur={1.8} />
      </Path>

      {/* 2. Deeper turbulent undertone crescent hugging the lower contact edge (blur 1.0) */}
      <Path
        path="M -34 12 C -20 22 5 25 28 17 C 20 25 -5 28 -28 22 Z"
        color="#3E8792"
        opacity={alpha(0.48)}
      >
        <Blur blur={1.0} />
      </Path>

      {/* 3. Mid disturbed water strokes framing the exposed foam edge (blur 0.7 - 0.8) */}
      {/* Left-flank churn curl */}
      <Path
        path="M -44 4 C -36 12 -28 18 -14 22"
        color="#4FA7B2"
        style="stroke"
        strokeWidth={3.4}
        strokeCap="round"
        opacity={alpha(0.50)}
      >
        <Blur blur={0.8} />
      </Path>

      {/* Main under-foam surge */}
      <Path
        path="M -24 22 C -6 29 16 28 36 21"
        color="#4FA7B2"
        style="stroke"
        strokeWidth={3.6}
        strokeCap="round"
        opacity={alpha(0.52)}
      >
        <Blur blur={0.8} />
      </Path>

      {/* Forward turbulent lip */}
      <Path
        path="M -12 30 C 6 34 22 32 38 27"
        color="#6BBFC8"
        style="stroke"
        strokeWidth={2.6}
        strokeCap="round"
        opacity={alpha(0.44)}
      >
        <Blur blur={0.7} />
      </Path>

      {/* Right downstream surge */}
      <Path
        path="M 22 10 C 34 14 48 18 60 16"
        color="#6BBFC8"
        style="stroke"
        strokeWidth={3.0}
        strokeCap="round"
        opacity={alpha(0.46)}
      >
        <Blur blur={0.75} />
      </Path>

      {/* 4. Broken downstream wake fragments (blur 0.35 - 0.45) */}
      {/* Fragment 1: near wake arc + offset tick */}
      <Path
        path="M 36 18 C 44 24 54 26 64 22"
        color="#84D1D8"
        style="stroke"
        strokeWidth={2.8}
        strokeCap="round"
        opacity={alpha(0.46)}
      >
        <Blur blur={0.45} />
      </Path>
      <Path
        path="M 44 30 C 52 32 58 30 65 27"
        color="#6BBFC8"
        style="stroke"
        strokeWidth={2.2}
        strokeCap="round"
        opacity={alpha(0.38)}
      >
        <Blur blur={0.45} />
      </Path>

      {/* Fragment 2: mid wake wave + lower tick */}
      <Path
        path="M 58 17 C 68 21 78 26 84 22"
        color="#84D1D8"
        style="stroke"
        strokeWidth={2.4}
        strokeCap="round"
        opacity={alpha(0.40)}
      >
        <Blur blur={0.4} />
      </Path>
      <Path
        path="M 66 31 C 74 32 82 29 88 26"
        color="#9DDEE3"
        style="stroke"
        strokeWidth={2.0}
        strokeCap="round"
        opacity={alpha(0.34)}
      >
        <Blur blur={0.4} />
      </Path>

      {/* Fragment 3: outer wake crest */}
      <Path
        path="M 76 19 C 84 23 92 25 98 21"
        color="#9DDEE3"
        style="stroke"
        strokeWidth={2.0}
        strokeCap="round"
        opacity={alpha(0.32)}
      >
        <Blur blur={0.35} />
      </Path>

      {/* Fragment 4: trailing dissipation filament */}
      <Path
        path="M 90 27 C 96 29 102 28 106 25"
        color="#9DDEE3"
        style="stroke"
        strokeWidth={1.6}
        strokeCap="round"
        opacity={alpha(0.24)}
      >
        <Blur blur={0.35} />
      </Path>
    </Group>
  );
}
export default memo(WaterfallImpactUnderlay);
