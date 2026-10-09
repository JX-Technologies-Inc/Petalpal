import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const decoderFile = require.resolve('decode-uri-component');
const decode = require('decode-uri-component');
const queryString = require('query-string');
const config = { screens: { garden: '', fairy: 'garden-test', feature: 'feature/:feature', visit: 'visit/:ownerId' } };

test('clean install resolves every locked query-string caller to the CommonJS backport', () => {
  assert.equal(fs.realpathSync(decoderFile), fileURLToPath(new URL('../vendor/decode-uri-component/index.cjs', import.meta.url)));
  const lock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url)));
  const callers = Object.keys(lock.packages).filter(p => p.endsWith('/query-string'));
  assert.ok(callers.length > 0);
  for (const caller of callers) {
    const callerRequire = createRequire(fileURLToPath(new URL('../' + caller + '/index.js', import.meta.url)));
    assert.equal(fs.realpathSync(callerRequire.resolve('decode-uri-component')), fs.realpathSync(decoderFile));
  }
  assert.equal(typeof decode, 'function');
});

test('valid UTF-8, separators, one-level encoding and long valid components preserve decoding', () => {
  for (const value of ['', '%00', '%7F', '%2F%3F%23', '%2B', '%252525', '%ED%9F%BF', '%F4%8F%BF%BF', '%F0%9F%98%80', '%E4%BD%A0%E5%A5%BD', '%20'.repeat(3000)]) {
    assert.equal(decode(value), decodeURIComponent(value));
  }
  assert.equal(decode('a+b%2Bc'), 'a b+c');
  for (const value of [undefined, null, 1, {}, [], Symbol('x')]) assert.throws(() => decode(value), TypeError);
});

test('upstream malformed-byte and percent-separator security regressions', () => {
  const cases = {
    '%': '%', '%GG': '%GG', '%E0%A4%A': '%E0%A4%A',
    '%C0%AF': '%C0%AF', '%ED%A0%80': '%ED%A0%80', '%F4%90%80%80': '%F4%90%80%80',
    '%F0%9F%41': '%F0%9FA', '%C3%41': '%C3A', '%E0%80%80': '%E0%80%80',
    '%F0%9F%98%80%ab': '😀%ab', '%C3%A5%%C3%A5': 'å%å',
    '%FE%FF': '\uFFFD\uFFFD', '%FF%FE': '\uFFFD\uFFFD', '%C2': '\uFFFD',
    '%C2%C2%B5': '\uFFFDµ', '%84%D7%25%88%90': '%84%D7%%88%90',
    '%20%20%25%80': '  %%80', '%7B%ab%7C%de%7D': '{%ab|%de}',
  };
  for (const [input, expected] of Object.entries(cases)) assert.equal(decode(input), expected, input);
});

test('fallback bound is exact at 4096 and 4097 UTF-16 code units', () => {
  const atLimit = '%'.repeat(4093) + '%20';
  assert.equal(decode(atLimit), '%'.repeat(4093) + ' ');
  const aboveLimit = '%' + atLimit;
  assert.equal(decode(aboveLimit), aboveLimit);
  assert.equal(decode('😀'.repeat(2048) + '%20%'), '😀'.repeat(2048) + '%20%');
  assert.equal(decode('a+'.repeat(2048) + '%'), 'a '.repeat(2048) + '%');
});

test('oversized malformed components never enter fallback scanner or replacement map', () => {
  let calls = 0;
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(decoderFile, 'utf8'), {
    module, decodeURIComponent: input => { calls++; return decodeURIComponent(input); },
  });
  for (const size of [4097, 8192, 1024 * 1024]) {
    const input = '%FF'.repeat(Math.floor(size / 3)) + '%'.repeat(size % 3);
    calls = 0;
    assert.equal(module.exports(input), input);
    assert.equal(calls, 1, 'only native linear decoding, with no fallback calls');
  }
});

test('adversarial decoding and legacy routing complete within a bounded subprocess deadline', () => {
  const result = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const decode = require(${JSON.stringify(decoderFile)});
    const parse = require(${JSON.stringify(require.resolve('query-string'))}).parse;
    const legacy = require(${JSON.stringify(require.resolve('expo-router/build/react-navigation/core/getStateFromPath'))});
    const distinctRuns = Array.from({length: 256}, (_, i) => '%FF%' + i.toString(16).padStart(2, '0') + 'x').join('');
    for (let i = 0; i < 10; i++) for (const size of [1024, 2048, 4096, 4097, 8192]) {
      for (const input of ['%FF'.repeat(Math.floor(size / 3)), '%84%D7%25%88%90'.repeat(Math.floor(size / 15)), distinctRuns]) {
        decode(input); parse('value=' + input);
        assert.ok(legacy.getStateFromPath('/visit/owner?value=' + input, ${JSON.stringify(config)}));
      }
    }
    const huge = '%FF'.repeat(350000); assert.equal(decode(huge), huge);
    assert.ok(legacy.getStateFromPath('/visit/owner?value=' + huge, ${JSON.stringify(config)}));
  `], { timeout: 5000, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});

test('query-string preserves duplicates, encoded keys, separators and owner query data', () => {
  const parsed = queryString.parse('tag=one&tag=two&text=a%26b%3Dc&%6Bey=hello+%E2%9C%93&ownerId=other');
  assert.deepEqual(parsed.tag, ['one', 'two']);
  assert.equal(parsed.text, 'a&b=c'); assert.equal(parsed.key, 'hello ✓');
  assert.equal(parsed.ownerId, 'other');
});

test('legacy parser preserves Garden/Fairy navigation and query decoding', () => {
  const { getStateFromPath } = require('expo-router/build/react-navigation/core/getStateFromPath');
  for (const path of ['/', '/garden-test', '/feature/fairy?label=hello%20%E2%9C%93']) assert.ok(getStateFromPath(path, config));
  const state = getStateFromPath('/visit/owner?label=%84%D7%25%88%90', config);
  assert.equal(state.routes[0].params.ownerId, 'owner');
  assert.equal(state.routes[0].params.label, '%84%D7%%88%90');
  assert.equal(getStateFromPath('/unexpected', config), undefined);
});

test('outbound query-string round trips preserve legitimate values', () => {
  const values = { label: 'Fairy ✓ + Garden', owner: 'a/b', text: 'a&b=c' };
  assert.deepEqual({ ...queryString.parse(queryString.stringify(values)) }, values);
});
