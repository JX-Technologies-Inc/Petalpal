import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import {
  checkProductionConfig, checkFallbackConfig, checkProductionDistText, versionAllowed, appMessage, fallbackMessage,
} from '../scripts/cloudflare-production-deploy.mjs';
import { checkArtifactMetadata } from '../scripts/cloudflare-integration-deploy.mjs';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const sha = 'b'.repeat(40);
const digest = 'sha256:' + 'e'.repeat(64);

test('committed production and fallback profiles are private and target only petalpal-web-production', () => {
  assert.deepEqual(checkProductionConfig(read('deploy/cloudflare/wrangler.production.jsonc')), []);
  assert.deepEqual(checkFallbackConfig(read('deploy/cloudflare/wrangler.rollback.jsonc')), []);
  const base = JSON.parse(read('deploy/cloudflare/wrangler.production.jsonc').replace(/^\s*\/\/.*$/gm, ''));
  for (const change of [{ name: 'petalpal-web-integration' }, { name: 'petalpal-expo-synthetic-9a9d57d' }, { workers_dev: true },
    { preview_urls: true }, { routes: [{ pattern: 'app.jastrevia.com/*', custom_domain: true }] }, { custom_domains: ['x'] },
    { vars: { PETALPAL_ENVIRONMENT: 'integration' } }, { main: 'rollback-worker.js' }]) {
    assert.notDeepEqual(checkProductionConfig(JSON.stringify({ ...base, ...change })), [], JSON.stringify(change));
  }
  // Integration/synthetic profiles and the app profile can never pass as the fallback.
  for (const file of ['wrangler.integration.jsonc', 'wrangler.preview.jsonc', 'wrangler.jsonc', 'wrangler.production.jsonc']) {
    assert.notDeepEqual(checkFallbackConfig(read(`deploy/cloudflare/${file}`)), [], file);
  }
  for (const file of ['wrangler.integration.jsonc', 'wrangler.preview.jsonc', 'wrangler.rollback.jsonc']) {
    assert.notDeepEqual(checkProductionConfig(read(`deploy/cloudflare/${file}`)), [], file);
  }
});

const key = 'AIza' + 'P'.repeat(35);
const bundle = (over = {}) => {
  const c = { apiKey: key, authDomain: 'petalpal-b212c.firebaseapp.com', projectId: 'petalpal-b212c', appId: '1:879846854472:web:02b860eacfaf5bb7616d7d', ...over };
  return `x=(0,t.initializeApp)({apiKey:"${c.apiKey}",authDomain:"${c.authDomain}",projectId:"${c.projectId}",appId:"${c.appId}"},o);u="https://petalpal-v2.onrender.com";${over.extra || ''}`;
};

test('production artifact must use the existing production API and Firebase Web App only', () => {
  assert.deepEqual(checkProductionDistText(bundle()), []);
  for (const over of [{ apiKey: 'apiKey' }, { projectId: 'petalpal-integration-test', authDomain: 'petalpal-integration-test.firebaseapp.com' },
    { appId: '1:1:web:other' }, { extra: 'v="https://petalpal-backend-test.onrender.com"' }, { extra: 'h="petalpal-web-integration.petalpal-jx.workers.dev"' },
    { extra: 'synthetic-public-build-fixture' }, { extra: '"private_key":"x"' }, { extra: 'postgres://u:p@h/db' }, { extra: 'DATABASE_URL' }]) {
    assert.notDeepEqual(checkProductionDistText(bundle(over)), [], JSON.stringify(over).slice(0, 70));
  }
  assert.notDeepEqual(checkProductionDistText('no firebase'), []);
  assert.ok(checkProductionDistText(bundle({ appId: 'bad' })).every(error => !error.includes(key)));
});

test('only the exact production artifact from the main build passes provenance', () => {
  const meta = kind => ({
    artifact: { id: 5, name: `expo-web-${kind}-${sha}`, digest, expired: false, workflow_run: { id: 9 } },
    run: { id: 9, path: '.github/workflows/cloudflare-web-build.yml', head_branch: 'main', head_sha: sha, event: 'workflow_dispatch', conclusion: 'success' },
  });
  const expected = { artifactId: '5', digest, sourceSha: sha };
  assert.deepEqual(checkArtifactMetadata(meta('production'), expected, 'production'), []);
  for (const kind of ['integration', 'synthetic']) assert.notDeepEqual(checkArtifactMetadata(meta(kind), expected, 'production'), [], kind);
  // Integration tooling default is unchanged and rejects production artifacts.
  assert.notDeepEqual(checkArtifactMetadata(meta('production'), expected), []);
});

test('activation and rollback deploy only the recorded verified version', () => {
  const expected = { artifactId: '5', digest, sourceSha: sha };
  assert.equal(versionAllowed('activate-app', appMessage('5', digest), expected), true);
  assert.equal(versionAllowed('rollback', fallbackMessage(sha), expected), true);
  for (const [phase, message] of [['activate-app', fallbackMessage(sha)], ['rollback', appMessage('5', digest)],
    ['activate-app', appMessage('6', digest)], ['rollback', fallbackMessage('c'.repeat(40))], ['activate-app', null],
    ['upload-app', appMessage('5', digest)], ['rollback', `integration-artifact 5 ${digest}`]]) {
    assert.equal(versionAllowed(phase, message, expected), false, `${phase} ${message}`);
  }
});

test('production release workflow is manual, main-only, single-attempt and never exposes the Worker', () => {
  const source = read('.github/workflows/cloudflare-production-deploy.yml');
  const workflow = parse(source);
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(workflow.permissions, { contents: 'read', actions: 'read' });
  const job = workflow.jobs.release;
  assert.equal(job.environment, 'petalpal-web-production-deploy');
  assert.match(job.if, /refs\/heads\/main/); assert.match(job.if, /run_attempt == 1/);
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  const runs = job.steps.map(step => step.run || '').join('\n');
  assert.doesNotMatch(runs, /wrangler (deploy|triggers)|custom[-_]domain|--routes?\b|workers_dev|subdomain|build:cloudflare|npm run build/);
  assert.match(runs, /versions upload -c wrangler\.rollback\.jsonc/);
  assert.match(runs, /versions upload -c wrangler\.production\.jsonc/);
  assert.match(runs, /versions deploy "\$\{VERSION_ID\}@100%" --name petalpal-web-production/);
  assert.match(runs, /check-version/);
  assert.doesNotMatch(source, /petalpal-web-integration|INTEGRATION_DEPLOY_TOKEN|petalpal-backend-test/);
});
