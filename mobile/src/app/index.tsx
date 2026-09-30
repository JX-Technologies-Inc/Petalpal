import * as Device from 'expo-device';
import { Link, router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedIcon } from '@/components/animated-icon';
import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

function getDevMenuHint() {
  if (Platform.OS === 'web') {
    return <ThemedText type="small">use browser devtools</ThemedText>;
  }
  if (Device.isDevice) {
    return (
      <ThemedText type="small">
        shake device or press <ThemedText type="code">m</ThemedText> in terminal
      </ThemedText>
    );
  }
  const shortcut = Platform.OS === 'android' ? 'cmd+m (or ctrl+m)' : 'cmd+d';
  return (
    <ThemedText type="small">
      press <ThemedText type="code">{shortcut}</ThemedText>
    </ThemedText>
  );
}

export default function HomeScreen() {
  if (__DEV__) return <DevHomeScreen />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <AnimatedIcon />
          <ThemedText type="title" style={styles.title}>
            Welcome to&nbsp;Expo
          </ThemedText>
        </ThemedView>

        <ThemedText type="code" style={styles.code}>
          get started
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.stepContainer}>
          <HintRow
            title="Try editing"
            hint={<ThemedText type="code">src/app/index.tsx</ThemedText>}
          />
          <HintRow title="Dev tools" hint={getDevMenuHint()} />
          <HintRow
            title="Fresh start"
            hint={<ThemedText type="code">npm run reset-project</ThemedText>}
          />
        </ThemedView>

        {Platform.OS === 'web' && <WebBadge />}
      </SafeAreaView>
    </ThemedView>
  );
}

const DEV_ROUTES = [
  { label: '🌸 Open Journal (Planting & Entries)', href: '/journal' },
  { label: 'Open native garden preview', href: '/garden-test' },
  { label: 'Open Treehouse test', href: '/treehouse-test' },
  { label: 'Open Swing test', href: '/swing-test' },
  { label: 'Open Moon Bed test', href: '/moon-bed-test' },
  { label: 'Open Tea Set test', href: '/tea-set-test' },
  { label: 'Open Waterfall test', href: '/waterfall-test' },
  { label: 'Open Water preview', href: '/water-test' },
] as const;

function DevHomeScreen() {
  return <ThemedView style={styles.container}>
    <SafeAreaView style={styles.devSafeArea}>
      <ScrollView style={styles.devScroll} contentContainerStyle={styles.devContent}>
        <ThemedText type="subtitle" style={styles.devTitle}>PetalPal DEV</ThemedText>
        <View style={styles.devButtons}>
          {DEV_ROUTES.map(({ label, href }) => (
            <Pressable key={href} accessibilityRole="button" style={styles.devButton}
              onPress={() => router.push(href)}>
              <Text style={styles.devButtonText}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Link href="/explore" style={styles.exploreLink}>Open Explore starter screen</Link>
      </ScrollView>
    </SafeAreaView>
  </ThemedView>;
}

const styles = StyleSheet.create({
  devSafeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  devScroll: { flex: 1 },
  devContent: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, gap: 12 },
  devTitle: { textAlign: 'center' },
  devButtons: { alignSelf: 'stretch', gap: 8 },
  devButton: {
    minHeight: 42, paddingHorizontal: 14, paddingVertical: 9,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#245B45', borderRadius: 10,
  },
  devButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  exploreLink: { alignSelf: 'center', paddingVertical: 6 },
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  code: {
    textTransform: 'uppercase',
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
});
