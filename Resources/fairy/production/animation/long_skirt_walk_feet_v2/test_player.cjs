const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const ids={};for(const id of ['a','b','label','play','prev','next','speed','bg','move'])ids[id]={style:{},value:'1',textContent:''};
let tick;const context={document:{getElementById:id=>ids[id],querySelectorAll:()=>[{classList:{toggle(){}}},{classList:{toggle(){}}}]},requestAnimationFrame:fn=>tick=fn};
vm.createContext(context);vm.runInContext(html.match(/<script>([\s\S]*)<\/script>/)[1],context);
assert.equal(ids.label.textContent,'Frame 1 / 32');ids.next.onclick();assert.equal(ids.label.textContent,'Frame 2 / 32');ids.prev.onclick();assert.equal(ids.label.textContent,'Frame 1 / 32');ids.prev.onclick();assert.equal(ids.label.textContent,'Frame 32 / 32');ids.next.onclick();ids.play.onclick();tick(100);tick(142.5);assert.equal(ids.label.textContent,'Frame 2 / 32');ids.play.onclick();tick(185);assert.equal(ids.label.textContent,'Frame 2 / 32');ids.move.onclick();assert.equal(ids.a.style.left,ids.b.style.left);ids.bg.onclick();
console.log('PASS: player initialization, stepping, wrap, play/pause, 42.5ms timing, matching positions, background toggle (mock DOM; not browser visual QA).');
