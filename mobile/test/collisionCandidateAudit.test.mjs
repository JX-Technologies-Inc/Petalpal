import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createAuditEngine} from '../scripts/collisionAuditEngine.mjs';
import {candidateEngine,classes} from '../scripts/auditCollisionCandidates.mjs';
import {runScenario} from '../scripts/auditPlantingCapacity.mjs';
const current=createAuditEngine(),candidate=candidateEngine({S:9,M:12,L:16});
assert.equal(classes.CHAMOMILE,'S');assert.equal(classes.TULIP,'M');assert.equal(classes.HYDRANGEA,'L');
for(const species of Object.keys(classes))assert.ok(candidate.config.getFlowerPlacementDefinition(species).footprintRadius<=current.config.getFlowerPlacementDefinition(species).footprintRadius,species);
for(const [name,radius] of [['Tulip',12],['Lavender',9],['Sunflower',16],['Daisy',9],['Lotus',22],['Cherry Blossom',22]])assert.equal(current.config.getFlowerPlacementDefinition(name).footprintRadius,radius);
const scenario=current.scenarios.find(s=>s.key==='representative');
const old=current.runScenario(6,scenario),original=runScenario(6,scenario);
assert.deepEqual(old,original,'injected engine with no override equals previous audit');
const occupied=[];
for(const p of old.placements){const params={flowerId:p.id,month:6,flowerName:p.flowerName,worldX:p.worldX,worldY:p.worldY,existingPlacements:occupied};assert.equal(current.validate(params).isValid,true);assert.equal(candidate.validate(params).isValid,true);occupied.push({...p,flowerId:p.id,month:6});}
const p=occupied[0];const params={flowerId:'new',month:6,flowerName:p.flowerName,worldX:p.worldX,worldY:p.worldY,existingPlacements:occupied};
assert.equal(candidate.validate(params).reason,'COLLIDES_WITH_FLOWER');
assert.equal(candidate.validate({...params,ignorePlacementId:p.id}).isValid,true);
const first=candidate.runScenario(6,scenario),second=candidate.runScenario(6,scenario);
assert.deepEqual(first,second,'candidate reload/search deterministic');
const data=JSON.parse(fs.readFileSync(new URL('../../output/collision-model-candidate-audit/candidate-results.json',import.meta.url),'utf8'));
assert.equal(data.qaPlacementsPersisted,false);
for(const model of data.models){assert.equal(model.rows.length,48);for(const row of model.rows)assert.equal('placements' in row,false);}
const migration=JSON.parse(fs.readFileSync(new URL('../../docs/flower-visuals/PRODUCTION_COLLISION_SML_HASHES.json',import.meta.url),'utf8'));
for(const [file,hash] of Object.entries(data.protectedHashes)){const bytes=fs.readFileSync(new URL('../../'+file,import.meta.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),migration[file]??hash,file);}
console.log('Candidate isolation, previous-engine parity, monotonic placement, collision/Adjust, determinism and protected hashes passed.');
