import { Group, Image, useImage } from '@shopify/react-native-skia';
import { GARDEN_WORLD_HEIGHT, GARDEN_WORLD_WIDTH } from './gardenMapLayout';

// Each PNG is transparent and already aligned to the complete Garden world.
// The unchanged entrance road is drawn by GardenConnectionLayer before this group.
const sources = [
  require('@/assets/garden/infrastructure/SS01_stepping_stones.png'),
  require('@/assets/garden/infrastructure/seams/Road_west_seamed.png'),
  require('@/assets/garden/infrastructure/final/B02_bridge.png'),
  require('@/assets/garden/infrastructure/final/B01_bridge.png'),
  require('@/assets/garden/infrastructure/b02-land06-connection/b02-foreground-local-opening.png'),
  require('@/assets/garden/infrastructure/seams/B01_land08_occlusion.png'),
  require('@/assets/garden/infrastructure/final/ST01_approved.png'),
  require('@/assets/garden/infrastructure/seams/ST01_feet_occlusion.png'),
  require('@/assets/garden/infrastructure/seams/Road_entrance09_seamed.png'),
  require('@/assets/garden/infrastructure/seams/Road_other_seamed.png'),
  require('@/assets/garden/infrastructure/seams/B01_entrance_underlay.png'),
  require('@/assets/garden/infrastructure/seams/B01_entrance_foreground.png'),
  require('@/assets/garden/infrastructure/entrance-connections/land09-transition.png'),
  require('@/assets/garden/infrastructure/entrance-connections/b01-foot-landing.png'),
  require('@/assets/garden/infrastructure/land09-interface-v2/land09-interface-foreground.png'),
  require('@/assets/garden/infrastructure/b02-land06-connection/land06-approach.png'),
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
  const land09Transition = useImage(sources[12]);
  const b01FootLanding = useImage(sources[13]);
  const land09InterfaceForeground = useImage(sources[14]);
  const land06Approach = useImage(sources[15]);
  // The connected B01 paving replaces the two legacy foot patches. Draw the
  // unchanged bridge above it; GardenScene draws the entrance arch afterward.
  const images = [road, groundJunctions, roadForeground, stones, land06Approach, b02, st01,
    b02Foreground, st01Foreground, land09Transition, land09InterfaceForeground, b01FootLanding, b01, b01Foreground];

  return <Group>
    {images.map((image, index) => image && <Image key={index} image={image} x={0} y={0}
      width={GARDEN_WORLD_WIDTH} height={GARDEN_WORLD_HEIGHT} fit="fill" />)}
  </Group>;
}
