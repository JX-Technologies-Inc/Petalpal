import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { parse } from 'yaml';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSecurityCi, securityTests, httpTests, assertCleanCheckout, additionalSecurityTests } from '../scripts/security-ci.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('CI runner resolves the explicit baseline and strips unsafe inherited configuration', () => {
  const calls = [];
  const status = runSecurityCi((exe, args, options) => { calls.push({ exe, args, options }); return { status: 0 }; }, {
    PATH: '/bin', HOME: '/tmp/fixture', DATABASE_URL: 'do-not-forward',
    DEV_DATABASE_URL: 'do-not-forward', FIREBASE_SERVICE_ACCOUNT: 'do-not-forward',
    OPENAI_API_KEY: 'do-not-forward', NODE_OPTIONS: '--import=do-not-forward',
    DOTENV_CONFIG_PATH: 'do-not-forward', PETALPAL_DAST_SCOPE: 'social',
  });
  assert.equal(status, 0); assert.equal(calls.length, 3 + additionalSecurityTests.length);
  assert.deepEqual(calls[0].args, ['--test', '--test-concurrency=1', ...securityTests]);
  assert.deepEqual(calls[1].args, ['--test', `--test-name-pattern=${httpTests}`, 'test/back/http-security.test.js']);
  assert.deepEqual(calls[2].args, ['scripts/api-security-fuzz.js']);
  assert.deepEqual(calls.slice(3).map(call => call.args), additionalSecurityTests.map(({ file, pattern }) => ['--test', `--test-name-pattern=${pattern}`, file]));
  for (const { file, pattern, count } of additionalSecurityTests) {
    const titles = [...read(file).matchAll(/^test\((["'])(.*?)\1/gm)].map(match => match[2]);
    assert.equal(titles.filter(title => new RegExp(pattern).test(title)).length, count, file);
  }
  assert.throws(() => assertCleanCheckout(() => true), /clean checkout/);
  assert.doesNotThrow(() => assertCleanCheckout(() => false));
  for (const path of [...securityTests, ...additionalSecurityTests.map(item => item.file), 'test/back/http-security.test.js', 'scripts/api-security-fuzz.js']) assert.ok(existsSync(new URL('../' + path, import.meta.url)));
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


test('real isolated failures, missing tests/commands and child timeout stop the CI runner', () => {
  const directory = mkdtempSync(join(tmpdir(), 'petalpal-ci-negative-'));
  try {
    const failing = join(directory, 'failing.test.mjs');
    writeFileSync(failing, "import test from 'node:test'; import assert from 'node:assert/strict'; test('intentional isolated failure', () => assert.fail('fixture'));\n");
    const cases = [
      { args: ['--test', failing], status: 1 },
      { args: ['--test', join(directory, 'missing.test.mjs')], status: 1 },
      { exe: join(directory, 'missing-node'), args: [], error: 'ENOENT' },
      { args: ['-e', 'setInterval(() => {}, 1000)'], timeout: 150, error: 'ETIMEDOUT' },
    ];
    for (const fixture of cases) {
      let calls = 0;
      const result = runSecurityCi((exe, _args, options) => {
        calls++;
        assert.equal(options.timeout, 90000);
        const child = spawnSync(fixture.exe || exe, fixture.args, {
          ...options, cwd: directory, stdio: 'pipe', timeout: fixture.timeout || options.timeout,
        });
        if (fixture.error) assert.equal(child.error?.code, fixture.error);
        else assert.equal(child.status, fixture.status);
        return child;
      }, {});
      assert.notEqual(result, 0); assert.equal(calls, 1);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});


test('Expo web CI builds the real production export with only synthetic public configuration', () => {
  const source = read('.github/workflows/security-regression.yml');
  const job = parse(source).jobs['expo-web'];
  assert.equal(job.env.EXPO_NO_DOTENV, '1');
  assert.equal(job.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, 'petalpal-synthetic');
  assert.equal(job.env.EXPO_PUBLIC_API_BASE_URL, undefined);
  const runs = job.steps.map(step => step.run || '').join('\n');
  assert.match(runs, /NODE_ENV=production npm --prefix mobile run build:web/);
  assert.match(runs, /test\/back\/expo-web.test.js/);
  assert.doesNotMatch(runs, /migrate|deploy|npm start/);
  assert.doesNotMatch(source, /secrets\./);
});
