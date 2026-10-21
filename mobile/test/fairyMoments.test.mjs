import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { FAIRY_MOMENTS_CONFIG } from '../../lib/fairy-config.js';

const ts = createRequire(import.meta.url)('typescript');
const src = new URL('../src/', import.meta.url);
// Values cross a vm realm, so compare plain JSON.
const same = (actual, expected) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
// Transpile one TS module and run it with injected imports.
function load(relative, imports = {}) {
  const exports = {};
  const source = fs.readFileSync(new URL(relative, src), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  vm.runInNewContext(outputText, { exports, Date, Math, Number, String, encodeURIComponent, Boolean, require: ref => {
    if (ref in imports) return imports[ref];
    throw Error(`unexpected import ${ref}`);
  } });
  return exports;
}

// Labels: phone-local time, readable places.
const format = load('components/moments/momentFormat.ts');
const now = new Date(2026, 9, 21, 15, 0);
const ago = minutes => new Date(now.getTime() - minutes * 60_000).toISOString();
assert.equal(format.momentTimeLabel(ago(0), now), 'Just now');
assert.equal(format.momentTimeLabel(ago(12), now), '12 min ago');
assert.equal(format.momentTimeLabel(ago(150), now), '2 h ago');
assert.equal(format.momentTimeLabel(new Date(2026, 9, 20, 14, 32).toISOString(), now), 'Yesterday 14:32');
assert.equal(format.momentTimeLabel(new Date(2026, 9, 15, 9, 0).toISOString(), now), 'Oct 15');
assert.equal(format.momentTimeLabel(new Date(2025, 11, 31, 9, 0).toISOString(), now), 'Dec 31, 2025');
assert.equal(format.momentTimeLabel('not a date', now), '');
assert.equal(format.momentLocationLabel('TEA_CHAIR'), 'Tea chair');
assert.equal(format.momentLocationLabel('EAST_BRIDGE'), 'East bridge');
assert.equal(format.momentLocationLabel('SOMEWHERE_NEW'), 'Garden');

// API client: Moments are on only when the runtime response carries them; any failure keeps the old icon.
const calls = [];
let reply = async () => ({});
const service = load('services/fairyMoments.ts', { './api': { apiRequest: async (...args) => { calls.push(args); return reply(...args); } } });
reply = async () => ({ fairy: {}, moments: { unread: true } });
same(await service.syncFairyMoments(), { enabled: true, unread: true });
same(calls.at(-1), ['/api/fairy/runtime']);
reply = async () => ({ fairy: {} });
same(await service.syncFairyMoments(), { enabled: false, unread: false });
reply = async () => { throw Object.assign(new Error('Complete onboarding'), { status: 409 }); };
same(await service.syncFairyMoments(), { enabled: false, unread: false });
reply = async () => ({ posts: [] });
await service.loadFairyMoments();
same(calls.at(-1), ['/api/fairy/moments']);
await service.loadFairyMoments('2026-10-15T20:00:00.000Z');
same(calls.at(-1), ['/api/fairy/moments?before=2026-10-15T20%3A00%3A00.000Z']);
await service.likeFairyMoment('m/1', true);
same(calls.at(-1), ['/api/fairy/moments/m%2F1/like', 'POST', { liked: true }]);

// Every photo the server can pick has a bundled file, and nothing is bundled that it can't pick.
const required = [];
const photos = load('components/moments/momentPhotos.ts', new Proxy({}, { has: () => true, get: (_, path) => { required.push(path); return path; } }));
const bundled = Object.keys(photos.MOMENT_PHOTOS);
assert.equal(photos.momentPhoto(null), undefined);
assert.equal(photos.momentPhoto('TEA_TIME/1'), '@/assets/moments/TEA_TIME-1.jpg');
const serverKeys = [
  ...Object.entries(FAIRY_MOMENTS_CONFIG.photos).flatMap(([state, list]) => list.map(photo => `${state}/${photo.key}`)),
  ...FAIRY_MOMENTS_CONFIG.spots.map(spot => `IDLE/${spot}`),
];
assert.deepEqual([...bundled].sort(), [...serverKeys].sort());
for (const path of required) assert.ok(fs.existsSync(new URL(`../assets/${path.replace('@/assets/', '')}`, import.meta.url)), path);
console.log('fairyMoments tests passed');
