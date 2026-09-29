import { Group, Image, Mask, Rect, Shader, Skia, useImage } from '@shopify/react-native-skia';
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

import { GARDEN_WORLD_HEIGHT, GARDEN_WORLD_WIDTH } from '../gardenMapLayout';
import { WATER_ASSETS } from './waterAssets';

export const SURFACE_RIPPLE_CYCLE_MS = 6400;
const EDGE = Skia.RuntimeEffect.Make(`
uniform float2 size;
half4 main(float2 p){float a=smoothstep(0.0,90.0,p.x)*smoothstep(0.0,90.0,p.y)*
smoothstep(0.0,90.0,size.x-p.x)*smoothstep(0.0,90.0,size.y-p.y);return half4(a);}
`);

type SurfaceRippleLayerProps = {
  active: boolean;
  enabled?: boolean;
  opacity?: number;
  width?: number;
  height?: number;
  softWorldEdges?: boolean;
};

function cyclicWeight(phase: number, index: number, count: number): number {
  'worklet';
  let distance = Math.abs(phase - index);
  if (distance > count / 2) distance = count - distance;
  if (distance >= 1) return 0;
  const cosine = Math.cos(distance * Math.PI / 2);
  return cosine * cosine;
}

function SurfaceRippleLayer({
  active,
  enabled = true,
  opacity = 0.35,
  width = GARDEN_WORLD_WIDTH,
  height = GARDEN_WORLD_HEIGHT,
  softWorldEdges = false,
}: SurfaceRippleLayerProps) {
  const reducedMotion = useReducedMotion();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const phase = useSharedValue(0);
  const frameA = useImage(WATER_ASSETS.ripples[0]);
  const frameB = useImage(WATER_ASSETS.ripples[1]);
  const frameC = useImage(WATER_ASSETS.ripples[2]);
  const frameD = useImage(WATER_ASSETS.ripples[3]);
  const frames = [frameA, frameB, frameC, frameD] as const;
  const shouldAnimate = enabled && active && foreground && !reducedMotion;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    cancelAnimation(phase);
    if (reducedMotion) phase.value = 0;
    if (shouldAnimate) {
      phase.value = withRepeat(
        withTiming(4, { duration: SURFACE_RIPPLE_CYCLE_MS, easing: Easing.linear }),
        -1,
        false,
      );
    }
    return () => cancelAnimation(phase);
  }, [phase, reducedMotion, shouldAnimate]);

  const opacityA = useDerivedValue(() => cyclicWeight(phase.value, 0, 4) * opacity);
  const opacityB = useDerivedValue(() => cyclicWeight(phase.value, 1, 4) * opacity);
  const opacityC = useDerivedValue(() => cyclicWeight(phase.value, 2, 4) * opacity);
  const opacityD = useDerivedValue(() => cyclicWeight(phase.value, 3, 4) * opacity);
  const opacities = [opacityA, opacityB, opacityC, opacityD] as const;

  if (!enabled) return null;

  const layers = (
    <Group>
      {frames.map((image, index) => image ? (
        <Image key={index} image={image} x={0} y={0} width={width} height={height}
          opacity={opacities[index]} fit="fill" />
      ) : null)}
    </Group>
  );
  return softWorldEdges && EDGE ? <Mask mode="alpha" mask={
    <Rect x={0} y={0} width={width} height={height}>
      <Shader source={EDGE} uniforms={{size:[width,height]}} />
    </Rect>
  }>{layers}</Mask> : layers;
}

export default memo(SurfaceRippleLayer);
