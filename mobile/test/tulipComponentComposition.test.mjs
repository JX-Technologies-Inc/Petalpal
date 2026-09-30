import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const load=loadPlantingModules();
const model=load('../flower-density-sandbox/tulip-components/tulipComposition');
const {composeTulip,COMPONENTS,COLOR_WEIGHTS,DENSITY_BLOOMS,partBounds}=model;
const images=load('../flower-density-sandbox/tulip-components/componentImages').COMPONENT_IMAGES;
const {compositionForId,sortVisualsByGroundY}=load('../flower-visuals/flowerVisualResolver');
const {generateDensityLayout,DEFAULT_TUNING}=load('../flower-density-sandbox/flowerDensityModel');
const clean=x=>JSON.parse(JSON.stringify(x));
const root=new URL('../../',import.meta.url);
assert.equal(COMPONENTS.length,28);assert.equal(new Set(COMPONENTS.map(c=>c.componentId)).size,28);
for(const c of COMPONENTS) {
  assert.ok(images[c.componentId]);assert.equal(c.status,'READY_FOR_REVIEW');
  assert.ok(c.anchorX>=0&&c.anchorX<=1&&c.anchorY>=0&&c.anchorY<=1);
  const png=fs.readFileSync(new URL(c.asset,root));
  assert.equal(png.readUInt32BE(16),512);assert.equal(png.readUInt32BE(20),512);assert.equal(png[25],6);
  assert.equal(createHash('sha256').update(png).digest('hex'),c.sha256);
}
const counts=Object.fromEntries(Object.keys(COLOR_WEIGHTS).map(k=>[k,0]));const signatures=new Set();
let assertions=0;
for(let i=0;i<1200;i++) {
  const id=`component-review-${i}`,c=composeTulip(id),same=composeTulip(id);
  assert.deepEqual(clean(c),clean(same));assert.equal(c.density,compositionForId(id));
  assert.equal(c.footprintRadius,12);assert.equal(c.plantingObjectCount,1);assert.equal(c.secondaryEmotions.length,0);
  const blooms=c.parts.map(p=>COMPONENTS.find(a=>a.componentId===p.componentId)).filter(a=>a.bloomCount>0);
  assert.equal(blooms.reduce((s,a)=>s+a.bloomCount,0),c.bloomCount);
  assert.ok(c.bloomCount>=DENSITY_BLOOMS[c.density][0]&&c.bloomCount<=DENSITY_BLOOMS[c.density][1]);
  if(c.colorFamily==='pink-only')assert.ok(blooms.every(b=>b.dominantColorFamily==='pink'));
  if(c.colorFamily==='yellow-only')assert.ok(blooms.every(b=>b.dominantColorFamily==='yellow'));
  if(!c.colorFamily.endsWith('-only')) {
    assert.ok(blooms.some(b=>b.dominantColorFamily==='pink'||b.dominantColorFamily==='mixed'));
    assert.ok(blooms.some(b=>b.dominantColorFamily==='yellow'||b.dominantColorFamily==='mixed'));
  }
  assert.ok(c.bounds.width<80&&c.bounds.height<65,'Cluster stays visually coherent');
  c.parts.forEach((p,j)=>{
    assert.ok(Math.abs(p.localX)<=6&&Math.abs(p.localY)<=3.5);
    assert.ok(Math.abs(p.rotation)<=10*Math.PI/180);
    if(j)assert.ok(c.parts[j-1].localY<=p.localY,'Internal ground depth');
    const b=partBounds(p),eps=1e-8;
    assert.ok(b.x>=c.bounds.x-eps&&b.y>=c.bounds.y-eps&&b.x+b.width<=c.bounds.x+c.bounds.width+eps&&b.y+b.height<=c.bounds.y+c.bounds.height+eps);
  });
  counts[c.colorFamily]++;signatures.add(JSON.stringify({density:c.density,color:c.colorFamily,parts:c.parts}));assertions++;
}
assert.equal(signatures.size,1200,'Useful non-prefab variations across distinct identities');
for(const [family,weight] of Object.entries(COLOR_WEIGHTS))assert.ok(Math.abs(counts[family]/1200-weight)<.05,`${family} seeded distribution`);
for(const density of ['sparse','normal','full'])for(let i=0;i<50;i++) {
  const c=composeTulip(`explicit-${i}`,density);assert.equal(c.density,density);
  assert.ok(c.bloomCount>=DENSITY_BLOOMS[density][0]&&c.bloomCount<=DENSITY_BLOOMS[density][1]);
}
for(const [month,count] of [[10,30],[6,30],[10,10]]) {
  const layout=generateDensityLayout(month,count,'M',DEFAULT_TUNING),original=JSON.stringify(layout);
  const composed=layout.flowers.map(f=>({...f,composition:composeTulip(f.id)}));
  assert.equal(JSON.stringify(layout),original);assert.equal(composed.length,layout.placed);
  assert.deepEqual(clean(sortVisualsByGroundY(composed).map(f=>[f.id,f.worldX,f.worldY,f.footprintRadius])),
    clean(sortVisualsByGroundY(layout.flowers).map(f=>[f.id,f.worldX,f.worldY,f.footprintRadius])));
  console.log(`Component preset ${month}/${count}: ${layout.placed} objects, same coordinates/depth, radius 12.`);
}
const dir=new URL('../src/components/garden/flower-density-sandbox/tulip-components/',import.meta.url);
for(const name of ['tulipComposition.ts','TulipComponentLayer.tsx']) {
  const source=fs.readFileSync(new URL(name,dir),'utf8');
  for(const forbidden of ['Math.random(', 'ColorMatrix', 'hueRotate', 'setInterval(', 'setTimeout('])assert.ok(!source.includes(forbidden));
}
const jsx=(type,props)=>({type,props});
const releaseLoad=loadPlantingModules(undefined,{memo:fn=>fn},undefined,true,{
  'react/jsx-runtime':{jsx,jsxs:jsx},'@shopify/react-native-skia':{},
});
assert.equal(releaseLoad('../flower-density-sandbox/tulip-components/TulipComponentLayer').TulipComponentLayer({flowers:[]}),null);
console.log(`Tulip V2: ${assertions} deterministic identities + explicit densities; 28 asset hashes; color counts ${JSON.stringify(counts)}. Release rendering disabled.`);
