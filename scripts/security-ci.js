import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

export const securityTests = [
  'test/back/auth.test.js',
  'test/back/security-config.test.js',
];

export const httpTests = 'production HTTPS security headers|HSTS requires|CSP supports|private namespaces|Socket.IO polling';

export function assertCleanCheckout(exists = existsSync) {
  // natural imports dotenv.config() directly, bypassing DOTENV_CONFIG_PATH.
  if (exists(new URL('../.env', import.meta.url))) throw new Error('Security CI requires a clean checkout without .env; existing files are never removed');
}

// Explicit allowlist: no .env files, provider credentials, DB target, NODE_OPTIONS
// or caller-supplied test arguments reach the child. DAST adds its own sandbox.
export function runSecurityCi(spawn = spawnSync, inherited = process.env) {
  const env = {
    ...Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'SystemRoot']
      .filter(key => inherited[key] !== undefined).map(key => [key, inherited[key]])),
    NODE_ENV: 'test', DOTENV_CONFIG_PATH: '/dev/null',
    DEV_DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:1/petalpal_test',
    AI_ASYNC_EXECUTION_MODE: 'manual',
  };
  for (const args of [
    ['--test', '--test-concurrency=1', ...securityTests],
    ['--test', `--test-name-pattern=${httpTests}`, 'test/back/http-security.test.js'],
    ['scripts/api-security-fuzz.js'],
  ]) {
    const result = spawn(process.execPath, args, {
      cwd: fileURLToPath(new URL('../', import.meta.url)), env,
      timeout: 90000, stdio: 'inherit',
    });
    if (result.error || result.signal || result.status !== 0) return result.status || 1;
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw new Error('Security CI accepts no arguments or external target');
  assertCleanCheckout();
  process.exitCode = runSecurityCi();
}
