import { Group, Image, useImage } from '@shopify/react-native-skia';
import { memo } from 'react';
import { registeredArtwork } from './registeredArtwork';

// Local Treehouse entrance: irregular slabs, shoreline support and an open
// western junction. Landmark source layers and transforms remain unchanged.
const roadArtwork = registeredArtwork(require('@/assets/garden/roads/complete/R01_treehouse_path.png'),
    require('@/assets/garden/runtime/roads/complete/R01_treehouse_path.png'), 574, 441, 219, 213);
const foregroundArtwork = registeredArtwork(require('@/assets/garden/roads/complete/R01_existing_foreground.png'),
    require('@/assets/garden/runtime/roads/complete/R01_existing_foreground.png'), 0, 0, 1, 1);
const artwork = [roadArtwork, foregroundArtwork];
function GardenRoadApproachLayer() {
  const road = useImage(roadArtwork.source);
  const foreground = useImage(foregroundArtwork.source);
  if (!road || !foreground) return null;
  return <Group>{[road, foreground].map((image, index) => <Group key={index} clip={artwork[index].clip}><Image
    image={image} x={artwork[index].x} y={artwork[index].y} width={artwork[index].width}
    height={artwork[index].height} fit="fill" /></Group>)}</Group>;
}

export default memo(GardenRoadApproachLayer);
