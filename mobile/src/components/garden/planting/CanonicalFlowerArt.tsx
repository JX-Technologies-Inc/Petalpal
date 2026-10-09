import { Circle, Group, Image, useImage } from '@shopify/react-native-skia';
import type { FlowerPlacementRecord } from './plantingPersistence';
import { sourceFlowerImageUri } from './flowerDetailApi';
import { getFlowerPlacementDefinition } from './flowerFootprintConfig';
// Presentation palette only; canonical species, accent and effect come from the backend.
const ACCENTS: Record<string, string> = { PEARL_GOLD:'#e6c886', BRIGHT_CORAL:'#ff806b', EMBER_RED:'#d64b3f',
  SHARP_ORANGE:'#f38b38', WARM_CREAM:'#f4d7a2', MIXED_VIOLET:'#ab83cf', IRIDESCENT_BLUE:'#70b9e4',
  MUTED_BLUE:'#7796bc', COOL_GREEN:'#7fae8e', VIVID_GOLD:'#f7c443', COOL_DARK_EDGE:'#768cab',
  WARM_GOLD:'#eab84e', SUNLIT_YELLOW:'#f8d45a', SOFT_PINK:'#eba2bd', DAWN_GOLD:'#e7b566',
  SILVER_BLUE:'#a2bdd4', COOL_BLUE:'#75a7d6', CONTRAST_POP:'#cc78d6' };
export function CanonicalFlowerEffects({ flower }: { flower: FlowerPlacementRecord }) {
  const color = flower.colorAccent && ACCENTS[flower.colorAccent];
  if (!color) return null;
  const effect = flower.visualEffect || '';
  const haze = /RAIN|MIST|SPORES/.test(effect);
  const motes = /MOTES|DRIFT/.test(effect);
  return <Group>
    <Circle cx={flower.worldX} cy={flower.worldY - 24} r={haze ? 27 : 22} color={color} opacity={haze ? .15 : .09} />
    {[0,1,2,3].map((i) => <Circle key={i} cx={flower.worldX + (i % 2 ? 20 : -20)}
      cy={flower.worldY - 14 - i * 13} r={motes ? 3 : haze ? 6 : 2} color={color} opacity={haze ? .16 : .55} />)}
  </Group>;
}
export function CanonicalFlowerArt({ flower }: { flower: FlowerPlacementRecord }) {
  const image = useImage(flower.image ? sourceFlowerImageUri(flower.image) : null);
  const size = getFlowerPlacementDefinition(flower.flowerName, flower.speciesCode);
  return <Group>
    {image ? <Image image={image} x={flower.worldX - size.visualWidth / 2} y={flower.worldY - size.visualHeight * .82}
      width={size.visualWidth} height={size.visualHeight} fit="contain" /> :
      <Circle cx={flower.worldX} cy={flower.worldY} r={4} color="#7e907b" />}
    <CanonicalFlowerEffects flower={flower} />
  </Group>;
}
