import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const base=new URL('../src/components/fairy/',import.meta.url);
const cache=new Map();
function load(url) {
  if(cache.has(url.href))return cache.get(url.href);
  const exports={};cache.set(url.href,exports);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {exports,require:r=>load(new URL(r+'.ts',url))});return exports;
}
const {FairyController}=load(new URL('FairyController.ts',base));
const {fairyGait,smoothTravel}=load(new URL('fairyLocomotion.ts',base));
const playback=load(new URL('fairyPosePlayback.ts',base));
const {FAIRY_POSE_FRAMES:frames,FAIRY_POSE_SCALE:scale}=load(new URL('fairyPoseMetadata.ts',base));
const standing=frames[8];
const api=load(new URL('fairySwingInteraction.ts',base));
const target=api.createSwingTarget({x:653,y:740},1312,1199);
const initial={x:target.approach.x-90,y:target.approach.y+20};
const controller=new FairyController(initial);
assert.equal(controller.snapshot().state,'idle');
assert.equal(controller.request(target),true);
assert.equal(controller.request(target),false,'No concurrent landmark ownership');
const seen=new Set(),phases=new Set();let attached=0,finished=false;
for(let i=0;i<4000;i++) {
  const before=controller.snapshot();controller.tick(10);const s=controller.snapshot();
  seen.add(s.state);phases.add(s.phase);
  assert.ok(Math.hypot(s.x-before.x,s.y-before.y)<=.650001,'No arrival/detach teleport');
  assert.ok(s.seated>=0&&s.seated<=1);
  assert.ok(s.gaitWeight>=0&&s.gaitWeight<=1);
  assert.ok(s.gaitPhase>=before.gaitPhase,'Phase follows distance without resetting at waypoints');
  if(s.state!==before.state||s.attached!==before.attached) {
    assert.equal(s.gaitWeight,0,'Neutral gait at state/attachment handoff');
    assert.ok(Math.hypot(s.x-before.x,s.y-before.y)<.002,'Eased arrival has no last-frame position jump');
  }
  if(s.attached) {
    assert.equal(s.gaitWeight,0);
    assert.ok(s.poseIndex>=8&&s.nextPoseIndex>=8,'Only dedicated back poses occupy the seat');
    assert.equal(s.facing,'N');
  }
  if(s.phase==='swinging_back'||s.phase==='settling_back')assert.equal(s.poseIndex,10);
  if(s.phase==='turn_back'||s.phase==='turn_front')assert.equal(s.attached,false);
  if(s.phase==='none'&&s.state!=='idle'&&s.poseMix===1) {
    const contact=playback.contactOffset(s.poseIndex,target.spriteScale,target.spriteAngle);
    assert.ok(Math.abs(s.drawX+contact.x-s.supportX)<1e-9);
    assert.ok(Math.abs(s.drawY+contact.y-s.supportY)<1e-9);
    if(before.supportX!==null&&playback.walkPose(before.gaitPhase).plant===playback.walkPose(s.gaitPhase).plant) {
      assert.equal(s.supportX,before.supportX,'No stance sliding');assert.equal(s.supportY,before.supportY);
    }
  }
  if(s.attached){attached++;assert.equal(s.currentLandmark,'swing');assert.equal(s.x,target.interaction.x);assert.equal(s.y,target.interaction.y);}
  if(s.phase==='stand_back')assert.equal(s.state,'leaving_landmark');
  if(s.state==='idle'){finished=true;break;}
}
assert.ok(finished&&attached>0);
for(const state of ['idle','walking','approach_landmark','interacting','leaving_landmark'])assert.ok(seen.has(state),state);
for(const phase of ['turn_back','sit_back','swinging_back','settling_back','stand_back','turn_front'])assert.ok(phases.has(phase),phase);
const end=controller.snapshot();assert.equal(end.activeTarget,null);assert.equal(end.currentLandmark,null);assert.equal(end.attached,false);
assert.equal(end.x,target.exit.x);assert.equal(end.y,target.exit.y);assert.equal(end.seated,0);
assert.equal(end.gaitWeight,0);assert.equal(end.poseIndex,0);assert.equal(end.facing,'SE');
assert.equal(controller.request(target),true,'Repeat visits supported');
const frozen=JSON.stringify(controller.snapshot());controller.tick(0);assert.equal(JSON.stringify(controller.snapshot()),frozen);
const detached=controller.snapshot();detached.activeTarget.interaction.x=0;assert.notEqual(controller.snapshot().activeTarget.interaction.x,0,'Snapshots cannot mutate runtime');
assert.throws(()=>controller.tick(NaN));assert.throws(()=>new FairyController({x:NaN,y:0}));

// Independent map transform calculation. The seated hips and walking root
// use the same approved landmark transform (translation, scale, center rotation).
const placement=load(new URL('../garden/swingMapPlacement.ts',base));
const a=placement.SWING_MAP_ROTATION*Math.PI/180,s=placement.SWING_MAP_SCALE;
const q={x:653+(standing.root[0]-standing.hips[0])*scale/s,y:740+(standing.root[1]-standing.hips[1])*scale/s};
const dx=(q.x-656)*s,dy=(q.y-599.5)*s;
assert.ok(Math.abs(target.interaction.x-(placement.SWING_MAP_X+656*s+dx*Math.cos(a)-dy*Math.sin(a)))<1e-9);
assert.ok(Math.abs(target.interaction.y-(placement.SWING_MAP_Y+599.5*s+dx*Math.sin(a)+dy*Math.cos(a)))<1e-9);
// Entire character registration, not just root: feet, hips, face and canvas
// corners coincide when switching from the world parent to the resting seat.
for(const point of [{x:0,y:0},{x:1254,y:1254},{x:655,y:676},{x:674,y:1178},{x:675,y:180}]) {
  const lx=(point.x-standing.root[0])*scale,ly=(point.y-standing.root[1])*scale;
  const world={x:target.interaction.x+lx*Math.cos(a)-ly*Math.sin(a),y:target.interaction.y+lx*Math.sin(a)+ly*Math.cos(a)};
  const seat=api.swingLocalToWorld({x:653+(point.x-standing.hips[0])*scale/s,y:740+(point.y-standing.hips[1])*scale/s},1312,1199);
  assert.ok(Math.hypot(world.x-seat.x,world.y-seat.y)<1e-9,'Full-canvas seat registration unchanged');
}
assert.equal(smoothTravel(0),0);assert.equal(smoothTravel(1),1);
assert.ok(smoothTravel(.001)<1e-7);assert.ok(1-smoothTravel(.999)<1e-7);
for(let p=0;p<20;p+=.031) {
  const rest=fairyGait(p,0);
  for(const value of Object.values(rest))assert.equal(Math.abs(value),0,'Exact neutral pose when stopped');
  const gait=fairyGait(p,1);
  assert.ok(Math.abs(gait.leg)<=.025);
  assert.ok(gait.kneeLeft>=0&&gait.kneeRight>=0&&gait.kneeLeft*gait.kneeRight===0,'Alternating knee lift');
  assert.ok(Math.abs(gait.bodyY)*api.FAIRY_WORLD_SCALE<.18,'No large body bounce');
  assert.ok(Math.abs(gait.wing)<=.006&&Math.abs(gait.petal)<=.004);
}
const scene=fs.readFileSync(new URL('FairySwingTestScene.tsx',base),'utf8');
assert.ok(scene.includes('fairy={<Group'));
assert.ok(!scene.includes('FairyExtractedLayers'),'Rejected standing-cutout renderer is disconnected');
assert.ok(scene.includes('cancelAnimationFrame(frame)'));
assert.ok(scene.includes("AppState.addEventListener('change'"));
assert.ok(!/localStorage|fetch\(|GardenScene/.test(scene));
const swing=fs.readFileSync(new URL('../garden/SwingEntity.tsx',base),'utf8');
assert.ok(swing.indexOf('&& fairy')>swing.indexOf('<Group origin={{ x: SWING_PIVOT_X'));
assert.ok(swing.indexOf('&& fairy')<swing.lastIndexOf('<RegisteredLayer image={movingFront.image}'));
console.log('Fairy authored poses: back-facing lifecycle, grounded stance, repeat visits, pause, full-canvas attachment parity and rejected-renderer isolation passed.');
