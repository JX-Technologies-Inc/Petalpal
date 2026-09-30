import { getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Metro selects Firebase's React Native export, which provides this persistence.
import * as FirebaseAuth from 'firebase/auth';
let auth: Auth | undefined;
export function firebaseAuth(): Auth {
  if (auth) return auth;
  if (!process.env.EXPO_PUBLIC_FIREBASE_API_KEY) throw new Error('Configure the public Firebase client settings to sign in.');
  const app = getApps().find((item) => item.name === 'petalpal-mobile') || initializeApp({
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'petalpal-b212c.firebaseapp.com',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'petalpal-b212c',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:879846854472:web:02b860eacfaf5bb7616d7d',
  }, 'petalpal-mobile');
  if (Platform.OS === 'web') auth = getAuth(app);
  else {
    const native = FirebaseAuth as typeof FirebaseAuth & {
      getReactNativePersistence: (storage: typeof AsyncStorage) => import('firebase/auth').Persistence;
    };
    auth = initializeAuth(app, { persistence: native.getReactNativePersistence(AsyncStorage) });
  }
  return auth;
}
