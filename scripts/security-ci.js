import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

export const securityTests = [
  'test/back/auth.test.js',
  'test/back/security-config.test.js',
  'test/back/rate-limit.test.js',
  'test/back/auth-abuse.route.test.js',
  'test/back/preauth-admission.route.test.js',
  // Native provider contracts use injected fetch and disposable PGlite only.
  'test/back/ai-gateway.test.js',
];

export const httpTests = 'production HTTPS security headers|HSTS requires|CSP supports|private namespaces|Socket.IO polling';

// Focused existing fixtures only; no real database/provider/load acceptance.
export const additionalSecurityTests = [
  // New submissions: synthetic bilingual rules, rejected side effects and legacy aliases.
  { file: 'test/back/content-safety.test.js', pattern: '.', count: 7 },
  { file: 'test/back/daily-grow.route.test.js', pattern: '.', count: 1 },
  // Phase 4 cross-week Monthly grounding: mocked Gateway, disposable PGlite.
  { file: 'test/back/opus-monthly.test.js', pattern: '.', count: 26 },
  // Phase 3 bilingual Weekly grounding: mocked inference, disposable PGlite.
  // One file in four children (same tests) so each stays under the 90 s child limit.
  // Node name patterns cannot exclude (the file-level root matches a lookahead), so the core
  // security cases are named by their title prefixes.
  { file: 'test/back/sonnet-weekly.test.js', pattern: '^(selector flag|versioned localized|Chinese and|Sonnet stays|English Sonnet|Chinese Weekly|explicit invalid|zero USD/shared|insufficient evidence|malformed/refused/unselected/ungrounded responses|timeout during|late noncooperative|consent revocation/regrant,|duplicate execution|evidence write|localized source|opt-in weekly-reflection-v2|Weekly composition|Weekly refuses|Weekly reuses) ', count: 20 },
  { file: 'test/back/sonnet-weekly.test.js', pattern: '^selector OFF/', count: 0 },
  { file: 'test/back/sonnet-weekly.test.js', pattern: '^selector ON/', count: 0 },
  { file: 'test/back/sonnet-weekly.test.js', pattern: '^(editorial |narrative thread |both editorial |evidence significance ON)', count: 4 },
  // Opt-in Prompt-First v2 reflection contracts: pure offline validators, no inference.
  { file: 'test/back/reflection-v2.test.js', pattern: '.', count: 17 },
  // Phase 2 Event routing: mocked Gateway and disposable PGlite, no real AI.
  { file: 'test/back/haiku-event-emotion.test.js', pattern: '.', count: 17 },
  { file: 'test/back/speech-admission.test.js', pattern: '^speech admission ', count: 4 },
  { file: 'test/back/ai-cost-gate.test.js', pattern: '^(per-user shared quota blocks provider call, while another owner remains independent|revoked AI-processing consent blocks speech/emotion before quota reservation or provider work)$', count: 2 },
  { file: 'test/back/ai-consent-lifecycle.test.js', pattern: '^same-millisecond revoke/regrant advances the consent epoch deterministically$', count: 1 },
  { file: 'test/back/security-p0-socket.test.js', pattern: '^Socket\\.IO handshake rejects missing, invalid and expired verifier results at runtime$', count: 1 },
  { file: 'test/back/realtime-security.test.js', pattern: '^(authorized joins/movement use token actor and do not leak to outsider/user rooms|paused authorized movement cannot publish after privacy revocation)$', count: 2 },
  { file: 'test/back/private-journals.test.js', pattern: '^private Journal routes isolate persistence and preserve historical shelf entries$', count: 1 },
  // Whole file (one top-level test and its subtests): cross-origin REST, Socket.IO
  // origin/token boundaries and native no-Origin compatibility.
  { file: 'test/back/cross-origin-web.test.js', pattern: '.', count: 1 },
  // Isolated integration environment: Firebase/PostgreSQL/origin/AI guard and the
  // environment-specific Cloudflare hosting configuration (no provider access).
  { file: 'test/back/integration-environment.test.js', pattern: '.', count: 15 },
  { file: 'test/back/integration-startup.test.js', pattern: '.', count: 5 },
  { file: 'test/cloudflare-integration.test.mjs', pattern: '.', count: 8 },
  { file: 'test/cloudflare-integration-deploy.test.mjs', pattern: '.', count: 4 },
  { file: 'test/cloudflare-rollback.test.mjs', pattern: '.', count: 6 },
  { file: 'test/cloudflare-production-deploy.test.mjs', pattern: '.', count: 5 },
  // Runtime tzdata: Vancouver stays UTC-7 after 2026-11-01 (IANA 2026b+).
  { file: 'test/back/vancouver-timezone.test.js', pattern: '.', count: 2 },
  // Event API: token-derived ownership, server-assigned Event time, private reads.
  { file: 'test/back/ai-event.route.test.js', pattern: '.', count: 1 },
];

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
    ...additionalSecurityTests.map(({ file, pattern }) => ['--test', `--test-name-pattern=${pattern}`, file]),
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
