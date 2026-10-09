export const RELOAD_OBSERVATION_KEY='petalpal_native_security_test_reload_observation_v1';
interface Storage {getItem:(key:string)=>Promise<string|null>;setItem:(key:string,value:string)=>Promise<void>}
export function createReloadObservation(storage:Storage){
  async function read(){
    const raw=await storage.getItem(RELOAD_OBSERVATION_KEY);if(!raw)return null;
    const v=JSON.parse(raw);
    if(!v||typeof v.origin!=='string'||!/^[a-z0-9:-]{1,80}$/.test(v.origin)||
      !['armed','observed'].includes(v.state)||Object.keys(v).sort().join()!==(v.state==='armed'?'origin,state':'count,origin,state')||
      (v.state==='observed'&&(!Number.isSafeInteger(v.count)||v.count<0)))throw Error('Invalid reload observation');
    return v as {origin:string;state:'armed'|'observed';count?:number};
  }
  async function write(value:unknown){const raw=JSON.stringify(value);await storage.setItem(RELOAD_OBSERVATION_KEY,raw);if(await storage.getItem(RELOAD_OBSERVATION_KEY)!==raw)throw Error('Reload observation not persisted')}
  return {
    async arm(runtime:string){if(await read())throw Error('Reload observation already exists');await write({origin:runtime,state:'armed'})},
    async observe(runtime:string,count:number){
      const v=await read();if(!v||v.origin===runtime||v.state==='observed')return;
      // Must complete before any startup erasure. A failed write leaves
      // storage closed; later cleanup cannot bypass this observation.
      await write({...v,state:'observed',count});
    },
    async passed(runtime:string){const v=await read();return !!v&&v.origin!==runtime&&v.state==='observed'&&v.count===0},
  };
}
