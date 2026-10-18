const fs=require('fs'),vm=require('vm'),assert=require('assert');const html=fs.readFileSync(__dirname+'/index.html','utf8'),js=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const nodes={};for(const id of ['original','refined','status','play','prev','next','scrub','speed','bg'])nodes[id]={value:id==='speed'?'1':id==='bg'?'#30323a':'0',style:{}};
let cb;const c=vm.createContext({document:{hidden:false,getElementById:id=>nodes[id],addEventListener(){}},requestAnimationFrame:f=>cb=f});vm.runInContext(js,c);
cb(0);cb(1360);assert.equal(vm.runInContext('time',c),0);nodes.prev.onclick();assert.equal(Number(nodes.scrub.value),23);nodes.next.onclick();assert.equal(Number(nodes.scrub.value),0);nodes.next.onclick();assert.equal(Number(nodes.scrub.value),1);assert(nodes.status.textContent.includes('(1.5)'));
nodes.scrub.value='20';nodes.scrub.oninput();assert(nodes.status.textContent.includes('(14)'));nodes.bg.onchange();assert.equal(nodes.original.style.background,nodes.refined.style.background);
nodes.play.onclick();cb(2720);assert.equal(Number(nodes.scrub.value),20);nodes.play.onclick();const t=vm.runInContext('time',c);cb(3000);assert.equal(vm.runInContext('time',c),t);
console.log('PASS: loop duration, frame stepping/order, scrub, synchronized timeline, pause, background (DOM mock).');
