import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';

const candidate = '1f8d0f98fb16b9553ae03c474f5952c808928e48';
const source = readFileSync(new URL('../.github/workflows/logging-candidate-validation.yml', import.meta.url), 'utf8');
const workflow = parse(source);
const job = workflow.jobs['logging-candidate'];
const runner = job.steps.at(-1).run.split("node --input-type=module <<'NODE'\n")[1].replace(/\nNODE\s*$/, '');

test('candidate workflow is path-scoped, pinned, read-only and bounded', () => {
  assert.deepEqual(workflow.on, { push: { branches: ['integration/mobile-backend-test'], paths: ['.github/workflows/logging-candidate-validation.yml'] } });
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.equal(workflow.concurrency['cancel-in-progress'], true);
  assert.equal(job['runs-on'], 'ubuntu-24.04'); assert.equal(job['timeout-minutes'], 10);
  assert.equal(job.steps.at(-1)['timeout-minutes'], 2);
  const uses = job.steps.filter(step => step.uses);
  assert.deepEqual(uses.map(step => step.uses), [
    'actions/checkout@11d5960a326750d5838078e36cf38b85af677262',
    'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020',
  ]);
  assert.deepEqual(uses[0].with, { ref: candidate, 'persist-credentials': false });
  assert.deepEqual(uses[1].with, { 'node-version': '24.7.0' });
  assert.match(job.steps[2].run, /git rev-parse HEAD/);
  assert.match(job.steps[2].run, /Workflow trigger SHA/);
  assert.match(job.steps[2].run, /github\.sha/);
  assert.equal(job.steps[3].run, 'npm ci --ignore-scripts --no-audit --no-fund');
  assert.equal(job.steps[4].run, 'npm exec --no -- prisma generate');
  assert.doesNotMatch(source, /secrets\.|continue-on-error|pull_request_target|migrate deploy|id-token:|security-events:|npm start/);
  assert.deepEqual(job.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: '/dev/null',
    DEV_DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:1/petalpal_test', AI_ASYNC_EXECUTION_MODE: 'manual' });
});

function execute({ sha = candidate, dotenv = false, result = {} } = {}) {
  let call;
  const fn = new Function('assert', 'execFileSync', 'spawnSync', 'existsSync', 'process', 'console',
    runner.replace(/^import .*;\n/gm, ''));
  fn(assert, (exe, args) => { assert.equal(exe, 'git'); assert.deepEqual(args, ['rev-parse', 'HEAD']); return sha + '\n'; },
    (exe, args, options) => { call = { exe, args, options }; return {
      status: 0, signal: null, stdout: '# tests 6\n# pass 6\n# fail 0\n# cancelled 0\n# skipped 0\n', ...result,
    }; }, () => dotenv, { execPath: '/synthetic/node', env: {
      PATH: '/bin', HOME: '/fixture', DATABASE_URL: 'do-not-forward', FIREBASE_PRIVATE_KEY: 'do-not-forward',
      NODE_OPTIONS: 'do-not-forward', GITHUB_TOKEN: 'do-not-forward',
    }, stdout: { write() {} }, stderr: { write() {} } }, { log() {} });
  return call;
}

test('candidate runner selects exactly six existing tests and strips inherited secrets', () => {
  const { exe, args, options } = execute();
  assert.equal(exe, '/synthetic/node'); assert.equal(options.timeout, 90000);
  assert.deepEqual(args.slice(0, 3), ['--test', '--test-concurrency=1', '--test-reporter=tap']);
  assert.equal(args.length, 6);
  assert.deepEqual(args.slice(4), ['test/back/logging-privacy.test.js', 'test/back/auth.test.js']);
  const pattern = new RegExp(args[3].slice('--test-name-pattern='.length));
  const counts = args.slice(4).map(file => {
    const text = execFileSync('git', ['show', `${candidate}:${file}`], { encoding: 'utf8' });
    return [...text.matchAll(/^test\((["'])(.*?)\1/gm)].filter(match => pattern.test(match[2])).length;
  });
  assert.deepEqual(counts, [4, 2]);
  assert.equal(JSON.stringify(options.env).includes('do-not-forward'), false);
  assert.equal(options.env.DEV_DATABASE_URL, 'postgresql://fixture:fixture@127.0.0.1:1/petalpal_test');
});

test('candidate runner rejects wrong source, env files, failures, timeouts and incomplete execution', () => {
  assert.throws(() => execute({ sha: 'different-sha' }));
  assert.throws(() => execute({ dotenv: true }));
  for (const result of [
    { status: 1 }, { error: Object.assign(new Error('fixture timeout'), { code: 'ETIMEDOUT' }) },
    { status: null, signal: 'SIGTERM' }, { stdout: '# tests 0\n# pass 0\n' },
    { stdout: '# tests 6\n# pass 5\n# fail 0\n# cancelled 0\n# skipped 1\n' },
  ]) assert.throws(() => execute({ result }));
});
