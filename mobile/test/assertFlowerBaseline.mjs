import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const collision=JSON.parse(fs.readFileSync(new URL('../../docs/flower-visuals/PRODUCTION_COLLISION_SML_HASHES.json',import.meta.url)));
const integration=JSON.parse(fs.readFileSync(new URL('../../docs/flower-visuals/PRODUCTION_GROWTH_INTEGRATION_HASHES.json',import.meta.url)));
const performance=JSON.parse(fs.readFileSync(new URL('../../docs/flower-visuals/PRODUCTION_GROWTH_PERFORMANCE_HASHES.json',import.meta.url)));
// Historical art baselines stay immutable. Explicit integration/performance
// source changes use separate exact hashes; performance output also has to
// match the frozen pre-optimization production reference in its regression gate.
export function assertFlowerBaseline(path,originalHash){
  const actual=crypto.createHash('sha256').update(fs.readFileSync(new URL('../../'+path,import.meta.url))).digest('hex');
  assert.equal(actual,collision[path]??performance[path]??integration[path]??originalHash,path);
}
