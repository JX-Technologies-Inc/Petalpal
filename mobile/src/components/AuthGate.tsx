import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Button, Text, TextInput, View } from 'react-native';
import { useAuth } from '../services/auth';
export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [working, setWorking] = useState(false);
  if (auth.session && !auth.loading) return <>{children}</>;
  async function submit() {
    setWorking(true);
    try { if (auth.needsProfile) await auth.completeProfile(name); else await auth.login(email, password); }
    finally { setWorking(false); setPassword(''); }
  }
  return <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
    <Text style={{ fontSize: 24 }}>Sign in to PetalPal</Text>
    <Text>Use your existing PetalPal account and verified email.</Text>
    {auth.loading ? <ActivityIndicator accessibilityLabel="Loading session" /> : <>
      {auth.needsProfile ? <TextInput accessibilityLabel="Display name" placeholder="Display name" value={name} onChangeText={setName} /> : <>
        <TextInput accessibilityLabel="Email" placeholder="Email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
        <TextInput accessibilityLabel="Password" placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      </>}
      <Button title={working ? 'Signing in…' : auth.needsProfile ? 'Complete profile' : 'Sign in'} disabled={working || (auth.needsProfile ? !name.trim() : !email || !password)} onPress={submit} />
      <Button title="Sign out of this session" onPress={() => void auth.logout()} />
      {auth.error ? <><Text accessibilityRole="alert">{auth.error}</Text><Button title="Retry session" onPress={() => void auth.retry()} /></> : null}
    </>}
  </View>;
}
