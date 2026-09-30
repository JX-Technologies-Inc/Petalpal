import { Image, useImage } from '@shopify/react-native-skia';
import { registeredArtwork } from './registeredArtwork';

// Local Land09 endpoint underlay. The immutable Main Entrance is drawn above it.
export default function GardenLand09InterfaceLayer() {
  const artwork = registeredArtwork(require('@/assets/garden/infrastructure/land09-interface-v2/land09-broad-interface.png'),
    require('@/assets/garden/runtime/infrastructure/land09-interface-v2/land09-broad-interface.png'), 1317, 1358, 194, 184);
  const image = useImage(artwork.source);
  return image ? <Image image={image} x={artwork.x} y={artwork.y}
    width={artwork.width} height={artwork.height} fit="fill" /> : null;
}
