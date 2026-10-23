import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { sourceFlowerImageUri } from './flowerDetailApi';
import { localFlowerArtwork } from './localFlowerArtwork';

// A flower's picture for lists: its own Garden artwork, framed on the bloom, the same art the
// Garden draws. Only a flower without bundled art falls back to the server's image or emoji.
export function FlowerThumb({ speciesCode, name, image, size, style }: {
  speciesCode?: string; name: string; image: string; size: number; style?: StyleProp<ViewStyle>;
}) {
  const local = localFlowerArtwork(speciesCode, name);
  const bounds = local?.component.contentBounds;
  if (local && bounds) {
    const inner = size * 0.86;
    const scale = Math.min(inner / (bounds[2] - bounds[0]), inner / (bounds[3] - bounds[1]));
    return <View accessibilityLabel={name} style={[styles.frame, { width: size, height: size }, style]}>
      <Image source={local.source} resizeMode="contain" style={{ position: 'absolute',
        width: local.component.canvasWidth * scale, height: local.component.canvasHeight * scale,
        left: size / 2 - ((bounds[0] + bounds[2]) * scale) / 2, top: size / 2 - ((bounds[1] + bounds[3]) * scale) / 2 }} />
    </View>;
  }
  const uri = sourceFlowerImageUri(image);
  return <View accessibilityLabel={name} style={[styles.frame, { width: size, height: size }, style]}>
    {uri ? <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="contain" />
      : <Text style={{ fontSize: size * 0.62, lineHeight: size, textAlign: 'center' }}>{image}</Text>}
  </View>;
}

const styles = StyleSheet.create({ frame: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' } });
