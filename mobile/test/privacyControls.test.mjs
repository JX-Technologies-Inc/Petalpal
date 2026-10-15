import assert from 'node:assert/strict';
import test from 'node:test';
import {hookHarness} from './hookHarness.mjs';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const nodes=t=>Array.isArray(t)?t.flatMap(nodes):t&&typeof t==='object'?[t,...nodes(t.props?.children)]:[];
function fixture(component, handler, auth={session:{user:{id:'owner'}}}){
 const hooks=hookHarness(),calls=[];
 const load=loadPlantingModules(undefined,hooks.react,null,false,{
  'react-native':{View:'View',Text:'Text',Switch:'Switch'},'./FeatureUI':{FeatureActionButton:'Action',ui:{}},
  '../../services/auth':{useAuth:()=>auth},
  '../../services/api':{apiRequest:async(path,method,body)=>{calls.push({path,method,body});return handler(path,method,body);}},
 });
 const [file,name]=component; let tree=hooks.mount(()=>load('../../features/'+file)[name]());
 return {calls,all:()=>nodes(tree),async flush(){tree=await hooks.flush();},async press(title){const b=nodes(tree).find(n=>n.props?.title===title);assert.ok(b,title);assert.ok(!b.props.disabled,title);await b.props.onPress();tree=await hooks.flush();}};
}
const off={aiProcessing:false,personalization:false,memoryEnabled:false};
const disclosure={version:'ai-2026-10-15',explanation:'Synthetic disclosure',retention:'No retention guarantee',features:[]};
test('AI choices start off, require an explicit save and include the disclosed version',async()=>{
 const f=fixture(['AiPrivacySettings','AiPrivacySettings'],async(path,method,body)=>method==='PUT'?body:path==='/ai/disclosure'?disclosure:off);
 await f.flush();assert.equal(f.calls.filter(c=>c.method==='PUT').length,0);
 const switches=f.all().filter(n=>n.type==='Switch');assert.ok(switches.every(n=>n.props.value===false));
 switches[0].props.onValueChange(true);await f.flush();assert.equal(f.calls.length,2);
 await f.press('Save my AI choices');assert.deepEqual(JSON.parse(JSON.stringify(f.calls.at(-1).body)),{...off,aiProcessing:true,disclosureVersion:disclosure.version});
 await f.press('Withdraw all AI consent');assert.deepEqual(JSON.parse(JSON.stringify(f.calls.at(-1).body)),{...off,disclosureVersion:disclosure.version});
});
test('disclosure failure prevents a grant but never prevents withdrawal',async()=>{
 const f=fixture(['AiPrivacySettings','AiPrivacySettings'],async(path,method,body)=>{if(method==='PUT')return body;if(path==='/ai/disclosure')throw Error('Temporarily unavailable');return off;});
 await f.flush();assert.equal(f.all().find(n=>n.props?.title==='Save my AI choices').props.disabled,true);
 await f.press('Withdraw all AI consent');assert.deepEqual(JSON.parse(JSON.stringify(f.calls.at(-1).body)),off);
});
test('community acceptance is an explicit versioned request with recoverable error',async()=>{
 let fail=true;const f=fixture(['CommunityGuidelines','CommunityGuidelines'],async(_path,method,body)=>{if(method!=='PUT')return {accepted:false};if(fail)throw Error('Offline');return body;});
 await f.flush();assert.equal(f.calls.length,1);await f.press('I accept the Community Guidelines');
 assert.ok(f.all().some(n=>n.props?.children==='Offline'));fail=false;await f.press('I accept the Community Guidelines');
 assert.equal(f.calls.at(-1).body.accepted,true);assert.equal(f.calls.at(-1).body.version,'petalpal-community-2026-10-15');
 assert.ok(f.all().some(n=>n.props?.children==='Accepted'));
});
test('account deletion requires confirmation; cancellation and retry are operable',async()=>{
 let count=0;const f=fixture(['DeleteAccountSettings','DeleteAccountSettings'],async()=>{}, {deleteAccount:async()=>{count++;throw Error('Sign in again');}});
 assert.equal(count,0);await f.press('Delete Account');await f.press('Cancel deletion');assert.equal(count,0);
 assert.ok(!f.all().some(n=>n.props?.title==='Permanently delete my account'));
 await f.press('Delete Account');await f.press('Permanently delete my account');assert.equal(count,1);
 assert.ok(f.all().some(n=>n.props?.children==='Sign in again'));await f.press('Permanently delete my account');assert.equal(count,2);
});
