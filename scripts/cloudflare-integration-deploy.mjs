// Deployment helpers for the isolated integration Worker ONLY. Used by
// .github/workflows/cloudflare-integration-deploy.yml. Pure checks are exported
// for tests; the CLI never prints tokens, keys or Firebase values.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const WORKER_NAME = 'petalpal-web-integration';
export const TEST_API_ORIGIN = 'https://petalpal-backend-test.onrender.com';
export const TEST_FIREBASE_PROJECT = 'petalpal-integration-test';
export const TEST_AUTH_DOMAIN = `${TEST_FIREBASE_PROJECT}.firebaseapp.com`;
export const BUILD_WORKFLOW_PATH = '.github/workflows/cloudflare-web-build.yml';
const PROTECTED_WORKERS = new Set(['petalpal-web-preview', 'petalpal-expo-synthetic-9a9d57d']);
const PRODUCTION_MARKERS = ['petalpal-v2.onrender.com', 'petalpal-b212c', '879846854472'];

export function deploymentMessage(artifactId, digest) { return `integration-artifact ${artifactId} ${digest}`; }

// 1. Artifact provenance: exact integration artifact from a successful main build.
export function checkArtifactMetadata({ artifact, run }, { artifactId, digest, sourceSha }) {
  const errors = [];
  if (String(artifact?.id) !== String(artifactId)) errors.push('artifact id mismatch');
  if (artifact?.name !== `expo-web-integration-${sourceSha}`) errors.push('artifact is not the integration export of the source commit');
  if (artifact?.digest !== digest) errors.push('artifact digest mismatch');
  if (artifact?.expired !== false) errors.push('artifact expired or unknown');
  if (artifact?.workflow_run?.id !== run?.id) errors.push('artifact run mismatch');
  if (run?.path !== BUILD_WORKFLOW_PATH) errors.push('artifact not produced by the Cloudflare build workflow');
  if (run?.head_branch !== 'main' || run?.head_sha !== sourceSha) errors.push('artifact not built from main at the source commit');
  if (run?.event !== 'workflow_dispatch' || run?.conclusion !== 'success') errors.push('artifact build run did not succeed');
  return errors;
}

// 2. Wrangler config: exact Worker, nothing public.
export function checkWranglerConfig(text) {
  const config = JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''));
  const errors = [];
  if (config.name !== WORKER_NAME || PROTECTED_WORKERS.has(config.name)) errors.push('wrong Worker name');
  if (config.workers_dev !== false) errors.push('workers_dev must be false');
  if (config.preview_urls !== false) errors.push('preview_urls must be false');
  if (!Array.isArray(config.routes) || config.routes.length) errors.push('routes must be empty');
  if (config.route || config.custom_domains || config.env) errors.push('no route, custom domain or environment overrides allowed');
  if (config.vars?.PETALPAL_ENVIRONMENT !== 'integration' || config.vars.API_ORIGIN || config.vars.FIREBASE_AUTH_DOMAIN) errors.push('unexpected vars');
  if (config.main !== 'worker.js' || config.assets?.directory !== '../../mobile/dist') errors.push('unexpected entry or assets directory');
  return errors;
}

// 3. Artifact content: TEST-only public configuration, no server credentials.
export function checkDistText(text) {
  const errors = [];
  const firebase = text.match(/initializeApp\)\(\{apiKey:"([^"]*)",authDomain:"([^"]*)",projectId:"([^"]*)",appId:"([^"]*)"\}/);
  if (!firebase) errors.push('Firebase Web config not found');
  else {
    const [, apiKey, authDomain, projectId, appId] = firebase;
    if (!/^AIza[0-9A-Za-z_-]{35}$/.test(apiKey)) errors.push('Firebase API key malformed');
    if (projectId !== TEST_FIREBASE_PROJECT || authDomain !== TEST_AUTH_DOMAIN) errors.push('Firebase project is not the TEST project');
    if (!/^1:\d+:web:[0-9a-f]+$/.test(appId)) errors.push('Firebase app ID malformed');
  }
  const backends = [...new Set(text.match(/https:\/\/[a-z0-9.-]+\.onrender\.com/g) || [])];
  if (backends.length !== 1 || backends[0] !== TEST_API_ORIGIN) errors.push('backend origin is not exactly the TEST backend');
  for (const marker of PRODUCTION_MARKERS) if (text.includes(marker)) errors.push('production identifier present');
  for (const pattern of [/BEGIN [A-Z ]*PRIVATE KEY|"private_key"\s*:/, /"type"\s*:\s*"service_account"|client_x509_cert_url/,
    /postgres(?:ql)?:\/\/[^"'\s]*@|prisma\+postgres:\/\//, /DATABASE_URL|FIREBASE_SERVICE_ACCOUNT_JSON|CLOUDFLARE_WORKER_AI_TOKEN|AI_JOB_(?:DISPATCH|EXECUTOR)_TOKEN/,
    /synthetic-public-build-fixture|fixture\.invalid|__preview-fixtures/]) if (pattern.test(text)) errors.push('forbidden content present');
  return [...new Set(errors)];
}

export function readDist(dist) {
  const files = [];
  const walk = dir => { for (const entry of readdirSync(dir)) { const path = join(dir, entry); statSync(path).isDirectory() ? walk(path) : files.push(path); } };
  walk(dist);
  const errors = [];
  if (!files.some(file => file.endsWith('/index.html'))) errors.push('index.html missing');
  if (files.length >= 20000) errors.push('asset count exceeds Cloudflare limit');
  if (files.some(file => statSync(file).size > 25 * 1024 * 1024)) errors.push('asset exceeds 25 MiB Cloudflare limit');
  const text = files.filter(file => /\.(js|html|json|css|map)$/.test(file)).map(file => readFileSync(file, 'utf8')).join('\n');
  return { errors: [...errors, ...checkDistText(text)], count: files.length };
}

// 5. Anonymous, cookie-free response classification.
export function classifyAnonymous(status, location) {
  if ([301, 302, 303, 307].includes(status) && /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com\//.test(location || '')) return 'protected';
  if (status === 401 || status === 403) return 'protected';
  if (status === 200 || (status >= 200 && status < 300)) return 'exposed';
  return 'pending';
}

async function cf(path, { method = 'GET', body } = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}${path}`, {
    method, body: body && JSON.stringify(body), signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
  });
  const json = await response.json().catch(() => ({}));
  // Error codes only; Cloudflare messages can echo request data.
  if (!response.ok || json.success === false) throw new Error(`Cloudflare API ${method} ${path.replace(/\/[0-9a-f]{32}/g, '/<id>')} failed (HTTP ${response.status}; codes ${(json.errors || []).map(e => e.code).join(',') || 'none'})`);
  return json.result;
}

async function latestDeploymentMessage() {
  try {
    const result = await cf(`/workers/scripts/${WORKER_NAME}/deployments`);
    const deployment = (result?.deployments || [])[0];
    return deployment?.annotations?.['workers/message'] || null;
  } catch (error) {
    // Per-Worker Editor tokens cannot create Workers; never fall through to creation.
    if (/HTTP 404/.test(error.message)) throw new Error(`Worker ${WORKER_NAME} must already exist (owner creates it once)`);
    throw error;
  }
}

async function anonymousProbe(host) {
  const results = [];
  for (const path of ['/', '/feature/daily', '/canvaskit.wasm']) {
    // No cookies or credentials: plain fetch from a fresh runner.
    const response = await fetch(`https://${host}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(20000) }).catch(() => null);
    results.push(response ? classifyAnonymous(response.status, response.headers.get('location')) : 'pending');
    await response?.arrayBuffer().catch(() => {});
  }
  return results.includes('exposed') ? 'exposed' : results.every(r => r === 'protected') ? 'protected' : 'pending';
}

async function main([command]) {
  const env = process.env;
  const fail = errors => { for (const error of errors) console.log(`::error::${error}`); process.exit(1); };
  if (command === 'check-artifact') {
    const metadata = JSON.parse(readFileSync(env.ARTIFACT_METADATA, 'utf8'));
    const errors = checkArtifactMetadata(metadata, { artifactId: env.ARTIFACT_ID, digest: env.ARTIFACT_DIGEST, sourceSha: env.SOURCE_SHA });
    if (errors.length) fail(errors);
    console.log('Artifact provenance PASS');
  } else if (command === 'check-content') {
    const config = checkWranglerConfig(readFileSync(new URL('../deploy/cloudflare/wrangler.integration.jsonc', import.meta.url), 'utf8'));
    const { errors, count } = readDist(new URL('../mobile/dist/', import.meta.url).pathname);
    if (config.length || errors.length) fail([...config, ...errors]);
    console.log(`Wrangler config and ${count}-file artifact content PASS (TEST backend + TEST Firebase only)`);
  } else if (command === 'already-deployed') {
    const current = await latestDeploymentMessage();
    const same = current === deploymentMessage(env.ARTIFACT_ID, env.ARTIFACT_DIGEST);
    console.log(`same=${same}`);
    if (env.GITHUB_OUTPUT) await import('node:fs').then(fs => fs.appendFileSync(env.GITHUB_OUTPUT, `same=${same}\n`));
  } else if (command === 'activate') {
    // Worker-level Cloudflare Access (owner-enabled once, exact-email reviewer
    // policy) must already protect every hostname of this Worker. The token has
    // no Access permission; protection is proven by cookie-free probes, and
    // workers.dev is switched off again unless every probe is Access-blocked.
    if (await latestDeploymentMessage() !== deploymentMessage(env.ARTIFACT_ID, env.ARTIFACT_DIGEST)) fail(['current Worker deployment is not the verified artifact']);
    const subdomain = String(env.CLOUDFLARE_WORKERS_SUBDOMAIN || '');
    if (!/^[a-z0-9-]+$/.test(subdomain)) fail(['CLOUDFLARE_WORKERS_SUBDOMAIN variable missing or invalid']);
    const host = `${WORKER_NAME}.${subdomain}.workers.dev`;
    const subdomainSetting = enabled => cf(`/workers/scripts/${WORKER_NAME}/subdomain`, { method: 'POST', body: { enabled, previews_enabled: false } });
    if (await anonymousProbe(host) === 'exposed') { await subdomainSetting(false); fail(['host already publicly reachable; workers.dev disabled']); }
    await subdomainSetting(true);
    let state = 'pending';
    for (let attempt = 0; attempt < 12 && state === 'pending'; attempt++) {
      await new Promise(done => setTimeout(done, 10000));
      state = await anonymousProbe(host);
    }
    if (state !== 'protected') { await subdomainSetting(false); fail([`anonymous probe ${state}; workers.dev disabled again`]); }
    console.log(`::notice::Protected integration preview active: https://${host}`);
  } else throw new Error('Unknown command');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
