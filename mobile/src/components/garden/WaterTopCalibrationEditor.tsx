import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { type WaterTopPlacement } from './waterTopPlacement';
import { type TopWaterMotionMode } from './water/WaterTopAssembly';

export type TopWaterDisplayPreset = 'water-only' | 'cliff' | 'waterfall' | 'bank' | 'all';

type Props = {
  rawFinal?: boolean;
  placement: WaterTopPlacement;
  motionMode: TopWaterMotionMode;
  displayPreset: TopWaterDisplayPreset;
  frontBankEnabled: boolean;
  onNudge: (field: keyof WaterTopPlacement, amount: number) => void;
  onMotionModeChange: (mode: TopWaterMotionMode) => void;
  onDisplayPresetChange: (preset: TopWaterDisplayPreset) => void;
  onFrontBankToggle: () => void;
  onReset: () => void;
  onExit: () => void;
};

const clean = (value: number) => Number(value.toFixed(6));

export default function WaterTopCalibrationEditor({
  rawFinal = false,
  placement,
  motionMode,
  displayPreset,
  frontBankEnabled,
  onNudge,
  onMotionModeChange,
  onDisplayPresetChange,
  onFrontBankToggle,
  onReset,
  onExit,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const exportJson = JSON.stringify(
    {
      waterTop: {
        x: clean(placement.x),
        y: clean(placement.y),
        scale: clean(placement.scale),
        rotation: clean(placement.rotation),
        cliffOffsetX: clean(placement.cliffOffsetX),
        cliffOffsetY: clean(placement.cliffOffsetY),
        cliffScale: clean(placement.cliffScale ?? 1.0),
        bankOffsetX: clean(placement.bankOffsetX ?? 0),
        bankOffsetY: clean(placement.bankOffsetY ?? 0),
        bankScale: clean(placement.bankScale ?? 1.0),
      },
    },
    null,
    2,
  );

  const PRESETS: { key: TopWaterDisplayPreset; label: string }[] = [
    { key: 'water-only', label: 'WATER ONLY' },
    { key: 'cliff', label: '+ LARGE CLIFF' },
    { key: 'waterfall', label: '+ WATERFALL' },
    { key: 'bank', label: '+ FRONT BANK' },
    { key: 'all', label: 'ALL' },
  ];

  return (
    <View style={[styles.panel, collapsed && styles.collapsedPanel]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.summaryContainer}>
          <Text style={styles.title}>{rawFinal ? 'SOURCE WATER — RIVER / CLIFF' : 'Water Top Calibration'}</Text>
          <Text style={styles.summary}>
            X: {clean(placement.x)} · Y: {clean(placement.y)} · Scale: {clean(placement.scale)} · Rot:{' '}
            {clean(placement.rotation)}°
          </Text>
          {!rawFinal && <Text style={styles.summarySub}>
            Cliff: ({clean(placement.cliffOffsetX)}, {clean(placement.cliffOffsetY)}) x{clean(placement.cliffScale ?? 1)} · Bank: ({clean(placement.bankOffsetX ?? 0)}, {clean(placement.bankOffsetY ?? 0)}) x{clean(placement.bankScale ?? 1)}
          </Text>}
        </View>
        <Button label={collapsed ? 'Expand' : 'Collapse'} onPress={() => setCollapsed((v) => !v)} />
      </View>

      {/* Main action buttons */}
      <View style={styles.row}>
        <Button label="Exit" onPress={onExit} style={styles.exitButton} />
        <Button label="Reset" onPress={onReset} />
        <Button label="Export JSON" onPress={() => setShowExport((v) => !v)} />
      </View>

      {/* Diagnostic Display Presets */}
      {rawFinal ? <View>
        <Text style={styles.summarySub}>887 × 1774 asset · extended upstream · fixed cliffs / central outlet</Text>
        <Button label={`Source Flow: ${motionMode === 'animate' ? 'ON' : 'OFF'}`}
          selected={motionMode === 'animate'}
          onPress={() => onMotionModeChange(motionMode === 'static' ? 'animate' : 'static')} />
      </View> : <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>Display Preset:</Text>
      </View>
      <View style={styles.row}>
        {PRESETS.map(({ key, label }) => {
          const isSelected = displayPreset === key;
          return (
            <Button
              key={key}
              label={isSelected ? `${label} ✓` : label}
              selected={isSelected}
              onPress={() => onDisplayPresetChange(key)}
            />
          );
        })}
      </View>

      {/* Mode toggles */}
      <View style={styles.row}>
        <Button
          label={`Front Bank: ${frontBankEnabled ? 'ON' : 'OFF'}`}
          selected={frontBankEnabled}
          onPress={onFrontBankToggle}
        />
        <Button
          label={`Motion: ${motionMode.toUpperCase()}`}
          selected={motionMode === 'animate'}
          onPress={() => onMotionModeChange(motionMode === 'static' ? 'animate' : 'static')}
        />
      </View>
      </>}

      {showExport && (
        <TextInput
          multiline
          editable={false}
          selectTextOnFocus
          value={exportJson}
          style={styles.export}
        />
      )}

      {/* Detailed numeric nudge controls */}
      {!collapsed && (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {/* Section: Whole Assembly */}
          <Text style={styles.groupTitle}>── Assembly Transform ──</Text>
          <Control
            label="Assembly X"
            value={clean(placement.x)}
            increments={[-50, -10, -1, 1, 10, 50]}
            onNudge={(amount) => onNudge('x', amount)}
          />
          <Control
            label="Assembly Y"
            value={clean(placement.y)}
            increments={[-50, -10, -1, 1, 10, 50]}
            onNudge={(amount) => onNudge('y', amount)}
          />
          <Control
            label="Assembly Scale"
            value={clean(placement.scale)}
            increments={[-0.1, -0.05, -0.01, -0.005, 0.005, 0.01, 0.05, 0.1]}
            onNudge={(amount) => onNudge('scale', amount)}
          />
          <Control
            label="Assembly Rotation"
            value={clean(placement.rotation)}
            increments={[-5, -1, -0.25, 0.25, 1, 5]}
            suffix="°"
            onNudge={(amount) => onNudge('rotation', amount)}
          />

          {/* Section: Large Cliff Layer */}
          {!rawFinal && <>
          <Text style={styles.groupTitle}>── Large Cliff Layer ──</Text>
          <Control
            label="Cliff X"
            value={clean(placement.cliffOffsetX)}
            increments={[-20, -10, -1, 1, 10, 20]}
            onNudge={(amount) => onNudge('cliffOffsetX', amount)}
          />
          <Control
            label="Cliff Y"
            value={clean(placement.cliffOffsetY)}
            increments={[-20, -10, -1, 1, 10, 20]}
            onNudge={(amount) => onNudge('cliffOffsetY', amount)}
          />
          <Control
            label="Cliff Scale"
            value={clean(placement.cliffScale ?? 1.0)}
            increments={[-0.05, -0.01, -0.005, 0.005, 0.01, 0.05]}
            onNudge={(amount) => onNudge('cliffScale', amount)}
          />

          {/* Section: Front Seam Bank Layer */}
          <Text style={styles.groupTitle}>── Front Bank Layer ──</Text>
          <Control
            label="Bank X"
            value={clean(placement.bankOffsetX ?? 0)}
            increments={[-20, -10, -1, 1, 10, 20]}
            onNudge={(amount) => onNudge('bankOffsetX', amount)}
          />
          <Control
            label="Bank Y"
            value={clean(placement.bankOffsetY ?? 0)}
            increments={[-20, -10, -1, 1, 10, 20]}
            onNudge={(amount) => onNudge('bankOffsetY', amount)}
          />
          <Control
            label="Bank Scale"
            value={clean(placement.bankScale ?? 1.0)}
            increments={[-0.05, -0.01, -0.005, 0.005, 0.01, 0.05]}
            onNudge={(amount) => onNudge('bankScale', amount)}
          />
          </>}
        </ScrollView>
      )}
    </View>
  );
}

function Control({
  label,
  value,
  increments,
  suffix = '',
  onNudge,
}: {
  label: string;
  value: number;
  increments: readonly number[];
  suffix?: string;
  onNudge: (amount: number) => void;
}) {
  return (
    <View style={styles.control}>
      <Text style={styles.value}>
        {label}: {String(value)}
        {suffix}
      </Text>
      <View style={styles.row}>
        {increments.map((amount) => (
          <Button
            key={amount}
            label={`${amount > 0 ? '+' : ''}${amount}${suffix}`}
            onPress={() => onNudge(amount)}
          />
        ))}
      </View>
    </View>
  );
}

function Button({
  label,
  onPress,
  selected = false,
  style,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
  style?: any;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.button, selected && styles.buttonSelected, style]}
    >
      <Text style={[styles.buttonText, selected && styles.buttonTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    maxHeight: '48%',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFFF2',
    borderWidth: 1,
    borderColor: '#C0C8C3',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  collapsedPanel: {
    maxHeight: undefined,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryContainer: {
    flex: 1,
  },
  title: {
    color: '#172219',
    fontSize: 13,
    fontWeight: '700',
  },
  summary: {
    color: '#172219',
    fontSize: 10,
    marginTop: 1,
  },
  summarySub: {
    color: '#4B554E',
    fontSize: 9.5,
    marginTop: 1,
  },
  sectionHeader: {
    marginTop: 4,
  },
  sectionLabel: {
    color: '#172219',
    fontSize: 10.5,
    fontWeight: '700',
  },
  groupTitle: {
    color: '#2A4A35',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 2,
    textAlign: 'center',
  },
  control: {
    marginTop: 5,
  },
  value: {
    color: '#172219',
    fontSize: 11,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 4,
  },
  scrollArea: {
    marginTop: 6,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  button: {
    minHeight: 28,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    backgroundColor: '#D8DDDA',
  },
  buttonSelected: {
    backgroundColor: '#30694B',
  },
  buttonText: {
    color: '#172219',
    fontSize: 10.5,
    fontWeight: '600',
  },
  buttonTextSelected: {
    color: '#FFFFFF',
  },
  exitButton: {
    backgroundColor: '#E8C5C5',
  },
  export: {
    height: 110,
    marginTop: 6,
    padding: 6,
    color: '#172219',
    backgroundColor: '#EEF1EF',
    fontSize: 10,
    fontFamily: 'monospace',
    textAlignVertical: 'top',
    borderRadius: 4,
  },
});
