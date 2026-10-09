import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'yaml';
import { runSecurityCi, securityTests, httpTests, assertCleanCheckout } from '../scripts/security-ci.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('CI runner resolves the explicit baseline and strips unsafe inherited configuration', () => {
  const calls = [];
  const status = runSecurityCi((exe, args, options) => { calls.push({ exe, args, options }); return { status: 0 }; }, {
    PATH: '/bin', HOME: '/tmp/fixture', DATABASE_URL: 'do-not-forward',
    DEV_DATABASE_URL: 'do-not-forward', FIREBASE_SERVICE_ACCOUNT: 'do-not-forward',
    OPENAI_API_KEY: 'do-not-forward', NODE_OPTIONS: '--import=do-not-forward',
    DOTENV_CONFIG_PATH: 'do-not-forward', PETALPAL_DAST_SCOPE: 'social',
  });
  assert.equal(status, 0); assert.equal(calls.length, 3);
  assert.deepEqual(calls[0].args, ['--test', '--test-concurrency=1', ...securityTests]);
  assert.deepEqual(calls[1].args, ['--test', `--test-name-pattern=${httpTests}`, 'test/back/http-security.test.js']);
  assert.deepEqual(calls[2].args, ['scripts/api-security-fuzz.js']);
  assert.throws(() => assertCleanCheckout(() => true), /clean checkout/);
  assert.doesNotThrow(() => assertCleanCheckout(() => false));
  for (const path of [...securityTests, 'test/back/http-security.test.js', 'scripts/api-security-fuzz.js']) assert.ok(existsSync(new URL('../' + path, import.meta.url)));
  for (const call of calls) {
    assert.equal(call.exe, process.execPath); assert.equal(call.options.timeout, 90000);
    assert.equal(call.options.env.DOTENV_CONFIG_PATH, '/dev/null');
    assert.equal(call.options.env.DEV_DATABASE_URL, 'postgresql://fixture:fixture@127.0.0.1:1/petalpal_test');
    assert.equal(call.options.env.AI_ASYNC_EXECUTION_MODE, 'manual');
    assert.equal(JSON.stringify(call.options.env).includes('do-not-forward'), false);
    assert.equal(Object.hasOwn(call.options.env, 'PETALPAL_DAST_SCOPE'), false);
  }
  assert.equal(JSON.parse(read('package.json')).scripts['test:security:ci'], 'node scripts/security-ci.js');
});

test('CI runner propagates failures, timeouts and signals without silently continuing', () => {
  for (const failure of [{ status: 2 }, { status: null, signal: 'SIGTERM' }, { status: null, error: new Error('timeout') }]) {
    let calls = 0;
    assert.notEqual(runSecurityCi(() => { calls++; return failure; }, {}), 0);
    assert.equal(calls, 1);
  }
  let calls = 0;
  assert.equal(runSecurityCi(() => (++calls === 1 ? { status: 0 } : { status: 3 }), {}), 3);
});

test('workflow preserves scoped triggers, read-only permissions, pinned actions and explicit commands', () => {
  const source = read('.github/workflows/security-regression.yml');
  const workflow = parse(source);
  assert.deepEqual(workflow.on.push.branches, ['integration/mobile-backend-test']);
  assert.deepEqual(workflow.on.pull_request.branches, ['integration/mobile-backend-test', 'main']);
  assert.ok(Object.hasOwn(workflow.on, 'workflow_dispatch'));
  assert.deepEqual(Object.keys(workflow.on).sort(), ['pull_request', 'push', 'workflow_dispatch']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.equal(workflow.concurrency['cancel-in-progress'], true);
  const job = workflow.jobs.security;
  assert.equal(job['timeout-minutes'], 15); assert.equal(job['runs-on'], 'ubuntu-24.04');
  assert.equal(job.permissions, undefined); assert.equal(job.environment, undefined);
  const uses = job.steps.filter(step => step.uses);
  assert.equal(uses.length, 2);
  for (const step of uses) assert.match(step.uses, /^actions\/(checkout|setup-node)@[0-9a-f]{40}$/);
  assert.equal(uses[0].with['persist-credentials'], false);
  assert.equal(uses[1].with['node-version'], '24.7.0');
  assert.deepEqual(job.steps.filter(step => step.run).map(step => step.run), [
    'npm ci --ignore-scripts --no-audit --no-fund', 'npm exec --no -- prisma generate',
    'node --test test/security-ci.test.js', 'npm run test:security:ci',
  ]);
  assert.doesNotMatch(source, /secrets\.|continue-on-error|pull_request_target|security-events:|id-token:|migrate deploy/);
});
