import { Group, Image, useImage } from '@shopify/react-native-skia';
import { useCallback, useEffect, useState } from 'react';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { WATER_ASSETS } from './waterAssets';
import { GARDEN_WORLD_HEIGHT, GARDEN_WORLD_WIDTH } from '../gardenMapLayout';
import LotusLayer, { DEFAULT_LOTUS_PLACEMENTS, type LotusClusterPlacement } from './LotusLayer';

export const BASE_RIPPLE_CYCLE_MS = 6400;
export const BASE_WAKE_CYCLE_MS = 5200;
export const BASE_LOTUS_SWAY_MS = 7000;

export type WaterSpeedMode = 'slow' | 'normal' | 'fast';
export type LotusRenderMode = 'sway' | 'static';

export type WaterScenePreviewProps = {
  width?: number;
  height?: number;
  baseVisible?: boolean;
  baseVariant?: 'old' | 'new';
  baseOnly?: boolean;
  ripplesVisible?: boolean;
  rippleOpacity?: number;
  wakeVisible?: boolean;
  wakeOpacity?: number;
  fishVisible?: boolean;
  fishOpacity?: number;
  lotusVisible?: boolean;
  lotusOpacity?: number;
  lotusMode?: LotusRenderMode;
  lotusPlacements?: readonly LotusClusterPlacement[];
  animationEnabled?: boolean;
  speedMode?: WaterSpeedMode;
  onDebugStatus?: (status: string) => void;
};

function getCyclicWeight(phase: number, index: number, count: number): number {
  'worklet';
  let diff = Math.abs(phase - index);
  if (diff > count / 2) {
    diff = count - diff;
  }
  if (diff >= 1) return 0;
  // Cosine-squared crossfade guarantees weight(d) + weight(1-d) == 1.0 with 0 derivative at ends
  const c = Math.cos(diff * (Math.PI / 2));
  return c * c;
}

export default function WaterScenePreview({
  width = GARDEN_WORLD_WIDTH,
  height = GARDEN_WORLD_HEIGHT,
  baseVisible = true,
  baseVariant = 'new',
  baseOnly = false,
  ripplesVisible = true,
  rippleOpacity = 0.35,
  wakeVisible = false,
  wakeOpacity = 0.9,
  fishVisible = true,
  fishOpacity = 1.0,
  lotusVisible = true,
  lotusOpacity = 1.0,
  lotusMode = 'sway',
  lotusPlacements = DEFAULT_LOTUS_PLACEMENTS,
  animationEnabled = true,
  speedMode = 'normal',
  onDebugStatus,
}: WaterScenePreviewProps) {
  const reducedMotion = useReducedMotion();
  const isPlaying = animationEnabled && !reducedMotion;

  const speedMultiplier = speedMode === 'slow' ? 0.5 : speedMode === 'fast' ? 1.75 : 1.0;

  const [errors, setErrors] = useState<string[]>([]);
  const onError = useCallback((reason: Error) => {
    if (__DEV__) {
      setErrors((prev) => (prev.includes(reason.message) ? prev : [...prev, reason.message]));
    }
  }, []);

  // 1. Base image
  const baseImage = useImage(WATER_ASSETS.base, onError);
  const calmBaseImage = useImage(WATER_ASSETS.calmBase, onError);
  const selectedBaseImage = baseVariant === 'new' ? calmBaseImage : baseImage;

  // Fish overlay (static)
  const fishImage = useImage(WATER_ASSETS.fish, onError);

  // Surface light ripples (4-frame cycle A -> B -> C -> D)
  const rippleImageA = useImage(WATER_ASSETS.ripples[0], onError);
  const rippleImageB = useImage(WATER_ASSETS.ripples[1], onError);
  const rippleImageC = useImage(WATER_ASSETS.ripples[2], onError);
  const rippleImageD = useImage(WATER_ASSETS.ripples[3], onError);
  const rippleImages = [rippleImageA, rippleImageB, rippleImageC, rippleImageD];

  // Waterfall wake overlay (4-frame cycle A -> B -> C -> D)
  const wakeImageA = useImage(WATER_ASSETS.wake[0], onError);
  const wakeImageB = useImage(WATER_ASSETS.wake[1], onError);
  const wakeImageC = useImage(WATER_ASSETS.wake[2], onError);
  const wakeImageD = useImage(WATER_ASSETS.wake[3], onError);
  const wakeImages = [wakeImageA, wakeImageB, wakeImageC, wakeImageD];

  // Animation phase drivers (UI thread worklets)
  const ripplePhase = useSharedValue(0);
  const wakePhase = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(ripplePhase);
    cancelAnimation(wakePhase);

    if (isPlaying) {
      const rippleDuration = BASE_RIPPLE_CYCLE_MS / speedMultiplier;
      const wakeDuration = BASE_WAKE_CYCLE_MS / speedMultiplier;

      ripplePhase.value = withRepeat(
        withTiming(4, { duration: rippleDuration, easing: Easing.linear }),
        -1,
        false
      );

      wakePhase.value = withRepeat(
        withTiming(4, { duration: wakeDuration, easing: Easing.linear }),
        -1,
        false
      );
    }

    return () => {
      cancelAnimation(ripplePhase);
      cancelAnimation(wakePhase);
    };
  }, [isPlaying, speedMultiplier, ripplePhase, wakePhase]);

  // Derived opacities for ripples (smooth continuous cosine-squared crossfade)
  const rippleOpacity0 = useDerivedValue(() =>
    ripplesVisible ? getCyclicWeight(ripplePhase.value, 0, 4) * rippleOpacity : 0
  );
  const rippleOpacity1 = useDerivedValue(() =>
    ripplesVisible ? getCyclicWeight(ripplePhase.value, 1, 4) * rippleOpacity : 0
  );
  const rippleOpacity2 = useDerivedValue(() =>
    ripplesVisible ? getCyclicWeight(ripplePhase.value, 2, 4) * rippleOpacity : 0
  );
  const rippleOpacity3 = useDerivedValue(() =>
    ripplesVisible ? getCyclicWeight(ripplePhase.value, 3, 4) * rippleOpacity : 0
  );
  const rippleOpacities = [rippleOpacity0, rippleOpacity1, rippleOpacity2, rippleOpacity3];

  // Derived opacities for wake overlay (smooth continuous cosine-squared crossfade)
  const wakeOpacity0 = useDerivedValue(() =>
    wakeVisible ? getCyclicWeight(wakePhase.value, 0, 4) * wakeOpacity : 0
  );
  const wakeOpacity1 = useDerivedValue(() =>
    wakeVisible ? getCyclicWeight(wakePhase.value, 1, 4) * wakeOpacity : 0
  );
  const wakeOpacity2 = useDerivedValue(() =>
    wakeVisible ? getCyclicWeight(wakePhase.value, 2, 4) * wakeOpacity : 0
  );
  const wakeOpacity3 = useDerivedValue(() =>
    wakeVisible ? getCyclicWeight(wakePhase.value, 3, 4) * wakeOpacity : 0
  );
  const wakeOpacities = [wakeOpacity0, wakeOpacity1, wakeOpacity2, wakeOpacity3];

  // Status diagnostics
  useEffect(() => {
    if (__DEV__ && onDebugStatus) {
      const allRipplesLoaded = rippleImages.every(Boolean);
      const allWakeLoaded = wakeImages.every(Boolean);
      const baseLoaded = Boolean(baseImage);
      const fishLoaded = Boolean(fishImage);

      const status = [
        `Water Preview: ${isPlaying ? `PLAYING (${speedMode})` : 'PAUSED'}`,
        `Base: ${baseLoaded ? 'loaded' : 'loading...'} | Fish: ${fishLoaded ? 'loaded (static)' : 'loading...'}`,
        `Ripples (4 frames): ${allRipplesLoaded ? 'all decoded' : 'loading...'} (opacity ${Math.round(rippleOpacity * 100)}%)`,
        `Wake (4 frames): ${allWakeLoaded ? 'all decoded' : 'loading...'} (opacity ${Math.round(wakeOpacity * 100)}%)`,
        `Lotus: ${lotusPlacements.length} clusters (${lotusMode} mode)`,
        errors.length > 0 ? `Errors: ${errors.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      onDebugStatus(status);
    }
  }, [
    isPlaying,
    speedMode,
    rippleOpacity,
    wakeOpacity,
    lotusMode,
    lotusPlacements.length,
    baseImage,
    fishImage,
    rippleImages,
    wakeImages,
    errors,
    onDebugStatus,
  ]);

  return (
    <Group>
      {/* 1. Base water layer (foundation) */}
      {(baseVisible || baseOnly) && selectedBaseImage && (
        <Image image={selectedBaseImage} x={0} y={0} width={width} height={height} fit="fill" />
      )}

      <Group opacity={baseOnly ? 0 : 1}>
      {/* 2. Surface light ripples (smooth crossfade cycle A -> B -> C -> D) */}
      {ripplesVisible &&
        rippleImages.map((image, i) =>
          image ? (
            <Image
              key={`ripple-${i}`}
              image={image}
              x={0}
              y={0}
              width={width}
              height={height}
              opacity={rippleOpacities[i]}
              fit="fill"
            />
          ) : null
        )}

      {/* 3. Waterfall wake overlay; disabled by default until localized near the impact zone. */}
      {wakeVisible &&
        wakeImages.map((image, i) =>
          image ? (
            <Image
              key={`wake-${i}`}
              image={image}
              x={0}
              y={0}
              width={width}
              height={height}
              opacity={wakeOpacities[i]}
              fit="fill"
            />
          ) : null
        )}

      {/* 4. Fish overlay (static per requirement) */}
      {fishVisible && fishImage && (
        <Image
          image={fishImage}
          x={0}
          y={0}
          width={width}
          height={height}
          opacity={fishOpacity}
          fit="fill"
        />
      )}

      {/* 5. Lotus flowers (independent placement-driven clusters) */}
      <LotusLayer
        visible={lotusVisible}
        opacity={lotusOpacity}
        mode={lotusMode}
        active={isPlaying}
        placements={lotusPlacements}
      />
      </Group>
    </Group>
  );
}
