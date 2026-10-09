import { validAttemptId, validateCheckpoints, type Checkpoint } from './engine';
export const ATTEMPT_INDEX_KEY='petalpal_native_security_test_attempts_v2';
export const attemptKey=(id:string)=>{if(!validAttemptId(id))throw Error('Invalid attempt');return `${ATTEMPT_INDEX_KEY}:${id}`};
export interface AttemptIndex { generation:number; id:string; historical:string[]; legacyStatus:'historical-superseded' }
export interface AttemptReport extends AttemptIndex { journal:Checkpoint[] }
export function createAttemptStore(storage:{getItem:(key:string)=>Promise<string|null>;setItem:(key:string,value:string)=>Promise<void>},newId:()=>string) {
  async function index():Promise<AttemptIndex|null>{
    const raw=await storage.getItem(ATTEMPT_INDEX_KEY);if(!raw)return null;
    const v=JSON.parse(raw);
    if(Object.keys(v).sort().join()!=='generation,historical,id,legacyStatus'||v.legacyStatus!=='historical-superseded'||!validAttemptId(v.id)||!Number.isSafeInteger(v.generation)||v.generation<1||
      !Array.isArray(v.historical)||v.historical.length!==v.generation-1||v.historical.some((id:unknown)=>!validAttemptId(id)||id===v.id)||new Set(v.historical).size!==v.historical.length)throw Error('Invalid attempt index');
    return v;
  }
  async function report():Promise<AttemptReport|null>{
    const current=await index();if(!current)return null;
    const journal=validateCheckpoints(JSON.parse(await storage.getItem(attemptKey(current.id))||'[]'));
    if(journal.some(c=>c.attemptId!==current.id||c.scenario!==1))throw Error('Stale attempt report rejected');
    if((await index())?.id!==current.id)throw Error('Attempt selection changed during read');
    return {...current,journal};
  }
  async function allocate(){
    const prior=await report();
    if(prior&&!['PASS','FAIL','BLOCKED'].includes(prior.journal.at(-1)?.code||''))throw Error('An attempt is already prepared or active');
    const id=newId();if(!validAttemptId(id)||id===prior?.id||prior?.historical.includes(id)||await storage.getItem(attemptKey(id)))throw Error('Attempt identity reused');
    const current:AttemptIndex={id,generation:(prior?.generation||0)+1,historical:prior?[...prior.historical,prior.id]:[],legacyStatus:'historical-superseded'};
    await storage.setItem(ATTEMPT_INDEX_KEY,JSON.stringify(current));
    if((await index())?.id!==id)throw Error('Attempt selection was not persisted');
    return current;
  }
  async function write(id:string,value:string){
    if((await index())?.id!==id)throw Error('Superseded attempt write rejected');
    const journal=validateCheckpoints(JSON.parse(value));if(!journal.length||journal.some(c=>c.attemptId!==id))throw Error('Attempt identity mismatch');
    const before=JSON.parse(await storage.getItem(attemptKey(id))||'[]');
    if(journal.length!==before.length+1||JSON.stringify(journal.slice(0,-1))!==JSON.stringify(before))throw Error('Attempt history overwrite rejected');
    await storage.setItem(attemptKey(id),value);
    if(await storage.getItem(attemptKey(id))!==value)throw Error('Checkpoint persistence not confirmed');
  }
  return {index,report,allocate,write};
}
