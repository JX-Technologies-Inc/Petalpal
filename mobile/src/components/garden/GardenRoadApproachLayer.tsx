import { Group, Image, useImage } from '@shopify/react-native-skia';
import { GARDEN_WORLD_HEIGHT, GARDEN_WORLD_WIDTH } from './gardenMapLayout';

// Local Treehouse entrance: irregular slabs, shoreline support and an open
// western junction. Landmark source layers and transforms remain unchanged.
export default function GardenRoadApproachLayer() {
  const road = useImage(require('@/assets/garden/roads/complete/R01_treehouse_path.png'));
  const foreground = useImage(require('@/assets/garden/roads/complete/R01_existing_foreground.png'));
  if (!road || !foreground) return null;
  return <Group>{[road, foreground].map((image, index) => <Image key={index}
    image={image} x={0} y={0} width={GARDEN_WORLD_WIDTH}
    height={GARDEN_WORLD_HEIGHT} fit="fill" />)}</Group>;
}
