import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Fonts, Spacing } from '../constants/theme';
import { useAuth } from '../services/auth';

export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [mode, setMode] = useState<'signIn' | 'register'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🦋');
  const [aiConsent, setAiConsent] = useState(false);
  const [working, setWorking] = useState(false);
  const busy = useRef(false);
  const checkVerification = useRef(auth.checkVerification);
  checkVerification.current = auth.checkVerification;

  useEffect(() => {
    setEmail(''); setPassword(''); setConfirmation(''); setName('');
    setAvatar('🦋'); setAiConsent(false); setMode('signIn');
  }, [auth.identity?.uid]);
  useEffect(() => {
    if (!auth.loading) void SplashScreen.hideAsync().catch(() => {});
  }, [auth.loading]);
  useEffect(() => {
    if (auth.phase !== 'verificationPending') return;
    // Resume after visiting the verification link, without polling or forcing
    // another registration. The provider guards against identity changes.
    const recheck = () => { if (!busy.current) void checkVerification.current(); };
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') recheck(); });
    if (typeof window !== 'undefined') window.addEventListener('focus', recheck);
    return () => {
      subscription.remove();
      if (typeof window !== 'undefined') window.removeEventListener('focus', recheck);
    };
  }, [auth.phase]);

  async function run(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true; setWorking(true);
    try { await action(); }
    finally { busy.current = false; setWorking(false); setPassword(''); setConfirmation(''); }
  }
  const button = (label: string, action: () => Promise<void>, disabled = false, secondary = false) =>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: working || disabled }}
      disabled={working || disabled} onPress={() => void run(action)}
      style={[styles.button, secondary && styles.secondaryButton, (working || disabled) && styles.disabled]}>
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{label}</Text>
    </Pressable>;
  const field = (label: string, props: TextInputProps) => <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor="#7a887b" editable={!working}
      style={styles.input} {...props} />
  </View>;

  if (auth.phase === 'signedIn' && auth.session) return <>{children}</>;
  if (auth.loading) return <View style={styles.loading}>
    <ActivityIndicator color="#365b42" accessibilityLabel="Loading session" />
    <Text style={styles.body}>{auth.phase === 'registering' ? 'Creating your account…' : 'Opening PetalPal…'}</Text>
  </View>;
  const verification = auth.phase === 'verificationPending';
  const profile = auth.phase === 'profileRequired';
  const registering = mode === 'register';
  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
      <View style={styles.card} testID="auth-card">
        <Text style={styles.brand}>PetalPal</Text>
        <Text style={styles.title}>{verification ? 'Verify your email' : profile ? 'Welcome to your garden'
          : registering ? 'Create your PetalPal account' : 'Sign in to PetalPal'}</Text>
        <Text style={styles.body}>{verification ? `Check your inbox at ${auth.identity?.email || 'your email address'}.`
          : profile ? 'Choose how you’ll appear in PetalPal.' : 'Your feelings, your flowers, your little place to grow.'}</Text>
        {verification ? <>
          {button(working ? 'Checking…' : 'I’ve verified my email', auth.checkVerification)}
          {button('Resend verification email', auth.resendVerification, false, true)}
          {button('Use another account', auth.logout, false, true)}
        </> : profile ? <>
          {field('Display name', { value: name, onChangeText: setName, maxLength: 80, autoComplete: 'name' })}
          <Text style={styles.label}>Garden avatar</Text>
          <View style={styles.avatars}>{['🦋', '🐝', '🐦'].map((choice) => <Pressable key={choice}
            accessibilityRole="radio" accessibilityLabel={{ '🦋': 'Butterfly', '🐝': 'Bee', '🐦': 'Bird' }[choice]}
            accessibilityState={{ selected: avatar === choice }} disabled={working} onPress={() => setAvatar(choice)}
            style={[styles.avatar, avatar === choice && styles.selected]}><Text style={styles.avatarText}>{choice}</Text></Pressable>)}</View>
          <Pressable accessibilityRole="checkbox" accessibilityLabel="Allow AI processing of my Events"
            accessibilityState={{ checked: aiConsent, disabled: working }} disabled={working}
            onPress={() => setAiConsent(!aiConsent)} style={styles.consent}>
            <Text style={styles.label}>{aiConsent ? '☑' : '☐'} Allow AI processing of my Events</Text>
          </Pressable>
          <Text style={styles.hint}>Optional. Off by default. This does not enable long-term memory.</Text>
          {button(working ? 'Saving…' : 'Continue to PetalPal', () => auth.completeProfile({ name, avatar, aiConsent }), !name.trim())}
          {button('Use another account', auth.logout, false, true)}
        </> : <>
          {field('Email', { value: email, onChangeText: setEmail, keyboardType: 'email-address', autoCapitalize: 'none',
            autoCorrect: false, autoComplete: 'email' })}
          {field('Password', { value: password, onChangeText: setPassword, secureTextEntry: true,
            autoComplete: registering ? 'new-password' : 'current-password' })}
          {registering && field('Confirm password', { value: confirmation, onChangeText: setConfirmation,
            secureTextEntry: true, autoComplete: 'new-password' })}
          {button(working ? 'Please wait…' : registering ? 'Create account' : 'Sign in',
            () => registering ? auth.register(email, password, confirmation) : auth.login(email, password), !email.trim() || !password)}
          <Pressable accessibilityRole="button" disabled={working} onPress={() => {
            setMode(registering ? 'signIn' : 'register'); setPassword(''); setConfirmation('');
          }} style={styles.switchMode}>
            <Text style={styles.link}>{registering ? 'Already have an account? Sign in' : 'New to PetalPal? Create account'}</Text>
          </Pressable>
          {auth.identity && auth.error ? button('Retry session', auth.retry, false, true) : null}
        </>}
        {auth.message ? <Text accessibilityLiveRegion="polite" style={styles.body}>{auth.message}</Text> : null}
        {auth.error ? <Text accessibilityRole="alert" style={styles.error}>{auth.error}</Text> : null}
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#eff4e9' },
  loading: { flex: 1, backgroundColor: '#eff4e9', alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  page: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.four },
  card: { width: '100%', maxWidth: 440, backgroundColor: '#fbfcf6', borderRadius: 24,
    padding: Spacing.four, gap: Spacing.three, borderWidth: 1, borderColor: '#c8d6c1' },
  brand: { color: '#365b42', fontFamily: Fonts.rounded, fontSize: 22, fontWeight: '700' },
  title: { color: '#294732', fontFamily: Fonts.rounded, fontSize: 28, fontWeight: '700', lineHeight: 34 },
  body: { color: '#536653', fontFamily: Fonts.sans, fontSize: 15, lineHeight: 23 },
  field: { gap: Spacing.two },
  label: { color: '#294732', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#c8d6c1', borderRadius: 12,
    backgroundColor: '#fff', color: '#294732', fontFamily: Fonts.sans, fontSize: 16, padding: Spacing.three },
  button: { minHeight: 48, backgroundColor: '#365b42', borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  buttonText: { color: '#fff', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '600' },
  secondaryButton: { backgroundColor: '#e3edda' },
  secondaryButtonText: { color: '#365b42' },
  disabled: { opacity: 0.5 },
  switchMode: { paddingVertical: Spacing.two, alignItems: 'center' },
  link: { color: '#365b42', fontFamily: Fonts.sans, fontSize: 14, textAlign: 'center' },
  avatars: { flexDirection: 'row', gap: Spacing.two },
  avatar: { padding: Spacing.three, borderRadius: 12, borderWidth: 1, borderColor: '#c8d6c1' },
  avatarText: { fontSize: 24 },
  selected: { backgroundColor: '#e3edda', borderColor: '#365b42' },
  consent: { paddingVertical: Spacing.two },
  hint: { color: '#536653', fontSize: 12, lineHeight: 18 },
  error: { color: '#983e3e', fontFamily: Fonts.sans, fontSize: 14, lineHeight: 21 },
});
