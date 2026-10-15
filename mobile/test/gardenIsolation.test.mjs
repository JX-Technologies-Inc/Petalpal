import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
for(const [command,file] of [['python','auditGardenIsolation.py'],['node','profileWaterfallTimer.mjs']]){
 const r=spawnSync(command,[fileURLToPath(new URL('../scripts/'+file,import.meta.url))],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
}
const read=name=>JSON.parse(fs.readFileSync(new URL('../../output/garden-runtime-performance/'+name,import.meta.url),'utf8'));
const matrix=read('isolation-static-matrix.json');assert.equal(matrix.matrix.length,16);
for(const row of matrix.matrix){assert.equal(row.liveFps,null);assert.equal(row.reactRenders,null);assert.equal(row.skiaRedraws,null);if(row.flowerProxy)assert.equal(row.flowerProxy.pieces,591);}
const waterfall=read('waterfall-virtual-timer.json').rows;
assert.equal(waterfall[0].timerCallbacks,0);assert.equal(waterfall[1].timerCallbacks,Math.floor(30000/33));
for(const row of waterfall){assert.equal(row.uniqueImageRequests,41);assert.equal(row.finalHostDescriptors.Image,9);}
assert.equal(waterfall[1].functionCalls,waterfall[1].stateUpdates+1);
const panel=fs.readFileSync(new URL('../src/components/garden/performance/GardenRuntimePanel.tsx',import.meta.url),'utf8');
for(const label of ['FULL','NO FLOWERS','NO WATER','NO WATERFALL','NO FISH/LOTUS','NO LANDMARK ANIMATION','STATIC MAP ONLY'])assert.ok(panel.includes(label));
assert.ok(panel.includes('DebugUI:false'));assert.ok(panel.includes('recording||!canChangeFixture'));
console.log('Isolation: 16 honest measurement/bound configurations, deterministic waterfall 30-second timer probe, unchanged image/node counts and readonly one-click panel controls passed.');
