import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const root=new URL('../../',import.meta.url),plain=x=>JSON.parse(JSON.stringify(x));
const items=new Map(),writes=[];
const storage={getItem:k=>items.get(k)??null,setItem:(k,v)=>{writes.push(k);items.set(k,v);}};
const load=loadPlantingModules(storage),collision=load('parentCollision'),config=load('flowerFootprintConfig');
const expected={S:['CHAMOMILE','COREOPSIS','DAISY','BLUEBELL','HEATHER','SNOWDROP','ASTER','DANDELION','YELLOW_RAPESEED_FLOWER','CHINESE_VIOLET_CRESS','LAVENDER'],M:['TULIP','GERBERA_DAISY','ANEMONE','GENTIAN','PETUNIA','POPPY','WHITE_ROSE','YELLOW_DAFFODIL','OLIVE'],L:['HYDRANGEA','SUNFLOWER','BIRD_OF_PARADISE']};
const radii={S:9,M:12,L:16};
assert.equal(Object.keys(collision.PARENT_COLLISION_CLASSES).length,23);
for(const [cls,species] of Object.entries(expected))for(const code of species){
  assert.deepEqual(plain(collision.resolveParentCollision(code)),{speciesCode:code,status:'CLASSIFIED',collisionClass:cls,radius:radii[cls]});
  assert.equal(config.getFlowerPlacementDefinition('unrelated display',code).footprintRadius,radii[cls]);
  assert.equal(config.getFlowerPlacementDefinition(code.toLowerCase().replaceAll('_',' ')).footprintRadius,radii[cls]);
}
const masks=load('approvedPlantingMasks'),validate=load('placementValidator').validateFlowerPlacement;
const points=load('../flower-density-sandbox/monthly-growth/growthCoverage').growthMask(6).points;
const point=points.find(p=>masks.isFootprintInApprovedMonthMaskWorld(6,p.x,p.y,24));assert.ok(point);
for(const code of ['LOTUS','CHERRY_BLOSSOM','UNKNOWN']){
  assert.equal(collision.resolveParentCollision(code).status,'UNRESOLVED');
  assert.equal(validate({flowerId:'new',month:6,worldX:point.x,worldY:point.y,flowerName:'Tulip',speciesCode:code,existingPlacements:[]}).reason,'COLLISION_CLASS_UNRESOLVED');
}
const saved={id:'saved',flowerId:'real',journalEntryId:'journal',month:6,landId:'Land06',worldX:point.x,worldY:point.y,rotation:13,scale:.83,plantedDate:'2026-06-01T12:00:00Z',placementVersion:1,flowerName:'pink',speciesCode:'CHAMOMILE'};
items.set('petalpal_flower_placements_v1',JSON.stringify([saved]));
const restored=await load('plantingPersistence').loadFlowerPlacements();assert.deepEqual(plain(restored),[saved]);assert.equal(writes.length,0);
const params={flowerId:'real',month:6,worldX:point.x,worldY:point.y,flowerName:'pink',speciesCode:'CHAMOMILE',existingPlacements:[saved]};
assert.equal(validate(params).reason,'COLLIDES_WITH_FLOWER');assert.equal(validate({...params,ignorePlacementId:'saved'}).isValid,true);
assert.equal(validate({...params,ignorePlacementId:'someone-else'}).reason,'COLLIDES_WITH_FLOWER');
// Accepted legacy footprint at the same anchor implies accepted smaller radius.
for(const code of Object.keys(collision.PARENT_COLLISION_CLASSES))assert.equal(validate({...params,speciesCode:code,existingPlacements:[]}).isValid,true);
// Real renderer circles use the same canonical resolver, including mismatched names.
const jsx=(type,props)=>({type,props});let state;
const renderLoad=loadPlantingModules(undefined,{useMemo:f=>f()},undefined,true,{
  'react/jsx-runtime':{jsx,jsxs:jsx},'@shopify/react-native-skia':{Circle:'Circle',Group:'Group'},
  './PlantingContext':{usePlanting:()=>state},'./productionGrowth':{productionGrowth:()=>[]},'./ProductionGrowthLayer':{ProductionGrowthLayer:'Growth'},
});
const nodes=n=>Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[];
for(const mode of ['planting','adjusting'])for(const code of ['CHAMOMILE','TULIP','HYDRANGEA']){
  state={placements:[],activeMode:mode,targetFlower:{...saved,speciesCode:code},previewCoords:point,validationResult:{isValid:true}};
  const circles=nodes(renderLoad('ProductionPlantedFlowers').ProductionPlantedFlowers({})).filter(n=>n.type==='Circle');
  assert.equal(circles.find(n=>n.props.style==='stroke').props.r,collision.resolveParentCollision(code).radius);
}
// All untouched baseline source/art/masks and prior archives must remain byte-identical.
const baseline=JSON.parse(fs.readFileSync(new URL('output/collision-model-candidate-audit/candidate-results.json',root)));
const authorized=JSON.parse(fs.readFileSync(new URL('docs/flower-visuals/PRODUCTION_COLLISION_SML_HASHES.json',root)));
for(const [file,hash] of Object.entries(baseline.protectedHashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL(file,root))).digest('hex'),authorized[file]??hash,file);
const capacity=JSON.parse(fs.readFileSync(new URL('output/production-collision-sml-v1/capacity.json',root)));
assert.equal(capacity.auditOverride,false);assert.equal(capacity.rows.length,12);assert.ok(capacity.rows.every(r=>r.placed===30));
console.log('Production collision: all 23 classes, canonical precedence, unresolved rejection, preview/Adjust parity, self-ignore, saved-record no-write preservation, 12-land actual capacity and protected source/art/checkpoints passed.');
