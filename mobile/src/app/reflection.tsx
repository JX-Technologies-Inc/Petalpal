import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useWorldTime } from '../components/garden/world-time';
import { listReflections, readReflection, type ReflectionReport, type ReportType, type SavedReport } from '../services/reflections';

const title = (type: ReportType) => type === 'weekly' ? 'Weekly' : 'Monthly';
function period(report: SavedReport) {
  if (report.type === 'monthly') {
    const match = report.periodKey.match(/(\d{4})-(\d{2})/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  return report.periodKey;
}

export default function Reflection() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { isTreehouseLightingTime: worldNight } = useWorldTime();
  const [nightOverride, setNightOverride] = useState<boolean | null>(null);
  const night = nightOverride ?? worldNight;
  const lighting = useRef(new Animated.Value(night ? 1 : 0)).current;
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReducedMotion(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    const animation = Animated.timing(lighting, { toValue: night ? 1 : 0, duration: reducedMotion ? 0 : 550, useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [night, reducedMotion, lighting]);
  const [type, setType] = useState<ReportType>('weekly');
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<SavedReport | null>(null);
  const [detail, setDetail] = useState<ReflectionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [listError, setListError] = useState('');
  const [readError, setReadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [section, setSection] = useState<'Summary' | 'Topics' | 'Patterns'>('Summary');
  const listAbort = useRef<AbortController | null>(null);
  async function load(older?: string) {
    listAbort.current?.abort();
    const controller = new AbortController(); listAbort.current = controller;
    setLoading(true); setListError('');
    try {
      const result = await listReflections(older, controller.signal);
      if (controller.signal.aborted) return;
      setReports(previous => older ? [...previous, ...result.reports] : result.reports);
      setCursor(result.nextCursor);
    } catch (error) {
      if (!controller.signal.aborted) setListError(error instanceof Error ? error.message : 'Unable to load saved reflections.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }
  useEffect(() => { void load(); return () => listAbort.current?.abort(); }, []);
  useEffect(() => {
    setSelected(current => current?.type === type ? current : reports.find(report => report.type === type) || null);
  }, [reports, type]);
  useEffect(() => {
    setDetail(null); setReadError(''); setSection('Summary');
    if (!selected) { setReading(false); return; }
    const controller = new AbortController(); setReading(true);
    readReflection(selected, controller.signal).then(result => {
      if (!controller.signal.aborted) setDetail(result);
    }).catch(error => {
      if (!controller.signal.aborted) setReadError(error instanceof Error ? error.message : 'Unable to read this reflection.');
    }).finally(() => { if (!controller.signal.aborted) setReading(false); });
    return () => controller.abort();
  }, [selected, retry]);

  const compact = width < 700;
  const sceneWidth = Math.min(width, 1000);
  const artHeight = sceneWidth * 4 / 3;
  const bookWidth = sceneWidth * (compact ? .96 : .80);
  const bookHeight = compact ? 820 : artHeight * .48;
  const bookTop = artHeight * .365;
  const sceneHeight = compact ? Math.max(artHeight, bookTop + bookHeight + 20) : artHeight;
  const camera = { position: 'absolute' as const, left: 0, top: 0, width: sceneWidth, height: artHeight };
  const lakeCamera = { ...camera, top: -artHeight * .14 };
  const available = reports.filter(report => report.type === type);
  const currentDetail = detail?.id === selected?.id && selected?.type === type ? detail : null;
  return <ScrollView style={{ flex: 1, backgroundColor: '#35271D' }} contentContainerStyle={{ minHeight: height, alignItems: 'center' }}>
    <View style={{ width: sceneWidth, height: sceneHeight, overflow: 'hidden' }} testID="reflection-scene">
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image source={require('../../assets/reflection/lake-day-v2.png')} style={lakeCamera} />
        <Animated.Image source={require('../../assets/reflection/lake-night-v2.png')} style={[lakeCamera, { opacity: lighting }]} />
        <Image source={require('../../assets/reflection/interior-day-v2.png')} style={camera} />
        <Animated.Image source={require('../../assets/reflection/interior-night-v2.png')} style={[camera, { opacity: lighting }]} />
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={[s.back, { top: artHeight * .055, left: sceneWidth * .115 }]}><Text style={s.ink}>←  Back to Garden</Text></Pressable>
      <Pressable testID="reflection-lantern" accessibilityRole="switch" accessibilityLabel="Lantern — night lighting" accessibilityState={{ checked: night }} aria-checked={night} accessibilityHint="Turn the lantern on for night, or off for day" onPress={() => setNightOverride(!night)} hitSlop={6}
        style={{ position: 'absolute', left: sceneWidth * .91, top: artHeight * .10, width: sceneWidth * .085, height: artHeight * .145, zIndex: 3 }} />
      {(['weekly', 'monthly'] as const).map((item, index) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: type === item }} aria-selected={type === item} accessibilityLabel={`${title(item)} reflections`} onPress={() => setType(item)} style={{ position: 'absolute', left: sceneWidth * (.561 + index * .094), top: artHeight * .075, width: sceneWidth * .086, height: artHeight * .17, alignItems: 'center', paddingTop: artHeight * .042 }}>
        <Text style={{ fontFamily: 'Georgia', fontSize: Math.max(12, sceneWidth * .018), color: '#EAD6AA', textShadowColor: '#42301C', textShadowRadius: 2, borderBottomWidth: type === item ? 1 : 0, borderColor: '#DCC49588', paddingBottom: 4 }}>{title(item)}</Text>
      </Pressable>)}
      <View testID="reflection-book" style={{ position: 'absolute', top: bookTop, left: compact ? sceneWidth * .02 : sceneWidth * .17, width: bookWidth, height: bookHeight }}>
        {!compact && <View style={{ position: 'absolute', left: '-6%', top: '10%', gap: 6, zIndex: 2 }}>
          {(['Summary', 'Topics', 'Patterns'] as const).map((item, index) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: section === item, disabled: !currentDetail }} aria-selected={section === item} disabled={!currentDetail} onPress={() => setSection(item)} style={[s.edgeTab, { backgroundColor: ['#BBC09A', '#E1C49A', '#DCA9A0'][index], opacity: section === item ? 1 : .88 }]}><Text style={s.small}>{item}</Text></Pressable>)}
        </View>}
        <View style={[s.pages, { top: compact ? 0 : '7%', bottom: compact ? 0 : '10%', left: compact ? '3%' : '10%', right: compact ? '3%' : '5%', backgroundColor: compact ? (night ? '#E6C495' : '#F3E1BA') : 'transparent', flexDirection: compact ? 'column' : 'row', padding: compact ? 22 : 0, borderLeftWidth: compact ? 7 : 0, borderColor: '#765035', shadowColor: '#291A0D', shadowOpacity: compact ? .3 : 0, shadowRadius: 5 }]}>
          <View style={{ flex: 1, minHeight: 0, paddingRight: compact ? 0 : 30 }}>
            
            <Text accessibilityRole="header" style={[s.heading, { fontSize: compact ? 25 : Math.max(21, Math.min(27, sceneWidth * .026)) }]}>Your {title(type)} Reflection</Text>
            {selected?.type === type && <Text style={[s.ink, { marginTop: 4 }]}>{period(selected)}{selected.status === 'PARTIAL' ? ' · In progress' : ''}</Text>}
            {available.length > 1 && <ScrollView horizontal style={{ flexGrow: 0, marginTop: 9 }} contentContainerStyle={{ gap: 8 }}>
              {available.map(report => <Pressable key={report.id} accessibilityRole="button" accessibilityState={{ selected: selected?.id === report.id }} onPress={() => setSelected(report)} style={[s.period, selected?.id === report.id && { backgroundColor: '#C5CAA2' }]}><Text style={s.small}>{period(report)}</Text></Pressable>)}
            </ScrollView>}
            <View style={s.rule} />
            {compact && <View style={{ flexDirection: 'row', gap: 5, marginBottom: 12 }}>{(['Summary', 'Topics', 'Patterns'] as const).map((item, index) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: section === item, disabled: !currentDetail }} aria-selected={section === item} disabled={!currentDetail} onPress={() => setSection(item)} style={[s.tab, { backgroundColor: ['#BBC09A', '#E1C49A', '#DCA9A0'][index] }]}><Text style={s.small}>{item}</Text></Pressable>)}</View>}
            {(loading || reading) && <ActivityIndicator color="#6E744E" accessibilityLabel="Loading reflection" />}
            {!!listError && <><Text style={s.body}>{listError}</Text><Pressable accessibilityRole="button" onPress={() => void load(cursor || undefined)}><Text style={s.link}>Try loading again</Text></Pressable></>}
            {!!readError && <><Text style={s.body}>{readError}</Text><Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)}><Text style={s.link}>Try reading again</Text></Pressable></>}
            {cursor && !loading && <Pressable accessibilityRole="button" onPress={() => void load(cursor)}><Text style={s.link}>Older reflections</Text></Pressable>}
            <ScrollView key={`${selected?.id}-${section}`} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 15 }}>
              {!loading && !listError && !available.length && <View style={{ paddingTop: 20 }}>
                <Text style={[s.heading, { fontSize: 22, marginBottom: 15 }]}>A place to look back</Text>
                <Text style={s.body}>No saved {type} reflections yet.</Text>
                <Text style={s.body}>When a reflection is available, you can return here to revisit its moments, themes and patterns.{cursor ? ' You can also look through older reflections.' : ''}</Text>
                <Image source={require('../../assets/garden/environment/flowers/ivory_wildflowers.png')} resizeMode="contain" style={{ width: 105, height: 80, marginTop: 8, opacity: .8 }} accessible={false} />
              </View>}
              {currentDetail && <>
                {section === 'Summary' && <Text selectable style={s.body}>{currentDetail.summary || currentDetail.narrativeSections?.map(item => item.claim).join('\n\n') || 'No written reflection is available for this saved report.'}</Text>}
                {(section === 'Summary' || section === 'Topics') && <>
                  <Text style={s.sectionHeading}>Your {title(type)} Themes</Text>
                  {currentDetail.topTopics?.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 17 }}>{currentDetail.topTopics.map(item => <View key={item.topic} style={s.topic}>
                    <Text style={{ color: '#85905D', fontSize: 26 }}>❧</Text><Text style={s.ink}>{item.topic}</Text><Text style={s.small}>{item.count} recorded</Text>
                  </View>)}</View> : <Text style={s.body}>No themes recorded in this reflection.</Text>}
                </>}
                {(section === 'Summary' || section === 'Patterns') && <>
                  <Text style={s.sectionHeading}>❧  Notable Patterns</Text>
                  {currentDetail.trendSignals?.status === 'ok' ? <>
                    {typeof currentDetail.trendSignals.eventCountChange === 'number' && <Text style={s.body}>Recorded events: {currentDetail.trendSignals.eventCountChange > 0 ? '+' : ''}{currentDetail.trendSignals.eventCountChange} compared with the previous {type === 'weekly' ? 'week' : 'month'}.</Text>}
                    {currentDetail.trendSignals.topicChanges?.map(item => <Text key={item.topic} selectable style={s.pattern}>❧  {item.topic}: {item.previousCount} → {item.currentCount}</Text>)}
                  </> : <Text style={s.body}>There isn’t enough recorded evidence to compare periods.</Text>}
                </>}
              </>}
            </ScrollView>
            {currentDetail && <Text style={[s.small, { paddingTop: 7, borderTopWidth: 1, borderColor: '#AA8B5933' }]}>{currentDetail.eventCount} recorded {currentDetail.eventCount === 1 ? 'event' : 'events'} · Saved reflection</Text>}
          </View>
          <View style={{ flex: compact ? undefined : 1, minHeight: 0, alignItems: 'center', paddingLeft: compact ? 0 : 18, paddingTop: compact ? 15 : 0, paddingBottom: compact ? 0 : artHeight * .045 }}>
            <Image source={require('../../assets/reflection/botanical.png')} resizeMode="contain" accessible={false} style={{ width: '100%', height: compact ? 175 : undefined, flex: compact ? undefined : 1, opacity: .88 }} />
            {currentDetail?.narrativeSections?.length ? <ScrollView style={{ maxHeight: compact ? 100 : 120, alignSelf: 'stretch' }}><Text selectable style={s.note}>{currentDetail.narrativeSections[currentDetail.narrativeSections.length - 1].claim}</Text></ScrollView> : <Text style={s.caption}>❧  {currentDetail ? period(selected!) : 'Your reflections, kept here.'}</Text>}
          </View>
        </View>
      </View>
    </View>
  </ScrollView>;
}
const s = StyleSheet.create({
  back: { position: 'absolute', top: 24, left: 24, padding: 13, borderRadius: 4, backgroundColor: '#F3E7CCD9' },
  pages: { position: 'absolute', borderRadius: 12 },
  eyebrow: { fontFamily: 'Georgia', fontSize: 10, letterSpacing: 1.4, color: '#8C7652', marginBottom: 7 },
  rule: { height: 1, backgroundColor: '#AC8A5244', marginVertical: 16 },
  sectionHeading: { fontFamily: 'Georgia', fontSize: 18, color: '#654D30', marginTop: 8, marginBottom: 12 },
  pattern: { fontFamily: 'Georgia', fontSize: 15, lineHeight: 23, color: '#556040', marginBottom: 8 },
  topic: { alignItems: 'center', minWidth: 70, maxWidth: 125, padding: 5 },
  edgeTab: { width: 83, minHeight: 49, justifyContent: 'center', alignItems: 'center', borderRadius: 4, borderWidth: 1, borderColor: '#9F805866', shadowColor: '#372412', shadowOpacity: .18, shadowRadius: 2, shadowOffset: { width: 1, height: 2 } },
  note: { fontFamily: 'Georgia', fontStyle: 'italic', fontSize: 17, lineHeight: 25, color: '#775633', textAlign: 'center', padding: 9 },
  caption: { fontFamily: 'Georgia', fontStyle: 'italic', fontSize: 16, color: '#8B6C44', paddingVertical: 16, textAlign: 'center' },
  heading: { fontFamily: 'Georgia', color: '#453321', lineHeight: 34 },
  ink: { fontFamily: 'Georgia', color: '#453321', fontSize: 16 },
  body: { fontFamily: 'Georgia', color: '#4D3B28', fontSize: 16, lineHeight: 26, marginBottom: 15 },
  small: { fontFamily: 'Georgia', color: '#53432D', fontSize: 13, lineHeight: 19 },
  link: { fontFamily: 'Georgia', color: '#52613B', textDecorationLine: 'underline', marginVertical: 10 },
  period: { padding: 7, borderRadius: 3, borderWidth: 1, borderColor: '#AD936255' },
  tab: { paddingHorizontal: 9, paddingVertical: 8, borderRadius: 4 },
});
