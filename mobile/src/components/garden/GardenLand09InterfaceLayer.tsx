import { Group, Image, useImage } from '@shopify/react-native-skia';
import { memo } from 'react';
import { registeredArtwork } from './registeredArtwork';

const artwork = registeredArtwork(require('@/assets/garden/infrastructure/land09-interface-v2/land09-broad-interface.png'),
    require('@/assets/garden/runtime/infrastructure/land09-interface-v2/land09-broad-interface.png'), 1317, 1358, 194, 184);
// Local Land09 endpoint underlay. The immutable Main Entrance is drawn above it.
function GardenLand09InterfaceLayer() {
  const image = useImage(artwork.source);
  return image ? <Group clip={artwork.clip}><Image image={image} x={artwork.x} y={artwork.y}
    width={artwork.width} height={artwork.height} fit="fill" /></Group> : null;
}

export default memo(GardenLand09InterfaceLayer);
