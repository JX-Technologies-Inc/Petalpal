// Metadata and pure state transitions only: no rendering, asset generation or timers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript'),cache=new Map();
function load(name){if(cache.has(name))return cache.get(name);const exports={};cache.set(name,exports);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(`../src/components/fairy/${name}.ts`,import.meta.url),'utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:ref=>load(ref.slice(2))});return exports;
}
const api=load('fairyPlayback'),runtime=load('fairyRuntime');
const descriptor={name:'walk',direction:'NE',frameCount:6,fps:12,loop:true,frameWidth:128,frameHeight:192};
assert.equal(api.validFairyAnimationClip(descriptor),true);
assert.equal(api.validFairyAnimationClip({name:'idle',direction:'front',frameCount:1,fps:1,loop:false}),true,'Dimensions optional; legacy direction supported');
for(const patch of [{frameCount:0},{frameCount:1.5},{fps:0},{fps:Infinity},{frameWidth:-1},{frameHeight:NaN},{loop:'yes'},{name:'invented'},{direction:'unknown'}])
  assert.equal(api.validFairyAnimationClip({...descriptor,...patch}),false);
const none=api.createFairyPlayback(null);assert.equal(none.status,'no-clip');assert.equal(none.frameIndex,0);
assert.equal(api.playFairy(none),none);assert.equal(api.pauseFairy(none),none);assert.equal(api.stepFairy(none,1),none);assert.equal(api.advanceFairy(none,1000),none);
assert.equal(api.createFairyPlayback({...descriptor,fps:0}).status,'no-clip');
let state=api.createFairyPlayback(descriptor);assert.equal(state.status,'paused');assert.notEqual(state.clip,descriptor,'Own descriptor copy');
state=api.playFairy(state);assert.equal(state.status,'playing');state=api.advanceFairy(state,250);assert.equal(state.frameIndex,3);
state=api.pauseFairy(state);const held=state;assert.equal(api.advanceFairy(state,999),held);
state=api.advanceFairy(api.playFairy(state),250);assert.equal(state.frameIndex,0);assert.equal(state.status,'playing','Loop wraps');
state=api.stepFairy(state,99);assert.equal(state.frameIndex,5);assert.equal(state.status,'paused');
state=api.stepFairy(state,-99);assert.equal(state.frameIndex,0,'Manual stepping clamps');
assert.equal(api.advanceFairy(state,NaN),state);assert.equal(api.stepFairy(state,Infinity),state);
state=api.advanceFairy(api.playFairy(api.createFairyPlayback({...descriptor,loop:false})),1000);
assert.equal(state.status,'completed');assert.equal(state.frameIndex,5);assert.equal(state.elapsedMs,500);
state=api.playFairy(state);assert.equal(state.frameIndex,0);assert.equal(state.elapsedMs,0,'Play restarts a completed one-shot');
const selected=api.createFairyPlayback({...descriptor,name:'sit',direction:'S'});assert.equal(selected.frameIndex,0);assert.equal(selected.status,'paused','State/direction rebinding resets playback');
for(const direction of runtime.FAIRY_SPRITE_DIRECTIONS)assert.equal(runtime.fairyAssetDirection(direction),direction);
for(const [facing,direction] of Object.entries({front:'S',back:'N',left:'W',right:'E'}))assert.equal(runtime.fairyAssetDirection(facing),direction);
// These numeric handles stand in for registered references only; no images loaded.
const reference={source:0,geometry:{width:1448,height:1086,anchorX:.5,anchorY:1}};
assert.equal(api.fairyClipDescriptor({reference,animations:{}},'idle','front'),null);
const sequence={kind:'sequence',frames:[1,2],width:128,height:192,anchorX:.5,anchorY:1,fps:12,loop:true};
const seqMeta=api.fairyClipDescriptor({reference,animations:{walk:{S:sequence}}},'walk','front');
assert.equal(seqMeta.frameCount,2);assert.equal(seqMeta.frameWidth,128);assert.equal(seqMeta.direction,'front');
assert.equal(api.fairyClipDescriptor({reference,animations:{walk:{S:{...sequence,frames:[]}}}},'walk','front'),null);
const atlas={kind:'atlas',source:3,frames:[{x:0,y:0,width:64,height:96,anchorX:.5,anchorY:1},{x:64,y:0,width:80,height:96,anchorX:.5,anchorY:1}],fps:10,loop:false};
const atlasMeta=api.fairyClipDescriptor({reference,animations:{idle:{N:atlas}}},'idle','N');
assert.equal(atlasMeta.frameCount,2);assert.equal(atlasMeta.frameWidth,undefined,'Variable atlas width remains unspecified');assert.equal(atlasMeta.frameHeight,96);
console.log('Fairy playback metadata/transitions: validation, no-clip no-ops, pause/resume, loop/one-shot, stepping, rebinding, facing aliases and sequence/atlas descriptors passed.');
