import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { DevSettings, Platform } from 'react-native';
import { apiBaseUrl } from '../api';
import { firebaseAuth } from '../firebase';
import { assertNativeSecurityClient, nativeSecurityEnabled } from '../nativeSecurity';
import { armNativeLogoutWitness, disarmNativeLogoutWitness } from '../nativeSecurityLogoutWitness';
import { capturePlacementSession, loadFlowerPlacements, saveFlowerPlacements, scopeFlowerPlacements, type PlacementSession } from '../../components/garden/planting/plantingPersistence';
import { CHECKPOINT_KEY, SCENARIO_ONE_RETRY_KEY, createNativeSecurityScenarioHarness, validateCheckpoints, type Snapshot, type Checkpoint } from './engine';
import { createScenarioOneAuthorizationClient, createScenarioOneEncryptedHandoff, SCENARIO_ONE_AUTHORIZATION_KEY, type ScenarioOneGrant } from './scenarioOneAuthorization';
import { createAttemptStore, attemptKey } from './attempts';
import { createContinuationStore, verifiedSource, CONTINUATION_ACCESS_KEY } from './continuation';
import { RELOAD_OBSERVATION_KEY } from './reloadObservation';

const ACCESS_KEY = 'petalpal_native_security_test_harness_access_v1';
const accessOptions = { keychainService: ACCESS_KEY, keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
let reloadRequestedThisRuntime = false;
let continuationRunning:Promise<Checkpoint[]>|null=null;
const continuationOptions={keychainService:CONTINUATION_ACCESS_KEY,keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY};
interface Identity { email: string; password: string; uid: string | null; owner: string | null; disposable: boolean }
interface Source {
  environment: string; firebaseProject: string; database: string;
  credentials: Partial<Record<'A'|'B'|'C', Identity>>;
  status: Record<'A'|'B'|'C', { firebaseExists: boolean; backendExists: boolean }>;
  capability?: string;
}
export interface ProductAuth {
  phase: string; session: { user: { id: string } } | null; error: string;
  login: (email: string, password: string) => Promise<void>; logout: () => Promise<void>; deleteAccount: () => Promise<void>;
}
interface Hooks {
  inspect: () => Promise<Snapshot>; resetHooks: () => void; holdNextWrite: () => void; releaseWrite: () => void;
  failNext: (operation: 'remove') => void; prepareGlobalPreference: () => Promise<void>; removeGlobalPreference: () => Promise<void>;
  armReloadObservation:()=>Promise<void>;reloadObservationPassed:()=>Promise<boolean>;
}
function guard() {
  if (!__DEV__ || !nativeSecurityEnabled || Platform.OS === 'web' || typeof HermesInternal === 'undefined') throw new Error('Isolated native harness required');
  assertNativeSecurityClient();
  if (firebaseAuth().app.options.projectId !== 'petalpal-native-security-test') throw new Error('Firebase boundary rejected');
}
// Type-only Hermes global; never used to enable the harness by itself.
declare const HermesInternal: unknown;
const attemptStore=()=>createAttemptStore(AsyncStorage,()=>`s1-${Array.from(Crypto.getRandomBytes(16),b=>b.toString(16).padStart(2,'0')).join('')}`);
const continuationStore=()=>createContinuationStore(AsyncStorage,attemptStore().report);
async function continuationRequest(method:string,capability:string){
  guard();const response=await fetch(`${apiBaseUrl()}/native-security/harness/${method}`,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:`Bearer ${capability}`},body:'{}'});
  if(!response.ok)throw Error('Continuation authorization unavailable');return response.json();
}
function validateContinuationSource(source:Source,fresh=false){
  if(source.environment!=='native-security-test'||source.firebaseProject!=='petalpal-native-security-test'||source.database!=='petalpal_native_security_test'||
    !source.status.A.firebaseExists||!source.status.A.backendExists||!source.status.B.firebaseExists||!source.status.B.backendExists||
    source.status.C.firebaseExists!==source.status.C.backendExists||(fresh&&!source.status.C.backendExists))throw Error('Continuation isolation rejected');
  if(!source.credentials.A?.uid||!source.credentials.A.owner||source.credentials.A.disposable||!source.credentials.B?.uid||!source.credentials.B.owner||source.credentials.B.disposable||!source.credentials.C?.disposable)throw Error('Continuation identities rejected');
}
async function installContinuation(value:unknown){
  guard();const original=verifiedSource(await attemptStore().report()),store=continuationStore();
  if(await store.read())throw Error('Continuation already prepared');
  const grant=value as {origin:string;capability:string};
  if(!grant||Object.keys(grant).sort().join()!=='capability,origin'||grant.origin!==apiBaseUrl()||!/^[a-f0-9]{64}$/.test(grant.capability))throw Error('Continuation grant rejected');
  validateContinuationSource(await continuationRequest('session',grant.capability),true);
  const encoded=JSON.stringify({...grant,sourceAttemptId:original.id});
  await SecureStore.setItemAsync(CONTINUATION_ACCESS_KEY,encoded,continuationOptions);
  if(await SecureStore.getItemAsync(CONTINUATION_ACCESS_KEY,continuationOptions)!==encoded)throw Error('Continuation grant persistence failed');
  await store.prepare();return {ready:true,scope:'scenarios-2-7'};
}
async function installReloadRecovery(value:unknown){
  guard();const original=verifiedSource(await attemptStore().report()),store=continuationStore(),prior=await store.read();
  const grant=value as {origin:string;capability:string};
  if(!prior||prior.journal.at(-1)?.scenario!==5||prior.journal.at(-1)?.code!=='BLOCKED'||prior.journal.at(-2)?.phase!=='reload-requested'||
    !grant||Object.keys(grant).sort().join()!=='capability,origin'||grant.origin!==apiBaseUrl()||!/^[a-f0-9]{64}$/.test(grant.capability))throw Error('Reload recovery boundary rejected');
  const source=await continuationRequest('session',grant.capability);validateContinuationSource(source);
  if(source.status.C.backendExists||source.status.C.firebaseExists)throw Error('Completed C deletion required');
  const hooks=(globalThis as typeof globalThis & {__PETALPAL_NATIVE_SECURITY__?:Hooks}).__PETALPAL_NATIVE_SECURITY__,snapshot=await hooks?.inspect();
  if(firebaseAuth().currentUser||!snapshot?.available||snapshot.ownerActive||snapshot.namespaceKeyCount!==0||snapshot.memoryRecordCount!==0||
    snapshot.memoryCachePresent||!snapshot.storageReady||snapshot.pendingErasureCount!==0||snapshot.cleanupResult!==true||snapshot.failureArmed||snapshot.writeHeld||
    await AsyncStorage.getItem(RELOAD_OBSERVATION_KEY))throw Error('Fresh non-destructive reload recovery required');
  const encoded=JSON.stringify({...grant,sourceAttemptId:original.id});
  await SecureStore.setItemAsync(CONTINUATION_ACCESS_KEY,encoded,continuationOptions);
  if(await SecureStore.getItemAsync(CONTINUATION_ACCESS_KEY,continuationOptions)!==encoded)throw Error('Recovery authorization not persisted');
  await store.prepareReloadRecovery();return {ready:true,scope:'scenarios-5-7'};
}
function scenarioOneAuthorizationClient() {
  const options={keychainService:SCENARIO_ONE_AUTHORIZATION_KEY,keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY};
  const report=async(key:string)=>validateCheckpoints(JSON.parse(await AsyncStorage.getItem(key)||'[]'));
  return createScenarioOneAuthorizationClient({
    guard,apiOrigin:apiBaseUrl,
    storage:{get:()=>SecureStore.getItemAsync(SCENARIO_ONE_AUTHORIZATION_KEY,options),
      set:value=>SecureStore.setItemAsync(SCENARIO_ONE_AUTHORIZATION_KEY,value,options),
      remove:()=>SecureStore.deleteItemAsync(SCENARIO_ONE_AUTHORIZATION_KEY,options)},
    original:()=>report(CHECKPOINT_KEY),retry:()=>report(SCENARIO_ONE_RETRY_KEY),
    request:async(grant,method)=>{
      guard(); const response=await fetch(`${grant.origin}/native-security/scenario1/${method}`,{
        method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:`Bearer ${grant.capability}`},body:'{}',
      });
      if(!response.ok)throw new Error('Scoped authorization unavailable');return response.json();
    },
  });
}
// Local inspector handoff only: no credentials/grants are in the Metro bundle.
// This writes SecureStore after live isolation and untouched-retry checks;
// it never calls product login, logout, cache fixtures, or a scenario runner.
if (__DEV__ && nativeSecurityEnabled && Platform.OS!=='web' && typeof HermesInternal!=='undefined') {
  (globalThis as typeof globalThis & {__PETALPAL_NATIVE_SECURITY_AUTHORIZATION__?:unknown}).__PETALPAL_NATIVE_SECURITY_AUTHORIZATION__=
    createScenarioOneEncryptedHandoff({guard,randomBytes:Crypto.getRandomBytes,install:grant=>scenarioOneAuthorizationClient().install(grant)});
  (globalThis as typeof globalThis & {__PETALPAL_NATIVE_SECURITY_CONTINUATION_AUTHORIZATION__?:unknown}).__PETALPAL_NATIVE_SECURITY_CONTINUATION_AUTHORIZATION__=
    createScenarioOneEncryptedHandoff({guard,randomBytes:Crypto.getRandomBytes,install:installContinuation});
  (globalThis as typeof globalThis & {__PETALPAL_NATIVE_SECURITY_RELOAD_RECOVERY_AUTHORIZATION__?:unknown}).__PETALPAL_NATIVE_SECURITY_RELOAD_RECOVERY_AUTHORIZATION__=
    createScenarioOneEncryptedHandoff({guard,randomBytes:Crypto.getRandomBytes,install:installReloadRecovery});
}
export function createDeviceNativeSecurityHarness(auth: () => ProductAuth, progress: (journal: Checkpoint[]) => void) {
  guard();
  const hooks = (globalThis as typeof globalThis & { __PETALPAL_NATIVE_SECURITY__?: Hooks }).__PETALPAL_NATIVE_SECURITY__;
  if (!hooks) throw new Error('Native diagnostics unavailable');
  let source: Source | null = null;
  let capability: string | null = null;
  const scopedAuthorization=scenarioOneAuthorizationClient();
  let scopedGrant:ScenarioOneGrant|null=null;
  const attempts=attemptStore(),continuation=createContinuationStore(AsyncStorage,attempts.report);
  let preparing=false;
  async function request(method: string, token: string) {
    guard();
    const response = await fetch(`${apiBaseUrl()}/native-security/harness/${method}`, {
      method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{}',
    });
    if (!response.ok) throw new Error('Isolated credential bridge unavailable');
    return response.json();
  }
  function validate(data: Source) {
    if (data.environment !== 'native-security-test' || data.firebaseProject !== 'petalpal-native-security-test' ||
        data.database !== 'petalpal_native_security_test') throw new Error('Live isolation rejected');
    if (!data.status.A.firebaseExists || !data.status.A.backendExists || !data.status.B.firebaseExists || !data.status.B.backendExists ||
        data.status.C.firebaseExists !== data.status.C.backendExists) throw new Error('Account existence rejected');
  }
  async function initializeAccess() {
    capability = await SecureStore.getItemAsync(ACCESS_KEY, accessOptions);
    if (capability) source = await request('session', capability);
    else {
      const user = firebaseAuth().currentUser;
      if (!user || auth().phase !== 'signedIn') throw new Error('Sign in as A once before starting');
      source = await request('bootstrap', await user.getIdToken());
      validate(source!);
      capability = source?.capability || null;
      if (!capability) throw new Error('Resume access unavailable');
      await SecureStore.setItemAsync(ACCESS_KEY, capability, accessOptions);
    }
    validate(source!);
    if (!source?.credentials.C?.disposable) throw new Error('Disposable C rejected');
  }
  async function waitSettled(expected?: string) {
    const pending=()=>auth().phase === 'initializing' || (!!expected && auth().phase!==expected);
    for (let i=0;i<600 && pending();i++) await new Promise<void>(r=>setTimeout(r,50));
    if (pending()) throw new Error('Native auth did not settle');
  }
  async function inspect() {
    let s = await hooks!.inspect();
    for (let i=0;i<50 && s.available && !s.activeOwnerMatchesExpected;i++) {
      await new Promise<void>(r=>setTimeout(r,10)); s=await hooks!.inspect();
    }
    if (!s.available) throw new Error('Native storage inspection unavailable'); return s;
  }
  function identity(label: 'A'|'B'|'C') {
    const target = source?.credentials[label], user = firebaseAuth().currentUser, current = auth();
    if (!target?.uid || !target.owner || !user || current.phase !== 'signedIn' || user.uid !== target.uid ||
        current.session?.user.id !== target.owner || capturePlacementSession().owner !== target.owner ||
        (label==='C' && !target.disposable)) throw new Error('Exact designated identity rejected');
  }
  const fixture = [{ id: 'native-security-safe-marker', flowerId: 'native-security-fixture', journalEntryId: 'native-security-test',
    plantedDate: '2026-10-07T12:00:00.000Z', month: 10, worldX: 1200, worldY: 562, scale: 1, rotation: 0, placementVersion: 1, supportCount: 0 }];
  const createEngine = (checkpointKey: string, attemptId?:string, continuationSource?:Checkpoint[]) => createNativeSecurityScenarioHarness({
    attemptId,
    continuationSource,
    prepareContinuation:async()=>{
      await waitSettled();const raw=await SecureStore.getItemAsync(CONTINUATION_ACCESS_KEY,continuationOptions);
      if(!raw)throw Error('Continuation authorization required');const grant=JSON.parse(raw);
      if(grant.origin!==apiBaseUrl()||grant.sourceAttemptId!==attemptId||!/^[a-f0-9]{64}$/.test(grant.capability))throw Error('Continuation scope mismatch');
      const verified=await continuationRequest('session',grant.capability);validateContinuationSource(verified);capability=grant.capability;source=verified;
    },
    enabled: __DEV__ && nativeSecurityEnabled && Platform.OS !== 'web',
    read: async() => continuationSource?JSON.stringify((await continuation.read())?.journal||[]):AsyncStorage.getItem(checkpointKey),
    write: value => continuationSource?continuation.write(value):attemptId?attempts.write(attemptId,value):AsyncStorage.setItem(checkpointKey, value), progress,
    boundary: async () => {
      if(!continuationSource&&(attemptId||checkpointKey===SCENARIO_ONE_RETRY_KEY)){
        if(!scopedGrant)throw new Error('Scenario-1 authorization required');
        const status=await scopedAuthorization.status(scopedGrant);
        return {A:status.status.A.backendExists,B:status.status.B.backendExists,C:status.status.C.backendExists};
      }
      if(scopedGrant)throw new Error('Scenario-1 authorization cannot run later scenarios');
      guard(); if (!source || !capability) throw new Error('Test access required');
      const status = await request('status', capability); validate(status);
      return { A: status.status.A.backendExists, B: status.status.B.backendExists, C: status.status.C.backendExists };
    },
    login: async label => {
      if(!continuationSource&&(attemptId||checkpointKey===SCENARIO_ONE_RETRY_KEY)&&label!=='A')throw new Error('Scenario-1 authorization permits only A');
      await waitSettled();
      const target = source?.credentials[label];
      if (!target?.uid || !target.owner) throw new Error('Designated account unavailable');
      if (firebaseAuth().currentUser?.uid !== target.uid || auth().phase !== 'signedIn') {
        await auth().login(target.email, target.password); await waitSettled();
      }
      identity(label);
    }, identity,
    signedOut: () => auth().phase === 'signedOut' && firebaseAuth().currentUser === null,
    errorIsGeneric: () => ['', 'Your session is closed. Private device cache cleanup failed; please sign in again to retry.',
      'Private device cache cleanup failed. Please retry.'].includes(auth().error),
    logout: async () => { await auth().logout(); await waitSettled('signedOut'); },
    deleteC: async () => { if(!continuationSource&&(attemptId||checkpointKey===SCENARIO_ONE_RETRY_KEY))throw new Error('Deletion is outside Scenario-1 authorization'); identity('C'); await auth().deleteAccount(); await waitSettled('signedOut'); },
    inspect, fixture: () => saveFlowerPlacements(fixture), readCount: async () => (await loadFlowerPlacements()).length,
    capture: capturePlacementSession, staleWrite: session => saveFlowerPlacements(fixture,session as PlacementSession),
    armWitness: armNativeLogoutWitness, disarmWitness: disarmNativeLogoutWitness,
    resetHooks: () => hooks.resetHooks(), holdWrite: () => hooks.holdNextWrite(), releaseWrite: () => hooks.releaseWrite(), failRemove: () => hooks.failNext('remove'),
    preference: present => present ? hooks.prepareGlobalPreference() : hooks.removeGlobalPreference(),
    recoverStorage: async () => { if (!await scopeFlowerPlacements(null)) throw new Error('Native recovery failed'); },
    reload: async() => { guard();await hooks.armReloadObservation();reloadRequestedThisRuntime=true; DevSettings.reload(); },
    freshRuntime: () => !reloadRequestedThisRuntime,
    reloadEvidence:()=>hooks.reloadObservationPassed(),
    disposeAccess: async () => {
      if (capability) await request('revoke',capability);
      await SecureStore.deleteItemAsync(continuationSource?CONTINUATION_ACCESS_KEY:ACCESS_KEY,continuationSource?continuationOptions:accessOptions); capability=null; source=null;
    },
  });
  const engine=createEngine(CHECKPOINT_KEY), retry=createEngine(SCENARIO_ONE_RETRY_KEY);
  const preparation={settleAuth:()=>waitSettled(),authorize:async()=>{
    const authorization=await scopedAuthorization.initialize();scopedGrant=authorization.grant;source=authorization.source;
  }};
  return {
    readContinuation:continuation.read,
    activateContinuation:async()=>{guard();await continuation.activate()},
    runContinuation:async()=>{
      guard();if(continuationRunning)return continuationRunning;
      continuationRunning=(async()=>{
        const original=verifiedSource(await attempts.report()),saved=await continuation.read();
        if(!saved?.active)throw Error('Continuation is not activated');
        const last=saved.journal.at(-1)!;
        if(last.code==='FAIL'||last.code==='BLOCKED'||(last.scenario===7&&last.code==='PASS'))return saved.journal;
        const active=createEngine('',original.id,original.journal);
        try{return await active.runAllNativeSecurityScenarios()}
        finally{
          const end=(await continuation.read())?.journal.at(-1);
          if(end?.code==='FAIL'||end?.code==='BLOCKED'){
            try{if(capability)await continuationRequest('revoke',capability)}finally{await SecureStore.deleteItemAsync(CONTINUATION_ACCESS_KEY,continuationOptions);capability=null;source=null}
          }
        }
      })();
      try{return await continuationRunning}finally{continuationRunning=null}
    },
    readCurrentAttempt: attempts.report,
    prepareFreshScenarioOne: async()=>{
      guard();if(preparing)throw Error('Preparation already active');preparing=true;
      try {
        const current=await attempts.allocate();
        disarmNativeLogoutWitness();hooks.resetHooks();source=null;scopedGrant=null;
        await createEngine(attemptKey(current.id),current.id).prepareScenarioOne(preparation);
        source=null;scopedGrant=null;
        return await attempts.report();
      } finally {preparing=false}
    },
    runCurrentScenarioOne: async()=>{
      guard();const current=await attempts.report();
      if(!current||current.journal.at(-1)?.phase!=='ready')throw Error('Prepared current attempt required');
      const active=createEngine(attemptKey(current.id),current.id);
      try{return await active.runScenarioOneOnly(preparation)}
      finally {
        if(['PASS','FAIL','BLOCKED'].includes((await active.readReport()).at(-1)?.code||'')) {
          try{await scopedAuthorization.revoke()}finally{source=null;scopedGrant=null}
        }
      }
    },
    hasScenarioOneRetry: async () => (await retry.readReport()).length>0,
    readReport: async () => { const report=await retry.readReport(); return report.length ? report : engine.readReport(); },
    readOriginalReport: engine.readReport,
    runScenarioOneOnly: async () => {
      guard();
      const original=await engine.readReport();
      if (!original.length || original.some(c=>c.scenario!==1) || original.at(-1)?.code!=='FAIL') throw new Error('Scenario 1 retry boundary rejected');
      const prior=await retry.readReport();
      if (prior.at(-1)?.code==='PASS'||prior.at(-1)?.code==='FAIL'||prior.at(-1)?.code==='BLOCKED') return prior;
      // Persist the retry's start before any fallible preparation. Otherwise a
      // preparation rejection leaves only the original FAIL visible on-device.
      try { return await retry.runScenarioOneOnly({
        settleAuth: () => waitSettled(),
        authorize: async () => {
          const authorization=await scopedAuthorization.initialize();scopedGrant=authorization.grant;source=authorization.source;
        },
      }); }
      finally {
        const last=(await retry.readReport()).at(-1);
        if(last&&['PASS','FAIL','BLOCKED'].includes(last.code)) {
          try { await scopedAuthorization.revoke(); } finally { scopedGrant=null;source=null; }
        }
      }
    },
    runAllNativeSecurityScenarios: async () => { guard();if(await attempts.index())throw Error('Scenario-1-only attempt selected');await waitSettled(); await initializeAccess(); return engine.runAllNativeSecurityScenarios(); },
  };
}
