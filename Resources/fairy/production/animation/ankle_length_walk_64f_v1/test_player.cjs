const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const ids=['play','prev','next','speed','bg','ground','seek','label','oldLabel','newLabel','stageA','stageB','gridA','gridB','original','candidate','closeA','closeB','detailA','detailB','contacts','contactA','passingA','contactB','passingB','critical4','critical12','seam','travel','traveler'];
const e=Object.fromEntries(ids.map(id=>[id,{value:id==='speed'?'1':id==='bg'?'light':'0',style:{},src:'',className:'',textContent:''}]));let tick;
const ctx={document:{hidden:false,getElementById:id=>e[id],addEventListener(){}},requestAnimationFrame:fn=>tick=fn};vm.createContext(ctx);vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
assert.equal(e.label.textContent,'1 / 64');const first=e.original.src;e.next.onclick();assert.equal(e.label.textContent,'2 / 64');assert.equal(e.original.src,first);e.prev.onclick();e.prev.onclick();assert.equal(e.label.textContent,'64 / 64');e.next.onclick();
e.play.onclick();tick(0);tick(21.25);assert.equal(e.label.textContent,'2 / 64');assert.equal(e.gridB.style.backgroundPositionX,'-1.125px');tick(42.5);assert.equal(e.label.textContent,'3 / 64');assert.notEqual(e.original.src,first);tick(1360);assert.equal(e.label.textContent,'1 / 64');assert.equal(e.gridB.style.backgroundPositionX,'-72px');
e.speed.value='2';e.speed.onchange();tick(1400);tick(1410.625);assert.equal(e.label.textContent,'2 / 64');e.play.onclick();tick(1500);assert.equal(e.label.textContent,'2 / 64');
e.seek.value='32';e.seek.oninput();assert.equal(e.label.textContent,'33 / 64');
for(const [id,label] of Object.entries({contactA:1,passingA:19,contactB:33,passingB:51,critical4:13,critical12:45,seam:61})){e[id].onclick();assert.equal(e.label.textContent,label+' / 64');}
e.bg.value='dark';e.bg.onchange();assert.equal(e.stageA.className,'stage dark');assert.equal(e.closeB.className,'close dark');e.ground.onclick();assert.equal(e.gridB.style.display,'none');e.ground.onclick();assert.equal(e.gridB.style.display,'block');
assert.equal(e.detailA.src,e.original.src);assert.equal(e.detailB.src,e.candidate.src);assert.equal(e.traveler.src,e.candidate.src);
ctx.document.hidden=true;e.play.onclick();tick(9000);tick(10000);assert.equal(e.label.textContent,'61 / 64');
console.log('PASS: self-contained 32/64 synchronization; 21.25ms samples; 1360ms wrap; root travel; controls, backgrounds, stepping, scrub and visibility pause. Mock DOM only.');
