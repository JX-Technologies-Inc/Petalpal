import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const isolatedHome = mkdtempSync(path.join(tmpdir(), 'petalpal-hosting-test-'));
const env = {
  PATH: process.env.PATH, HOME: isolatedHome, TMPDIR: tmpdir(),
  NODE_ENV: 'test', DOTENV_CONFIG_PATH: '/dev/null', DOTENV_CONFIG_QUIET: 'true',
  DEV_DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:1/petalpal_test',
  AI_ASYNC_EXECUTION_MODE: 'manual', WRANGLER_SEND_METRICS: 'false', CI: '1'
};
// CI installs Chromium into this explicit, task-owned cache.
if (process.env.PLAYWRIGHT_BROWSERS_PATH) env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH;
// Public production-config exports use normal static delivery checks, never the
// synthetic-only package scanner or browser fixture login.
const previewTests = process.argv.includes('--production-artifact') ? []
  : ['test/cloudflare-preview.test.mjs', 'test/cloudflare-preview-package.test.mjs'];
try {
  for (const args of [
    ['--test', 'test/cloudflare-web.test.mjs', ...previewTests, 'test/back/cross-origin-web.test.js',
      'test/back/cross-origin-browser.test.js', 'test/back/cross-origin-browser-socket.test.js',
      'mobile/test/crossOriginApi.test.mjs'],
    ['--test', '--test-name-pattern=cross-origin AuthProvider', 'mobile/test/authSession.test.mjs']
  ]) {
    const result = spawnSync(process.execPath, args, { env, stdio: 'inherit', cwd: new URL('..', import.meta.url) });
    if (result.error || result.status !== 0) { process.exitCode = 1; break; }
  }
} finally { rmSync(isolatedHome, { recursive: true, force: true }); }
