import {validateCheckpoints,type Checkpoint} from './engine';
import {type AttemptReport} from './attempts';
export const CONTINUATION_ACCESS_KEY='petalpal_native_security_test_continuation_access_v1';
export const continuationKey=(id:string)=>`petalpal_native_security_test_continuation_v1:${id}`;
export const reloadRecoveryKey=(id:string)=>`${continuationKey(id)}:reload-recovery-v1`;
export function verifiedSource(value:AttemptReport|null){
  if(!value||value.generation!==1)throw Error('Verified generation 1 required');
  const journal=validateCheckpoints(value.journal);
  if(journal.length!==7||journal.some(c=>c.attemptId!==value.id||c.scenario!==1)||journal.at(-1)?.code!=='PASS')throw Error('Persisted Scenario-1 PASS required');
  return value;
}
export function createContinuationStore(storage:{getItem:(key:string)=>Promise<string|null>;setItem:(key:string,value:string)=>Promise<void>},source:()=>Promise<AttemptReport|null>){
  async function selectedKey(id:string){return await storage.getItem(reloadRecoveryKey(id))?reloadRecoveryKey(id):continuationKey(id)}
  function recoveryPrefix(raw:string|null){
    if(!raw)throw Error('Original blocked reload required');const value=JSON.parse(raw),journal=validateCheckpoints(value.journal);
    if(value.active!==true||journal.at(-1)?.scenario!==5||journal.at(-1)?.code!=='BLOCKED'||journal.at(-2)?.phase!=='reload-requested'||
      [2,3,4].some(n=>!journal.some(c=>c.scenario===n&&c.code==='PASS')))throw Error('Only witnessed blocked reload can recover');
    return journal.filter(c=>c.scenario<5);
  }
  async function read(){
    const original=verifiedSource(await source()),key=await selectedKey(original.id),raw=await storage.getItem(key);
    if(!raw)return null;
    const value=JSON.parse(raw);
    if(Object.keys(value).sort().join()!=='active,journal,sourceAttemptId'||value.sourceAttemptId!==original.id||typeof value.active!=='boolean')throw Error('Invalid continuation record');
    const journal=validateCheckpoints(value.journal);
    if(JSON.stringify(journal.slice(0,7))!==JSON.stringify(original.journal)||journal.some(c=>c.attemptId!==original.id))throw Error('Continuation source mismatch');
    if(key===reloadRecoveryKey(original.id)){
      const prefix=recoveryPrefix(await storage.getItem(continuationKey(original.id)));
      if(JSON.stringify(journal.slice(0,prefix.length))!==JSON.stringify(prefix))throw Error('Recovery changed completed scenarios');
    }
    return {sourceAttemptId:original.id,active:value.active as boolean,journal};
  }
  async function persist(value:{sourceAttemptId:string;active:boolean;journal:Checkpoint[]}){
    const key=await selectedKey(value.sourceAttemptId),encoded=JSON.stringify(value);await storage.setItem(key,encoded);
    if(await storage.getItem(key)!==encoded)throw Error('Continuation persistence failed');
  }
  async function prepare(){
    const existing=await read();if(existing)throw Error('Continuation already exists');
    const original=verifiedSource(await source());await persist({sourceAttemptId:original.id,active:false,journal:original.journal});return read();
  }
  async function prepareReloadRecovery(){
    const original=verifiedSource(await source());if(await storage.getItem(reloadRecoveryKey(original.id)))throw Error('Reload recovery already exists');
    await read();const journal=recoveryPrefix(await storage.getItem(continuationKey(original.id)));
    const encoded=JSON.stringify({sourceAttemptId:original.id,active:false,journal}),key=reloadRecoveryKey(original.id);
    await storage.setItem(key,encoded);if(await storage.getItem(key)!==encoded)throw Error('Recovery persistence failed');return read();
  }
  async function activate(){const value=await read();if(!value||value.active||!(value.journal.length===7||(await selectedKey(value.sourceAttemptId)===reloadRecoveryKey(value.sourceAttemptId)&&value.journal.at(-1)?.scenario===4&&value.journal.at(-1)?.code==='PASS')))throw Error('Fresh authorized continuation required');await persist({...value,active:true})}
  async function write(encoded:string){
    const prior=await read();if(!prior?.active)throw Error('Continuation is not activated');const journal=validateCheckpoints(JSON.parse(encoded));
    if(journal.length!==prior.journal.length+1||JSON.stringify(journal.slice(0,-1))!==JSON.stringify(prior.journal)||journal.some(c=>c.attemptId!==prior.sourceAttemptId))throw Error('Continuation history replacement rejected');
    await persist({...prior,journal});
  }
  return {read,prepare,prepareReloadRecovery,activate,write};
}
