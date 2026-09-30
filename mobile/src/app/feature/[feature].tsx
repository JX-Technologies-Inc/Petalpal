import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, ScrollView, StyleSheet, Text } from 'react-native';
import { useAuth } from '../../services/auth';
import { gardenFeature } from '../../services/featureCatalog';

// Intentionally replaceable missing-feature presentation; no pretend backend actions.
export default function FeatureScreen() {
  const { feature: id } = useLocalSearchParams<{ feature: string }>();
  const feature = gardenFeature(id);
  const { session, experience, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const profile = experience?.user || session?.user;
  return <ScrollView contentContainerStyle={styles.content}>
    <Button title="Back to Garden" onPress={() => router.dismissTo('/')} />
    <Text style={styles.title}>{feature?.label || 'Feature unavailable'}</Text>
    <Text>Status: {feature?.status || 'COMING SOON'}</Text>
    {feature?.id === 'profile' || feature?.id === 'settings' ? <>
      <Text>Name: {profile?.name || 'PetalPal account'}</Text>
      <Text>Avatar: {profile?.avatar || 'Not set'}</Text>
      <Text>Timezone: {profile?.timezone || 'UTC'}</Text>
      {feature.id === 'profile' ? <Text>Profile display is connected. Profile and avatar editing have not been migrated.</Text> : <>
        <Text>Account and logout are connected. AI consent controls will be migrated in a later phase. Your existing consent settings are preserved.</Text>
        {error ? <Text accessibilityRole="alert">{error}</Text> : null}
        <Button title={busy ? 'Signing out…' : 'Sign out'} disabled={busy} onPress={async () => {
          setBusy(true); setError('');
          try { router.dismissTo('/'); await logout(); }
          catch { setError('Unable to sign out. Please try again.'); }
          finally { setBusy(false); }
        }} />
      </>}
    </> : <Text>Not migrated yet. This shortcut is a placeholder; it performs no backend operations.</Text>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: 24, gap: 16 },
  title: { fontSize: 24, fontWeight: '600' },
});
