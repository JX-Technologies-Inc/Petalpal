export const CHECKPOINT_KEY = 'petalpal_native_security_test_harness_v1';
export const SCENARIO_ONE_RETRY_KEY = 'petalpal_native_security_test_harness_scenario1_retry_v1';
export type Scenario = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Code = 'RUNNING' | 'PASS' | 'FAIL' | 'BLOCKED';
type PreparationStage = 'auth-settled' | 'scenario1-authorization';
interface ScenarioOnePreparation { settleAuth: () => Promise<void>; authorize: () => Promise<void> }
export interface Snapshot {
  available: boolean; namespaceKeyCount: number; scopedRecordCount: number;
  memoryCachePresent: boolean; memoryRecordCount: number; activeOwnerMatchesExpected: boolean;
  ownerActive: boolean; storageReady: boolean; pendingErasureCount: number; cleanupResult: boolean | null;
  globalPreferencePreserved: boolean; failureArmed: string | null; writeHeld: boolean;
  bootNamespaceKeyCount: number | null;
  milestones: { operation: string; stage: string }[];
}
export interface Checkpoint {
  attemptId?: string;
  scenario: Scenario; phase: string; started: boolean; completed: boolean; timestamp: string; code: Code;
  cachePresent: boolean; recordCount: number; memoryCachePresent: boolean; memoryRecordCount: number;
  expectedOwnerMatch: boolean; cleanupCompleted: boolean; preferencePreserved: boolean; failureInjectionArmed: boolean;
  failedChecks?: string[];
  preparationFailure?: PreparationStage;
}
export interface HarnessDependencies {
  attemptId?: string;
  continuationSource?: Checkpoint[];
  prepareContinuation?: () => Promise<void>;
  enabled: boolean;
  read: () => Promise<string | null>; write: (value: string) => Promise<void>;
  boundary: () => Promise<{ A: boolean; B: boolean; C: boolean }>;
  login: (label: 'A' | 'B' | 'C') => Promise<void>; identity: (label: 'A' | 'B' | 'C') => void;
  signedOut: () => boolean; errorIsGeneric: () => boolean;
  logout: () => Promise<void>; deleteC: () => Promise<void>;
  inspect: () => Promise<Snapshot>; fixture: () => Promise<void>; readCount: () => Promise<number>;
  capture: () => unknown; staleWrite: (session: unknown) => Promise<void>;
  armWitness: (callback: (erased: boolean) => Promise<void>) => void; disarmWitness: () => void;
  resetHooks: () => void; holdWrite: () => void; releaseWrite: () => void; failRemove: () => void;
  preference: (present: boolean) => Promise<void>; recoverStorage: () => Promise<void>;
  reload: () => void | Promise<void>; freshRuntime: () => boolean; reloadEvidence?:()=>Promise<boolean>; disposeAccess: () => Promise<void>;
  progress?: (journal: Checkpoint[]) => void; pause?: () => Promise<void>;
}
const phases: Record<Scenario, string[]> = {
  1: ['ready', 'fixture', 'logout-pending', 'logout-completed', 'pass'],
  2: ['ready', 'fixture', 'delete-pending', 'logout-completed', 'remote-deleted', 'pass'],
  3: ['ready', 'fixture', 'logout-pending', 'logout-completed', 'b-authorized', 'pass'],
  4: ['ready', 'write-held', 'logout-pending', 'logout-completed', 'stale-fenced', 'pass'],
  5: ['ready', 'fixture', 'logout-pending', 'logout-completed', 'reload-requested', 'pass'],
  6: ['ready', 'fixture', 'logout-pending', 'logout-completed', 'preference-removed', 'pass'],
  7: ['ready', 'fixture', 'logout-pending', 'failure-observed', 'failure-safe', 'recovered', 'pass'],
};
const attemptPhases=['preparing','ready','fixture','logout-pending','logout-completed','verification','pass'];
export const validAttemptId=(id: unknown): id is string => typeof id==='string' && /^s1-[a-f0-9]{32}$/.test(id);
const fields = ['scenario','phase','started','completed','timestamp','code','cachePresent','recordCount','memoryCachePresent',
  'memoryRecordCount','expectedOwnerMatch','cleanupCompleted','preferencePreserved','failureInjectionArmed'].sort();
const booleanFields = ['started','completed','cachePresent','memoryCachePresent','expectedOwnerMatch','cleanupCompleted','preferencePreserved','failureInjectionArmed'] as const;
const allowedFailedChecks = ['logout-witness','signed-out','erasure-returned','durable-cache','memory-cache','expected-owner',
  'storage-ready','pending-erasure','cleanup-result','owner-inactive','fault-disarmed','write-held','verification-cleanup'];
const cleanCheckpoint = (c: Checkpoint) => !c.cachePresent && !c.memoryCachePresent && c.recordCount === 0 &&
  c.memoryRecordCount === 0 && c.expectedOwnerMatch && c.cleanupCompleted && !c.failureInjectionArmed;
export function validateCheckpoints(input: unknown): Checkpoint[] {
  if (!Array.isArray(input) || input.length > 100) throw new Error('Invalid test checkpoints');
  let previous: Checkpoint | undefined;
  const attemptId=input[0]?.attemptId;
  if (attemptId!==undefined && !validAttemptId(attemptId)) throw new Error('Invalid attempt identity');
  for (const item of input) {
    if (!item || typeof item !== 'object' || item.attemptId!==attemptId || Object.keys(item).filter(key=>!['failedChecks','preparationFailure','attemptId'].includes(key)).sort().join() !== fields.join() ||
        !Number.isInteger(item.scenario) || item.scenario < 1 || item.scenario > 7 ||
        !['RUNNING','PASS','FAIL','BLOCKED'].includes(item.code) || typeof item.phase !== 'string' ||
        (!(attemptId&&item.scenario===1?attemptPhases:phases[item.scenario as Scenario]).includes(item.phase) && !['blocked','failed'].includes(item.phase)) ||
        booleanFields.some(key => typeof item[key] !== 'boolean') || item.started !== true ||
        item.completed !== (item.code === 'PASS') || !Number.isInteger(item.recordCount) || item.recordCount < 0 ||
        !Number.isInteger(item.memoryRecordCount) || item.memoryRecordCount < 0 ||
        typeof item.timestamp !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(item.timestamp)) throw new Error('Invalid test checkpoint schema');
    if ('failedChecks' in item && (item.code!=='FAIL' || !Array.isArray(item.failedChecks) || !item.failedChecks.length ||
        item.failedChecks.some((check: unknown)=>typeof check!=='string'||!allowedFailedChecks.includes(check)))) throw new Error('Invalid failure checks');
    if ('preparationFailure' in item && (item.scenario!==1 || item.code!=='BLOCKED' || previous?.scenario!==1 || previous.code!=='RUNNING' ||
        !['auth-settled','scenario1-authorization'].includes(item.preparationFailure))) throw new Error('Invalid preparation failure');
    const c = item as Checkpoint;
    if (!previous) { if (c.scenario !== 1 || c.phase !== (attemptId?'preparing':'ready')) throw new Error('Missing start checkpoint'); }
    else if (previous.code !== 'RUNNING') {
      if (previous.code !== 'PASS' || c.scenario !== previous.scenario + 1 || c.phase !== 'ready') throw new Error('Invalid scenario sequence');
    } else {
      if (c.scenario !== previous.scenario) throw new Error('Skipped scenario');
      if (c.code !== 'BLOCKED' && c.code !== 'FAIL') {
        const sequence = attemptId&&c.scenario===1?attemptPhases:phases[c.scenario];
        if (sequence.indexOf(c.phase) !== sequence.indexOf(previous.phase) + 1) throw new Error('Skipped checkpoint phase');
      }
    }
    if ((c.phase === 'pass') !== (c.code === 'PASS') ||
        (c.phase === 'blocked') !== (c.code === 'BLOCKED') || (c.phase === 'failed') !== (c.code === 'FAIL')) throw new Error('Invalid result checkpoint');
    if (c.phase === 'logout-completed' && !cleanCheckpoint(c)) throw new Error('Invalid logout witness');
    if (attemptId && c.scenario===1 && ['verification','pass'].includes(c.phase) && !cleanCheckpoint(c)) throw new Error('Invalid verification evidence');
    if (c.phase === 'fixture' && (!c.cachePresent || !c.memoryCachePresent || c.recordCount !== 1 || c.memoryRecordCount !== 1 || !c.expectedOwnerMatch)) throw new Error('Missing native fixture observation');
    if (c.phase === 'failure-observed' && (c.memoryCachePresent || c.memoryRecordCount || c.failureInjectionArmed)) throw new Error('Invalid fail-closed witness');
    previous = c;
  }
  return input as Checkpoint[];
}
const empty: Snapshot = { available: true, namespaceKeyCount: 0, scopedRecordCount: 0, memoryCachePresent: false,
  memoryRecordCount: 0, activeOwnerMatchesExpected: true, ownerActive: false, storageReady: true,
  pendingErasureCount: 0, cleanupResult: false, globalPreferencePreserved: false, failureArmed: null,
  writeHeld: false, bootNamespaceKeyCount: null, milestones: [] };
function clean(s: Snapshot) { return s.available && s.namespaceKeyCount === 0 && !s.memoryCachePresent &&
  s.memoryRecordCount === 0 && !s.ownerActive && s.activeOwnerMatchesExpected && s.storageReady &&
  s.pendingErasureCount === 0 && s.cleanupResult === true && !s.failureArmed && !s.writeHeld; }
class VerificationFailure extends Error {
  constructor(readonly checks?: string[], readonly snapshot?: Snapshot) { super('Native verification failed'); }
}
export function createNativeSecurityScenarioHarness(d: HarnessDependencies) {
  let journal: Checkpoint[] = [], running = false;
  let witnessFailure: VerificationFailure | null = null;
  async function save(scenario: Scenario, phase: string, snapshot: Snapshot = empty, code: Code = 'RUNNING', cleanup = snapshot.cleanupResult === true, failedChecks?: string[], preparationFailure?: PreparationStage) {
    const c: Checkpoint = { scenario, phase, started: true, completed: code === 'PASS', timestamp: new Date().toISOString(), code,
      cachePresent: snapshot.namespaceKeyCount > 0, recordCount: snapshot.scopedRecordCount,
      memoryCachePresent: snapshot.memoryCachePresent, memoryRecordCount: snapshot.memoryRecordCount,
      expectedOwnerMatch: snapshot.activeOwnerMatchesExpected, cleanupCompleted: cleanup,
      preferencePreserved: snapshot.globalPreferencePreserved, failureInjectionArmed: snapshot.failureArmed !== null };
    if (d.attemptId) c.attemptId=d.attemptId;
    if (failedChecks?.length) c.failedChecks=failedChecks;
    if (preparationFailure) c.preparationFailure=preparationFailure;
    const next = validateCheckpoints([...journal, c]);
    await d.write(JSON.stringify(next)); journal = next; d.progress?.(journal.slice());
  }
  function require(value: boolean) { if (!value) throw new VerificationFailure(); }
  async function signIn(label: 'A' | 'B' | 'C') { await d.login(label); d.identity(label); }
  async function fixture(n: Scenario) {
    const s = await d.inspect();
    require(s.available && s.namespaceKeyCount === 0 && s.memoryRecordCount === 0 && s.storageReady &&
      s.activeOwnerMatchesExpected && !s.failureArmed && !s.writeHeld);
    await d.fixture(); const after = await d.inspect();
    require(after.available && after.namespaceKeyCount === 1 && after.scopedRecordCount === 1 && after.memoryRecordCount === 1 && after.memoryCachePresent);
    await save(n,'fixture',after);
  }
  function witness(n: Scenario) {
    d.armWitness(async erased => {
      let s = await d.inspect();
      if (n === 7) {
        require(!erased && s.available && !s.ownerActive && !s.memoryCachePresent && s.memoryRecordCount === 0 && !s.failureArmed &&
          s.milestones.some(m => m.operation === 'remove' && m.stage === 'injected-failure'));
        await save(n,'failure-observed',s,'RUNNING',false);
      } else {
        {
          // Auth's sign-out observer may enqueue a second scope cleanup after
          // the logout's awaited cleanup. Remain inside the original witness;
          // only quiescent native state may be persisted before logout returns.
          for (let i=0;erased && !clean(s) && i<100;i++) {
            await (d.pause?.() || new Promise<void>(r=>setTimeout(r,25))); s=await d.inspect();
          }
          const checks: string[]=[];
          if (!erased) checks.push('erasure-returned');
          if (s.namespaceKeyCount!==0) checks.push('durable-cache');
          if (s.memoryCachePresent||s.memoryRecordCount!==0) checks.push('memory-cache');
          if (!s.activeOwnerMatchesExpected) checks.push('expected-owner');
          if (!s.storageReady) checks.push('storage-ready');
          if (s.pendingErasureCount!==0) checks.push('pending-erasure');
          if (s.cleanupResult!==true) checks.push('cleanup-result');
          if (s.ownerActive) checks.push('owner-inactive');
          if (s.failureArmed) checks.push('fault-disarmed');
          if (s.writeHeld) checks.push('write-held');
          if (checks.length) { witnessFailure=new VerificationFailure(checks,s); throw witnessFailure; }
        }
        require(erased && clean(s));
        if (n === 6) require(s.globalPreferencePreserved);
        await save(n,'logout-completed',s,'RUNNING',true);
      }
    });
  }
  async function finish(n: Scenario) {
    if (witnessFailure) throw witnessFailure;
    const phase = journal[journal.length-1].phase;
    if (n === 1) {
      if (phase!=='logout-completed' && !(d.attemptId && phase==='verification')) throw witnessFailure || new VerificationFailure(['logout-witness']);
      if (!d.signedOut()) throw new VerificationFailure(['signed-out'],await d.inspect());
      if (d.attemptId && phase==='logout-completed') {
        const state=await d.inspect();
        if (!clean(state)) throw new VerificationFailure(['verification-cleanup'],state);
        await save(1,'verification',state);
      }
    }
    if (n === 2) {
      if (phase === 'logout-completed') {
        const status = await d.boundary(); require(!status.C && status.A && status.B && d.signedOut());
        await save(n,'remote-deleted',await d.inspect());
      } else require(phase === 'remote-deleted');
    }
    if (n === 3) {
      if (phase === 'logout-completed') {
        await signIn('B'); const count = await d.readCount(), s = await d.inspect();
        require(count === 0 && s.namespaceKeyCount === 0 && s.memoryRecordCount === 0 && s.activeOwnerMatchesExpected);
        await save(n,'b-authorized',s);
      } else require(phase === 'b-authorized');
    }
    if (n === 4) require(phase === 'stale-fenced');
    if (n === 5) {
      if (phase === 'logout-completed') {
        require(d.signedOut()); await save(n,'reload-requested',await d.inspect()); await d.reload(); return false;
      }
      require(phase === 'reload-requested');
      const boot = await d.inspect(); require(d.freshRuntime() && boot.bootNamespaceKeyCount === 0 && clean(boot) && d.signedOut());
      if(d.reloadEvidence)require(await d.reloadEvidence());
    }
    if (n === 6) {
      if (phase === 'logout-completed') { await d.preference(false); const s = await d.inspect(); require(!s.globalPreferencePreserved); await save(n,'preference-removed',s); }
      else require(phase === 'preference-removed');
    }
    if (n === 7) {
      require(phase === 'recovered');
      const status = await d.boundary(); require(status.A && status.B && !status.C);
      await d.disposeAccess();
    }
    const final=await d.inspect();
    if (d.attemptId && n===1 && !clean(final)) throw new VerificationFailure(['verification-cleanup'],final);
    await save(n,'pass',final,'PASS'); return true;
  }
  async function execute(n: Scenario) {
    const status = await d.boundary(); require(status.A && status.B);
    const phase = journal[journal.length-1].phase;
    if (phase !== 'ready') {
      // Only already-written witnesses can resume. Never repeat an ambiguous
      // fixture/logout/delete. Startup scope cleanup cannot write a witness.
      if ((n===1 && d.attemptId && phase==='verification') || ([1,2,3,5,6].includes(n) && phase === 'logout-completed') ||
          (n===2 && phase==='remote-deleted') || (n===3 && phase==='b-authorized') ||
          (n===4 && phase==='stale-fenced') || (n===5 && phase==='reload-requested') ||
          (n===6 && phase==='preference-removed') || (n===7 && phase==='recovered')) return finish(n);
      throw new Error('Interrupted phase has no completion evidence');
    }
    if (n === 2 && !status.C) throw new Error('C is already absent without local completion evidence');
    d.resetHooks();
    await signIn(n === 2 ? 'C' : 'A');
    if (n === 6) await d.preference(true);
    if (n !== 4) await fixture(n);
    if (n === 2) {
      const verified = await d.boundary(); require(verified.C && verified.A && verified.B); d.identity('C');
      await save(n,'delete-pending',await d.inspect()); witness(n); await d.deleteC();
    } else if (n === 4) {
      const old = d.capture(); d.holdWrite(); const write = d.staleWrite(old); void write.catch(() => {});
      let held = await d.inspect();
      for (let i=0;i<100 && (!held.writeHeld || held.namespaceKeyCount!==1 || held.scopedRecordCount!==1 || !held.milestones.some(m=>m.operation==='write'&&m.stage==='adapter-completed'));i++) {
        await (d.pause?.() || new Promise<void>(r=>setTimeout(r,25))); held = await d.inspect();
      }
      require(held.writeHeld && held.namespaceKeyCount === 1 && held.milestones.some(m=>m.operation==='write'&&m.stage==='adapter-completed'));
      await save(n,'write-held',held); await save(n,'logout-pending',held); witness(n);
      const logout = d.logout(); void logout.catch(() => {}); const invalidated = await d.inspect();
      require(!invalidated.ownerActive && !invalidated.memoryCachePresent && invalidated.memoryRecordCount===0);
      d.releaseWrite(); await write; await logout;
      require(journal[journal.length-1].phase === 'logout-completed');
      await d.staleWrite(old); require(clean(await d.inspect()) && d.signedOut());
      await save(n,'stale-fenced',await d.inspect());
    } else {
      await save(n,'logout-pending',await d.inspect()); witness(n);
      if (n === 7) d.failRemove();
      await d.logout();
    }
    if (n === 7) {
      require(journal[journal.length-1].phase === 'failure-observed');
      require(await d.readCount()===0 && d.signedOut() && d.errorIsGeneric());
      d.resetHooks(); await save(n,'failure-safe',await d.inspect(),'RUNNING',false);
      await d.recoverStorage(); require(clean(await d.inspect()));
      await d.preference(true); require((await d.inspect()).globalPreferencePreserved);
      await d.preference(false); require(!(await d.inspect()).globalPreferencePreserved);
      await save(n,'recovered',await d.inspect());
    }
    return finish(n);
  }
  async function runAllNativeSecurityScenarios(stopAfter: Scenario = 7, preparation?: ScenarioOnePreparation, prepareOnly=false) {
    if (!d.enabled) throw new Error('Isolated native harness disabled');
    if (d.attemptId && (!validAttemptId(d.attemptId) || (stopAfter!==1&&!d.continuationSource))) throw new Error('Scenario-1 attempt boundary rejected');
    if (d.continuationSource && (stopAfter!==7 || prepareOnly)) throw new Error('Continuation cannot execute Scenario 1');
    if (running) return journal.slice(); running = true; witnessFailure=null;
    let preparationStage: PreparationStage | undefined;
    try {
      const raw = await d.read(); journal = raw ? validateCheckpoints(JSON.parse(raw)) : [];
      if (journal.length && journal[0].attemptId!==d.attemptId) throw new Error('Journal attempt mismatch');
      if (d.continuationSource) {
        const source=validateCheckpoints(d.continuationSource);
        if(!d.attemptId||source.length!==7||source.some(c=>c.scenario!==1||c.attemptId!==d.attemptId)||source.at(-1)?.code!=='PASS'||
          JSON.stringify(journal.slice(0,source.length))!==JSON.stringify(source))throw new Error('Verified Scenario-1 source required');
      }
      if (journal.length && ['FAIL','BLOCKED'].includes(journal[journal.length-1].code)) return journal.slice();
      if (stopAfter===1 && journal.at(-1)?.code==='PASS') return journal.slice();
      if (d.continuationSource && journal.at(-1)?.scenario===7 && journal.at(-1)?.code==='PASS') return journal.slice();
      if (d.continuationSource) {
        const last=journal.at(-1)!;
        if(last.code==='PASS')await save((last.scenario+1) as Scenario,'ready');
        await d.prepareContinuation?.();
      }
      if (!journal.length) await save(1,d.attemptId?'preparing':'ready');
      if (stopAfter===1 && preparation) {
        preparationStage='auth-settled'; await preparation.settleAuth();
        preparationStage='scenario1-authorization'; await preparation.authorize();
        preparationStage=undefined;
      }
      if (d.attemptId && journal.at(-1)?.phase==='preparing') {
        if (!preparation) throw new Error('Explicit preparation required');
        await save(1,'ready');
      }
      if (prepareOnly) return journal.slice();
      while (true) {
        const last = journal[journal.length-1];
        if (last.code === 'PASS') {
          if (last.scenario >= stopAfter) break;
          await save((last.scenario+1) as Scenario,'ready');
        }
        if (!await execute(journal[journal.length-1].scenario)) break;
      }
    } catch (error) {
      // Private SDK/adapter payloads never enter diagnostics or console logs.
      if (journal.length && journal[journal.length-1].code === 'RUNNING') {
        const failed = error instanceof VerificationFailure;
        try { await save(journal[journal.length-1].scenario,failed ? 'failed' : 'blocked',
          failed && error.snapshot ? error.snapshot : empty,failed ? 'FAIL' : 'BLOCKED',false,
          failed ? error.checks : undefined,failed ? undefined : preparationStage); } catch { /* Fail closed on diagnostic storage errors. */ }
      }
      throw new Error('Native harness blocked; inspect the sanitized checkpoints');
    } finally {
      if (!prepareOnly) {
        d.disarmWitness(); d.resetHooks();
        try { await d.preference(false); } catch { /* The final checkpoint remains non-PASS on storage failure. */ }
      }
      running = false;
    }
    return journal.slice();
  }
  return { prepareScenarioOne: (preparation:ScenarioOnePreparation) => runAllNativeSecurityScenarios(1,preparation,true), runAllNativeSecurityScenarios: () => runAllNativeSecurityScenarios(), runScenarioOneOnly: (preparation?: ScenarioOnePreparation) => runAllNativeSecurityScenarios(1,preparation), readReport: async () => {
    if (!d.enabled) throw new Error('Isolated native harness disabled');
    const raw = await d.read(); return raw ? validateCheckpoints(JSON.parse(raw)) : [];
  } };
}
