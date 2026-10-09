// Explicit container-only entry point (outside the historical *.test.js suite).
// Validate image packaging, then reuse the accepted
// fixture against the image's actual server/dependencies. No production startup.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

assert.equal(process.platform, 'linux');
assert.equal(process.arch, 'x64');
assert.equal(process.cwd(), '/app');
for (const path of [
  'server.js', 'moodClassifier.js', 'lib/auth.js', 'lib/firebase-admin.js',
  'lib/http-security.js', 'lib/socket-security.js', 'lib/ai-worker.js',
  'lib/database-isolation.js', 'lib/native-security.js', 'scripts/ai-worker.js',
  'data/flowerDB.js', 'data/mood-model.json', 'prisma/schema.prisma',
  'generated/prisma/client.ts', 'docs/openapi.yaml',
]) assert.ok(existsSync(`/app/${path}`), `Missing backend component: ${path}`);
for (const path of [
  'mobile', 'client', 'Resources', 'assets', 'deploy', 'cloudflare-worker', '.git',
  '.env', '.env.local', 'node_modules/expo', 'node_modules/expo-router',
]) assert.equal(existsSync(`/app/${path}`), false, `Unexpected image content: ${path}`);
const pkg = JSON.parse(readFileSync('/app/package.json', 'utf8'));
assert.equal(pkg.scripts.start, 'npx prisma migrate deploy && node server.js');
console.log('Backend-only image packaging PASS; production startup is unchanged and NOT executed');

// Existing assertions cover listening HTTP, CORS, bearer rejection/acceptance,
// owner isolation, no-store and Engine.IO polling/WS upgrade/token reconnect.
await import('./cross-origin-web.test.js');
