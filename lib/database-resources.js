import pg from 'pg';

export const DATABASE_LIMITS = Object.freeze({
  connections: 10, waiting: 20, acquisitionMs: 2000,
  statementMs: 10000, lockMs: 1500, idleTransactionMs: 10000,
});
export const DATABASE_TRANSACTION_OPTIONS = Object.freeze({ maxWait: 2000, timeout: 5000 });

class BoundedDatabasePool extends pg.Pool {
  connect(callback) {
    if (!this.ending && this.waitingCount >= DATABASE_LIMITS.waiting) {
      const error = Object.assign(new Error('Database capacity is busy'), { code: '53300' });
      if (callback) { queueMicrotask(() => callback(error)); return; }
      return Promise.reject(error);
    }
    return super.connect(callback);
  }
}

export function createDatabasePool(connectionString) {
  const url = new URL(connectionString);
  // Preserve unrelated startup options, but URL parameters must not disable limits.
  const options = url.searchParams.get('options') || '';
  for (const key of ['options', 'statement_timeout', 'idle_in_transaction_session_timeout', 'query_timeout', 'connectionTimeoutMillis']) {
    url.searchParams.delete(key);
  }
  return new BoundedDatabasePool({
    connectionString: url.toString(), max: DATABASE_LIMITS.connections,
    connectionTimeoutMillis: DATABASE_LIMITS.acquisitionMs,
    statement_timeout: DATABASE_LIMITS.statementMs,
    idle_in_transaction_session_timeout: DATABASE_LIMITS.idleTransactionMs,
    options: `${options} -c lock_timeout=${DATABASE_LIMITS.lockMs} -c statement_timeout=${DATABASE_LIMITS.statementMs} -c idle_in_transaction_session_timeout=${DATABASE_LIMITS.idleTransactionMs}`,
  });
}

export function isDatabaseResourceError(error) {
  const cause = error?.meta?.driverAdapterError?.cause;
  const codes = [error?.code, error?.meta?.code, error?.cause?.code,
    error?.cause?.originalCode, cause?.originalCode, cause?.code];
  return codes.some(code => ['53300', '55P03', '40P01', '57014', 'P2024', 'P2028', 'P2034', 'P2037'].includes(code)) ||
    cause?.kind === 'TooManyConnections' ||
    error?.message === 'timeout exceeded when trying to connect';
}
