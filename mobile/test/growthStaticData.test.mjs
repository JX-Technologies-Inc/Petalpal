import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../src/components/garden/flower-density-sandbox/monthly-growth/growthStaticData.json',import.meta.url)));
for(const [name,hash] of Object.entries(data.sourceHashes)){
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../../'+name,import.meta.url))).digest('hex'),hash,name);
}
const load=loadPlantingModules(),coverage=load('../flower-density-sandbox/monthly-growth/growthCoverage');
const info=load('../flower-density-sandbox/monthly-growth/growthStatic');
const reference=JSON.parse(fs.readFileSync(new URL('../../output/flower-visual-checkpoints/PRODUCTION_GROWTH_V1_1_VISUAL_APPROVED/reference.json',import.meta.url)));
assert.deepEqual(JSON.parse(JSON.stringify(coverage.growthMask(6))),reference.cases.cold30.growth.mask);
for(let month=1;month<=12;month++){
  assert.equal(info.getGrowthRegionInfo(month).month,month);
  const first=coverage.growthMask(month);assert.equal(coverage.growthMask(month),first);
  assert.ok(first.points.length>0&&first.path.length>0);
}
assert.throws(()=>info.getGrowthRegionInfo(0));
console.log('All twelve static regions have current source hashes; June sampler exactly matches the frozen pre-optimization reference; identities are reused.');
