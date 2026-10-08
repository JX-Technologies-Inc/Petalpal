import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { createSecurityMetrics, securityMetrics } from '../../lib/security-metrics.js';
import { flushSecurityMetrics, startSecurityMetricsLogging } from '../../lib/security-log.js';
import { createDatabasePool, MonitoredDatabaseClient } from '../../lib/database-resources.js';
import { AiJobWorker } from '../../lib/ai-worker.js';
import { PrismaAiCostGate } from '../../lib/ai-cost-gate.js';
import { emitSecurityEvent } from '../../lib/security-events.js';
import { createRateLimiter } from '../../lib/rate-limit.js';

const count = name => securityMetrics.snapshot()[name];
test('fixed counters saturate safely; snapshots are private, bounded and fail-open', t => {
  const local = createSecurityMetrics();
  local.increment('attacker-private-label'); local.increment('__proto__');
  local.increment('auth_rejected', -1); local.increment('auth_rejected', Infinity);
  local.increment('auth_rejected', Number.MAX_SAFE_INTEGER); local.increment('auth_rejected');
  assert.equal(local.snapshot().auth_rejected, Number.MAX_SAFE_INTEGER);
  assert.equal(Object.keys(local.snapshot()).length, 13);
  const copy = local.snapshot(); copy.auth_rejected = 0;
  assert.equal(local.snapshot().auth_rejected, Number.MAX_SAFE_INTEGER);
  const logs = [];
  const log = t.mock.method(console, 'log', value => logs.push(JSON.parse(value)));
  flushSecurityMetrics();
  securityMetrics.increment('auth_rejected'); flushSecurityMetrics(); flushSecurityMetrics();
  assert.equal(logs.length, 1);
  assert.deepEqual(Object.keys(logs[0]).sort(), ['counters', 'eventType', 'timestamp']);
  assert.equal(logs[0].eventType, 'security_metrics');
  assert.ok(Object.values(logs[0].counters).every(Number.isSafeInteger));
  log.mock.mockImplementation(() => { throw new Error('Logging unavailable'); });
  securityMetrics.increment('auth_rejected'); assert.doesNotThrow(flushSecurityMetrics);
  log.mock.mockImplementation(value => logs.push(JSON.parse(value)));
  flushSecurityMetrics(); assert.equal(logs.length, 2, 'failed emission must not lose the count');
  // Cadence and idempotent startup without a real timer/wait.
  let timers = 0, unrefs = 0;
  t.mock.method(globalThis, 'setInterval', (callback, interval) => {
    assert.equal(callback, flushSecurityMetrics); assert.equal(interval, 60000);
    timers++; return { unref() { unrefs++; } };
  });
  startSecurityMetricsLogging(); startSecurityMetricsLogging();
  assert.equal(timers, 1); assert.equal(unrefs, 1);
});

test('pool/query instrumentation preserves callback and Promise results/errors, never SQL labels', async t => {
  const before = securityMetrics.snapshot();
  const pool = createDatabasePool('postgresql://fixture:private@127.0.0.1:5432/fixture_test');
  t.after(() => pool.end());
  assert.equal(pool.options.Client, MonitoredDatabaseClient);
  assert.equal(pool.options.max, 10); assert.equal(pool.options.connectionTimeoutMillis, 2000);
  Object.defineProperty(pool, 'waitingCount', { configurable: true, value: 20 });
  await assert.rejects(pool.connect(), error => error.code === '53300');
  await new Promise(resolve => pool.connect(error => { assert.equal(error.code, '53300'); resolve(); }));
  assert.equal(count('db_pool_exhaustion') - before.db_pool_exhaustion, 2);
  Object.defineProperty(pool, 'waitingCount', { configurable: true, value: 0 });
  const acquisition = new Error('timeout exceeded when trying to connect');
  t.mock.method(pg.Pool.prototype, 'connect', callback => {
    if (callback) return callback(acquisition);
    return Promise.reject(acquisition);
  });
  await assert.rejects(pool.connect(), error => error === acquisition);
  pool.connect(error => assert.equal(error, acquisition));
  assert.equal(count('db_acquisition_timeout') - before.db_acquisition_timeout, 2);
  const client = new MonitoredDatabaseClient();
  const input = { text: 'SELECT private_user_content', values: ['private-token'] };
  const result = { rows: [{ ok: 1 }] };
  let failure;
  t.mock.method(pg.Client.prototype, 'query', function(...args) {
    assert.equal(this, client); assert.equal(args[0], input);
    if (typeof args.at(-1) === 'function') return args.at(-1)(failure, failure ? undefined : result);
    return failure ? Promise.reject(failure) : Promise.resolve(result);
  });
  assert.equal(await client.query(input), result);
  client.query(input, (error, value) => { assert.equal(error, undefined); assert.equal(value, result); });
  for (const [code, message, metric] of [
    ['57014', 'canceling statement due to statement timeout', 'db_query_timeout'],
    ['57014', 'canceling statement due to user request', 'db_query_cancelled'],
    ['55P03', 'private lock detail', 'db_lock_timeout'], ['40P01', 'private SQL detail', 'db_deadlock'],
  ]) {
    failure = Object.assign(new Error(message), { code });
    await assert.rejects(client.query(input), error => error === failure);
    client.query(input, error => assert.equal(error, failure));
    assert.equal(count(metric) - before[metric], 2);
  }
  assert.ok(!JSON.stringify(securityMetrics.snapshot()).includes('private'));
});

test('AI failure, actual retry scheduling, lease loss and quota-denial hooks count once', async t => {
  const before = securityMetrics.snapshot();
  const messages = [];
  const job = { id: 'private-job', ownerId: 'private-owner', jobType: 'test', attemptCount: 1 };
  let status = 'PENDING';
  const repository = { markFailed: async () => ({ status }), markSucceeded: async () => ({ count: 1 }),
    renewLease: async () => ({ count: 0 }) };
  const worker = new AiJobWorker({ repository, handlers: { test: async () => { throw new Error('private provider text'); } },
    logger: { error: (...args) => messages.push(args) } });
  const failure = await worker.executeClaimed(job);
  assert.equal(failure.succeeded, false); assert.equal(failure.error.code, 'AI_JOB_FAILED');
  assert.equal(count('ai_job_failed') - before.ai_job_failed, 1);
  assert.equal(count('ai_job_retry_scheduled') - before.ai_job_retry_scheduled, 1);
  status = 'FAILED'; await worker.executeClaimed(job);
  assert.equal(count('ai_job_retry_scheduled') - before.ai_job_retry_scheduled, 1);
  t.mock.timers.enable({ apis: ['setInterval'] });
  let finish;
  worker.handlers.test = () => new Promise(resolve => { finish = resolve; });
  const pending = worker.executeClaimed(job);
  t.mock.timers.tick(20000);
  await new Promise(resolve => setImmediate(resolve));
  finish({});
  const lease = await pending;
  assert.equal(lease.error.code, 'AI_JOB_LEASE_LOST');
  assert.equal(count('ai_lease_failure') - before.ai_lease_failure, 1);
  assert.equal(count('ai_job_failed') - before.ai_job_failed, 3);
  assert.ok(!/private-job|private-owner|private provider text|ai-worker-/.test(JSON.stringify(messages)));
  const gate = new PrismaAiCostGate({ $transaction: async () => { throw { code: 'AI_QUOTA_EXCEEDED' }; } }, { env: {} });
  await assert.rejects(gate.reserve({ identity: { userId: 'private-owner' }, action: 'EVENT_EMOTION' }),
    error => error.code === 'AI_QUOTA_EXCEEDED');
  assert.equal(count('ai_quota_denied') - before.ai_quota_denied, 1);
});

test('security/auth rejection and rate-limit counters stay bounded even when event logging fails', t => {
  const before = securityMetrics.snapshot();
  t.mock.method(console, 'log', () => { throw new Error('Logging unavailable'); });
  for (const eventType of ['authentication_failure', 'authorization_denial']) {
    assert.doesNotThrow(() => emitSecurityEvent({ eventType, outcome: 'denied',
      actorId: 'private-owner', routeClass: '/users/private-owner', safeReason: 'private input' }));
  }
  emitSecurityEvent({ eventType: 'private-unbounded-label', outcome: 'failed' });
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });
  const req = { ip: '192.0.2.1', path: '/private-path' };
  let accepted = 0, status;
  const res = { set() { return this; }, status(value) { status = value; return this; }, json() {} };
  limiter(req, res, () => accepted++); limiter(req, res, () => accepted++);
  assert.equal(accepted, 1); assert.equal(status, 429);
  assert.equal(count('auth_rejected') - before.auth_rejected, 1);
  assert.equal(count('authorization_rejected') - before.authorization_rejected, 1);
  assert.equal(count('security_rate_limited') - before.security_rate_limited, 1);
  assert.equal(Object.keys(securityMetrics.snapshot()).length, 13);
});
