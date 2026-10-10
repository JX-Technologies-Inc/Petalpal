// Verifies an integration Expo Web export (mobile/dist) targets only the TEST
// backend and TEST Firebase Web App and bundles no server credentials.
// Expected values come from the build environment and are never printed.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../mobile/dist/', import.meta.url).pathname;
const required = ['CLOUDFLARE_API_ORIGIN', 'EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', 'EXPO_PUBLIC_FIREBASE_APP_ID'];
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`);

const files = [];
const walk = dir => { for (const entry of readdirSync(dir)) { const path = join(dir, entry); statSync(path).isDirectory() ? walk(path) : files.push(path); } };
walk(dist);
const text = files.filter(file => /\.(js|html|json|map|css)$/.test(file)).map(file => readFileSync(file, 'utf8')).join('\n');

const results = [];
const check = (name, ok) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); };
check('TEST API origin is bundled', text.includes(process.env.CLOUDFLARE_API_ORIGIN));
check('TEST Firebase project is bundled', text.includes(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID));
check('TEST Firebase auth domain is bundled', text.includes(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN));
check('TEST Firebase app ID is bundled', text.includes(process.env.EXPO_PUBLIC_FIREBASE_APP_ID));
// Production identifiers are public names; their absence proves no production binding.
for (const [name, value] of [['production API origin', 'petalpal-v2.onrender.com'], ['production Firebase project', 'petalpal-b212c'],
  ['production Firebase app ID', '1:879846854472:web:02b860eacfaf5bb7616d7d']]) check(`no ${name}`, !text.includes(value));
for (const [name, pattern] of [['private key material', /BEGIN [A-Z ]*PRIVATE KEY|"private_key"\s*:/],
  ['service-account JSON', /"type"\s*:\s*"service_account"|client_x509_cert_url/],
  ['database connection string', /postgres(?:ql)?:\/\/[^"'\s]*@|prisma\+postgres:\/\//],
  ['backend secret variable names', /DATABASE_URL|FIREBASE_SERVICE_ACCOUNT_JSON|CLOUDFLARE_WORKER_AI_TOKEN|AI_JOB_(?:DISPATCH|EXECUTOR)_TOKEN/]]) {
  check(`no ${name}`, !pattern.test(text));
}
console.log(`${files.length} exported files scanned`);
if (results.includes(false)) process.exit(1);
