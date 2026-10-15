import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {loadPlantingModules} from '../test/loadPlantingModules.mjs';
const jsx=(type,props)=>({type,props});let cursor=0;const slots=[];
const react={memo:f=>f,useState:init=>[init,()=>{}],useCallback:f=>f,useEffect:()=>{},useMemo(fn,deps){const i=cursor++;const old=slots[i];if(old&&deps.every((d,j)=>d===old.deps[j]))return old.value;return(slots[i]={deps,value:fn()}).value;}};
const state={placements:[],activeMode:'normal',targetFlower:null,previewCoords:null};
const load=loadPlantingModules(new Proxy({}, {get(){throw Error('No storage in architecture CPU probe');}}),react,undefined,true,{
 'react/jsx-runtime':{jsx,jsxs:jsx},'@shopify/react-native-skia':{Group:'Group',Image:'Image',Circle:'Circle',useImage:()=>null},'./PlantingContext':{usePlanting:()=>state}});
const {productionGrowth}=load('productionGrowth'),{productionQARecords}=load('productionGrowthQAData');
const {ProductionPlantedFlowers,growthPreviewParents}=load('ProductionPlantedFlowers');
const parents=productionQARecords(30);state.placements=parents;state.targetFlower=parents[0];
function render(){cursor=0;return ProductionPlantedFlowers({depthPass:'all'});}
const cold=performance.now();const original=productionGrowth(parents)[0].growth;const generationMs=performance.now()-cold;
render();state.activeMode='adjusting';const before=[],after=[];
for(let i=1;i<=6;i++){
 state.previewCoords={worldX:parents[0].worldX+i,worldY:parents[0].worldY+i};
 let t=performance.now();productionGrowth(growthPreviewParents(parents,state.targetFlower,state.previewCoords,true));before.push(performance.now()-t);
 t=performance.now();render();after.push(performance.now()-t);
}
state.activeMode='normal';state.previewCoords=null;let t=performance.now();render();const cancelPreparationMs=performance.now()-t;
const result={scope:'Desktop Node actual generator/ProductionPlantedFlowers functions with memo hooks; no React/GPU/FPS/surface timing. Before explicitly rebuilds six preview positions; after renders the committed cached field plus lightweight rings.',parents:30,pieces:original.pieces.length,generationMs,beforeFullPreviewMs:before,afterLightweightPreviewPreparationMs:after,cancelPreparationMs,
 architecture:{canvasSurfacesBefore:1,canvasSurfacesAfter:4,flowerNodesInWaterSceneGraphAfter:0,flowerImagesBeforeRecording:591,flowerPictureNodesAfterReady:1,extraCopiedFlowerTextures:0},
 surfaceRgbaEstimates:[1,2,3].map(dpr=>({viewport:[390,844],dpr,perSurfaceMiB:390*844*dpr*dpr*4/1048576,threeAdditionalSurfacesMiB:3*390*844*dpr*dpr*4/1048576})),actualGpuMemory:null,actualFps:null};
fs.writeFileSync(new URL('../../output/garden-runtime-performance/static-dynamic-architecture.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
