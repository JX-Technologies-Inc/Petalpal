// Release helpers for the production web Worker `petalpal-web-production` ONLY.
// Used by .github/workflows/cloudflare-production-deploy.yml. The Worker has no
// workers.dev, preview URL or route in either profile; public exposure (custom
// domain/DNS, Access removal) is a separate human step outside this tooling.
// Never prints tokens, keys or Firebase values.
import { readFileSync, readdirSync, statSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkArtifactMetadata } from './cloudflare-integration-deploy.mjs';

export const WORKER_NAME = 'petalpal-web-production';
export const PRODUCTION_API_ORIGIN = 'https://petalpal-v2.onrender.com';
export const PRODUCTION_FIREBASE_PROJECT = 'petalpal-b212c';
export const PRODUCTION_AUTH_DOMAIN = 'petalpal-b212c.firebaseapp.com';
export const PRODUCTION_APP_ID = '1:879846854472:web:02b860eacfaf5bb7616d7d';
const TEST_MARKERS = ['petalpal-backend-test', 'petalpal-integration-test', 'petalpal-web-integration', '.workers.dev',
  'synthetic-public-build-fixture', 'fixture.invalid', '__preview-fixtures'];

export const appMessage = (artifactId, digest) => `production-artifact ${artifactId} ${digest}`;
export const fallbackMessage = sha => `first-launch-fallback ${sha}`;

const stripComments = text => JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''));
function privateProfileErrors(config) {
  const errors = [];
  if (config.name !== WORKER_NAME) errors.push('wrong Worker name');
  if (config.workers_dev !== false) errors.push('workers_dev must be false');
  if (config.preview_urls !== false) errors.push('preview_urls must be false');
  if (!Array.isArray(config.routes) || config.routes.length) errors.push('routes must be empty');
  if (config.route || config.custom_domains || config.env) errors.push('no route, custom domain or environment overrides allowed');
  return errors;
}

// Application profile: production Worker, private, production defaults (no vars).
export function checkProductionConfig(text) {
  const config = stripComments(text);
  const errors = privateProfileErrors(config);
  if (config.main !== 'worker.js' || config.assets?.directory !== '../../mobile/dist') errors.push('unexpected entry or assets directory');
  if (config.vars) errors.push('production profile must not set vars (CSP uses production defaults)');
  return errors;
}

// Fallback profile: same Worker, redirect-only entry, no assets or vars.
export function checkFallbackConfig(text) {
  const config = stripComments(text);
  const errors = privateProfileErrors(config);
  if (config.main !== 'rollback-worker.js' || config.assets || config.vars) errors.push('fallback profile must be redirect-only');
  return errors;
}

// Production artifact content: existing production backend + Firebase Web App only.
export function checkProductionDistText(text) {
  const errors = [];
  const firebase = text.match(/initializeApp\)\(\{apiKey:"([^"]*)",authDomain:"([^"]*)",projectId:"([^"]*)",appId:"([^"]*)"\}/);
  if (!firebase) errors.push('Firebase Web config not found');
  else {
    const [, apiKey, authDomain, projectId, appId] = firebase;
    if (!/^AIza[0-9A-Za-z_-]{35}$/.test(apiKey)) errors.push('Firebase API key malformed');
    if (projectId !== PRODUCTION_FIREBASE_PROJECT || authDomain !== PRODUCTION_AUTH_DOMAIN || appId !== PRODUCTION_APP_ID) {
      errors.push('Firebase Web App is not the existing production app');
    }
  }
  const backends = [...new Set(text.match(/https:\/\/[a-z0-9.-]+\.onrender\.com/g) || [])];
  if (backends.length !== 1 || backends[0] !== PRODUCTION_API_ORIGIN) errors.push('backend origin is not exactly the production API');
  for (const marker of TEST_MARKERS) if (text.includes(marker)) errors.push('TEST, integration or synthetic identifier present');
  for (const pattern of [/BEGIN [A-Z ]*PRIVATE KEY|"private_key"\s*:/, /"type"\s*:\s*"service_account"|client_x509_cert_url/,
    /postgres(?:ql)?:\/\/[^"'\s]*@|prisma\+postgres:\/\//, /DATABASE_URL|FIREBASE_SERVICE_ACCOUNT_JSON|CLOUDFLARE_WORKER_AI_TOKEN|AI_JOB_(?:DISPATCH|EXECUTOR)_TOKEN/]) {
    if (pattern.test(text)) errors.push('forbidden server credential content present');
  }
  return [...new Set(errors)];
}

function readDist(dist) {
  const files = [];
  const walk = dir => { for (const entry of readdirSync(dir)) { const path = join(dir, entry); statSync(path).isDirectory() ? walk(path) : files.push(path); } };
  walk(dist);
  const errors = [];
  if (!files.some(file => file.endsWith('/index.html'))) errors.push('index.html missing');
  if (files.length >= 20000) errors.push('asset count exceeds Cloudflare limit');
  if (files.some(file => statSync(file).size > 25 * 1024 * 1024)) errors.push('asset exceeds 25 MiB Cloudflare limit');
  const text = files.filter(file => /\.(js|html|json|css|map)$/.test(file)).map(file => readFileSync(file, 'utf8')).join('\n');
  return { errors: [...errors, ...checkProductionDistText(text)], count: files.length };
}

// Which version may be deployed by which phase: by its recorded upload message.
export function versionAllowed(phase, message, { artifactId, digest, sourceSha }) {
  if (phase === 'activate-app') return message === appMessage(artifactId, digest);
  if (phase === 'rollback') return message === fallbackMessage(sourceSha);
  return false;
}

async function cf(path) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}${path}`, {
    signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.success === false) throw new Error(`Cloudflare API GET failed (HTTP ${response.status}; codes ${(json.errors || []).map(e => e.code).join(',') || 'none'})`);
  return json.result;
}

async function main([command]) {
  const env = process.env;
  const fail = errors => { for (const error of errors) console.log(`::error::${error}`); process.exit(1); };
  const expected = { artifactId: env.ARTIFACT_ID, digest: env.ARTIFACT_DIGEST, sourceSha: env.SOURCE_SHA };
  const profile = file => readFileSync(new URL(`../deploy/cloudflare/${file}`, import.meta.url), 'utf8');
  if (command === 'check-fallback') {
    const errors = checkFallbackConfig(profile('wrangler.rollback.jsonc'));
    if (errors.length) fail(errors);
    console.log('Fallback profile PASS (production Worker, private, redirect-only)');
  } else if (command === 'check-artifact') {
    const errors = checkArtifactMetadata(JSON.parse(readFileSync(env.ARTIFACT_METADATA, 'utf8')), expected, 'production');
    if (errors.length) fail(errors);
    console.log('Production artifact provenance PASS');
  } else if (command === 'check-content') {
    const config = checkProductionConfig(profile('wrangler.production.jsonc'));
    const { errors, count } = readDist(new URL('../mobile/dist/', import.meta.url).pathname);
    if (config.length || errors.length) fail([...config, ...errors]);
    console.log(`Production profile and ${count}-file artifact PASS (production API + production Firebase only)`);
  } else if (command === 'check-version') {
    const id = String(env.VERSION_ID || '');
    if (!/^[0-9a-f-]{36}$/.test(id)) fail(['VERSION_ID must be a Worker version UUID']);
    const version = await cf(`/workers/scripts/${WORKER_NAME}/versions/${id}`);
    const message = version?.annotations?.['workers/message'] || version?.metadata?.annotations?.['workers/message'] || null;
    if (!versionAllowed(env.PHASE, message, expected)) fail([`version ${id} is not the verified ${env.PHASE === 'rollback' ? 'fallback' : 'application'} upload`]);
    console.log(`Version ${id} verified for ${env.PHASE}`);
  } else if (command === 'record-version') {
    // Parse only the version UUID from Wrangler output; emit it for the release record.
    const match = readFileSync(env.WRANGLER_OUTPUT, 'utf8').match(/Version ID:\s*([0-9a-f-]{36})/i);
    if (!match) fail(['Wrangler did not report a version ID']);
    console.log(`::notice title=${env.PHASE}::${WORKER_NAME} version ${match[1]} (${env.MESSAGE})`);
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${env.PHASE}: \`${match[1]}\` — ${env.MESSAGE}\n`);
  } else throw new Error('Unknown command');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
