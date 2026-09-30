import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FeatureStatus } from '../../services/featureCatalog';

export const FEATURE_COLORS = {
  primary: '#5AA4AB', secondary: '#A67EB7', ink: '#17262A', muted: '#64777B',
  paper: '#F7FBFB', line: '#5AA4AB40', tealWash: '#5AA4AB18', purpleWash: '#A67EB71C',
};

export function StatusChip({ status }: { status: FeatureStatus }) {
  return <View style={[ui.chip, status === 'REAL' ? ui.tealWash : ui.purpleWash]}>
    <View style={[ui.dot, { backgroundColor: status === 'REAL' ? FEATURE_COLORS.primary : FEATURE_COLORS.secondary }]} />
    <Text style={ui.chipText}>{status}</Text>
  </View>;
}

export function FeatureActionButton({ title, onPress, disabled = false, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [ui.button, secondary && ui.secondaryButton, disabled && ui.disabled, pressed && ui.pressed]}>
    <Text style={ui.buttonText}>{title}</Text>
  </Pressable>;
}

export function FeatureSection({ title, children }: { title?: string; children: ReactNode }) {
  return <View style={ui.section}>{title ? <Text style={ui.sectionTitle}>{title}</Text> : null}{children}</View>;
}

export const ui = StyleSheet.create({
  body: { gap: 18 },
  text: { fontSize: 14, lineHeight: 21, color: FEATURE_COLORS.muted },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: FEATURE_COLORS.ink },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: FEATURE_COLORS.ink },
  caption: { fontSize: 12, lineHeight: 18, color: FEATURE_COLORS.muted },
  section: { borderRadius: 20, padding: 16, borderWidth: 1, borderColor: FEATURE_COLORS.line, backgroundColor: '#FFFFFF', gap: 12 },
  chip: { flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 },
  chipText: { fontSize: 10, fontWeight: '700', letterSpacing: .4, color: FEATURE_COLORS.ink },
  dot: { width: 5, height: 5, borderRadius: 3 },
  tealWash: { backgroundColor: FEATURE_COLORS.tealWash },
  purpleWash: { backgroundColor: FEATURE_COLORS.purpleWash },
  button: { minHeight: 46, justifyContent: 'center', alignItems: 'center', borderRadius: 15, paddingHorizontal: 16,
    paddingVertical: 12, backgroundColor: FEATURE_COLORS.primary },
  secondaryButton: { backgroundColor: FEATURE_COLORS.secondary },
  buttonText: { fontSize: 14, fontWeight: '700', color: FEATURE_COLORS.ink, textAlign: 'center' },
  disabled: { opacity: .45 },
  pressed: { opacity: .8, transform: [{ scale: .98 }] },
  notice: { borderRadius: 16, padding: 13, gap: 8, backgroundColor: FEATURE_COLORS.purpleWash },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
