import { router } from 'expo-router';
import { Button, ScrollView, Text } from 'react-native';
import { useAuth } from '../../services/auth';
import { BACKEND_QA_FEATURES } from '../../services/backendQa';
import { useBackendQa } from '../../hooks/useBackendQa';

export default function BackendQaScreen() {
  const { session } = useAuth();
  const qa = useBackendQa(session?.user.id, __DEV__);
  if (!__DEV__) return <Text>Not available.</Text>;
  return <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
    <Text>Backend integration QA — development only</Text>
    <Button title="Back to Garden" onPress={() => router.dismissTo('/')} />
    <Text>PREVIEW means a backend exists; the mobile workflow is incomplete. Statuses are integration capabilities, not live API checks.</Text>
    {BACKEND_QA_FEATURES.map(([feature, status]) => <Text key={feature}>{feature}: {status}</Text>)}
    <Button title="Refresh backend summary" disabled={qa.loading} onPress={() => void qa.refresh()} />
    {qa.loading ? <Text>Checking session and Garden…</Text> : null}
    {qa.failed ? <Text accessibilityRole="alert">Backend summary unavailable. Check your connection and retry.</Text> : null}
    {qa.summary ? <>
      <Text>Session and owner Garden: OK</Text>
      <Text>Flowers: {qa.summary.flowers}</Text>
      <Text>Event flowers: {qa.summary.eventFlowers}</Text>
      <Text>Historical / Daily flowers: {qa.summary.historicalOrDailyFlowers}</Text>
      <Text>Flowers with backend secondary emotions: {qa.summary.flowersWithSecondaryEmotions}</Text>
      <Text>Checked in today: {qa.summary.checkedInToday ? 'Yes' : 'No'}</Text>
    </> : null}
  </ScrollView>;
}
