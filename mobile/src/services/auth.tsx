import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { apiRequest, configureApi } from './api';
import { firebaseAuth } from './firebase';
import { scopeFlowerPlacements } from '../components/garden/planting/plantingPersistence';
import type { FlowerSession } from '../components/garden/planting/flowerDetailApi';
interface SessionResponse { user: FlowerSession['user'] | null; needsProfile?: boolean }
interface AuthState {
  session: FlowerSession | null; loading: boolean; needsProfile: boolean; error: string;
  login: (email: string, password: string) => Promise<void>;
  completeProfile: (name: string) => Promise<void>;
  logout: () => Promise<void>; retry: () => Promise<void>;
}
const Context = createContext<AuthState | null>(null);
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('AuthProvider required'); return value; }
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<FlowerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(0);
  async function sync(name?: string) {
    const generation = ++version.current;
    setLoading(true); setError('');
    try {
      const auth = firebaseAuth();
      await auth.authStateReady();
      if (!auth.currentUser) { setSession(null); setNeedsProfile(false); return; }
      configureApi({ apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ||
        (typeof window !== 'undefined' && __DEV__ ? `${window.location.protocol}//${window.location.hostname}:3000` : ''),
        getAccessToken: async (force) => { await auth.authStateReady(); return auth.currentUser?.getIdToken(force) || null; } });
      const result = await apiRequest<SessionResponse>('/auth/session', 'POST', name
        ? { name: name.trim(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, aiConsent: false }
        : { deferProfileCreation: true });
      if (generation !== version.current) return;
      setNeedsProfile(Boolean(result.needsProfile));
      scopeFlowerPlacements(result.user?.id || null);
      setSession(result.user ? { user: result.user } : null);
    } catch (err) {
      if (generation === version.current) { setSession(null); setError(err instanceof Error ? err.message : 'Unable to sign in.'); }
    } finally { if (generation === version.current) setLoading(false); }
  }
  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(firebaseAuth(), () => {
        // Unmount private screens immediately when the Firebase identity changes.
        setSession(null); setNeedsProfile(false); scopeFlowerPlacements(null); configureApi(null); void sync();
      });
      return () => { version.current++; unsubscribe(); configureApi(null); };
    } catch (err) { setLoading(false); setError((err as Error).message); }
  }, []);
  const value: AuthState = { session, loading, needsProfile, error,
    login: async (email, password) => {
      setError('');
      try { await signInWithEmailAndPassword(firebaseAuth(), email.trim(), password); }
      catch (err) { setError((err as Error).message); }
    },
    completeProfile: (name) => sync(name), retry: () => sync(),
    logout: async () => {
      // In-flight requests are invalidated before Firebase sign-out resolves.
      version.current++; scopeFlowerPlacements(null); configureApi(null); setSession(null); setNeedsProfile(false); setError('');
      try { await signOut(firebaseAuth()); }
      catch (err) { setError((err as Error).message); }
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
