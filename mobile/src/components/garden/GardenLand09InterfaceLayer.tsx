import { Image, useImage } from '@shopify/react-native-skia';
import { GARDEN_WORLD_HEIGHT, GARDEN_WORLD_WIDTH } from './gardenMapLayout';

// Local Land09 endpoint underlay. The immutable Main Entrance is drawn above it.
export default function GardenLand09InterfaceLayer() {
  const image = useImage(require('@/assets/garden/infrastructure/land09-interface-v2/land09-broad-interface.png'));
  return image ? <Image image={image} x={0} y={0}
    width={GARDEN_WORLD_WIDTH} height={GARDEN_WORLD_HEIGHT} fit="fill" /> : null;
}
