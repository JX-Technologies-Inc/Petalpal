import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export type TreehousePlacement = { x: number; y: number; scale: number };

type Props = {
  placement: TreehousePlacement;
  onNudge: (field: keyof TreehousePlacement, amount: number) => void;
  onReset: () => void;
};

export default function TreehouseCalibrationEditor({ placement, onNudge, onReset }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const exportJson = JSON.stringify({ treehouse: placement }, null, 2);

  return (
    <View style={[styles.panel, collapsed && styles.collapsedPanel]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Treehouse Calibration</Text>
          <Text style={styles.summary}>X: {String(placement.x)} · Y: {String(placement.y)} · Scale: {String(placement.scale)}</Text>
        </View>
        <Button label={collapsed ? 'Expand' : 'Collapse'} onPress={() => setCollapsed((value) => !value)} />
      </View>
      {!collapsed && (
        <ScrollView keyboardShouldPersistTaps="handled">
          <Control label="X" value={placement.x} increments={[-10, -1, 1, 10]} onNudge={(n) => onNudge('x', n)} />
          <Control label="Y" value={placement.y} increments={[-10, -1, 1, 10]} onNudge={(n) => onNudge('y', n)} />
          <Control label="Scale" value={placement.scale} increments={[-0.05, -0.01, 0.01, 0.05]}
            onNudge={(n) => onNudge('scale', n)} />
          <View style={styles.row}>
            <Button label="Reset Treehouse" onPress={onReset} />
            <Button label="Export Treehouse placement" onPress={() => setShowExport((value) => !value)} />
          </View>
          {showExport && <TextInput multiline editable={false} selectTextOnFocus value={exportJson} style={styles.export} />}
        </ScrollView>
      )}
    </View>
  );
}

function Control({ label, value, increments, onNudge }: {
  label: string; value: number; increments: readonly number[]; onNudge: (amount: number) => void;
}) {
  return (
    <View style={styles.control}>
      <Text style={styles.value}>{label}: {String(value)}</Text>
      <View style={styles.row}>
        {increments.map((amount) => <Button key={amount} label={`${amount > 0 ? '+' : ''}${amount}`} onPress={() => onNudge(amount)} />)}
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
  panel: { position: 'absolute', left: 8, right: 8, bottom: 8, maxHeight: '38%', padding: 8,
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
