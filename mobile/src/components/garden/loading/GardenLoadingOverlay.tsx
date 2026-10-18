import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLandsReady } from './gardenReadiness';

// Shown over the canvas until the water base and the seven land textures decode. It never
// intercepts touches, and it changes nothing about rendering or quality.
export function GardenLoadingOverlay({ waterReady }: { waterReady: boolean }) {
  const landsReady = useLandsReady();
  const ready = waterReady && landsReady;
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setSlow(true), 12_000);
    return () => clearTimeout(timer);
  }, [ready]);
  if (ready) return null;
  return <View pointerEvents="none" style={styles.root} testID="garden-loading">
    <ActivityIndicator color="#365b42" accessibilityLabel="Loading your garden" />
    <Text accessibilityLiveRegion="polite" style={styles.title}>Growing your garden…</Text>
    {slow ? <Text style={styles.hint}>The first visit can take up to a minute on a slow connection.</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 5, alignItems: 'center', justifyContent: 'center',
    gap: 10, padding: 24, backgroundColor: '#eef3e6' },
  title: { fontSize: 17, fontWeight: '600', color: '#365b42' },
  hint: { fontSize: 13, color: '#5d7263', textAlign: 'center', maxWidth: 280 },
});
