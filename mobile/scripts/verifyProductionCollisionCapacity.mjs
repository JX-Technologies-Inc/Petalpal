import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createAuditEngine} from './collisionAuditEngine.mjs';
const engine=createAuditEngine(); // No radius resolver/VM override.
const scenario=engine.scenarios.find(s=>s.key==='representative'),rows=[];
for(let month=1;month<=12;month++){
  const {placements,...row}=engine.runScenario(month,scenario);
  assert.equal(row.placed,30,`${row.landId} requires 30 real parents`);
  assert.deepEqual(row.uniqueProductionRadii,[9,12,16]);
  rows.push(row);console.log(`${row.landId}: ${row.placed}/30; minimum clearance ${row.minimumPairwiseClearance.toFixed(2)}px`);
}
const out=new URL('../../output/production-collision-sml-v1/',import.meta.url);
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(new URL('capacity.json',out),JSON.stringify({resolver:'resolveParentCollision',auditOverride:false,qaPlacementsPersisted:false,rows},null,2)+'\n');
