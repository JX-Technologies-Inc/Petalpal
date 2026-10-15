import type { Transforms3d } from '@shopify/react-native-skia';
import { seeded } from '../flower-density-sandbox/tulip-components/tulipComposition';

/** Stable art-only variation. Apply around the soil root, outside model geometry. */
export function botanicalPresentationPose(id: string) {
  const random = seeded(`botanical-pose:${id}`);
  const seed = random();
  const scale = .94 + random() * .1;
  const rotation = (random() * 4 - 2) * Math.PI / 180;
  const skewX = (random() * 2 - 1) * .018;
  const transform: Transforms3d = [{ scale }, { rotate: rotation }, { skewX }];
  return { seed, transform };
}
