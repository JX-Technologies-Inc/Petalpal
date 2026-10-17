import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const reference=JSON.parse(fs.readFileSync(new URL('../../output/flower-visual-checkpoints/PRODUCTION_GROWTH_V1_1_VISUAL_APPROVED/reference.json',import.meta.url)));
const growth=reference.cases.cold30.growth,jsx=(type,props)=>({type,props});
const image={decoded:'original-image'},images=Object.fromEntries(growth.pieces.map(p=>[`${p.speciesCode}:${p.componentId}`,image]));
assert.equal(Object.keys(images).length,69,'The approved decoded-image request set remains 69');
let cursor=0,recordings=0;const slots=[],pending=[],pictures=[],deferred=[];
const react={memo:f=>f,useCallback:f=>f,
 useState(init){const i=cursor++;if(!slots[i])slots[i]={value:i===0?images:init};return[slots[i].value,v=>slots[i].value=typeof v==='function'?v(slots[i].value):v];},
 useMemo(fn,deps){const i=cursor++;if(!slots[i]||deps.some((d,j)=>d!==slots[i].deps[j]))slots[i]={deps,value:fn()};return slots[i].value;},
 useEffect(fn,deps){const i=cursor++;if(!slots[i]||deps.some((d,j)=>d!==slots[i].deps[j])){slots[i]?.cleanup?.();slots[i]={deps};pending.push(()=>slots[i].cleanup=fn());}}
};
function expand(node,types){if(Array.isArray(node))return node.flatMap(n=>expand(n,types));if(!node||typeof node!=='object')return[];
 if(typeof node.type==='function')return expand(node.type(node.props),types);
 return [...(types.includes(node.type)?[node]:[]),...expand(node.props?.children,types)];}
const load=loadPlantingModules(undefined,react,undefined,true,{
 'react/jsx-runtime':{jsx,jsxs:jsx},'@shopify/react-native-skia':{Group:'Group',Image:'Image',Skia:{RuntimeEffect:{Make:()=>null}},Picture:'Picture',useImage:()=>image,
 drawAsPicture:(element,bounds)=>{recordings++;const picture={element,bounds,disposed:0,ref:{deleted:false,isDeleted(){return this.deleted;}},dispose(){this.disposed++;this.ref.deleted=true;}};pictures.push(picture);
 return new Promise(resolve=>deferred.push(()=>resolve(picture)));}},
});
const draw=load('ProductionGrowthLayer').ProductionGrowthLayer;
function render(g,cache=true){cursor=0;const tree=draw({growth:g,cache});while(pending.length)pending.shift()();return tree;}
const first=render(growth),original=expand(first,['Image']);assert.equal(original.length,591);assert.equal(recordings,1);
const recorded=expand(pictures[0].element,['Image']);
assert.deepEqual(recorded,original,'Picture records identical images, order, anchors, dimensions and transforms');
assert.equal(expand(pictures[0].element,['Group']).length,1183,'Each flower retains its approved pose group in the cached picture');
const commands=tree=>expand(tree,['Group','Image']).map(({type,props:{children,...props}})=>({type,props}));
assert.deepEqual(commands(pictures[0].element),commands(first),'Recorded hierarchy keeps every transform and image draw identical');
const bounds=load('ProductionGrowthLayer').flowerPictureBounds(growth.pieces);
assert.deepEqual(pictures[0].bounds,bounds);
assert.ok(bounds.width>0&&bounds.height>0);
const boundary=load('ProductionGrowthLayer').flowerPictureBounds([{...growth.pieces[0],worldX:0,worldY:0}]);
assert.ok(boundary.x<0&&boundary.y<0,'Picture bounds preserve art beyond world/mask edges');assert.ok(recorded.every(n=>n.props.image===image));
deferred.shift()();await Promise.resolve();
const cached=render(growth);assert.equal(expand(cached,['Image']).length,0);assert.equal(expand(cached,['Picture']).length,1);
for(let i=0;i<100;i++)render(growth);assert.equal(recordings,1,'Unrelated rerenders do not rerecord immutable flower commands');
pictures[0].ref.deleted=true;
assert.equal(expand(render(growth),['Picture']).length,0,'A deleted picture is never submitted');
assert.equal(expand(render(growth),['Image']).length,591,'Deleted-picture guard preserves retained drawing');
pictures[0].ref.deleted=false;
const moved={...growth,...Object.fromEntries(['pieces','primary','companions','filler'].map(key=>[key,growth[key].map(p=>({...p,worldX:p.worldX+1}))]))};
render(moved);assert.equal(pictures[0].disposed,0,'Previously submitted picture remains alive for in-flight frames');assert.equal(recordings,2);
render(growth);assert.equal(recordings,3);deferred.shift()();await Promise.resolve();
assert.equal(pictures[1].disposed,1,'Stale asynchronous move recording is discarded');
deferred.shift()();await Promise.resolve();render(growth);
const uncached=render(growth,false);assert.equal(expand(uncached,['Image']).length,591,'Preview fallback keeps original image paint inheritance');
for(const slot of slots)slot?.cleanup?.();assert.equal(pictures[2].disposed,0,'Unmount does not explicitly delete a submitted picture');
const scene=fs.readFileSync(new URL('../src/components/garden/GardenScene.tsx',import.meta.url),'utf8');
const planeNames=[...scene.matchAll(/<GardenCanvasPlane name="([^"]+)"/g)].map(m=>m[1]);
assert.deepEqual(planeNames,['water-motion','terrain','landmark-motion','fairy-walk','botanical-foreground']);
const motion=scene.slice(scene.indexOf('name="landmark-motion"'),scene.indexOf('name="botanical-foreground"'));
assert.ok(!motion.includes('PlantedFlowerLayer'));assert.ok(!motion.includes('<LandLayer'));
const plane=fs.readFileSync(new URL('../src/components/garden/rendering/GardenCanvasPlane.tsx',import.meta.url),'utf8');
assert.ok(plane.includes('style={styles.plane}'));assert.ok(plane.includes('pointerEvents="none"'));
assert.ok(plane.includes('transform={cameraTransform}'));
console.log('Static rendering: exact 591 recorded draw commands, 69 reused decoded assets, one Picture node, no animation rerecord, stale disposal and safe submitted-picture lifetime and ordered independent camera/gesture planes passed.');
