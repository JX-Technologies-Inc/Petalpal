import assert from 'node:assert/strict';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const plain=x=>JSON.parse(JSON.stringify(x)),items=new Map(),writes=[];
const storage={getItem:k=>items.get(k)??null,setItem:(k,v)=>{writes.push(k);items.set(k,v);}};
const states=[],effects=[];let hook=0;
const react={createContext:()=>({Provider:'Provider'}),useState:initial=>{
  const i=hook++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;
  return [states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v;}];
},useRef:initial=>({current:initial}),useCallback:fn=>fn,useMemo:fn=>fn(),
  useEffect:fn=>{if(!effects.length)effects.push(fn);},useContext:()=>null};
const load=loadPlantingModules(storage,react,undefined,true,{
  '@shopify/react-native-skia':{Group:'Group',Circle:'Circle'},
  './ProductionGrowthLayer':{ProductionGrowthLayer:'ProductionGrowthLayer'},
});
const context=load('PlantingContext'),api=load('productionGrowth'),preview=load('ProductionPlantedFlowers').growthPreviewParents;
function render(){hook=0;const root=context.PlantingProvider({children:null});return root.type(root.props).props.value;}
let flow=render();effects[0]();await new Promise(r=>setImmediate(r));flow=render();
assert.equal(writes.length,0);assert.equal(flow.placements.length,0);
const masks=load('approvedPlantingMasks'),points=load('../flower-density-sandbox/monthly-growth/growthCoverage').growthMask(6).points;
const point=points.find(p=>masks.isFootprintInApprovedMonthMaskWorld(6,p.x,p.y,22)&&
  masks.isFootprintInApprovedMonthMaskWorld(6,p.x+1,p.y+1,22));
assert.ok(point,'Real approved mask can contain unchanged production radius');
flow.startPlanting({flowerId:'unresolved-flow',month:6,flowerName:'Lotus',speciesCode:'LOTUS'});
flow=render();flow.updatePreview(point.x,point.y);flow=render();
assert.equal(flow.validationResult.reason,'COLLISION_CLASS_UNRESOLVED');
assert.equal(await flow.confirmPlacement(),false);assert.equal(writes.length,0);
flow.cancelPlacement();flow=render();
flow.startPlanting({flowerId:'real-flow',journalEntryId:'real-journal',month:6,flowerName:'pink',
  speciesCode:'CHAMOMILE',plantedDate:'2026-06-01T12:00:00Z',scale:.9,rotation:12});
flow=render();flow.updatePreview(point.x,point.y);flow=render();
assert.ok(flow.validationResult.isValid);assert.equal(writes.length,0);
assert.equal(await flow.confirmPlacement(),true);flow=render();
const original=plain(flow.placements[0]),before=plain(api.productionGrowth(flow.placements)[0].growth.pieces);
assert.equal(original.journalEntryId,'real-journal');assert.equal(original.flowerId,'real-flow');
assert.ok(before.length);assert.ok(!('growthOriginV11' in original));
const picked=api.hitProductionFlower(flow.placements,point.x,point.y);
assert.equal(picked.id,original.id);flow.openFlowerDetail(picked);flow=render();
assert.equal(flow.selectedFlower.flowerId,'real-flow');assert.equal(flow.selectedFlower.journalEntryId,'real-journal');
flow.startAdjusting(flow.placements[0]);flow=render();flow.updatePreview(point.x+1,point.y+1);flow=render();
const previewParents=preview(flow.placements,flow.targetFlower,flow.previewCoords,true);
const previewPieces=plain(api.productionGrowth(previewParents)[0].growth.pieces);
for(const piece of before.filter(p=>p.kind==='primary')){
  const moved=previewPieces.find(p=>p.id===piece.id);
  assert.ok(Math.abs(moved.worldX-piece.worldX-1)<1e-9);
  assert.ok(Math.abs(moved.worldY-piece.worldY-1)<1e-9);
}
const saved=items.get('petalpal_flower_placements_v1'),writeCount=writes.length;
flow.cancelPlacement();flow=render();
assert.equal(writes.length,writeCount);assert.equal(items.get('petalpal_flower_placements_v1'),saved);
assert.deepEqual(plain(flow.placements[0]),original);
assert.deepEqual(plain(api.productionGrowth(flow.placements)[0].growth.pieces),before);
flow.startAdjusting(flow.placements[0]);flow=render();flow.updatePreview(0,0);flow=render();
assert.equal(await flow.confirmPlacement(),false);assert.equal(writes.length,writeCount);
flow.updatePreview(point.x+1,point.y+1);flow=render();assert.equal(await flow.confirmPlacement(),true);flow=render();
const after=plain(flow.placements[0]);
assert.deepEqual({...after,worldX:original.worldX,worldY:original.worldY},original,'Only confirmed coordinates changed');
assert.deepEqual(plain(api.productionGrowth(flow.placements)[0].growth.pieces),previewPieces);
const restarted=loadPlantingModules(storage),restored=await restarted('plantingPersistence').loadFlowerPlacements();
assert.deepEqual(plain(restored),[after]);
assert.deepEqual(plain(restarted('productionGrowth').productionGrowth(restored)[0].growth.pieces),previewPieces);
assert.ok(writes.every(k=>k==='petalpal_flower_placements_v1'));
assert.equal(JSON.parse(items.get('petalpal_flower_placements_v1')).length,1,'Only one parent is persisted');
console.log('Real provider + validator + in-memory persistence: Plant/Confirm/reload/detail/Adjust preview/Cancel/invalid rejection/Confirm/reload passed; no rendering metadata or child writes.');
