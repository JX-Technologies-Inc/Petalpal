import { BlurMask, Group, LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue, type SharedValue } from 'react-native-reanimated';
import {
  FLOATING_PETALS, PETAL_FOLDS, PETAL_PATHS, PETAL_WATERFALL_EXCLUSION,
  getPetalPose, petalWorldLength, type FloatingPetal,
} from './floatingPetalConfig';

const SHAPES = PETAL_PATHS.map(path => Skia.Path.MakeFromSVGString(path)!);
const FOLDS = PETAL_FOLDS.map(path => Skia.Path.MakeFromSVGString(path)!);
const WATER_LIGHT = Skia.Path.MakeFromSVGString('M -3.8 2.1 Q -0.5 3.2 2.3 2.4')!;
const WATERFALL_CLIP = Skia.Path.Rect(PETAL_WATERFALL_EXCLUSION);

type PetalFlow = { seconds: SharedValue<number>; enabled: boolean };
type ImpactPlacement = { x: number; y: number; width: number; height: number; rotation: number };
type FloatingPetalLayerProps = {
  active?: boolean;
  fit?: number;
  flow?: PetalFlow;
  impactPlacement?: ImpactPlacement;
};

const Petal = memo(function Petal({ petal, seconds, enabled, fit }: {
  petal: FloatingPetal; seconds: SharedValue<number>; enabled: boolean; fit: number;
}) {
  const scale = petalWorldLength(petal.lengthPx, fit) / 14;
  const transform = useDerivedValue(() => {
    const pose = getPetalPose(petal, enabled ? seconds.value : 0);
    return [{ translateX: pose.x }, { translateY: pose.y }, { rotate: pose.rotation },
      { scale }, { scaleY: petal.widthScale }];
  }, [petal, seconds, enabled, scale]);
  const lightOpacity = useDerivedValue(() => {
    const t = enabled ? seconds.value : 0;
    return 0.075 + Math.sin(t * 0.38 + petal.x * 0.014 + petal.y * 0.006) * 0.022;
  }, [petal, seconds, enabled]);
  return <Group transform={transform} opacity={petal.opacity}>
    {/* Flush, diffuse water contact: no detached drop shadow or raised edge. */}
    {petal.contact && <Path path={SHAPES[petal.shape]} color="#527F79" opacity={0.065}>
      <BlurMask blur={0.75} style="normal" respectCTM />
    </Path>}
    {/* Feather only the translucent pigment fringe. Keeping a separate readable
        center avoids a tiny blurred silhouette disappearing at normal fit. */}
    <Path path={SHAPES[petal.shape]} color={petal.pigment[1]} opacity={0.15}>
      <BlurMask blur={petal.softness + 0.45} style="normal" respectCTM />
    </Path>
    <Path path={SHAPES[petal.shape]} opacity={petal.softness > 0.3 ? 0.82 : 1}>
      <LinearGradient start={vec(-0.6, -3.1)} end={vec(1.5, 3)}
        colors={petal.pigment} positions={[0, 0.3, 0.65, 1]} />
    </Path>
    {petal.shape >= 4 && <Path path={FOLDS[petal.shape]} style="stroke" strokeWidth={0.48}
      strokeCap="round" color="#FAEBD6" opacity={0.21}>
      <BlurMask blur={0.35} style="normal" respectCTM />
    </Path>}
    {/* Only a few tips catch a faint, changing trace of the surrounding water. */}
    {petal.glint && <Path path={WATER_LIGHT} style="stroke" strokeWidth={0.55}
      strokeCap="round" color="#D4E9DB" opacity={lightOpacity}>
      <BlurMask blur={0.6} style="normal" respectCTM />
    </Path>}
  </Group>;
});

function PetalSurface({ flow, fit = 0.4, impactPlacement }: FloatingPetalLayerProps & { flow: PetalFlow }) {
  const impactClip = useMemo(() => {
    // Circumscribe the rotated impact with generous splash clearance. This only
    // clips petals and follows DEV impact calibration without touching the falls.
    const impact = impactPlacement ?? { x: 1040, y: 250, width: 110, height: 57, rotation: 2.25 };
    const radius = Math.hypot(impact.width, impact.height) / 2 + 100;
    return Skia.Path.Circle(impact.x, impact.y, radius);
  }, [impactPlacement]);
  return <Group clip={WATERFALL_CLIP} invertClip>
    <Group clip={impactClip} invertClip>
      {FLOATING_PETALS.map(petal => <Petal key={petal.id} petal={petal}
        seconds={flow.seconds} enabled={flow.enabled} fit={fit} />)}
    </Group>
  </Group>;
}

function StandalonePetals({ active = true, ...props }: FloatingPetalLayerProps) {
  const seconds = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  const frame = useFrameCallback(info => {
    seconds.value += Math.min(info.timeSincePreviousFrame ?? 0, 64) / 1000;
  }, false);
  useEffect(() => {
    frame.setActive(active && foreground && !reducedMotion);
    return () => frame.setActive(false);
  }, [active, foreground, reducedMotion, frame]);
  return <PetalSurface {...props} flow={{ seconds, enabled: !reducedMotion }} />;
}

function FloatingPetalLayer(props: FloatingPetalLayerProps) {
  return props.flow ? <PetalSurface {...props} flow={props.flow} /> : <StandalonePetals {...props} />;
}
export default memo(FloatingPetalLayer);
