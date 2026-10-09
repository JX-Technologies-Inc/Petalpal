import { Group, Image, useImage } from '@shopify/react-native-skia';
import placements from '@/assets/garden/environment/layers.json';

// Seven static, cropped Land overlays; reusable sprite instances are baked once
// offline. No per-plant React nodes, animation timers, or frame-time placement.
const sources = [
  require('@/assets/garden/environment/layers/land_central_environment.png'),
  require('@/assets/garden/environment/layers/land_101112_environment.png'),
  require('@/assets/garden/environment/layers/land_0405_environment.png'),
  require('@/assets/garden/environment/layers/land_06_environment.png'),
  require('@/assets/garden/environment/layers/land_07_environment.png'),
  require('@/assets/garden/environment/layers/land_08_environment.png'),
  require('@/assets/garden/environment/layers/land_09_environment.png'),
] as const;

function EnvironmentRegion({ index }: { index: number }) {
  const image = useImage(sources[index]);
  const placement = placements[index];
  return image ? <Image image={image} x={placement.x} y={placement.y}
    width={placement.width} height={placement.height} fit="fill" /> : null;
}

export default function GardenEnvironmentLayer() {
  return <Group>{sources.map((_, index) => <EnvironmentRegion key={index} index={index} />)}</Group>;
}
