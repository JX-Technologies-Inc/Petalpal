import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GARDEN_FEATURES, gardenFeature } from '../../services/featureCatalog';
import { usePanelTheme } from '../features/PanelTheme';
import { FeatureOverlay } from '../features/FeatureOverlay';
import { FEATURE_COLORS } from '../features/FeatureUI';
import { SidebarIllustration } from './SidebarIllustration';
import { usePlanting } from './planting/PlantingContext';

// One navigation model; only its sizing changes with the viewport.
export function GardenHud() {
  const insets = useSafeAreaInsets();
  const { theme, light } = usePanelTheme();
  const { width, height } = useWindowDimensions();
  const phone = width < 600 || (width < 900 && height < 500);
  const short = height < 500;
  const iconSize = phone ? Math.max(28, Math.min(short ? 30 : 38, (width - insets.left - insets.right) / 10)) : 42;
  const { activeMode, selectedFlower, isGardenLoading, gardenError, refreshGarden } = usePlanting();
  const [highlightedFeature, setHighlightedFeature] = useState<string>();
  const [openFeature, setOpenFeature] = useState<string>();
  const { feature: entryFeature } = useLocalSearchParams<{ feature?: string }>();
  useEffect(() => {
    if (!entryFeature) return;
    if (gardenFeature(entryFeature)?.id !== 'garden') setOpenFeature(gardenFeature(entryFeature)?.id);
    router.setParams({ feature: undefined });
  }, [entryFeature]);
  if (activeMode !== 'normal' || selectedFlower) return null;
  const navigationItem = (feature: typeof GARDEN_FEATURES[number]) => {
    const selected = openFeature === feature.id || (feature.id === 'profile' && openFeature === 'settings') || (feature.id === 'garden' && !openFeature);
    return <Pressable key={feature.id} accessibilityRole="button"
      accessibilityLabel={`${feature.label}, ${feature.status}`} accessibilityState={{ selected }} testID={`hud-${feature.id}`}
      onHoverIn={() => setHighlightedFeature(feature.id)} onHoverOut={() => setHighlightedFeature(undefined)}
      onFocus={() => setHighlightedFeature(feature.id)} onBlur={() => setHighlightedFeature(undefined)}
      onPress={() => setOpenFeature(feature.id === 'garden' ? undefined : feature.id)}
      style={({ pressed }) => [styles.bottomItem,
        (selected || highlightedFeature === feature.id) && [styles.selected, { backgroundColor: light ? '#D6E5DCD9' : theme.input, borderColor: theme.gold }],
        pressed && styles.pressed]}>
      <SidebarIllustration id={feature.id} size={iconSize} active={selected || highlightedFeature === feature.id} />
      <Text numberOfLines={1} style={[styles.label, styles.bottomLabel, { fontSize: phone ? 13 : 15, color: theme.text }]}>
        {feature.id === 'events' ? 'Events' : feature.id === 'profile' ? 'Me' : feature.label}
      </Text>
    </Pressable>;
  };
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    <View testID="main-navigation" style={[styles.bottomBar, {
      width: Math.min(phone ? 460 : Math.max(380, Math.min(460, width * .36)), width - insets.left - insets.right - 40),
      bottom: insets.bottom + (phone ? 8 : 24), padding: phone ? 3 : 4, gap: phone ? 3 : 5,
      borderRadius: phone ? 24 : 26, backgroundColor: theme.background, borderColor: theme.gold,
    }]}>
      {GARDEN_FEATURES.filter(feature => ['garden', 'events', 'friends', 'profile'].includes(feature.id)).map(navigationItem)}
    </View>
    <View style={[styles.info, { top: insets.top + 8, left: insets.left + 8, maxWidth: Math.max(100, width - insets.left - insets.right - 100) }]}>
      {isGardenLoading ? <ActivityIndicator accessibilityLabel="Loading Garden" size="small" color="#365b42" /> : null}
      {gardenError ? <><Text accessibilityRole="alert" style={styles.label}>{gardenError}</Text>
        <Pressable accessibilityRole="button" onPress={() => void refreshGarden()}><Text style={styles.label}>Try again</Text></Pressable></> : null}
      <Pressable accessibilityRole="button" onPress={() => router.push('/garden-history' as Href)}>
        <Text style={styles.label}>Garden history</Text>
      </Pressable>
    </View>
    <FeatureOverlay feature={gardenFeature(openFeature)} onClose={() => setOpenFeature(undefined)} onGardenChanged={refreshGarden} onOpenSettings={() => setOpenFeature('settings')} />
  </View>;
}
const styles = StyleSheet.create({
  bottomBar: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', padding: 5, gap: 4,
    borderRadius: 26, backgroundColor: '#FAF5E8F5', borderWidth: 1, borderColor: '#D4BD85',
    boxShadow: '0 3px 12px #163D4020' },
  bottomItem: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 21, padding: 2, minHeight: 52, borderWidth: 1, borderColor: 'transparent' },
  bottomLabel: { fontFamily: 'serif', fontSize: 13, lineHeight: 17, color: '#254E46' },
  selected: { backgroundColor: '#D6E5DCD9', borderColor: '#C6A164' },
  label: { color: FEATURE_COLORS.ink, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  pressed: { opacity: .7, transform: [{ scale: .96 }] },
  info: { position: 'absolute', alignSelf: 'center', gap: 5, maxWidth: 220,
    borderRadius: 14, padding: 8, backgroundColor: '#fffaf0e8' },
});
