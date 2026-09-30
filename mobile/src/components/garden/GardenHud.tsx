import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GARDEN_FEATURES, gardenFeature } from '../../services/featureCatalog';
import { FeatureOverlay } from '../features/FeatureOverlay';
import { FEATURE_COLORS } from '../features/FeatureUI';
import { usePlanting } from './planting/PlantingContext';

// Additive temporary shortcuts; Jinyin can replace this presentation independently.
export function GardenHud() {
  const insets = useSafeAreaInsets();
  const { activeMode, selectedFlower, isGardenLoading, gardenError, refreshGarden } = usePlanting();
  const [openFeature, setOpenFeature] = useState<string>();
  const { feature: entryFeature } = useLocalSearchParams<{ feature?: string }>();
  useEffect(() => {
    if (!entryFeature) return;
    if (gardenFeature(entryFeature)?.id !== 'garden') setOpenFeature(gardenFeature(entryFeature)?.id);
    router.setParams({ feature: undefined });
  }, [entryFeature]);
  if (activeMode !== 'normal' || selectedFlower) return null;
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    {[GARDEN_FEATURES.slice(0, 5), GARDEN_FEATURES.slice(5)].map((group, side) =>
      <View key={side} pointerEvents="box-none" style={[styles.group,
        { top: insets.top + 12, ...(side === 0 ? { left: insets.left + 8 } : { right: insets.right + 8 }) }]}>
        {group.map(feature => <Pressable key={feature.id} accessibilityRole="button"
          accessibilityLabel={`${feature.label}, ${feature.status}`} testID={`hud-${feature.id}`}
          onPress={() => setOpenFeature(feature.id === 'garden' ? undefined : feature.id)}
          style={({ pressed }) => [styles.shortcut, feature.id === 'events' && styles.eventsShortcut, pressed && styles.pressed]}>
          <SymbolView name={feature.icon} size={23} tintColor={FEATURE_COLORS.ink} />
          <Text numberOfLines={feature.id === 'events' ? 2 : 1} style={styles.label}>{feature.label}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.8} style={styles.status}>{feature.status}</Text>
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
    <FeatureOverlay feature={gardenFeature(openFeature)} onClose={() => setOpenFeature(undefined)} onGardenChanged={refreshGarden} />
  </View>;
}
const styles = StyleSheet.create({
  group: { position: 'absolute', gap: 6, width: 72 },
  shortcut: { height: 60, alignItems: 'center', justifyContent: 'center', padding: 5,
    backgroundColor: '#5AA4ABE8', borderRadius: 18, borderWidth: 1, borderColor: '#FFFFFF80',
    boxShadow: '0 3px 10px rgba(37,60,64,0.1)' },
  // Safe Jinyin baseline: the two-line Events label occupies an extra 8.5px.
  eventsShortcut: { height: 68.5 },
  label: { color: FEATURE_COLORS.ink, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  status: { color: FEATURE_COLORS.ink, fontSize: 7, height: 8.5, lineHeight: 8.5, maxWidth: '100%',
    marginTop: 2, backgroundColor: '#A67EB740', borderRadius: 4, paddingHorizontal: 2 },
  pressed: { opacity: .7, transform: [{ scale: .96 }] },
  info: { position: 'absolute', alignSelf: 'center', gap: 5, maxWidth: 220,
    borderRadius: 14, padding: 8, backgroundColor: '#fffaf0e8' },
});
