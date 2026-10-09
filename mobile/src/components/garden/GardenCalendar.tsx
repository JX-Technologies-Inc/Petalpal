import { useEffect, useMemo, useState } from 'react';
import { AppState, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePanelTheme } from '../features/PanelTheme';
import { usePlanting } from './planting/PlantingContext';
import type { FlowerPlacementRecord } from './planting/plantingPersistence';

import { calendarDateKey as dateKey, calendarRecordDay, calendarToday } from './calendarDates';

export function GardenCalendar({ onFocusFlower }: { onFocusFlower: (flower: FlowerPlacementRecord) => void }) {
  const { placements, isGardenLoading, gardenError } = usePlanting();
  const { light } = usePanelTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => new Date());
  const [simulated, setSimulated] = useState<Date | null>(null);
  const today = calendarToday(now, simulated, __DEV__);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selected, setSelected] = useState(() => dateKey(now));
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = setInterval(update, 30000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') update(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  const days = useMemo(() => {
    const result = new Map<string, FlowerPlacementRecord[]>();
    for (const flower of placements) {
      const key = calendarRecordDay(flower.plantedDate);
      if (!key) continue;
      result.set(key, [...(result.get(key) || []), flower]);
    }
    return result;
  }, [placements]);
  const ink = light ? '#254C3B' : '#F5E9C8';
  const popup = light
    ? { paper: '#FAF3DF', ink: '#254E43', muted: '#637562', edge: '#C4AF79', rule: '#A6986A55', selected: '#DCE3CE', outline: '#416651', shade: '#AD925C18' }
    : { paper: '#103431', ink: '#F2E7C6', muted: '#BBC6AE', edge: '#BCA571', rule: '#C6B98B55', selected: '#405B4B', outline: '#D6C58B', shade: '#031A1844' };
  const focus = Platform.OS === 'web' ? { outlineColor: popup.outline } : {};
  const label = { fontFamily: 'Georgia', color: ink, fontSize: 16 };
  const popupLabel = { ...label, color: popup.ink };
  const size = Math.min(164, Math.max(125, width * .22));
  const cells = Array.from({ length: month.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, i) => i - month.getDay() + 1);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open Garden calendar, ${today.toLocaleDateString()}`} onPress={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(dateKey(today)); setOpen(true); }} style={{ position: 'absolute', top: insets.top + 10, right: insets.right + 12, width: size, height: 64, justifyContent: 'center' }}>
      <Image accessible={false} source={light ? require('../../../assets/calendar/light.png') : require('../../../assets/calendar/dark.png')} resizeMode="contain" style={{ position: 'absolute', width: size, height: 64 }} />
      <Text style={[label, { marginLeft: size * .39, width: size * .47, textAlign: 'center', fontSize: size * .14 }]}>{today.toLocaleDateString('en', { month: 'short', day: 'numeric' })}</Text>
      {__DEV__ && simulated && <Text style={{ position: 'absolute', top: 59, right: 8, fontSize: 10, color: ink }}>DEV date</Text>}
    </Pressable>
    <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, backgroundColor: '#13291D66', justifyContent: 'center', alignItems: 'center', padding: 18 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close calendar" onPress={() => setOpen(false)} style={{ position: 'absolute', inset: 0 }} />
        <View accessibilityViewIsModal style={{ width: Math.min(390, width - 36), maxHeight: height - insets.top - insets.bottom - 36, padding: 18, borderRadius: 16, backgroundColor: popup.paper, borderWidth: 1, borderColor: popup.edge, boxShadow: `0 8px 28px #08251F30, inset 0 0 36px ${popup.shade}` }}>
          <View pointerEvents="none" accessible={false} aria-hidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { borderRadius: 15, overflow: 'hidden' }]}>
            <View style={{ position: 'absolute', inset: 3, borderRadius: 12, borderWidth: 1, borderColor: popup.rule, opacity: .3 }} />
            {[false, true].map(bottom => <View key={String(bottom)} style={{ position: 'absolute', width: 60, height: 102, overflow: 'hidden', opacity: light ? .42 : .34,
              ...(bottom ? { bottom: -12, right: -8, transform: [{ rotate: '-28deg' }] } : { top: -14, left: -12, transform: [{ rotate: '168deg' }] }) }}>
              {/* Crop the transparent padding of the existing botanical sprig. */}
              <Image accessible={false} source={require('../../../assets/garden/flowers/species/olive/components/batch/branch/leafy.png')} style={{ position: 'absolute', width: 280, height: 280, left: -113, top: -148 }} />
            </View>)}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={{ padding: 10, ...focus }}><Text style={popupLabel}>‹</Text></Pressable>
            <Text style={popupLabel}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={{ padding: 10, ...focus }}><Text style={popupLabel}>›</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Close calendar panel" onPress={() => setOpen(false)} style={{ padding: 8, ...focus }}><Text style={popupLabel}>×</Text></Pressable>
          </View>
          <ScrollView>
            <View style={{ flexDirection: 'row' }}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => <Text key={i} style={[popupLabel, { width: '14.285%', textAlign: 'center', fontSize: 12 }]}>{day}</Text>)}</View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 }}>{cells.map((day, i) => {
              const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
              const count = days.get(key)?.length || 0;
              return day < 1 ? <View key={i} style={{ width: '14.285%' }} /> : <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${key}, ${count} flowers or events${key === dateKey(today) ? ', today' : ''}`} accessibilityState={{ selected: key === selected }} onPress={() => setSelected(key)} style={{ width: '14.285%', height: 45, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: key === selected ? popup.selected : 'transparent', borderWidth: key === selected || key === dateKey(today) ? 1 : 0, borderColor: key === selected ? popup.outline : popup.edge, ...focus }}><Text style={popupLabel}>{day}</Text><Text style={{ color: popup.muted, fontSize: 9, height: 12 }}>{count ? `· ${count}` : ''}</Text></Pressable>;
            })}</View>
            <Text style={[popupLabel, { marginVertical: 10 }]}>{selected}</Text>
            {isGardenLoading ? <Text style={popupLabel}>Loading Garden…</Text> : gardenError ? <Text style={popupLabel}>{gardenError}</Text> : !(days.get(selected)?.length) ? <Text style={popupLabel}>No flowers or events for this day.</Text> : days.get(selected)!.map(flower => <Pressable key={flower.flowerId} accessibilityRole="button" accessibilityLabel={`Focus ${flower.flowerName}`} onPress={() => { setOpen(false); onFocusFlower(flower); }} style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: popup.rule, ...focus }}><Text style={popupLabel}>{flower.flowerName} · {flower.sourceType === 'EVENT' ? 'Event' : 'Flower'}</Text><Text style={[popupLabel, { fontSize: 12, color: popup.muted }]}>View in Garden</Text></Pressable>)}
            {__DEV__ && <View style={{ borderTopWidth: 1, borderColor: popup.rule, marginTop: 16, paddingTop: 12, gap: 12 }}>
              <Text style={[popupLabel, { fontSize: 11, color: popup.muted }]}>DEV preview date only · does not change report timing on the server.</Text>
              <Pressable accessibilityRole="button" style={focus} onPress={() => { const [y, m, d] = selected.split('-').map(Number); setSimulated(new Date(y, m - 1, d)); }}><Text style={popupLabel}>Use selected day for preview</Text></Pressable>
              <Pressable accessibilityRole="button" style={focus} onPress={() => setSimulated(null)}><Text style={popupLabel}>Use device date</Text></Pressable>
            </View>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}
