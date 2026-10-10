import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const synthetic = process.argv.includes('--synthetic');
const integration = process.argv.includes('--integration');
const productionApiOrigin = 'https://petalpal-v2.onrender.com';
const productionFirebaseProject = 'petalpal-b212c';
const productionAuthDomain = 'petalpal-b212c.firebaseapp.com';
const productionFirebaseAppId = '1:879846854472:web:02b860eacfaf5bb7616d7d'; // public default in mobile/src/services/firebase.ts
if (synthetic && integration) throw new Error('Choose one build target: --synthetic or --integration');
// Integration build: explicit test backend + test Firebase Web App, never production.
const apiOrigin = integration ? (process.env.CLOUDFLARE_API_ORIGIN || '') : productionApiOrigin;
if (integration) {
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(apiOrigin) || apiOrigin.toLowerCase() === productionApiOrigin) {
    throw new Error('Integration build requires CLOUDFLARE_API_ORIGIN: an exact non-production HTTPS origin');
  }
  if (process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID === productionFirebaseProject ||
      String(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN).toLowerCase() === productionAuthDomain ||
      process.env.EXPO_PUBLIC_FIREBASE_APP_ID === productionFirebaseAppId) {
    throw new Error('Integration build must use the isolated test Firebase project, not production');
  }
}
const config = JSON.parse(readFileSync(new URL('../mobile/app.json', import.meta.url)));
if (config.expo.web.output !== 'single') throw new Error('Review hosting routing before changing Expo output mode');
const names = ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'APP_ID'].map(x => `EXPO_PUBLIC_FIREBASE_${x}`);
// Do not inherit unrelated provider credentials or native test flags into Expo.
const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'SystemRoot'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
Object.assign(env, {
  NODE_ENV: 'production', EXPO_NO_DOTENV: '1', EXPO_NO_TELEMETRY: '1', CI: '1',
  EXPO_PUBLIC_API_BASE_URL: apiOrigin
});
const fixtures = ['synthetic-public-build-fixture', 'fixture.invalid', 'petalpal-synthetic', 'synthetic-public-app'];
for (const [index, name] of names.entries()) {
  if (!synthetic && !process.env[name]) throw new Error(`Missing required public frontend setting: ${name}`);
  env[name] = synthetic ? fixtures[index] : process.env[name];
}
console.log(`Exporting Expo Web (${synthetic ? 'synthetic validation only' : integration ? 'isolated integration configuration' : 'production configuration'}).`);
// Expo/Metro output is deliberately suppressed: never echo public key values
// or arbitrary build-time configuration into CI logs. Exit status is sufficient.
const result = spawnSync('npm', ['--prefix', 'mobile', 'run', 'build:web', '--', '--max-workers', '2'], {
  cwd: new URL('..', import.meta.url), env, stdio: 'ignore'
});
if (result.error || result.status !== 0) throw new Error('Expo export failed; inspect with synthetic configuration only');
console.log('Expo Web export completed; no deployment performed.');
