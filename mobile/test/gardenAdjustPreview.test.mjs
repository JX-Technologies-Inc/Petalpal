import assert from 'node:assert/strict';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const jsx=(type,props)=>({type,props});let cursor=0,calls=0;const slots=[];
const react={memo:f=>f,useState:init=>[init,()=>{}],useCallback:f=>f,useEffect:()=>{},useMemo(fn,deps){const i=cursor++;const old=slots[i];if(old&&deps.every((d,j)=>d===old.deps[j]))return old.value;return(slots[i]={deps,value:fn()}).value;}};
const state={placements:[],activeMode:'normal',targetFlower:null,previewCoords:null,validationResult:{isValid:true}};
const dependencies={'react/jsx-runtime':{jsx,jsxs:jsx},'@shopify/react-native-skia':{Group:'Group',Image:'Image',Skia:{RuntimeEffect:{Make:()=>null}},Circle:'Circle',useImage:()=>null},'./PlantingContext':{usePlanting:()=>state},'../flower-mood-effects/GardenMoodEffects':{GardenMoodEffectsLayer:'MoodEffects'}};
const load=loadPlantingModules(new Proxy({}, {get(){throw Error('No placement writes in preview test');}}),react,undefined,true,dependencies);
const api=load('productionGrowth'),parents=load('productionGrowthQAData').productionQARecords(30);
dependencies['./productionGrowth']={productionGrowth:p=>{calls++;return api.productionGrowth(p);}};
const {ProductionPlantedFlowers}=load('ProductionPlantedFlowers'),{ProductionGrowthLayer}=load('ProductionGrowthLayer');
function nodes(n){return Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[];}
function render(){cursor=0;return nodes(ProductionPlantedFlowers({depthPass:'behind-tea-set'}));}
state.placements=parents;const saved=JSON.stringify(parents),first=render().find(n=>n.type===ProductionGrowthLayer).props.growth;
assert.equal(first.pieces.length,591);assert.equal(calls,1);
state.activeMode='adjusting';state.targetFlower=parents[0];
for(let i=1;i<=60;i++){
 state.previewCoords={worldX:parents[0].worldX+i/20,worldY:parents[0].worldY+i/20};
 const tree=render();assert.equal(tree.find(n=>n.type===ProductionGrowthLayer).props.growth,first);
 assert.ok(tree.some(n=>n.type==='Circle'&&n.props.cx===state.previewCoords.worldX&&n.props.cy===state.previewCoords.worldY));
}
assert.equal(calls,1,'60 pointer updates never invoke productionGrowth again');
state.activeMode='normal';state.previewCoords=null;assert.equal(render().find(n=>n.type===ProductionGrowthLayer).props.growth,first);assert.equal(calls,1);
assert.equal(JSON.stringify(parents),saved,'Cancel leaves real parent data untouched');
state.placements=parents.map((p,i)=>i===0?{...p,worldX:p.worldX+2,worldY:p.worldY+1}:p);
const confirmed=render().find(n=>n.type===ProductionGrowthLayer).props.growth;
assert.equal(calls,2,'Confirmed placements invalidate once');assert.notEqual(confirmed,first);
assert.equal(JSON.stringify(confirmed),JSON.stringify(api.productionGrowth(state.placements)[0].growth),'Confirm produces the original deterministic engine output exactly');
assert.equal(JSON.stringify(parents),saved);
console.log('Adjust: 60 validated ring previews cause zero growth rebuilds, Cancel reuses the same 591-piece field, Confirm rebuilds once with exact engine output, no stored data changes.');
