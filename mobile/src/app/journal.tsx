import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Button, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../services/auth';
import { createEvent, emotionMessage, memoryMessage, eventFlowers, plantingRecord, PRIMARY_MOODS, readEvent,
  type BackendFlower, type EventResponse, type PrimaryMood } from '../services/events';
import { loadFlowerPlacements, type FlowerPlacementRecord } from '../components/garden/planting/plantingPersistence';
import { sourceFlowerImageUri } from '../components/garden/planting/flowerDetailApi';
export default function JournalScreen() {
  const { session } = useAuth();
  const [flowers, setFlowers] = useState<BackendFlower[]>([]);
  const [placements, setPlacements] = useState<FlowerPlacementRecord[]>([]);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<PrimaryMood | null>(null);
  const [result, setResult] = useState<EventResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pollError, setPollError] = useState('');
  const pending = useRef<{ content: string; mood: PrimaryMood; key: string } | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError('');
    try {
      const [remote, layout] = await Promise.all([eventFlowers(session.user.id), loadFlowerPlacements()]);
      if (mounted.current) { setFlowers(remote); setPlacements(layout); }
    } catch (err) { if (mounted.current) setError((err as Error).message); }
    finally { if (mounted.current) setLoading(false); }
  }, [session]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  async function saveEvent() {
    if (busy || !content.trim() || !session || !mood) return;
    setBusy(true); setError('');
    const draft = pending.current;
    // Keep the same key after transport failure; a retry cannot duplicate an Event.
    if (!draft || draft.content !== content.trim() || draft.mood !== mood) pending.current = {
      content: content.trim(), mood, key: `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    try {
      const created = await createEvent(pending.current!.content, mood, pending.current!.key);
      if (!mounted.current) return;
      pending.current = null; setResult(created); setContent('');
      if (created.flower) setFlowers((items) => [created.flower!, ...items.filter((item) => item.id !== created.flower!.id)]);
    } catch (err) { if (mounted.current) setError((err as Error).message); }
    finally { if (mounted.current) setBusy(false); }
  }
  useEffect(() => {
    if (!result || !['PENDING','RUNNING'].includes(result.event.emotionStatus)) return;
    let cancelled = false; let timer: ReturnType<typeof setTimeout>; let attempts = 0;
    async function poll() {
      try {
        const event = await readEvent(result!.event.id);
        if (cancelled) return;
        setPollError('');
        if (!['PENDING','RUNNING'].includes(event.emotionStatus)) {
          setResult((current) => current ? { ...current, event } : null); void refresh(); return;
        }
      } catch (err) { if (!cancelled) setPollError((err as Error).message); }
      if (!cancelled && ++attempts < 4) timer = setTimeout(poll, 15000);
    }
    timer = setTimeout(poll, 10000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [result?.event.id, result?.event.emotionStatus, refresh]);
  function plant(flower: BackendFlower) {
    const record = plantingRecord(flower, session?.user.timezone, result?.flower?.id === flower.id ? result.event.localDate : undefined);
    router.navigate({ pathname: '/', params: { mode: 'plant', flowerId: record.flowerId,
      journalEntryId: '', plantedDate: record.plantedDate, month: String(record.month),
      flowerName: record.flowerName, speciesCode: record.speciesCode, mood: record.mood } });
  }
  return <SafeAreaView style={styles.container}><ScrollView contentContainerStyle={styles.scrollContent}>
    <Text style={styles.headerTitle}>PetalPal Events</Text>
    <Text>Save an Event with your Primary Mood. AI processing follows your account consent settings.</Text>
    <TextInput accessibilityLabel="Event" placeholder="What happened?" multiline maxLength={4000}
      value={content} editable={!busy} onChangeText={setContent} style={{ minHeight: 90, borderWidth: 1, padding: 12 }} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {PRIMARY_MOODS.map((choice) => <Pressable key={choice} disabled={busy} accessibilityRole="radio"
        accessibilityState={{ selected: choice === mood }} onPress={() => setMood(choice)}>
        <Text style={{ padding: 8, backgroundColor: choice === mood ? '#cde5d4' : '#eee' }}>{choice.replace('_BLOOM','').replace('_',' ')}</Text>
      </Pressable>)}
    </View>
    <Button title={busy ? 'Saving Event…' : 'Save Event'} disabled={busy || !content.trim() || !mood} onPress={saveEvent} />
    {result ? <View><Text>{emotionMessage(result.event.emotionStatus)}</Text>
      <Text>Secondary emotions: {result.event.secondaryEmotions.join(', ') || 'None'}</Text>
      <Text>{memoryMessage(result.memoryJob)}</Text>
      {pollError ? <Text accessibilityRole="alert">{pollError}</Text> : null}
      <Button title="Refresh Event status" onPress={async () => {
        try { const event = await readEvent(result.event.id); if (mounted.current) { setResult({ ...result, event }); setPollError(''); await refresh(); } }
        catch (err) { if (mounted.current) setPollError((err as Error).message); }
      }} />
    </View> : null}
    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    <Button title="Refresh flowers" onPress={() => void refresh()} />
    <Button title="Open Garden" onPress={() => router.dismissTo('/')} />
    {loading ? <ActivityIndicator /> : null}
    {!loading && flowers.length === 0 ? <Text>No Event flowers yet.</Text> : null}
    {flowers.map((flower) => {
      const placed = placements.some((item) => item.flowerId === flower.id);
      return <View key={flower.id} style={styles.entryCard}>
        <Image source={{ uri: sourceFlowerImageUri(flower.img) }} style={{ width: 72, height: 72 }} resizeMode="contain" />
        <Text>{flower.name} · {flower.mood}</Text><Text>{flower.event || ''}</Text>
        <Text>Secondary emotions: {flower.sourceEvent?.secondaryEmotions.join(', ') || 'None'}</Text>
        <Button title={placed ? 'Adjust position' : 'Plant flower'} onPress={() => placed
          ? router.navigate({ pathname: '/', params: { mode: 'adjust', flowerId: flower.id } }) : plant(flower)} />
      </View>;
    })}
    <Text>Your Events are saved to your account. Garden positions stay on this device.</Text>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    alignItems: 'center',
  },
  gardenButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 8,
  },
  gardenButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  entryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  entryDate: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  entryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  moodPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  moodText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  reflectionText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#334155',
    marginBottom: 14,
  },
  flowerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  flowerThumb: {
    width: 44,
    height: 44,
  },
  flowerInfoCol: {
    flex: 1,
  },
  flowerSpeciesText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  regionConstraintText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  plantedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16A34A',
    marginTop: 3,
  },
  unplantedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
    marginTop: 3,
  },
  actionCol: {
    justifyContent: 'center',
  },
  plantButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#16A34A',
  },
  plantButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  adjustButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#245B45',
  },
  adjustButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
});
