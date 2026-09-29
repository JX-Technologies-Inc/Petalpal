import { Group, Image, useImage } from '@shopify/react-native-skia';
import { GARDEN_WORLD_HEIGHT, GARDEN_WORLD_WIDTH } from './gardenMapLayout';

// Each PNG is transparent and already aligned to the complete Garden world.
// The unchanged entrance road is drawn by GardenConnectionLayer before this group.
const sources = [
  require('@/assets/garden/infrastructure/SS01_stepping_stones.png'),
  require('@/assets/garden/infrastructure/seams/Road_west_seamed.png'),
  require('@/assets/garden/infrastructure/final/B02_bridge.png'),
  require('@/assets/garden/infrastructure/final/B01_bridge.png'),
  require('@/assets/garden/infrastructure/seams/B02_feet_occlusion.png'),
  require('@/assets/garden/infrastructure/seams/B01_land08_occlusion.png'),
  require('@/assets/garden/infrastructure/final/ST01_approved.png'),
  require('@/assets/garden/infrastructure/seams/ST01_feet_occlusion.png'),
  require('@/assets/garden/infrastructure/seams/Road_entrance09_seamed.png'),
  require('@/assets/garden/infrastructure/seams/Road_other_seamed.png'),
  require('@/assets/garden/infrastructure/seams/B01_entrance_underlay.png'),
  require('@/assets/garden/infrastructure/seams/B01_entrance_foreground.png'),
  require('@/assets/garden/infrastructure/entrance-connections/land09-transition.png'),
  require('@/assets/garden/infrastructure/entrance-connections/b01-foot-landing.png'),
] as const;

export default function GardenInfrastructureLayer() {
  const stones = useImage(sources[0]);
  const road = useImage(sources[1]);
  const b02 = useImage(sources[2]);
  const b01 = useImage(sources[3]);
  const b02Foreground = useImage(sources[4]);
  const b01Foreground = useImage(sources[5]);
  const st01 = useImage(sources[6]);
  const st01Foreground = useImage(sources[7]);
  const roadForeground = useImage(sources[8]);
  const groundJunctions = useImage(sources[9]);
  const entranceUnderlay = useImage(sources[10]);
  const entranceForeground = useImage(sources[11]);
  const land09Transition = useImage(sources[12]);
  const b01FootLanding = useImage(sources[13]);
  const images = [road, groundJunctions, roadForeground, entranceUnderlay, stones, b02, b01, st01,
    b02Foreground, b01Foreground, entranceForeground, st01Foreground, land09Transition, b01FootLanding];

  return <Group>
    {images.map((image, index) => image && <Image key={index} image={image} x={0} y={0}
      width={GARDEN_WORLD_WIDTH} height={GARDEN_WORLD_HEIGHT} fit="fill" />)}
  </Group>;
}
