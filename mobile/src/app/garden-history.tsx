import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../services/auth';
import { loadGardenPlacements } from '../components/garden/planting/gardenHydration';
import type { FlowerPlacementRecord } from '../components/garden/planting/plantingPersistence';

// Optional backend-test detail surface; the main Garden remains the visual scene.
export default function GardenHistoryScreen() {
  const { session } = useAuth();
  const [flowers, setFlowers] = useState<FlowerPlacementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError(''); setFlowers([]);
    if (session) loadGardenPlacements(session.user.id, session.user.id, session.user.timezone)
      .then(items => { if (active) setFlowers(items); })
      .catch(() => { if (active) setError('Your Garden history could not load. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session, revision]));
  return <ScrollView contentContainerStyle={styles.content}>
    <Button title="Back to Garden" onPress={() => router.dismissTo('/')} />
    <Text style={styles.title}>Garden history</Text>
    <Text>All backend flowers · {flowers.length}</Text>
    <Text>LOCAL positions are confirmed on this device. FALLBACK positions are temporary previews and may move as the Garden changes.</Text>
    {loading ? <ActivityIndicator accessibilityLabel="Loading Garden history" /> : null}
    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    <Button title="Refresh Garden history" onPress={() => setRevision(value => value + 1)} />
    {!loading && !error && !flowers.length ? <Text>No flowers yet. Create an Event to grow your Garden.</Text> : null}
    {flowers.map(flower => <View key={flower.flowerId} style={styles.flower}>
      <Text>{flower.flowerName} · {flower.sourceType}</Text>
      <Text selectable>{flower.flowerId}</Text>
      <Text>{flower.plantedDate}</Text>
      <Text>Primary Mood: {flower.mood}</Text>
      <Text>Secondary emotions: {flower.secondaryEmotions?.join(', ') || 'None'}</Text>
      <Text>Species: {flower.speciesCode}</Text>
      <Text>Accent: {flower.colorAccent || 'None'} · Effect: {flower.visualEffect || 'None'}</Text>
      <Text>Placement: {flower.placementOrigin}</Text>
    </View>)}
  </ScrollView>;
}
const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 24, gap: 16 },
  title: { fontSize: 24, fontWeight: '600' },
  flower: { gap: 6, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#d6e3ce' },
});
