const fs=require('fs'),path=require('path');
const ts=require('typescript');
const cache={};
function load(file){
  file=path.resolve(file);
  if(file.endsWith('.png'))return file;
  if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file,'utf8'));
  if(cache[file])return cache[file].exports;
  const module={exports:{}};cache[file]=module;
  const requireLocal=q=>q.startsWith('@/assets/')?q:load(path.resolve(path.dirname(file),q+(path.extname(q)?'':'.ts')));
  new Function('require','exports','module',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(requireLocal,module.exports,module);
  return module.exports;
}


const assert=require('assert/strict');
const root=path.resolve(__dirname,'../src/components/garden');
const g=load(root+'/fairy/gardenGround.ts'),r=load(root+'/fairy/groundNavigation.ts');
const {FairyNavigation:N}=load(root+'/fairy/FairyNavigation.ts');
const w=load(root+'/fairy/walkNetwork.ts'),plant=load(root+'/planting/approvedPlantingMasks.ts');
const {TEA_EXIT}=load(root+'/fairy/teaDestination.ts'),{MOON_EXIT}=load(root+'/fairy/moonDestination.ts'),{SWING_EXIT}=load(root+'/fairy/swingDestination.ts');
const blocked=g.isGardenGroundBlocked;
const fixtures={path:{x:1200,y:982},grass:{x:1428.4,y:1231.9},pavilion:{x:1188,y:710},tea:TEA_EXIT,
 swing:{x:880,y:1240},moon:{x:1960,y:1100},bridge:{x:1700,y:555},dryRock:{x:150,y:150},
 water:{x:1600,y:1200},plantable:plant.getApprovedMonthCentroid(2)};
for(const [kind,p]of Object.entries(fixtures))assert.equal(g.gardenGroundKind(p),kind==='water'?'water':kind==='plantable'?'plantable':'ground',kind);
for(const p of [{x:208,y:778},{x:383,y:927.6},{x:1111.8,y:1291.7},{x:1477,y:88.7},{x:1650,y:950},{x:1720,y:1380}])assert.equal(blocked(p),false);
for(let month=1;month<=12;month++)assert.equal(blocked(plant.getApprovedMonthCentroid(month)),true,`bed ${month}`);
function arrive(n){for(let i=0;i<5000&&(n.airborne||n.remaining.length);i++)n.update(16,blocked);assert.ok(!n.airborne&&!n.remaining.length,'arrival completes');assert.ok(!blocked(n.position),'no invalid landing');}
// These are exact off-road positions, never projected back to centerlines.
for(const target of [fixtures.grass,fixtures.pavilion,{x:1000,y:600}]){
 const n=new N();assert.ok(n.move(target,blocked));assert.equal(n.state,'walking');
 for(let i=0;i<5000&&n.remaining.length;i++){n.update(16,blocked);assert.equal(n.lift,0);assert.ok(!blocked(n.position));}
 assert.deepEqual(n.position,target);assert.equal(n.state,'idle');assert.equal(w.nearest(target),null,'test is off old roads');
 n.update(5000,blocked);assert.deepEqual(n.position,target);
}
// A flower bed between two dry points must be routed around, not crossed.
const around=r.groundRoute({x:880,y:680},{x:1060,y:680},blocked);assert.ok(around&&around.length>2);
for(let i=1;i<around.length;i++)assert.ok(r.safeGroundSegment(around[i-1],around[i],blocked));
for(const target of [fixtures.water,fixtures.plantable]){
 const n=new N(),before={...n.position};assert.equal(n.move(target,blocked),false);assert.equal(n.decision.mode,'INVALID');assert.deepEqual(n.position,before);
}
const flyer=new N();assert.ok(flyer.move(fixtures.tea,blocked));assert.equal(flyer.state,'flying');flyer.update(300,blocked);
const flightState=flyer.state;assert.equal(flyer.move(fixtures.water,blocked),false);assert.equal(flyer.state,flightState);arrive(flyer);assert.deepEqual(flyer.position,fixtures.tea);
// Close retargets while airborne retain lift and perform a controlled landing.
const retarget=new N();assert.ok(retarget.move(fixtures.tea,blocked));retarget.update(100,blocked);const lift=retarget.lift;
assert.ok(retarget.move(fixtures.path,blocked));assert.equal(retarget.state,'flying');assert.equal(retarget.lift,lift);arrive(retarget);
for(const [anchor,swing,moon,tea,state]of [[SWING_EXIT,true,false,false,'sittingOnSwing'],[MOON_EXIT,false,true,false,'sleepingOnMoonBed'],[TEA_EXIT,false,false,true,'seatedAtTea']]){
 const n=new N();assert.ok(n.move(anchor,blocked,swing,123.6,moon,tea));arrive(n);assert.equal(n.state,state);
 const seated={...n.position};assert.equal(n.move(fixtures.water,blocked),false);assert.equal(n.state,state);assert.deepEqual(n.position,seated);
 if(tea){n.update(1200,blocked);assert.equal(n.state,'drinkingTea');}
 assert.ok(n.move(anchor,blocked));arrive(n);assert.deepEqual(n.position,anchor);
}
console.log(JSON.stringify({status:'PASS',fixtures,checks:['10 ground categories','all 12 planting masks','exact off-road standing','grounded walking','routes avoid flower beds','water rejects walking/flight/occupied exit','smooth airborne retarget','tea/swing/moon arrival and exit']},null,2));
