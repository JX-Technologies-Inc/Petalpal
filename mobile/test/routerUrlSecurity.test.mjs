import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { loadPlantingModules } from './loadPlantingModules.mjs';

const require = createRequire(import.meta.url);
const queryString = require('query-string');
const originalParse = queryString.parse;
queryString.parse = () => { throw new Error('Legacy decoder parser invoked'); };
after(() => { queryString.parse = originalParse; });
const parserFile = require.resolve('expo-router/build/fork/getStateFromPath');
const parserRequire = createRequire(parserFile);
const module = { exports: {} };
// Replace only the React Native facade with its actual pure validator: no native runtime.
const validatePathConfig = require('expo-router/build/react-navigation/core/validatePathConfig').validatePathConfig;
vm.runInThisContext(`(function(require,module,exports){${fs.readFileSync(parserFile, 'utf8')}
})`, { filename: parserFile })(
  name => name === '../react-navigation/native' ? { validatePathConfig } : parserRequire(name), module, module.exports);
const { getStateFromPath } = module.exports;
const { parseQueryParams } = require('expo-router/build/fork/getStateFromPath-forks');
const { routeAllowed } = loadPlantingModules()('../../../services/routePolicy');
const config = { screens: { garden: '', fairy: 'garden-test', feature: 'feature/:feature', visit: 'visit/:ownerId', preview: 'treehouse-test' } };

for (const value of ['%', '%GG', '%E0%A4%A', '%FF'.repeat(512)]) {
  test(`SDK 57 query parser preserves bounded malformed input (${value.length} chars) without legacy decoder`, () => {
    const route = { name: 'garden', params: {} };
    const parsed = parseQueryParams('/?value=' + value, route);
    assert.equal(parsed.value, new URLSearchParams('value=' + value).get('value'));
  });
}
test('SDK query parser preserves duplicate values and encoded separators', () => {
  const parsed = parseQueryParams('/?tag=one&tag=two&text=a%26b%3Dc', { name: 'garden' });
  assert.deepEqual(parsed.tag, ['one', 'two']);
  assert.equal(parsed.text, 'a&b=c');
});
test('query cannot override route owner identity', () => {
  const state = getStateFromPath('/visit/owner?ownerId=other&ownerId=third', config);
  assert.equal(state.routes[0].params.ownerId, 'owner');
});
test('valid Garden/Fairy routes and UTF-8 query values remain navigable', () => {
  for (const path of ['/', '/garden-test', '/feature/fairy?label=hello%20%E2%9C%93']) {
    assert.ok(getStateFromPath(path, config));
    assert.equal(routeAllowed(path.split('?')[0], false), true);
  }
});
test('encoded separators are data; decoded nested visitor paths remain denied', () => {
  const state = getStateFromPath('/visit/owner%2Fdebug', config);
  assert.equal(state.routes[0].params.ownerId, 'owner/debug');
  assert.equal(routeAllowed('/visit/' + state.routes[0].params.ownerId, false), false);
});
test('traversal-like and unexpected production paths remain denied', () => {
  for (const path of ['/../treehouse-test', '/%2e%2e/treehouse-test', '/treehouse-test', '/feature/debug', '/visit/a/debug', '/unexpected']) {
    assert.equal(routeAllowed(path, false), false);
  }
  assert.equal(getStateFromPath('/unexpected', config), undefined);
});

test('bundled legacy parser enters the query-string decoder boundary', () => {
  const legacy = require('expo-router/build/react-navigation/core/getStateFromPath');
  assert.throws(() => legacy.getStateFromPath('/visit/owner?label=hello', config), /Legacy decoder parser invoked/);
});
