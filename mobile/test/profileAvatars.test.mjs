import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { AVATAR_IDS } from '../../lib/avatars.js';
import { loadPlantingModules } from './loadPlantingModules.mjs';

const load = loadPlantingModules();
const plain = value => JSON.parse(JSON.stringify(value)); // VM-realm objects

test('the app bundles exactly the server avatar library, one WebP each', () => {
  const { AVATAR_ART, AVATAR_IDS: appIds, DEFAULT_AVATAR, avatarArt } = load('../../avatars/avatarArt');
  assert.deepEqual(plain(appIds), [...AVATAR_IDS]);
  assert.ok(AVATAR_IDS.includes(DEFAULT_AVATAR));
  for (const id of AVATAR_IDS) {
    assert.equal(AVATAR_ART[id], `@/assets/avatars/${id}.webp`);
    assert.ok(fs.statSync(new URL(`../assets/avatars/${id}.webp`, import.meta.url)).size < 40_000, id);
  }
  assert.equal(avatarArt('🐦'), undefined, 'legacy emoji avatars still render as text');
  assert.equal(avatarArt(null), undefined);
});

test('time zones show as a city and zone name in the owner\'s language', () => {
  const { timezoneLabel } = load('../../../services/timezoneLabel');
  assert.equal(timezoneLabel('America/Vancouver', 'en'), 'Vancouver · Pacific Time');
  assert.equal(timezoneLabel('America/Vancouver', 'zh-Hans'), '温哥华 · 北美太平洋时间');
  assert.match(timezoneLabel('America/Argentina/Buenos_Aires', 'en'), /^Buenos Aires · /);
  assert.match(timezoneLabel('Asia/Shanghai', 'zh-Hans'), /^上海 · /);
  assert.equal(timezoneLabel(null, 'en'), 'Coordinated Universal Time (UTC)');
  assert.equal(timezoneLabel('Not/AZone', 'en'), 'AZone', 'an unknown zone still shows its city part');
});

test('the Moments cover library matches the server ids, one WebP each', async () => {
  const { MOMENT_COVER_IDS } = await import('../../lib/moment-covers.js');
  const { MOMENT_COVERS, MOMENT_COVER_IDS: appIds, momentCover } = load('../../moments/momentCovers');
  assert.deepEqual(plain(appIds), [...MOMENT_COVER_IDS]);
  for (const id of MOMENT_COVER_IDS) {
    assert.equal(MOMENT_COVERS[id], `@/assets/moment-covers/${id}.webp`);
    assert.ok(fs.statSync(new URL(`../assets/moment-covers/${id}.webp`, import.meta.url)).size < 120_000, id);
  }
  assert.equal(momentCover(null), undefined);
  assert.equal(momentCover('cover-99'), undefined);
});
