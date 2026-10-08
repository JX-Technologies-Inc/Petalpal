import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// No external target, env files, inherited provider credentials or database.
const atomicOnly = process.argv.length === 3 && process.argv[2] === '--atomic';
const socialOnly = process.argv.length === 3 && process.argv[2] === '--social';
if (process.argv.length !== 2 && !socialOnly && !atomicOnly) throw new Error('DAST accepts only --social or --atomic; no external target');
const systemEnv = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'SystemRoot']
  .filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
const result = spawnSync(process.execPath, ['--test', atomicOnly ? 'test/back/social-authorization.postgres.test.js' : 'test/security/api-fuzz.test.mjs'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)),
  env: {
    ...systemEnv, NODE_ENV: 'test', DOTENV_CONFIG_PATH: '/dev/null',
    PETALPAL_DAST_ISOLATED: '1', PETALPAL_DAST_SCOPE: socialOnly ? 'social' : 'all',
    DEV_DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:1/petalpal_test',
    TRUST_PROXY: 'loopback', RATE_LIMIT_GENERAL_MAX: '40', RATE_LIMIT_AUTH_MAX: '8',
    RATE_LIMIT_AUTH_ACCOUNT_MAX: '8', RATE_LIMIT_AI_MAX: '2',
    RATE_LIMIT_WINDOW_MS: '900000', AI_ASYNC_EXECUTION_MODE: 'manual',
  },
  timeout: atomicOnly ? 120000 : 30000, stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
