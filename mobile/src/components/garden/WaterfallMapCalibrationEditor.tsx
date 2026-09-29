import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { type WaterfallMapPlacement } from './waterfallMapPlacement';

type Props = {
  placement: WaterfallMapPlacement;
  onNudge: (field: keyof WaterfallMapPlacement, amount: number) => void;
  onReset: () => void;
  onExit: () => void;
  referenceOpacity: number;
  onReferenceOpacityChange: (opacity: number) => void;
};

const clean = (value: number) => Number(value.toFixed(6));

export default function WaterfallMapCalibrationEditor({
  placement, onNudge, onReset, onExit, referenceOpacity, onReferenceOpacityChange,
}: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const exportJson = JSON.stringify({ waterfall: {
    x: clean(placement.x), y: clean(placement.y), scale: clean(placement.scale),
    rotation: clean(placement.rotation),
    scaleX: clean(placement.scaleX), scaleY: clean(placement.scaleY),
  } }, null, 2);
  return <View style={[styles.panel, collapsed && styles.collapsedPanel]}>
    <View style={styles.header}>
      <View style={styles.summaryContainer}>
        <Text style={styles.title}>Waterfall Map Calibration</Text>
        <Text style={styles.summary}>X: {clean(placement.x)} · Y: {clean(placement.y)}
          {' · '}Scale: {clean(placement.scale)} · Rotation: {clean(placement.rotation)}°</Text>
      </View>
      <Button label={collapsed ? 'Advanced' : 'Collapse'} onPress={() => setCollapsed((value) => !value)} />
    </View>
    <View style={styles.row}>
      <Button label="Exit" onPress={onExit} />
      <Button label="Reset" onPress={onReset} />
      <Button label="Export JSON" onPress={() => setShowExport(value => !value)} />
    </View>
    <Text style={styles.summary}>Direct gestures temporarily disabled · use Advanced numeric controls</Text>
    <View style={styles.row}>
      <Text style={styles.referenceLabel}>Reference:</Text>
      {[0, 0.3, 0.5, 0.7].map((opacity) => (
        <Button key={opacity} label={`${opacity * 100}%${referenceOpacity === opacity ? ' ✓' : ''}`}
          onPress={() => onReferenceOpacityChange(opacity)} />
      ))}
    </View>
    {showExport && <TextInput multiline editable={false} selectTextOnFocus
      value={exportJson} style={styles.export} />}
    {!collapsed && <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
      <Control label="X" value={placement.x} increments={[-20, -10, -5, -1, 1, 5, 10, 20]}
        onNudge={(amount) => onNudge('x', amount)} />
      <Control label="Y" value={placement.y} increments={[-20, -10, -5, -1, 1, 5, 10, 20]}
        onNudge={(amount) => onNudge('y', amount)} />
      <Control label="Scale" value={placement.scale}
        increments={[-0.1, -0.05, -0.01, -0.005, 0.005, 0.01, 0.05, 0.1]}
        onNudge={(amount) => onNudge('scale', amount)} />
      <Control label="Rotation" value={placement.rotation}
        increments={[-5, -1, -0.25, 0.25, 1, 5]} suffix="°"
        onNudge={(amount) => onNudge('rotation', amount)} />
      <Control label="Perspective scaleX (0.9–1.1)" value={placement.scaleX}
        increments={[-0.01,-0.005,0.005,0.01]} onNudge={amount => onNudge('scaleX',amount)} />
      <Control label="Perspective scaleY (0.9–1.1)" value={placement.scaleY}
        increments={[-0.01,-0.005,0.005,0.01]} onNudge={amount => onNudge('scaleY',amount)} />
    </ScrollView>}
  </View>;
}

function Control({ label, value, increments, suffix = '', onNudge }: {
  label: string; value: number; increments: readonly number[]; suffix?: string;
  onNudge: (amount: number) => void;
}) {
  return <View style={styles.control}>
    <Text style={styles.value}>{label}: {String(value)}{suffix}</Text>
    <View style={styles.row}>{increments.map((amount) => <Button key={amount}
      label={`${amount > 0 ? '+' : ''}${amount}${suffix}`} onPress={() => onNudge(amount)} />)}</View>
  </View>;
}

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.button}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', left: 8, right: 8, bottom: 8, maxHeight: '42%', padding: 8,
    borderRadius: 8, backgroundColor: '#FFFFFFF2' },
  collapsedPanel: { maxHeight: undefined },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  summaryContainer: { flex: 1 },
  title: { color: '#172219', fontSize: 12, fontWeight: '700' },
  summary: { color: '#172219', fontSize: 10 },
  referenceLabel: { color: '#172219', fontSize: 11, fontWeight: '700', alignSelf: 'center' },
  control: { marginTop: 6 },
  value: { color: '#172219', fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 },
  button: { minHeight: 30, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center',
    borderRadius: 5, backgroundColor: '#D8DDDA' },
  buttonText: { color: '#172219', fontSize: 11, fontWeight: '600' },
  export: { height: 130, marginTop: 8, padding: 8, color: '#172219', backgroundColor: '#EEF1EF',
    fontSize: 10, fontFamily: 'monospace', textAlignVertical: 'top' },
});
