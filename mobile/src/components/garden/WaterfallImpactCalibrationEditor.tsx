import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type WaterfallImpactPlacement } from './waterfallImpactPlacement';

type Props = {
  placement: WaterfallImpactPlacement;
  onNudge: (field: keyof WaterfallImpactPlacement, amount: number) => void;
  onReset: () => void;
  onDone: () => void;
  onFocusImpact: () => void;
};

type EditableParam = 'x' | 'y' | 'width' | 'height' | 'rotation';

const PARAM_TABS: { key: EditableParam; label: string }[] = [
  { key: 'x', label: 'X' },
  { key: 'y', label: 'Y' },
  { key: 'width', label: 'W' },
  { key: 'height', label: 'H' },
  { key: 'rotation', label: 'ROT' },
];

const clean = (val: number) => Number(val.toFixed(2));

export default function WaterfallImpactCalibrationEditor({
  placement,
  onNudge,
  onReset,
  onDone,
  onFocusImpact,
}: Props) {
  const [activeParam, setActiveParam] = useState<EditableParam>('x');

  const paramConfigs: Record<
    EditableParam,
    { display: string; increments: number[]; suffix: string }
  > = {
    x: { display: `X = ${clean(placement.x)}`, increments: [-10, -1, 1, 10], suffix: '' },
    y: { display: `Y = ${clean(placement.y)}`, increments: [-10, -1, 1, 10], suffix: '' },
    width: { display: `W = ${clean(placement.width)}`, increments: [-10, -1, 1, 10], suffix: '' },
    height: { display: `H = ${clean(placement.height)}`, increments: [-10, -1, 1, 10], suffix: '' },
    rotation: {
      display: `ROT = ${clean(placement.rotation)}°`,
      increments: [-1, -0.25, 0.25, 1],
      suffix: '°',
    },
  };

  const currentConfig = paramConfigs[activeParam];

  return (
    <View style={styles.toolbar}>
      {/* Row 1: Readout + Actions (Focus, Reset, Done) */}
      <View style={styles.headerRow}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>Impact:</Text>
          <Text style={styles.summaryText}>
            X:{clean(placement.x)} Y:{clean(placement.y)} W:{clean(placement.width)} H:{clean(placement.height)} R:{clean(placement.rotation)}°
          </Text>
        </View>
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={onFocusImpact}
            style={[styles.btn, styles.btnFocus]}
          >
            <Text style={styles.btnFocusText}>Focus Impact</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onReset}
            style={[styles.btn, styles.btnReset]}
          >
            <Text style={styles.btnResetText}>Reset</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onDone}
            style={[styles.btn, styles.btnDone]}
          >
            <Text style={styles.btnDoneText}>✓ Done</Text>
          </Pressable>
        </View>
      </View>

      {/* Row 2: Single Parameter Selector */}
      <View style={styles.paramRow}>
        <Text style={styles.rowLabel}>Param:</Text>
        <View style={styles.paramTabs}>
          {PARAM_TABS.map(({ key, label }) => {
            const isSelected = activeParam === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => setActiveParam(key)}
                style={[styles.tab, isSelected && styles.tabSelected]}
              >
                <Text style={[styles.tabText, isSelected && styles.tabTextSelected]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.activeValueText}>{currentConfig.display}</Text>
      </View>

      {/* Row 3: Increments for the active parameter */}
      <View style={styles.nudgeRow}>
        <Text style={styles.rowLabel}>Adjust:</Text>
        <View style={styles.nudgeButtons}>
          {currentConfig.increments.map((amt) => (
            <Pressable
              key={amt}
              accessibilityRole="button"
              onPress={() => onNudge(activeParam, amt)}
              style={styles.nudgeBtn}
            >
              <Text style={styles.nudgeBtnText}>
                {amt > 0 ? `+${amt}` : amt}{currentConfig.suffix}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#1C2A22F2',
    borderWidth: 1,
    borderColor: '#3E5C48',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  summaryBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  summaryTitle: {
    color: '#8AE4B2',
    fontSize: 11,
    fontWeight: '700',
  },
  summaryText: {
    color: '#E8F5EE',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  btn: {
    minHeight: 26,
    paddingHorizontal: 8,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnFocus: {
    backgroundColor: '#264D43',
    borderWidth: 1,
    borderColor: '#4CA389',
  },
  btnFocusText: {
    color: '#D4FAF0',
    fontSize: 10,
    fontWeight: '700',
  },
  btnReset: {
    backgroundColor: '#35433B',
  },
  btnResetText: {
    color: '#C6D4CB',
    fontSize: 10,
    fontWeight: '600',
  },
  btnDone: {
    backgroundColor: '#2E7D52',
  },
  btnDoneText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowLabel: {
    color: '#A0B8A9',
    fontSize: 10,
    fontWeight: '700',
    width: 42,
  },
  paramTabs: {
    flexDirection: 'row',
    gap: 4,
  },
  tab: {
    minWidth: 32,
    height: 25,
    paddingHorizontal: 6,
    borderRadius: 5,
    backgroundColor: '#2B3D32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabSelected: {
    backgroundColor: '#388E5E',
  },
  tabText: {
    color: '#A9C4B2',
    fontSize: 11,
    fontWeight: '700',
  },
  tabTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  activeValueText: {
    marginLeft: 'auto',
    color: '#6DF2B5',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  nudgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nudgeButtons: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  nudgeBtn: {
    flex: 1,
    height: 27,
    borderRadius: 5,
    backgroundColor: '#31473A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#466453',
  },
  nudgeBtnText: {
    color: '#E8F5EE',
    fontSize: 11,
    fontWeight: '700',
  },
});
