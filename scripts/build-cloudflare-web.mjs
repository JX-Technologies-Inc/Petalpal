import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const synthetic = process.argv.includes('--synthetic');
const config = JSON.parse(readFileSync(new URL('../mobile/app.json', import.meta.url)));
if (config.expo.web.output !== 'single') throw new Error('Review hosting routing before changing Expo output mode');
const names = ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'APP_ID'].map(x => `EXPO_PUBLIC_FIREBASE_${x}`);
// Do not inherit unrelated provider credentials or native test flags into Expo.
const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'SystemRoot'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
Object.assign(env, {
  NODE_ENV: 'production', EXPO_NO_DOTENV: '1', EXPO_NO_TELEMETRY: '1', CI: '1',
  EXPO_PUBLIC_API_BASE_URL: 'https://petalpal-v2.onrender.com'
});
const fixtures = ['synthetic-public-build-fixture', 'fixture.invalid', 'petalpal-synthetic', 'synthetic-public-app'];
for (const [index, name] of names.entries()) {
  if (!synthetic && !process.env[name]) throw new Error(`Missing required public frontend setting: ${name}`);
  env[name] = synthetic ? fixtures[index] : process.env[name];
}
console.log(`Exporting Expo Web (${synthetic ? 'synthetic validation only' : 'production configuration'}).`);
// Expo/Metro output is deliberately suppressed: never echo public key values
// or arbitrary build-time configuration into CI logs. Exit status is sufficient.
const result = spawnSync('npm', ['--prefix', 'mobile', 'run', 'build:web', '--', '--max-workers', '2'], {
  cwd: new URL('..', import.meta.url), env, stdio: 'ignore'
});
if (result.error || result.status !== 0) throw new Error('Expo export failed; inspect with synthetic configuration only');
console.log('Expo Web export completed; no deployment performed.');
