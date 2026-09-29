import { Group, Image, Rect, useImage } from '@shopify/react-native-skia';
import { GARDEN_LANDS, type GardenLand, type GardenLandLayout } from './gardenMapLayout';
import GardenShoreContact from './water/GardenShoreContact';

function Land({ land, selected }: { land: GardenLand; selected: boolean }) {
  const image = useImage(land.source);
  if (!image) return null;
  // Match web img width:100%, height:auto and CSS center-center rotation.
  const height = land.width * image.height() / image.width();
  const centerX = land.x + land.width / 2;
  const centerY = land.y + height / 2;
  return (
    <Group transform={[
      { translateX: centerX },
      { translateY: centerY },
      { rotate: land.rotation * Math.PI / 180 },
      { translateX: -centerX },
      { translateY: -centerY },
    ]}>
      <GardenShoreContact image={image} x={land.x} y={land.y} width={land.width} height={height} />
      <Image image={image} x={land.x} y={land.y} width={land.width} height={height} fit="contain" />
      {__DEV__ && selected && (
        <Group>
          <Rect x={land.x} y={land.y} width={land.width} height={height}
            color="#FFE36E" style="stroke" strokeWidth={6} />
        </Group>
      )}
    </Group>
  );
}

type LandLayerProps = {
  layout?: GardenLandLayout;
  selectedLandId?: string | null;
};

export default function LandLayer({ layout = GARDEN_LANDS, selectedLandId = null }: LandLayerProps) {
  const orderedLands = [...layout].sort((a, b) => a.zIndex - b.zIndex);
  return (
    <Group>
      {orderedLands.map((land) => (
        <Land key={land.id} land={land} selected={land.id === selectedLandId} />
      ))}
    </Group>
  );
}
