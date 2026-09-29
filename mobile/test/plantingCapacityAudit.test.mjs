import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPlantingModules} from './loadPlantingModules.mjs';
import {getCandidates,runScenario,scenarios} from '../scripts/auditPlantingCapacity.mjs';
const modules=loadPlantingModules(new Proxy({}, {get(){throw new Error('Audit test must never read or write storage');}}));
const config=modules('flowerFootprintConfig'),validator=modules('placementValidator').validateFlowerPlacement;
const masks=modules('approvedPlantingMasks'),regions=modules('plantingRegionData').MONTH_REGION_METAS;
assert.equal(config.getFlowerPlacementDefinition('Tulip').footprintRadius,12);
assert.equal(config.getFlowerPlacementDefinition('Lavender').footprintRadius,9);
assert.equal(config.getFlowerPlacementDefinition('Sunflower').footprintRadius,16);
assert.equal(config.getFlowerPlacementDefinition('Daisy').footprintRadius,9);
assert.equal(config.DEFAULT_FLOWER_PLACEMENT_DEF.footprintRadius,22);
const teaCourtyard=validator({flowerId:'tea-check',month:6,worldX:1845,worldY:435,existingPlacements:[],flowerName:'Daisy'});
assert.equal(teaCourtyard.isValid,false,'Land06 Tea Set courtyard is excluded by the current production planting rules');
assert.equal(teaCourtyard.reason,'NOT_PLANTABLE_GRASS');
for(let month=1;month<=12;month++){
  assert.equal(masks.APPROVED_MASK_CALIBRATION[month].landId,regions[month].landId);
  assert.equal(masks.APPROVED_MASK_REFINEMENTS[month].month,month);
}
const candidatePoints=getCandidates(6),mix=scenarios.find(s=>s.key==='representative');
const first=runScenario(6,mix,candidatePoints),second=runScenario(6,mix,candidatePoints);
assert.deepEqual(second,first,'Same current Final Mask, species mix and search seeds produce identical placements/capacity');
assert.equal(first.requested,30);assert.equal(first.placed,30);
let occupied=[];
for(const p of first.placements){
  const result=validator({flowerId:p.id,month:6,worldX:p.worldX,worldY:p.worldY,existingPlacements:occupied,flowerName:p.flowerName});
  assert.equal(result.isValid,true,`${p.id} passes the real production validator`);
  occupied.push({id:p.id,flowerId:p.id,month:6,worldX:p.worldX,worldY:p.worldY,flowerName:p.flowerName,landId:'Land06'});
}
assert.equal(occupied.every(p=>p.landId==='Land06'),true);
assert.equal(first.placements.some(p=>p.id.includes('audit-only')),false);
const report=JSON.parse(fs.readFileSync(new URL('../../output/production-planting-capacity-audit/capacity.json',import.meta.url)));
assert.equal(report.qaPlacementsPersisted,false);
assert.ok(report.scenarioResults.every(row=>!('placements' in row)),'Saved output contains aggregate audit results only, no QA record coordinates');
console.log(`Planting capacity audit: production radii, all twelve approved mask identities, deterministic June representative packing (${first.placed}/30), validator parity and storage isolation passed.`);
