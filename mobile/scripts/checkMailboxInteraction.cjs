// node scripts/checkTreehouseEntry.cjs (or GARDEN_MOBILE_ROOT=/path/to/mobile node this-file)
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const localMobile = path.resolve(__dirname, '..');
const mobileRoot = process.env.GARDEN_MOBILE_ROOT ||
  (fs.existsSync(path.join(localMobile, 'src/components/garden/fairy/FairyNavigation.ts'))
    ? localMobile : 'C:/Users/cjysu/Documents/Petalpal/mobile');
const ts = require(require.resolve('typescript', { paths: [mobileRoot] }));
const cache = {};

function load(file) {
  file = path.resolve(file);
  if (file.endsWith('.png')) return file;
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
  if (cache[file]) return cache[file].exports;
  const module = { exports: {} };
  cache[file] = module;
  const requireLocal = request => request.startsWith('@/assets/') ? request
    : load(path.resolve(path.dirname(file), request + (path.extname(request) ? '' : '.ts')));
  new Function('require', 'exports', 'module', ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText)(requireLocal, module.exports, module);
  return module.exports;
}

const root=path.resolve(mobileRoot,'src/components/garden');
const {FairyNavigation:N,WALK_SPEED}=load(root+'/fairy/FairyNavigation.ts');
const {isGardenGroundBlocked:blocked}=load(root+'/fairy/gardenGround.ts');
const {safeGroundSegment}=load(root+'/fairy/groundNavigation.ts');
const {walkVisualHeight}=load(root+'/fairy/fairyMetrics.ts');
const {distance,WALK_START}=load(root+'/fairy/walkNetwork.ts');
const {mailboxApproachAnchor:approach,mailboxInteractionAnchor:interaction,
  mailboxPresentAnchor:present,mailboxExitAnchor:exit,hitsMailbox,MAILBOX_TIMING:T}
  =load(root+'/fairy/mailboxDestination.ts');
const {TREEHOUSE_MAP_X:x,TREEHOUSE_MAP_Y:y,TREEHOUSE_MAP_SCALE:scale}=load(root+'/treehouseMapPlacement.ts');
const near=present,epsilon=1e-6;
const source=(sx,sy)=>({x:x+sx*scale,y:y+sy*scale});
for(const [name,p]of Object.entries({approach,interaction,present,exit,near}))
  assert.equal(blocked(p),false,name+' is valid dry ground');
assert.ok(safeGroundSegment(approach,interaction,blocked),'alignment stays on ground');
assert.ok(safeGroundSegment(interaction,present,blocked),'step away stays on ground');
for(const p of [source(988,730),source(988,790),source(1000,865)])assert.equal(hitsMailbox(p),true);
for(const p of [source(874,780),source(710,365),WALK_START,source(1120,800)])assert.equal(hitsMailbox(p),false);
assert.equal(hitsMailbox({x:400+988*.4,y:100+802*.4},{x:400,y:100,scale:.4}),true);
const phases=['aligningToMailbox','retrievingMail','turningWithMail','presentingMail','mailboxTransition'];
let completed=0,checkedFrames=0;
function lock(n){
 const before={state:n.state,position:{...n.position},elapsed:n.mailboxElapsedMs,count:n.mailboxOpenedCount};
 assert.equal(n.move(WALK_START,blocked),false,'ordinary destination is locked during sequence');
 assert.equal(n.visitMailbox(blocked),false,'repeat mailbox tap cannot restart sequence');
 assert.equal(n.visitTreehouse(blocked),false,'treehouse cannot steal sequence');
 assert.equal(n.move(WALK_START,blocked,true),false,'swing cannot steal sequence');
 assert.equal(n.move(WALK_START,blocked,false,walkVisualHeight(),true),false,'moon cannot steal sequence');
 assert.equal(n.move(WALK_START,blocked,false,walkVisualHeight(),false,true),false,'tea cannot steal sequence');
 n.stop();n.update(0,blocked);
 assert.deepEqual({state:n.state,position:n.position,elapsed:n.mailboxElapsedMs,count:n.mailboxOpenedCount},before);
}
function arrive(start,mode,dt){
 const n=new N(start);assert.equal(n.returnFromMailbox(),false);
 assert.ok(n.visitMailbox(blocked,walkVisualHeight()));
 assert.equal(n.decision.mode,mode,'mailbox uses normal four-height selection');
 assert.equal(n.state,mode==='WALK'?'movingToMailbox':'flyingToMailbox');
 assert.deepEqual(n.position,start,'tap never teleports');
 assert.deepEqual(n.target,approach);
 let frames=0;
 while(!n.mailboxSequenceActive&&frames++<5000){
   const previous={...n.position};n.update(dt,blocked);
   assert.ok(distance(previous,n.position)<=dt*.6+epsilon,'continuous travel');
   assert.equal(n.mailboxOpenedCount,0,'travel cannot fire mailbox handoff');
   if(mode==='WALK'){assert.equal(n.lift,0);assert.equal(blocked(n.position),false);}
 }
 assert.ok(frames<5000);assert.equal(n.state,'aligningToMailbox');
 assert.deepEqual(n.position,approach);assert.equal(n.mailboxElapsedMs,0);
 return n;
}
function complete(n,dt){
 const count=n.mailboxOpenedCount,seen=[n.state];
 let frames=0,holdingMs=0;
 while(n.state!=='mailboxTransition'&&frames++<5000){
   const oldState=n.state,oldTime=n.mailboxElapsedMs,old={...n.position};
   lock(n);assert.equal(n.returnFromMailbox(),false,'no early return during action');
   n.update(dt,blocked);checkedFrames++;
   assert.equal(n.lift,0,'sequence stays grounded');
   assert.equal(n.airborne,false);
   assert.ok(distance(old,n.position)<=dt*WALK_SPEED+epsilon,'alignment and step away never teleport');
   assert.equal(blocked(n.position),false,'safe dry sequence destination');
   if(n.state!==oldState)seen.push(n.state);
   if(oldState==='presentingMail'){
     const end=oldTime+dt;
     holdingMs+=Math.max(0,Math.min(end,T.unfoldMs+T.holdMs)-Math.max(oldTime,T.unfoldMs));
     if(end<T.unfoldMs+T.holdMs)assert.equal(n.mailboxOpenedCount,count,'waits for fully open letter hold');
   }
   if(n.state!=='mailboxTransition')assert.equal(n.mailboxOpenedCount,count);
   if(n.state==='retrievingMail')assert.deepEqual(n.position,interaction);
   if(n.state==='presentingMail')assert.deepEqual(n.position,present);
 }
 assert.ok(frames<5000);assert.deepEqual(seen,phases,'all action phases are presented in order');
 assert.ok(holdingMs>=T.holdMs-dt,'full 0.8 second open-letter hold');
 assert.equal(n.mailboxOpenedCount,count+1,'exactly one mailbox callback signal');
 assert.equal(n.target,null);assert.deepEqual(n.position,present);lock(n);
 for(let i=0;i<50;i++)n.update(50,blocked);
 assert.equal(n.mailboxOpenedCount,count+1,'transition idles without emitting again');
 assert.equal(n.treehouseEntryCount,0);assert.equal(n.treehouseExitCount,0);
 completed++;
}
for(const dt of [7,16,33,50])for(const [start,mode]of [[near,'WALK'],[WALK_START,'FLY']]){
 const n=arrive(start,mode,dt);complete(n,dt);
 assert.ok(n.returnFromMailbox());assert.equal(n.state,'idle');assert.deepEqual(n.position,exit);
 assert.equal(n.returnFromMailbox(),false,'return is idempotent');
 assert.ok(n.move(approach,blocked));assert.equal(n.decision.mode,'WALK');
 for(let i=0;i<5000&&n.remaining.length;i++){n.update(dt,blocked);assert.equal(n.lift,0);}
 assert.equal(n.state,'idle');assert.deepEqual(n.position,approach);
 assert.equal(n.mailboxOpenedCount,1);
}
// The hook stays reusable after a future mailbox UI closes.
const repeated=arrive(near,'WALK',16);complete(repeated,16);assert.ok(repeated.returnFromMailbox());
assert.ok(repeated.visitMailbox(blocked));
for(let i=0;i<5000&&!repeated.mailboxSequenceActive;i++)repeated.update(16,blocked);
complete(repeated,16);assert.equal(repeated.mailboxOpenedCount,2);
// Travel is cancellable in both modes, unlike the short retrieve/present action.
for(const start of [near,WALK_START]){
 const n=new N(start);assert.ok(n.visitMailbox(blocked));n.update(50,blocked);
 assert.ok(!n.mailboxSequenceActive);assert.ok(n.move(start,blocked));
 for(let i=0;i<5000&&(n.airborne||n.remaining.length);i++){
   n.update(16,blocked);assert.equal(n.mailboxSequenceActive,false);assert.equal(n.mailboxOpenedCount,0);
 }
 assert.equal(n.state,'idle');assert.deepEqual(n.position,start);n.update(5000,blocked);assert.equal(n.mailboxOpenedCount,0);
}
const stopped=new N(near);assert.ok(stopped.visitMailbox(blocked));stopped.update(20,blocked);stopped.stop();
const stoppedAt={...stopped.position};stopped.update(5000,blocked);
assert.equal(stopped.state,'idle');assert.deepEqual(stopped.position,stoppedAt);assert.equal(stopped.mailboxOpenedCount,0);
// Invalid landing and existing interaction ownership still win.
const rejected=new N();assert.equal(rejected.visitMailbox(()=>true),false);assert.equal(rejected.decision.mode,'INVALID');
assert.deepEqual(rejected.position,WALK_START);
const tree=new N();assert.ok(tree.visitTreehouse(blocked));
for(let i=0;i<5000&&tree.state!=='enteringTreehouse';i++)tree.update(16,blocked);
assert.equal(tree.visitMailbox(blocked),false,'mailbox cannot interrupt treehouse entry');
assert.equal(tree.state,'enteringTreehouse');
// Exact hold boundary; no frame-rate or animation-duration surrogate.
const clock=new N(approach);assert.ok(clock.visitMailbox(blocked));
if(!clock.mailboxSequenceActive)clock.update(1,blocked);
clock.update(distance(approach,interaction)/WALK_SPEED+T.retrieveMs+T.turnMs+T.unfoldMs+T.holdMs-1,blocked);
assert.equal(clock.state,'presentingMail');assert.equal(clock.mailboxOpenedCount,0);
clock.update(2,blocked);assert.equal(clock.state,'mailboxTransition');assert.equal(clock.mailboxOpenedCount,1);
console.log(JSON.stringify({status:'PASS',anchors:{approach,interaction,present,exit},timing:T,
 completed,checkedFrames,checks:['real ground anchors and mailbox hit area','near WALK and far FLY',
 'continuous travel and grounded alignment','ordered retrieve/turn/unfold/hold sequence',
 '800ms hold before exactly-once handoff','locked action and cancellable travel',
 'future UI return and repeat interaction','invalid ground and existing treehouse ownership preserved']},null,2));
