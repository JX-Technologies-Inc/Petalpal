import { type Checkpoint } from './engine';
import nacl from 'tweetnacl';

export const SCENARIO_ONE_AUTHORIZATION_KEY = 'petalpal_native_security_test_scenario1_authorization_v1';
export interface ScenarioOneGrant { origin: string; capability: string }
export interface ScenarioOneSource {
  environment: string; firebaseProject: string; database: string; backendOrigin: string; authorizedScenarios: number[];
  credentials: { A: { email: string; password: string; uid: string; owner: string; disposable: boolean } };
  status: Record<'A'|'B'|'C',{firebaseExists:boolean;backendExists:boolean}>;
}
interface Dependencies {
  guard: () => void; apiOrigin: () => string;
  storage: { get: () => Promise<string|null>; set: (value:string) => Promise<void>; remove: () => Promise<void> };
  original: () => Promise<Checkpoint[]>; retry: () => Promise<Checkpoint[]>;
  request: (grant:ScenarioOneGrant, method:string) => Promise<unknown>;
}
function validateGrant(value: unknown): ScenarioOneGrant {
  const grant=value as ScenarioOneGrant;
  if (!grant || Object.keys(grant).sort().join()!=='capability,origin' || typeof grant.origin!=='string' ||
      typeof grant.capability!=='string' || !/^[a-f0-9]{64}$/.test(grant.capability)) throw new Error('Scoped grant rejected');
  const url=new URL(grant.origin);
  if (url.protocol!=='https:' || !/^[a-z0-9-]+\.trycloudflare\.com$/.test(url.hostname) ||
      url.origin!==grant.origin || url.username || url.password) throw new Error('Scoped HTTPS origin rejected');
  return grant;
}
function validateBoundary(value: unknown, apiOrigin: string) {
  const source=value as ScenarioOneSource;
  if (source?.environment!=='native-security-test' || source.firebaseProject!=='petalpal-native-security-test' ||
      source.database!=='petalpal_native_security_test' || source.backendOrigin!==apiOrigin ||
      !Array.isArray(source.authorizedScenarios) || source.authorizedScenarios.length!==1 || source.authorizedScenarios[0]!==1 ||
      ['A','B','C'].some(label=>source.status?.[label as 'A'|'B'|'C']?.firebaseExists!==true ||
        source.status[label as 'A'|'B'|'C'].backendExists!==true)) throw new Error('Scenario-1 isolation rejected');
  return source;
}
function validateSource(value: unknown, apiOrigin: string) {
  const source=validateBoundary(value,apiOrigin), a=source.credentials?.A;
  if (!source.credentials || Object.keys(source.credentials).join()!=='A' || !a || a.disposable!==false ||
      typeof a.email!=='string' || !a.email || typeof a.password!=='string' || a.password.length<12 ||
      typeof a.uid!=='string' || !a.uid || typeof a.owner!=='string' || !a.owner) throw new Error('A-only source rejected');
  return source;
}
export function createScenarioOneAuthorizationClient(d:Dependencies) {
  async function install(value:unknown) {
    d.guard(); const grant=validateGrant(value), original=await d.original(), retry=await d.retry();
    if (!original.length || original.some(c=>c.scenario!==1) || original.at(-1)?.code!=='FAIL' || retry.length) throw new Error('One-rerun boundary rejected');
    validateSource(await d.request(grant,'session'),d.apiOrigin());
    const encoded=JSON.stringify(grant); await d.storage.set(encoded);
    if (await d.storage.get()!==encoded) throw new Error('Secure grant persistence failed');
    return { ready:true, scope:'scenario-1' as const };
  }
  async function initialize() {
    d.guard(); const raw=await d.storage.get(); if (!raw) throw new Error('Scoped authorization required');
    const grant=validateGrant(JSON.parse(raw));
    return { grant, source:validateSource(await d.request(grant,'session'),d.apiOrigin()) };
  }
  async function status(grant:ScenarioOneGrant) {
    d.guard(); return validateBoundary(await d.request(validateGrant(grant),'status'),d.apiOrigin());
  }
  async function revoke() {
    d.guard(); const raw=await d.storage.get();
    try { if (raw) await d.request(validateGrant(JSON.parse(raw)),'revoke'); }
    finally { await d.storage.remove(); }
  }
  return { install, initialize, status, revoke };
}
interface Envelope { publicKey:string;nonce:string;ciphertext:string }
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
function bytes(value:unknown,length?:number){
  if(typeof value!=='string'||!value.length||value.length>1024||!/^([a-f0-9]{2})+$/.test(value)||
      (length!==undefined&&value.length!==length*2))throw new Error('Encrypted handoff rejected');
  return Uint8Array.from(value.match(/../g)!,part=>parseInt(part,16));
}
// Public key and ciphertext can cross the existing native debugger channel;
// the authorization bearer itself never appears in its command payload.
export function createScenarioOneEncryptedHandoff(d:{guard:()=>void;randomBytes:(length:number)=>Uint8Array;install:(grant:unknown)=>Promise<unknown>}){
  let secret:Uint8Array|null=null;
  return {
    prepare(){d.guard();secret?.fill(0);secret=d.randomBytes(32);return {publicKey:hex(nacl.box.keyPair.fromSecretKey(secret).publicKey)}},
    async install(value:unknown){
      d.guard();if(!secret)throw new Error('Explicit handoff preparation required');
      const key=secret;secret=null;
      try{
        const envelope=value as Envelope;
        if(!envelope||Object.keys(envelope).sort().join()!=='ciphertext,nonce,publicKey')throw new Error('Encrypted handoff rejected');
        const opened=nacl.box.open(bytes(envelope.ciphertext),bytes(envelope.nonce,24),bytes(envelope.publicKey,32),key);
        if(!opened)throw new Error('Encrypted handoff rejected');
        return await d.install(JSON.parse(String.fromCharCode(...opened)));
      }finally{key.fill(0)}
    },
  };
}
