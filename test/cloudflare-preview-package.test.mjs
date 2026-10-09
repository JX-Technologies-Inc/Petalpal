import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, lstat } from 'node:fs/promises';

test('retained preview package contains synthetic config and no credential/data file classes', async () => {
  const root = new URL('../mobile/dist/', import.meta.url);
  const files = await readdir(root, { recursive: true });
  let syntheticBundle = false;
  for (const file of files) {
    // Fail by category before opening any forbidden file; never print its data.
    assert.ok(!/(^|\/)(\.env[^/]*|\.dev\.vars[^/]*|\.git|.*\.(pem|key|p12|pfx|sql|sqlite|db|log|map))$/i.test(file),
      'Forbidden credential/database/log/source-map file class in static assets');
    const path = new URL(file, root), meta = await lstat(path);
    assert.ok(!meta.isSymbolicLink(), 'Static asset symlink is not approved');
    if (!meta.isFile() || !/\.(js|html|json|txt|css|svg)$/.test(file)) continue;
    const text = await readFile(path, 'utf8');
    assert.ok(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|"type"\s*:\s*"service_account"|AIza[\w-]{35}|postgres(?:ql)?:\/\/|AKIA[A-Z0-9]{16}/.test(text),
      'Potential credential or database configuration detected; inspect human-only');
    if (file.endsWith('.js') && text.includes('synthetic-public-build-fixture')) {
      assert.ok(['fixture.invalid', 'petalpal-synthetic', 'synthetic-public-app'].every(value => text.includes(value)),
        'All Firebase build settings must be synthetic');
      syntheticBundle = true;
    }
  }
  assert.ok(syntheticBundle, 'Retained Expo bundle must contain synthetic build settings');
});
