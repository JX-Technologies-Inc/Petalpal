import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export type SwingMapPlacement = { x: number; y: number; scale: number; rotation: number };

type Props = {
  placement: SwingMapPlacement;
  onNudge: (field: keyof SwingMapPlacement, amount: number) => void;
  onReset: () => void;
};

export default function SwingCalibrationEditor({ placement, onNudge, onReset }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const exportJson = JSON.stringify({ swing: placement }, null, 2);

  return (
    <View style={[styles.panel, collapsed && styles.collapsedPanel]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Swing Map Calibration</Text>
          <Text style={styles.summary}>
            X: {String(placement.x)} · Y: {String(placement.y)} · Scale: {String(placement.scale)}
            {' · '}Rotation: {String(placement.rotation)}°
          </Text>
        </View>
        <Button label={collapsed ? 'Expand' : 'Collapse'}
          onPress={() => setCollapsed((value) => !value)} />
      </View>
      {!collapsed && (
        <ScrollView keyboardShouldPersistTaps="handled">
          <Control label="X" value={placement.x} increments={[-10, -5, -1, 1, 5, 10]}
            onNudge={(amount) => onNudge('x', amount)} />
          <Control label="Y" value={placement.y} increments={[-10, -5, -1, 1, 5, 10]}
            onNudge={(amount) => onNudge('y', amount)} />
          <Control label="Scale" value={placement.scale}
            increments={[-0.05, -0.01, -0.005, 0.005, 0.01, 0.05]}
            onNudge={(amount) => onNudge('scale', amount)} />
          <Control label="Rotation" value={placement.rotation}
            increments={[-5, -1, -0.25, 0.25, 1, 5]} suffix="°"
            onNudge={(amount) => onNudge('rotation', amount)} />
          <View style={styles.row}>
            <Button label="Reset Swing" onPress={onReset} />
            <Button label="Export / Copy JSON" onPress={() => setShowExport((value) => !value)} />
          </View>
          {showExport && (
            <TextInput multiline editable={false} selectTextOnFocus value={exportJson}
              style={styles.export} />
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Control({ label, value, increments, suffix = '', onNudge }: {
  label: string;
  value: number;
  increments: readonly number[];
  suffix?: string;
  onNudge: (amount: number) => void;
}) {
  return (
    <View style={styles.control}>
      <Text style={styles.value}>{label}: {String(value)}{suffix}</Text>
      <View style={styles.row}>
        {increments.map((amount) => (
          <Button key={amount} label={`${amount > 0 ? '+' : ''}${amount}${suffix}`}
            onPress={() => onNudge(amount)} />
        ))}
      </View>
    </View>
  );
}

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.button}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', left: 8, right: 8, bottom: 8, maxHeight: '42%', padding: 8,
    borderRadius: 8, backgroundColor: '#FFFFFFF2' },
  collapsedPanel: { maxHeight: undefined },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { color: '#172219', fontSize: 12, fontWeight: '700' },
  summary: { color: '#172219', fontSize: 10 },
  control: { marginTop: 6 },
  value: { color: '#172219', fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 },
  button: { minHeight: 30, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center',
    borderRadius: 5, backgroundColor: '#D8DDDA' },
  buttonText: { color: '#172219', fontSize: 11, fontWeight: '600' },
  export: { minHeight: 130, marginTop: 8, padding: 8, color: '#172219', backgroundColor: '#EEF1EF',
    fontSize: 10, fontFamily: 'monospace', textAlignVertical: 'top' },
});
