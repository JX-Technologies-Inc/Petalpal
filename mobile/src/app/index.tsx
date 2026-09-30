import { Button, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../services/auth';
export default function HomeScreen() {
  const { session, logout, error } = useAuth();
  return <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
    <Text style={{ fontSize: 26 }}>PetalPal</Text>
    <Text>Welcome, {session?.user.name}</Text>
    <Button title="Events and flowers" onPress={() => router.push('/journal')} />
    <Button title="Open Garden" onPress={() => router.push('/garden-test')} />
    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    <Button title="Sign out" onPress={() => void logout()} />
  </View>;
}
