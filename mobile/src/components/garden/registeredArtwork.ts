import { Platform } from 'react-native';
import { GARDEN_WORLD_HEIGHT, GARDEN_WORLD_WIDTH } from './gardenMapLayout';

// Web copies trim only transparent padding. Preserve original source pixels and
// world registration; native platforms keep the original full-resolution image
// and clip its transparent padding using the same verified registration bounds.
export function registeredArtwork(original: number, web: number, x: number, y: number, width: number, height: number) {
  if (Platform.OS !== 'web') return { source: original, x: 0, y: 0, width: GARDEN_WORLD_WIDTH, height: GARDEN_WORLD_HEIGHT,
    clip: { x: x * GARDEN_WORLD_WIDTH / 2400, y: y * GARDEN_WORLD_HEIGHT / 1800,
      width: width * GARDEN_WORLD_WIDTH / 2400, height: height * GARDEN_WORLD_HEIGHT / 1800 } };
  return { source: web, x: x * GARDEN_WORLD_WIDTH / 2400, y: y * GARDEN_WORLD_HEIGHT / 1800,
    width: width * GARDEN_WORLD_WIDTH / 2400, height: height * GARDEN_WORLD_HEIGHT / 1800 };
}
