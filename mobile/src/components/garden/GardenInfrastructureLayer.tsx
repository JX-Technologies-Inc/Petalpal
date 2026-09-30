import { Group, Image, useImage } from '@shopify/react-native-skia';
import { registeredArtwork } from './registeredArtwork';

// Web copies retain the complete-world registration of each original PNG.
// The unchanged entrance road is drawn by GardenConnectionLayer before this group.
const sources = [
  registeredArtwork(require('@/assets/garden/infrastructure/SS01_stepping_stones.png'),
    require('@/assets/garden/runtime/infrastructure/SS01_stepping_stones.png'), 2060, 878, 151, 205),
  registeredArtwork(require('@/assets/garden/infrastructure/seams/Road_west_seamed.png'),
    require('@/assets/garden/runtime/infrastructure/seams/Road_west_seamed.png'), 651, 561, 367, 555),
  registeredArtwork(require('@/assets/garden/infrastructure/final/B02_bridge.png'),
    require('@/assets/garden/runtime/infrastructure/final/B02_bridge.png'), 1526, 458, 306, 208),
  registeredArtwork(require('@/assets/garden/infrastructure/final/B01_bridge.png'),
    require('@/assets/garden/runtime/infrastructure/final/B01_bridge.png'), 1571, 1236, 317, 263),
  registeredArtwork(require('@/assets/garden/infrastructure/b02-land06-connection/b02-foreground-local-opening.png'),
    require('@/assets/garden/runtime/infrastructure/b02-land06-connection/b02-foreground-local-opening.png'), 1499, 476, 363, 202),
  registeredArtwork(require('@/assets/garden/infrastructure/seams/B01_land08_occlusion.png'),
    require('@/assets/garden/runtime/infrastructure/seams/B01_land08_occlusion.png'), 1767, 1247, 127, 127),
  registeredArtwork(require('@/assets/garden/infrastructure/final/ST01_approved.png'),
    require('@/assets/garden/runtime/infrastructure/final/ST01_approved.png'), 1401, 758, 506, 377),
  registeredArtwork(require('@/assets/garden/infrastructure/seams/ST01_feet_occlusion.png'),
    require('@/assets/garden/runtime/infrastructure/seams/ST01_feet_occlusion.png'), 1361, 731, 609, 429),
  registeredArtwork(require('@/assets/garden/infrastructure/seams/Road_entrance09_seamed.png'),
    require('@/assets/garden/runtime/infrastructure/seams/Road_entrance09_seamed.png'), 1295, 1357, 190, 175),
  registeredArtwork(require('@/assets/garden/infrastructure/seams/Road_other_seamed.png'),
    require('@/assets/garden/runtime/infrastructure/seams/Road_other_seamed.png'), 1047, 305, 571, 826),
  require('@/assets/garden/infrastructure/seams/B01_entrance_underlay.png'),
  require('@/assets/garden/infrastructure/seams/B01_entrance_foreground.png'),
  registeredArtwork(require('@/assets/garden/infrastructure/entrance-connections/land09-transition.png'),
    require('@/assets/garden/runtime/infrastructure/entrance-connections/land09-transition.png'), 1339, 1389, 166, 145),
  registeredArtwork(require('@/assets/garden/infrastructure/entrance-connections/b01-foot-landing.png'),
    require('@/assets/garden/runtime/infrastructure/entrance-connections/b01-foot-landing.png'), 1564, 1404, 115, 160),
  registeredArtwork(require('@/assets/garden/infrastructure/land09-interface-v2/land09-interface-foreground.png'),
    require('@/assets/garden/runtime/infrastructure/land09-interface-v2/land09-interface-foreground.png'), 1317, 1358, 191, 181),
  registeredArtwork(require('@/assets/garden/infrastructure/b02-land06-connection/land06-approach.png'),
    require('@/assets/garden/runtime/infrastructure/b02-land06-connection/land06-approach.png'), 1735, 477, 131, 107),
] as const;

export default function GardenInfrastructureLayer() {
  const stones = useImage(sources[0].source);
  const road = useImage(sources[1].source);
  const b02 = useImage(sources[2].source);
  const b01 = useImage(sources[3].source);
  const b02Foreground = useImage(sources[4].source);
  const b01Foreground = useImage(sources[5].source);
  const st01 = useImage(sources[6].source);
  const st01Foreground = useImage(sources[7].source);
  const roadForeground = useImage(sources[8].source);
  const groundJunctions = useImage(sources[9].source);
  const land09Transition = useImage(sources[12].source);
  const b01FootLanding = useImage(sources[13].source);
  const land09InterfaceForeground = useImage(sources[14].source);
  const land06Approach = useImage(sources[15].source);
  // The connected B01 paving replaces the two legacy foot patches. Draw the
  // unchanged bridge above it; GardenScene draws the entrance arch afterward.
  const images = [road, groundJunctions, roadForeground, stones, land06Approach, b02, st01,
    b02Foreground, st01Foreground, land09Transition, land09InterfaceForeground, b01FootLanding, b01, b01Foreground];
  const artwork = [sources[1], sources[9], sources[8], sources[0], sources[15], sources[2], sources[6],
    sources[4], sources[7], sources[12], sources[14], sources[13], sources[3], sources[5]];

  return <Group>
    {images.map((image, index) => image && <Image key={index} image={image} x={artwork[index].x} y={artwork[index].y}
      width={artwork[index].width} height={artwork[index].height} fit="fill" />)}
  </Group>;
}
