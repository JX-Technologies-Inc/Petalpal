import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { type BridgeLocalPoint, type BridgeNumericField, type BridgeTestPlacement } from './bridgeTestPlacement';
import { BRIDGE_VIEW_SPRITE } from './bridgeSprites';

const FIELDS: [BridgeNumericField, string, number[]][] = [
  ['x', 'X', [-10, -1, -0.1, 0.1, 1, 10]],
  ['y', 'Y', [-10, -1, -0.1, 0.1, 1, 10]],
  ['scale', 'Scale', [-0.05, -0.005, -0.001, 0.001, 0.005, 0.05]],
  ['opacity', 'Opacity', [-0.1, -0.01, 0.01, 0.1]],
];
const PATH_POINTS = [['entryA', 'Entry A'], ['crest', 'Crest'], ['entryB', 'Entry B']] as const;
const POINT_FIELDS: (keyof BridgeLocalPoint)[] = ['x', 'y', 'elevation'];

export default function BridgeTestEditor({ placement, onChange, debug, onDebug, walkPath, onWalkPath, onReset, onDone }: {
  placement: BridgeTestPlacement; onChange: (p: BridgeTestPlacement) => void;
  debug: boolean; onDebug: () => void; walkPath: boolean; onWalkPath: () => void;
  onReset: () => void; onDone: () => void;
}) {
  const [showExport, setShowExport] = useState(false);
  const sprite = BRIDGE_VIEW_SPRITE;
  const setValue = (field: BridgeNumericField, value: number) => {
    if (!Number.isFinite(value)) return;
    if (field === 'cameraAzimuthDegrees') value = ((value % 360) + 360) % 360;
    onChange({ ...placement, [field]: Number((field === 'scale' ? Math.max(0.001, value)
      : field === 'opacity' ? Math.max(0, Math.min(1, value)) : value).toFixed(4)) });
  };
  const setPointValue = (point: 'entryA' | 'crest' | 'entryB', field: keyof BridgeLocalPoint, value: number) => {
    if (!Number.isFinite(value)) return;
    onChange({ ...placement, path: { ...placement.path,
      [point]: { ...placement.path[point], [field]: Number(value.toFixed(4)) },
    } });
  };
  return <View style={styles.panel}>
    <Text style={styles.title}>BRIDGE TEST</Text>
    <Text style={styles.text}>Ground-center anchor · uniform scale · local span/elevation units</Text>
    <Text style={styles.text}>Camera elevation: 55° LOCKED</Text>
    <View style={styles.row}>
      <Button label={`Visible: ${placement.visible ? 'ON' : 'OFF'}`} onPress={() => onChange({ ...placement, visible: !placement.visible })} />
      <Button label={`Show Bridge Debug: ${debug ? 'ON' : 'OFF'}`} onPress={onDebug} />
      <Button label={`Show Walk Path: ${walkPath ? 'ON' : 'OFF'}`} onPress={onWalkPath} />
      <Button label="Done" onPress={onDone} />
    </View>
    <ScrollView keyboardShouldPersistTaps="handled">
      <Text style={styles.text}>Entrance-to-right bridge: {sprite.cameraAzimuthDegrees} degrees</Text>
      {FIELDS.map(([field, label, steps]) => <View key={field} style={styles.field}>
        <Text style={styles.text}>{label}</Text>
        <View style={styles.row}>
          <NumericInput label={label} value={placement[field] ?? 0} onCommit={value => setValue(field, value)} />
          {steps.map(step => <Button key={step} label={`${step > 0 ? '+' : ''}${step}`}
            onPress={() => setValue(field, (placement[field] ?? 0) + step)} />)}
        </View>
      </View>)}
      <Text style={styles.text}>A → approach → crest → exit → B · debug metadata only</Text>
      {PATH_POINTS.flatMap(([point, title]) => POINT_FIELDS.map(field => {
        const label = `${title} local ${field === 'elevation' ? 'Elevation' : field.toUpperCase()}`;
        const value = placement.path[point][field];
        return <View key={`${point}-${field}`} style={styles.field}>
          <Text style={styles.text}>{label}</Text>
          <View style={styles.row}>
            <NumericInput label={label} value={value} onCommit={next => setPointValue(point, field, next)} />
            {[-0.1, -0.01, 0.01, 0.1].map(step => <Button key={step} label={`${step > 0 ? '+' : ''}${step}`}
              onPress={() => setPointValue(point, field, value + step)} />)}
          </View>
        </View>;
      }))}
      <View style={styles.row}>
        <Button label="Reset Bridge" onPress={onReset} />
        <Button label="Export / Copy JSON" onPress={() => setShowExport(v => !v)} />
      </View>
      <Text style={styles.text}>Like the existing calibration tools, values last for this session. Export before leaving.</Text>
      {showExport && <TextInput multiline editable={false} selectTextOnFocus
        value={JSON.stringify({ bridge: placement, bridgeDebug: { showBridgeDebug: debug, showWalkPath: walkPath } }, null, 2)} style={styles.export} />}
    </ScrollView>
  </View>;
}

function NumericInput({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.trim()) onCommit(Number(draft));
    setDraft(null);
  };
  return <TextInput accessibilityLabel={label} style={styles.input} value={draft ?? String(value)}
    onChangeText={setDraft} onBlur={commit} onSubmitEditing={commit}
    keyboardType="numbers-and-punctuation" selectTextOnFocus />;
}
function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.button}>
    <Text style={styles.text}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  panel: { position: 'absolute', bottom: 8, left: 8, right: 8, maxHeight: '45%', padding: 10, gap: 6, backgroundColor: '#FFFFFFF2', borderRadius: 8 },
  title: { fontSize: 13, fontWeight: '700', color: '#172219' },
  text: { fontSize: 11, color: '#172219' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  field: { marginVertical: 5, gap: 4 },
  button: { backgroundColor: '#D8DDDA', paddingHorizontal: 9, minHeight: 30, justifyContent: 'center', borderRadius: 5 },
  input: { width: 85, backgroundColor: '#EEF1EF', color: '#172219', padding: 5, borderWidth: 1, borderColor: '#809A88' },
  export: { minHeight: 180, backgroundColor: '#EEF1EF', fontFamily: 'monospace', fontSize: 11, color: '#172219' },
});
