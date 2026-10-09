import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { GardenLandLayout } from './gardenMapLayout';

const LAND_SELECTORS = [
  ['central', 'central'], ['land0405', '0405'], ['land06', '06'], ['land07', '07'],
  ['land08', '08'], ['land09', '09'], ['land101112', '101112'],
] as const;

type EditableField = 'x' | 'y' | 'width' | 'rotation';
type Props = {
  layout: GardenLandLayout;
  selectedId: string;
  onSelect: (id: string) => void;
  onNudge: (field: EditableField, amount: number) => void;
  onResetSelected: () => void;
  onResetAll: () => void;
};

export default function NativeLandCalibrationEditor({
  layout, selectedId, onSelect, onNudge, onResetSelected, onResetAll,
}: Props) {
  const selected = layout.find((land) => land.id === selectedId) ?? layout[0];
  const [showExport, setShowExport] = React.useState(false);
  const exportJson = JSON.stringify(Object.fromEntries(LAND_SELECTORS.map(([key, id]) => {
    const land = layout.find((item) => item.id === id)!;
    return [key, { x: land.x, y: land.y, width: land.width, rotation: land.rotation, zIndex: land.zIndex }];
  })), null, 2);

  return (
    <View style={styles.panel}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>DEV Land Calibration · Selected: {selectedId}</Text>
        <View style={styles.row}>
          {LAND_SELECTORS.map(([, id]) => (
            <Button key={id} label={id} selected={id === selectedId} onPress={() => onSelect(id)} />
          ))}
        </View>
        <Control label="X" value={selected.x} increments={[-10, -1, 1, 10]} onNudge={(n) => onNudge('x', n)} />
        <Control label="Y" value={selected.y} increments={[-10, -1, 1, 10]} onNudge={(n) => onNudge('y', n)} />
        <Control label="Width" value={selected.width} increments={[-10, -1, 1, 10]} onNudge={(n) => onNudge('width', n)} />
        <Control label="Rotation" value={selected.rotation} increments={[-1, -0.1, 0.1, 1]}
          suffix="°" onNudge={(n) => onNudge('rotation', n)} />
        <View style={styles.row}>
          <Button label="Reset selected" onPress={onResetSelected} />
          <Button label="Reset all" onPress={onResetAll} />
          <Button label="Export calibrated layout JSON" onPress={() => setShowExport((value) => !value)} />
        </View>
        {showExport && (
          <TextInput multiline editable={false} selectTextOnFocus value={exportJson} style={styles.export} />
        )}
      </ScrollView>
    </View>
  );
}

function Control({ label, value, increments, suffix = '', onNudge }: {
  label: string; value: number; increments: readonly number[]; suffix?: string;
  onNudge: (amount: number) => void;
}) {
  return (
    <View style={styles.control}>
      <Text style={styles.value}>{label}: {String(value)}{suffix}</Text>
      <View style={styles.row}>
        {increments.map((amount) => (
          <Button key={amount} label={`${amount > 0 ? '+' : ''}${amount}${suffix}`} onPress={() => onNudge(amount)} />
        ))}
      </View>
    </View>
  );
}

function Button({ label, selected = false, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
      style={[styles.button, selected && styles.selectedButton]}>
      <Text style={[styles.buttonText, selected && styles.selectedButtonText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', left: 8, right: 8, bottom: 8, maxHeight: '46%', padding: 8,
    borderRadius: 8, backgroundColor: '#FFFFFFF2' },
  title: { color: '#172219', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  control: { marginTop: 6 },
  value: { color: '#172219', fontSize: 12, fontWeight: '700', minWidth: 110 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 },
  button: { minHeight: 30, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center',
    borderRadius: 5, backgroundColor: '#D8DDDA' },
  selectedButton: { backgroundColor: '#245B45' },
  buttonText: { color: '#172219', fontSize: 11, fontWeight: '600' },
  selectedButtonText: { color: '#FFFFFF' },
  export: { minHeight: 180, marginTop: 8, padding: 8, color: '#172219', backgroundColor: '#EEF1EF',
    fontSize: 10, fontFamily: 'monospace', textAlignVertical: 'top' },
});
