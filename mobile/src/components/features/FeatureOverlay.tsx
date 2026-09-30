import { useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../services/auth';
import type { GARDEN_FEATURES } from '../../services/featureCatalog';
import { EventsPanel } from './EventsPanel';
import { FEATURE_COLORS as colors, FeatureActionButton, FeatureSection, StatusChip, ui } from './FeatureUI';

type Feature = typeof GARDEN_FEATURES[number];
const messages: Record<string, [string, string]> = {
  daily: ['A moment for your daily bloom', 'Daily check-ins are being connected. Your existing flowers stay in your Garden.'],
  friends: ['Grow a little closer', 'Friend features are being connected. Your circle will have a home here.'],
  visit: ['A little journey, together', 'Garden visits are being connected. You can keep tending your own Garden for now.'],
  fairy: ['A companion for your Garden', 'Fairy features are being connected. Your Garden companion stays just where it belongs.'],
  weekly: ['Your week, gently reflected', 'Weekly reflections are being connected. Keep collecting your everyday moments.'],
  monthly: ['A month of little blooms', 'Monthly reflections are not available yet. Your saved Events remain in your Garden.'],
};

// Only the temporary shell owns the modal. Garden stays mounted underneath it.
export function FeatureOverlay({ feature, onClose, onGardenChanged }: {
  feature: Feature | undefined; onClose: () => void; onGardenChanged?: () => void;
}) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  if (!feature) return null;
  return <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
      <View style={[StyleSheet.absoluteFill, styles.backdrop]} />
      <View accessibilityViewIsModal accessibilityLabel={`${feature.label} panel`}
        style={[styles.panel, { width: Math.min(440, width - 24), maxHeight: Math.max(180, height - insets.top - insets.bottom - 24) }]}>
        <View style={styles.accent}><View style={styles.tealAccent} /><View style={styles.purpleAccent} /></View>
        <View style={styles.header}>
          <View style={styles.icon}><SymbolView name={feature.icon} size={25} tintColor={colors.ink} /></View>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={ui.title}>{feature.label}</Text>
            <StatusChip status={feature.status} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Close ${feature.label}`} onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && ui.pressed]}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <FeatureContent key={feature.id} feature={feature} onClose={onClose} onGardenChanged={onGardenChanged} />
        </ScrollView>
        <View style={styles.footer}>
          <View style={styles.footerIcon}><SymbolView name={{ ios: 'leaf.fill', android: 'local_florist', web: 'local_florist' }} size={23} tintColor={colors.ink} /></View>
          <View style={{ flex: 1 }}><FeatureActionButton title="Return to Garden" onPress={onClose} /></View>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

function FeatureContent({ feature, onClose, onGardenChanged }: {
  feature: Feature; onClose: () => void; onGardenChanged?: () => void;
}) {
  const { session, experience, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const profile = experience?.user || session?.user;
  if (feature.id === 'events') return <EventsPanel onClose={onClose} onGardenChanged={onGardenChanged} />;
  if (feature.id === 'profile' || feature.id === 'settings') return <View style={ui.body}>
    <View style={styles.profileHero}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{profile?.avatar || '○'}</Text></View>
      <Text style={ui.title}>{profile?.name || 'PetalPal account'}</Text>
      <Text style={ui.caption}>{profile?.timezone || 'UTC'}</Text>
    </View>
    {feature.id === 'profile' ? <FeatureSection title="Your Garden profile">
      <Text style={ui.text}>This is your saved profile. Name and avatar editing will be connected later.</Text>
      <Text style={ui.caption}>Read only · synced from your account</Text>
    </FeatureSection> : <>
      <FeatureSection title="Your account">
        <Text style={ui.text}>Your Events and flowers are saved to your account.</Text>
        <Text style={ui.caption}>Signing out keeps your saved Garden safe.</Text>
      </FeatureSection>
      <FeatureSection title="AI & privacy">
        <Text style={ui.text}>Your existing consent settings are preserved. Consent controls are being connected.</Text>
      </FeatureSection>
      {error ? <Text accessibilityRole="alert" style={ui.text}>{error}</Text> : null}
      <FeatureActionButton title={busy ? 'Signing out…' : 'Sign out'} disabled={busy} onPress={async () => {
        setBusy(true); setError('');
        try { await logout(); onClose(); }
        catch { setError('Unable to sign out. Please try again.'); }
        finally { setBusy(false); }
      }} />
    </>}
  </View>;
  const message = messages[feature.id] || ['A new corner of your Garden', 'This feature is not available yet.'];
  return <View style={styles.empty}>
    <View style={styles.orbit}>
      <View style={styles.orbitDot} />
      <SymbolView name={feature.icon} size={42} tintColor={colors.ink} />
    </View>
    <Text style={[ui.title, styles.center]}>{message[0]}</Text>
    <Text style={[ui.text, styles.center]}>{message[1]}</Text>
    <Text style={[ui.caption, styles.center]}>No actions are available here yet.</Text>
  </View>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
  backdrop: { backgroundColor: '#00000045' },
  panel: { flexShrink: 1, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: '#5AA4AB70',
    backgroundColor: colors.paper, boxShadow: '0 14px 48px rgba(37,60,64,0.2)', elevation: 12 },
  accent: { height: 4, flexDirection: 'row' },
  tealAccent: { flex: 2, backgroundColor: colors.primary }, purpleAccent: { flex: 1, backgroundColor: colors.secondary },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderBottomWidth: 1, borderColor: colors.line },
  icon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tealWash },
  heading: { flex: 1, gap: 8 },
  close: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.purpleWash },
  closeText: { fontSize: 28, lineHeight: 32, color: colors.ink },
  scroll: { flexShrink: 1 }, content: { padding: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 12, marginTop: 0,
    padding: 10, borderRadius: 20, backgroundColor: colors.purpleWash },
  footerIcon: { width: 40, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tealWash },
  empty: { alignItems: 'center', paddingVertical: 22, gap: 18 },
  center: { textAlign: 'center' },
  orbit: { width: 96, height: 96, borderRadius: 36, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.tealWash, borderWidth: 1, borderColor: colors.line },
  orbitDot: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.secondary },
  profileHero: { alignItems: 'center', gap: 10 },
  avatar: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: colors.purpleWash },
  avatarText: { fontSize: 36 },
});
