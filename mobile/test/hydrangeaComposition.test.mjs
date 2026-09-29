import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const load=loadPlantingModules(),clean=x=>JSON.parse(JSON.stringify(x));
const hyd=load('../flower-density-sandbox/hydrangea-components/hydrangeaComposition');
const images=load('../flower-density-sandbox/hydrangea-components/componentImages').COMPONENT_IMAGES;
const area=load('../flower-density-sandbox/tulip-components/tulipAreaProfiles');
const model=load('../flower-density-sandbox/flowerDensityModel');
assert.equal(hyd.COMPONENTS.length,25);assert.equal(new Set(hyd.COMPONENTS.map(c=>c.sha256)).size,25);
for(const c of hyd.COMPONENTS){
  assert.equal(c.speciesCode,'HYDRANGEA');assert.equal(c.status,'APPROVED_L_CLASS_REFERENCE');
  assert.equal(c.worldUnitsPerPixel,.18);assert.equal(c.defaultVisualScale,1);assert.ok(images[c.componentId]);
  assert.equal(c.anchorX*512,c.canvasOffset[0]+c.sourceGroundPoint[0]-c.sourceRect[0]);
  assert.equal(c.anchorY*512,c.canvasOffset[1]+c.sourceGroundPoint[1]-c.sourceRect[1]);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL(`../../${c.asset}`,import.meta.url))).digest('hex'),c.sha256);
  assert.equal(hyd.componentById(c.componentId),c);assert.ok(c.bloomCount<=2,'Huge bushes never become Journal prefabs');
}
const colors=new Set(),silhouettes=new Set();let fullTwo=0,fullThree=0,partialRecipes=0,totalRecipes=0;
for(const month of [6,7,10])for(const density of ['sparse','normal','full'])for(let i=0;i<150;i++){
  const region=model.getRegionInfo(month),id=`hyd-${i}`,c=hyd.composeHydrangea(id,region,density);
  assert.deepEqual(clean(c),clean(hyd.composeHydrangea(id,region,density)));
  assert.equal(c.footprintRadius,16);assert.equal(c.plantingObjectCount,1);assert.deepEqual(clean(c.secondaryEmotions),[]);
  const [min,max]=hyd.DENSITY_HEADS[density];assert.ok(c.bloomCount>=min && c.bloomCount<=max);
  assert.equal(c.parts.reduce((sum,p)=>sum+hyd.componentById(p.componentId).bloomCount,0),c.bloomCount);
  const heads=c.parts.filter(p=>hyd.componentById(p.componentId).bloomCount>0);
  assert.ok(c.parts.some(p=>hyd.componentById(p.componentId).category==='foliage'),'Every composition has foliage');
  if(density==='sparse')assert.equal(hyd.componentById(heads[0].componentId).category,'partial');
  if(heads.length>1){assert.ok(heads.some(p=>p.scale<heads[0].scale) || heads.some(p=>p.scale>heads[0].scale),'Staggered head sizes');
    assert.ok(new Set(heads.map(p=>p.localY)).size>1,'Staggered depth');}
  if(density==='full'){if(c.bloomCount===2)fullTwo++;else fullThree++;}
  if(heads.some(p=>hyd.componentById(p.componentId).category==='partial'))partialRecipes++;totalRecipes++;
  const p=area.DEFAULT_AREA_PROFILES[area.classifyMaskArea(region.estimatedArea)];
  assert.equal(c.internalSpread,p.spread);assert.deepEqual(clean(c.compositionWeights),clean(p.weights));
  for(const part of c.parts){
    assert.ok(Math.abs(part.localX)<=6*p.spread);assert.ok(Math.abs(part.localY)<=2.5*p.spread);
    assert.ok(part.scale>=.38 && part.scale<=1);assert.ok(Math.abs(part.rotation)<=6*Math.PI/180);
    const component=hyd.componentById(part.componentId);
    if(component.bloomCount)assert.ok(['partial','head','asymmetric'].includes(component.category),'All main heads use V2 stem/patch art');
    assert.ok(component.componentId.endsWith('_v2'),'No rejected V1 components');
  }
  colors.add(c.colorFamily);silhouettes.add(JSON.stringify(c.parts));
}
assert.deepEqual([...colors].sort(),['blue','lavender','mixed','pink']);assert.ok(silhouettes.size>400);
assert.ok(fullTwo>fullThree*3,'Full is usually two heads, not routinely three');
assert.ok(partialRecipes/totalRecipes>.8,'Partial/side blooms dominate the recipe set');
assert.deepEqual(clean(area.AREA_THRESHOLDS),{medium:45000,large:90000});
console.log('Hydrangea: 25 unique assets and soil anchors; 1,350 deterministic recipes, 1/1–2/2–3 heads, source color variety, coherent offsets, radius 16, one object, existing profiles, no emotions passed.');
