import assert from 'node:assert/strict';
import {assertFlowerBaseline} from './assertFlowerBaseline.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const clean=x=>JSON.parse(JSON.stringify(x));
const read=p=>JSON.parse(fs.readFileSync(new URL(`../../${p}`,import.meta.url)));
const manifest=read('mobile/src/components/garden/flower-density-sandbox/hydrangea-components/componentManifest.json');
assert.equal(manifest.artVersion,2);
assert.equal(manifest.sourceSha256,'54db3ac0ac344c24d44cdad6b0cf007ff578daedab4cd81606760030ccdd661a');
const rejected=read('output/hydrangea-v1-rejected-assets.json');
for(const old of rejected.assets){
  assert.ok(!fs.existsSync(new URL(`../../${old.asset}`,import.meta.url)),old.asset);
  assert.ok(!manifest.components.some(c=>c.componentId===old.componentId || c.sha256===old.sha256));
}
for(const [p,hash] of Object.entries(read('output/hydrangea-v2-protected-baseline.json'))){
  assertFlowerBaseline(p,hash);
}
const model=loadPlantingModules()('../flower-density-sandbox/speciesReviewModel');
for(const snapshot of read('output/hydrangea-v2-placement-baseline.json')){
  const actual=model.generateSpeciesReviewLayout(snapshot.month,snapshot.layout.requested,snapshot.species);
  assert.deepEqual(clean(actual),snapshot.layout,'Exact old preset IDs, species assignments, positions, counts and footprints retained');
  const otherSpecies=model.composeSpeciesReview(actual.flowers,snapshot.month).filter(f=>f.speciesCode!=='HYDRANGEA');
  assert.deepEqual(clean(otherSpecies),snapshot.otherSpecies,'Tulip and Chamomile visuals unchanged');
}
console.log('V2 replacement: all 25 rejected assets absent; V2-only manifest; protected code/data unchanged; all four presets retain exact positions and other-species visuals.');
