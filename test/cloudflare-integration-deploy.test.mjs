import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  checkArtifactMetadata, checkWranglerConfig, checkDistText, checkAccessApp, classifyAnonymous, deploymentMessage,
} from '../scripts/cloudflare-integration-deploy.mjs';

const sha = '521f6b54ac1bbc34177c1db98bc3bf1696d74220';
const digest = 'sha256:' + 'f'.repeat(64);
const metadata = () => ({
  artifact: { id: 11661221273, name: `expo-web-integration-${sha}`, digest, expired: false, workflow_run: { id: 7 } },
  run: { id: 7, path: '.github/workflows/cloudflare-web-build.yml', head_branch: 'main', head_sha: sha, event: 'workflow_dispatch', conclusion: 'success' },
});
const expected = { artifactId: '11661221273', digest, sourceSha: sha };

test('artifact provenance accepts only the exact successful integration build from main', () => {
  assert.deepEqual(checkArtifactMetadata(metadata(), expected), []);
  for (const [path, value] of [['artifact.id', 1], ['artifact.name', `expo-web-production-${sha}`], ['artifact.digest', 'sha256:' + '0'.repeat(64)],
    ['artifact.expired', true], ['run.path', '.github/workflows/other.yml'], ['run.head_branch', 'feature'], ['run.head_sha', 'a'.repeat(40)],
    ['run.conclusion', 'failure'], ['run.id', 8]]) {
    const m = metadata(); const [k1, k2] = path.split('.'); m[k1][k2] = value;
    assert.notDeepEqual(checkArtifactMetadata(m, expected), [], path);
  }
});

test('committed integration Wrangler config is private and targets only the integration Worker', () => {
  const text = readFileSync(new URL('../deploy/cloudflare/wrangler.integration.jsonc', import.meta.url), 'utf8');
  assert.deepEqual(checkWranglerConfig(text), []);
  const base = JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''));
  for (const change of [{ name: 'petalpal-web-preview' }, { name: 'petalpal-expo-synthetic-9a9d57d' }, { workers_dev: true },
    { preview_urls: true }, { routes: [{ pattern: 'app.jastrevia.com/*' }] }, { custom_domains: ['x'] },
    { vars: { PETALPAL_ENVIRONMENT: 'integration', API_ORIGIN: 'https://petalpal-v2.onrender.com' } }]) {
    assert.notDeepEqual(checkWranglerConfig(JSON.stringify({ ...base, ...change })), [], JSON.stringify(change));
  }
  // The production and synthetic preview configs can never pass this gate.
  for (const file of ['wrangler.jsonc', 'wrangler.preview.jsonc']) {
    assert.notDeepEqual(checkWranglerConfig(readFileSync(new URL(`../deploy/cloudflare/${file}`, import.meta.url), 'utf8')), [], file);
  }
});

const key = 'AIza' + 'S'.repeat(35);
const bundle = (over = {}) => {
  const c = { apiKey: key, authDomain: 'petalpal-integration-test.firebaseapp.com', projectId: 'petalpal-integration-test', appId: '1:123:web:abc123', ...over };
  return `x=(0,t.initializeApp)({apiKey:"${c.apiKey}",authDomain:"${c.authDomain}",projectId:"${c.projectId}",appId:"${c.appId}"},o);u="https://petalpal-backend-test.onrender.com";${over.extra || ''}`;
};

test('artifact content must carry only TEST backend and TEST Firebase and no credentials', () => {
  assert.deepEqual(checkDistText(bundle()), []);
  for (const over of [{ apiKey: 'apiKey' }, { projectId: 'projectId', authDomain: 'authDomain' }, { projectId: 'petalpal-b212c', authDomain: 'petalpal-b212c.firebaseapp.com' },
    { appId: 'appId' }, { extra: 'v="https://petalpal-v2.onrender.com"' }, { extra: '"private_key":"x"' }, { extra: 'postgres://u:p@h/db' },
    { extra: 'DATABASE_URL' }, { extra: '__preview-fixtures' }, { extra: '"type":"service_account"' }]) {
    assert.notDeepEqual(checkDistText(bundle(over)), [], JSON.stringify(over).slice(0, 60));
  }
  assert.notDeepEqual(checkDistText('no firebase here'), []);
  assert.ok(checkDistText(bundle({ apiKey: 'apiKey' })).every(error => !error.includes(key)));
});

const host = 'petalpal-web-integration.example.workers.dev';
const reviewer = 'reviewer@jastrevia.com';
const policy = (over = {}) => ({ decision: 'allow', include: [{ email: { email: reviewer } }], exclude: [], require: [], ...over });

test('Access app must protect exactly the integration host for the single approved reviewer', () => {
  const app = { type: 'self_hosted', domain: host, self_hosted_domains: [host] };
  assert.deepEqual(checkAccessApp(app, [policy()], { host, reviewer }), []);
  for (const [a, p] of [[{ ...app, domain: `${host}/admin`, self_hosted_domains: [`${host}/admin`] }, [policy()]],
    [{ ...app, self_hosted_domains: [host, 'other.workers.dev'] }, [policy()]], [{ ...app, type: 'saas' }, [policy()]], [app, []],
    [app, [policy({ decision: 'bypass' })]], [app, [policy({ include: [{ everyone: {} }] })]],
    [app, [policy({ include: [{ email_domain: { domain: 'jastrevia.com' } }] })]],
    [app, [policy({ include: [{ email: { email: reviewer } }, { email: { email: 'other@jastrevia.com' } }] })]],
    [app, [policy(), policy({ decision: 'non_identity', include: [{ ip: { ip: '0.0.0.0/0' } }] })]]]) {
    assert.notDeepEqual(checkAccessApp(a, p, { host, reviewer }), []);
  }
});

test('anonymous probe classification never treats content as protected', () => {
  assert.equal(classifyAnonymous(302, 'https://jastrevia.cloudflareaccess.com/cdn-cgi/access/login/x'), 'protected');
  assert.equal(classifyAnonymous(403), 'protected');
  assert.equal(classifyAnonymous(200), 'exposed');
  assert.equal(classifyAnonymous(206), 'exposed');
  assert.equal(classifyAnonymous(302, 'https://evil.example/'), 'pending');
  assert.equal(classifyAnonymous(302, 'https://x.cloudflareaccess.com.evil.example/'), 'pending');
  assert.equal(classifyAnonymous(404), 'pending');
  assert.equal(deploymentMessage(1, digest), `integration-artifact 1 ${digest}`);
});
