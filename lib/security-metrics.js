const NAMES = Object.freeze([
  'db_pool_exhaustion', 'db_acquisition_timeout', 'db_query_timeout', 'db_query_cancelled',
  'db_lock_timeout', 'db_deadlock', 'ai_job_failed', 'ai_job_retry_scheduled',
  'ai_lease_failure', 'ai_quota_denied', 'auth_rejected', 'authorization_rejected', 'security_rate_limited',
]);

export function createSecurityMetrics() {
  const counters = Object.fromEntries(NAMES.map(name => [name, 0]));
  return Object.freeze({
    increment(name, amount = 1) {
      if (typeof name !== 'string' || !Object.hasOwn(counters, name) ||
          !Number.isSafeInteger(amount) || amount <= 0) return;
      counters[name] = Math.min(Number.MAX_SAFE_INTEGER, counters[name] + amount);
    },
    snapshot: () => ({ ...counters }),
  });
}
export const securityMetrics = createSecurityMetrics();

export function recordDatabaseQueryError(error) {
  try {
    if (error?.code === '57014') {
      securityMetrics.increment(error.message?.includes('statement timeout') ? 'db_query_timeout' : 'db_query_cancelled');
    } else if (error?.code === '55P03') securityMetrics.increment('db_lock_timeout');
    else if (error?.code === '40P01') securityMetrics.increment('db_deadlock');
  } catch { /* Metrics must not affect query errors. */ }
}

export function recordDatabaseAcquisitionError(error) {
  try {
    if (error?.code === '53300') securityMetrics.increment('db_pool_exhaustion');
    else if (error?.code === 'ETIMEDOUT' || ['timeout exceeded when trying to connect',
      'Connection terminated due to connection timeout'].includes(error?.message)) {
      securityMetrics.increment('db_acquisition_timeout');
    }
  } catch { /* Metrics must not affect connection errors. */ }
}
