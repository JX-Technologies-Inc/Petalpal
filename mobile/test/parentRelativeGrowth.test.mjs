import {assertFlowerBaseline} from './assertFlowerBaseline.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const storage=new Proxy({}, {get(){throw new Error('Pure anchoring must not access persistence');}});
const load=loadPlantingModules(storage),plain=x=>JSON.parse(JSON.stringify(x));
const monthly=load('../flower-density-sandbox/monthly-growth/monthlyGrowthModel');
const layered=load('../flower-density-sandbox/monthly-growth/layeredBedModel');
const relative=load('parentRelativeGrowth');
const records=monthly.monthlyGrowthRecords(6,30);
const approved=layered.buildLayeredBed(monthly.buildMonthlyGrowth(records,6),6);
const original=JSON.stringify(approved);
const recipe=relative.toParentRelativeGrowth(approved),recipeBefore=JSON.stringify(recipe);
assert.ok(recipe.children.every(p=>!('worldX' in p)&&!('worldY' in p)),'No absolute child coordinates retained');
assert.equal(recipe.children.length,591);
const reconstructed=relative.fromParentRelativeGrowth(recipe,records);
assert.deepEqual(plain(reconstructed.pieces),plain(approved.pieces),'Original anchors reconstruct the exact approved layout');
const movedId=records[0].id,dx=17,dy=-11;
const movedRecords=records.map(p=>p.id===movedId?{...p,worldX:p.worldX+dx,worldY:p.worldY+dy}:p);
const moved=relative.fromParentRelativeGrowth(recipe,movedRecords);
for(let i=0;i<approved.pieces.length;i++){
  const before=approved.pieces[i],after=moved.pieces[i],moves=before.parentId===movedId;
  assert.equal(after.worldX,before.worldX+(moves?dx:0));assert.equal(after.worldY,before.worldY+(moves?dy:0));
  assert.equal(after.id,before.id);assert.equal(after.parentId,before.parentId);assert.equal(after.scale,before.scale);
  assert.equal(after.rotation,before.rotation);assert.equal(after.componentId,before.componentId);
  if(moves)assert.notDeepEqual([after.worldX,after.worldY],[before.worldX,before.worldY],'No orphan at the original position');
}
assert.equal(JSON.stringify(recipe),recipeBefore,'Moving does not rewrite local offsets');
assert.equal(JSON.stringify(approved),original,'Approved source data is untouched');
assert.deepEqual(plain(relative.fromParentRelativeGrowth(recipe,records).pieces),plain(approved.pieces),'Cancel restores all original visuals');
const removed=relative.fromParentRelativeGrowth(recipe,records.filter(p=>p.id!==movedId));
assert.ok(removed.pieces.every(p=>p.parentId!==movedId),'No orphan children after parent removal');
const fresh=loadPlantingModules(storage)('parentRelativeGrowth');
assert.deepEqual(plain(fresh.fromParentRelativeGrowth(plain(recipe),plain(movedRecords)).pieces),plain(moved.pieces),
  'Pure reconstruction is deterministic given the same local recipe and saved anchors');
const footprint=load('flowerFootprintConfig');
assert.equal(footprint.getFlowerPlacementDefinition('Tulip').footprintRadius,12);
assert.equal(footprint.getFlowerPlacementDefinition('Sunflower').footprintRadius,16);
assert.equal(footprint.getFlowerPlacementDefinition().footprintRadius,22);
const baseline=JSON.parse(fs.readFileSync(new URL('../../docs/flower-visuals/MONTHLY_GROWTH_PROTECTED_BASELINE.json',import.meta.url)));
for(const path of ['mobile/src/components/garden/planting/flowerFootprintConfig.ts',
  'mobile/src/components/garden/planting/placementValidator.ts']){
  assertFlowerBaseline(path,baseline[path]);
}
console.log('Pure anchoring: exact approved reconstruction, equal dx/dy for every child, stable local offsets, Cancel, parent removal, deterministic reconstruction, no storage and unchanged production collision definitions passed.');
