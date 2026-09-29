import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const jsx=(type,props)=>({type,props}),plain=x=>JSON.parse(JSON.stringify(x));
const state={placements:[],activeMode:'normal',targetFlower:null,previewCoords:null};
const react={memo:fn=>fn,useMemo:fn=>fn(),useCallback:fn=>fn,useEffect:()=>{},
  useState:()=>[new Proxy({}, {get:()=> 'decoded-image'}),()=>{}]};
const load=loadPlantingModules(undefined,react,undefined,true,{
  'react/jsx-runtime':{jsx,jsxs:jsx},'@shopify/react-native-skia':{Group:'Group',Image:'Image',Circle:'Circle',useImage:()=> 'decoded-image'},
  './PlantingContext':{usePlanting:()=>state},
});
const api=load('productionGrowth'),render=load('ProductionPlantedFlowers').ProductionPlantedFlowers;
const layer=load('ProductionGrowthLayer').ProductionGrowthLayer;
const monthly=load('../flower-density-sandbox/monthly-growth/monthlyGrowthModel');
const records=[6,10].map(month=>{
  const p=monthly.monthlyGrowthRecords(month,1)[0];
  return {...p,id:`real-${month}`,flowerId:`flower-${month}`,flowerName:p.speciesCode,month,scale:1,rotation:0};
});
state.placements=records;
function nodes(node){return Array.isArray(node)?node.flatMap(nodes):node&&typeof node==='object'?[node,...nodes(node.props?.children)]:[];}
function images(node){if(Array.isArray(node))return node.flatMap(images);if(!node||typeof node!=='object')return [];
  if(typeof node.type==='function')return images(node.type(node.props));
  return [...(node.type==='Image'?[node]:[]),...images(node.props?.children)];}
for(const pass of ['all','behind-tea-set','foreground']){
  const tree=render({depthPass:pass}),scenes=nodes(tree).filter(n=>n.type===layer);
  assert.deepEqual(scenes.map(n=>n.props.growth.records[0].id),pass==='all'?['real-6','real-10']:pass==='behind-tea-set'?['real-6']:['real-10']);
  assert.ok(images(tree).length,'Neutral rendering works with __DEV__ false');
  assert.ok(nodes(tree).every(n=>!n.props?.clip),'Botanical pixels are not clipped to planting mask');
}
const before=JSON.stringify(records);
state.activeMode='adjusting';state.targetFlower=records[0];state.previewCoords={worldX:records[0].worldX+10,worldY:records[0].worldY+5};
const tree=render({depthPass:'behind-tea-set'}),growths=nodes(tree).filter(n=>n.type===layer);
assert.equal(growths.length,1,'Adjust replaces original visual field instead of drawing twice');
assert.equal(growths[0].props.growth.records[0].worldX,state.previewCoords.worldX);
assert.equal(JSON.stringify(records),before);
state.activeMode='planting';state.targetFlower={...records[0],id:'pending',flowerId:'pending'};
const pending=nodes(render({depthPass:'behind-tea-set'})).filter(n=>n.type===layer);
assert.equal(pending.length,2);assert.equal(pending[1].props.growth.companions.length,0);
assert.ok(pending[1].props.growth.pieces.every(p=>p.kind==='primary'));
assert.equal(nodes(render({depthPass:'foreground'})).filter(n=>n.type===layer).length,1);
const single=api.productionGrowth([records[0]])[0].growth,painted=images(layer({growth:single}));
assert.equal(painted.length,single.pieces.length);
assert.ok(painted.every(n=>n.props.image==='decoded-image'&&n.props.width>0&&n.props.height>0&&!n.props.colorFilter));
const coverage=load('../flower-density-sandbox/monthly-growth/growthCoverage');
const catalog=load('../flower-density-sandbox/monthly-growth/growthCatalog');
const primary=single.primary[0],component=catalog.growthCatalog(primary.speciesCode).lookup(primary.componentId);
let opaque;
for(let x=0;!opaque&&x<component.canvasWidth;x+=4)for(let y=0;!opaque&&y<component.canvasHeight;y+=4){
  const dx=(x-component.anchorX*component.canvasWidth)*primary.scale,dy=(y-component.anchorY*component.canvasHeight)*primary.scale;
  const point={x:primary.worldX+dx*Math.cos(primary.rotation)-dy*Math.sin(primary.rotation),
    y:primary.worldY+dx*Math.sin(primary.rotation)+dy*Math.cos(primary.rotation)};
  if(coverage.alphaAt(primary,point.x,point.y)>.15)opaque=point;
}
assert.ok(opaque);assert.equal(api.hitProductionFlower([records[0]],opaque.x,opaque.y),records[0],
  'Clicking actual primary alpha resolves the original parent record');
const wrapper=load('PlantedFlowerLayer');
assert.equal(wrapper.default({useMonthlyGrowth:true}).type,render);
assert.equal(wrapper.default({useMonthlyGrowth:false}).type,wrapper.LegacyPlantedFlowerLayer);
const source=fs.readFileSync(new URL('../src/components/garden/GardenScene.tsx',import.meta.url),'utf8');
assert.ok(source.includes('behindTeaSet={<PlantedFlowerLayer depthPass="behind-tea-set" useMonthlyGrowth={useMonthlyGrowth} />}'));
assert.ok(source.includes("depthPass={showLandmarks ? 'foreground' : 'all'} useMonthlyGrowth={useMonthlyGrowth}"));
console.log('Production render: neutral decoded artwork, release-capable drawing, no mask clip, one draw per depth pass, Land06 slot, Adjust and Plant previews, flag recovery passed.');
