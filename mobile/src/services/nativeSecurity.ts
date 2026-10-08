export const nativeSecurityRequested = process.env.EXPO_PUBLIC_NATIVE_SECURITY_TEST === '1';
export function assertNativeSecurityClient(value = process.env.EXPO_PUBLIC_API_BASE_URL) {
  if (!process.env.EXPO_PUBLIC_NATIVE_SECURITY_TEST) return;
  if (!nativeSecurityRequested || !__DEV__ || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID !== 'petalpal-native-security-test' ||
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN !== 'petalpal-native-security-test.firebaseapp.com' ||
      !process.env.EXPO_PUBLIC_FIREBASE_API_KEY || !process.env.EXPO_PUBLIC_FIREBASE_APP_ID) {
    throw new Error('Native security client isolation cannot be confirmed');
  }
  let url: URL;
  try { url = new URL(value || ''); } catch { throw new Error('Isolated HTTPS endpoint is missing'); }
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.trycloudflare\.com$/.test(url.hostname) ||
      url.username || url.password || url.port || url.search || url.hash || url.pathname !== '/' ||
      url.origin !== new URL(process.env.EXPO_PUBLIC_API_BASE_URL!).origin) {
    throw new Error('Native security API boundary mismatch');
  }
}
// Reject the isolated flag in released builds before storage or SDK access.
assertNativeSecurityClient();
export const nativeSecurityEnabled = __DEV__ && nativeSecurityRequested;
