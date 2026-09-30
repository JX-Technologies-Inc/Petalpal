import { router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GARDEN_FEATURES } from '../../services/featureCatalog';
import { usePlanting } from './planting/PlantingContext';

// Additive temporary shortcuts; Jinyin can replace this presentation independently.
export function GardenHud() {
  const insets = useSafeAreaInsets();
  const { activeMode, selectedFlower, isGardenLoading, gardenError, refreshGarden } = usePlanting();
  if (activeMode !== 'normal' || selectedFlower) return null;
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    {[GARDEN_FEATURES.slice(0, 5), GARDEN_FEATURES.slice(5)].map((group, side) =>
      <View key={side} pointerEvents="box-none" style={[styles.group,
        { top: insets.top + 12, ...(side === 0 ? { left: insets.left + 8 } : { right: insets.right + 8 }) }]}>
        {group.map(feature => <Pressable key={feature.id} accessibilityRole="button"
          accessibilityLabel={`${feature.label}, ${feature.status}`} testID={`hud-${feature.id}`}
          onPress={() => feature.id === 'garden' ? void refreshGarden() : router.push(feature.route as Href)}
          style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}>
          <SymbolView name={feature.icon} size={23} tintColor="#365b42" />
          <Text style={styles.label}>{feature.label}</Text>
          <Text style={styles.status}>{feature.status}</Text>
        </Pressable>)}
      </View>)}
    <View style={[styles.info, { bottom: insets.bottom + 12 }]}>
      {isGardenLoading ? <ActivityIndicator accessibilityLabel="Loading Garden" size="small" color="#365b42" /> : null}
      {gardenError ? <><Text accessibilityRole="alert" style={styles.label}>{gardenError}</Text>
        <Pressable accessibilityRole="button" onPress={() => void refreshGarden()}><Text style={styles.label}>Try again</Text></Pressable></> : null}
      <Pressable accessibilityRole="button" onPress={() => router.push('/garden-history' as Href)}>
        <Text style={styles.label}>Garden history</Text>
      </Pressable>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  group: { position: 'absolute', gap: 6, width: 72 },
  shortcut: { minHeight: 60, alignItems: 'center', justifyContent: 'center', padding: 5,
    backgroundColor: '#fffaf0e8', borderRadius: 18, borderWidth: 1, borderColor: '#d6e3ce' },
  label: { color: '#365b42', fontSize: 10, fontWeight: '600', textAlign: 'center' },
  status: { color: '#677c60', fontSize: 7, marginTop: 2 },
  pressed: { opacity: .7, transform: [{ scale: .96 }] },
  info: { position: 'absolute', alignSelf: 'center', gap: 5, maxWidth: 220,
    borderRadius: 14, padding: 8, backgroundColor: '#fffaf0e8' },
});
