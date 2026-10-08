import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import https from 'node:https';
import { Resolver } from 'node:dns/promises';
import { execFileSync, spawn } from 'node:child_process';
import express from 'express';
import rateLimit from 'express-rate-limit';
import WebSocket from 'ws';
import { parse } from 'dotenv';
import { assertNativeSecurityEnvironment, assertNativeSecurityHttps } from '../lib/native-security.js';
import { readNativeTestAccounts } from '../lib/native-security-harness.js';
import { createScenarioOneAuthorization, scenarioOneAuthorizationRouter } from '../lib/native-security-scenario1-authorization.js';

const recovering=process.argv[3]==='--reload-recovery';
const continuing=recovering||process.argv[3]==='--continuation';
const scope=recovering?'scenarios-5-7':continuing?'scenarios-2-7':'scenario-1';
const installer=recovering?'__PETALPAL_NATIVE_SECURITY_RELOAD_RECOVERY_AUTHORIZATION__':continuing?'__PETALPAL_NATIVE_SECURITY_CONTINUATION_AUTHORIZATION__':'__PETALPAL_NATIVE_SECURITY_AUTHORIZATION__';
const root=fileURLToPath(new URL('../',import.meta.url));
const nacl=createRequire(path.join(root,'mobile/package.json'))('tweetnacl');
let cleanupOnFailure=async()=>{};
let renewalStage='local-boundary';
let readinessHttpStatus=null;
let readinessFailure=null;
async function scopedPublicRead(origin,pathname='/',method='GET') {
  assertNativeSecurityHttps(origin);
  const url=new URL(pathname,origin), resolver=new Resolver();resolver.setServers(['1.1.1.1']);
  // Resolve only this new public relay through Cloudflare's resolver. TLS
  // still verifies the original hostname; system/network DNS is unchanged.
  const [address]=await resolver.resolve4(url.hostname);
  return new Promise((resolve,reject)=>{
    const req=https.request(url,{method,servername:url.hostname,
      lookup:(_host,options,callback)=>callback(null,options.all?[{address,family:4}]:address,4),
      headers:method==='POST'?{'Content-Type':'application/json'}:{}},res=>{
      let body='';res.on('data',chunk=>{body+=chunk;if(body.length>8192)req.destroy(Error('Scoped response rejected'))});
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,json:()=>JSON.parse(body)}));
    });req.setTimeout(10000,()=>req.destroy(Error('Scoped HTTPS timeout')));req.on('error',reject);req.end(method==='POST'?'{}':undefined);
  });
}
function local(name,json=false) {
  const p=path.join(root,name), stat=fs.lstatSync(p);
  if(!stat.isFile()||stat.uid!==process.getuid()||(stat.mode&0o777)!==0o600)throw Error('Local credential boundary rejected');
  execFileSync('git',['check-ignore','--quiet','--',name],{cwd:root,stdio:'ignore'});
  return json?JSON.parse(fs.readFileSync(p,'utf8')):parse(fs.readFileSync(p));
}
async function nativeInspector() {
  const targets=await (await fetch('http://127.0.0.1:8108/json/list',{signal:AbortSignal.timeout(10000)})).json();
  if(targets.length!==1)throw Error('One isolated native runtime required');
  const url=new URL(targets[0].webSocketDebuggerUrl);
  if(url.hostname!=='127.0.0.1'||url.port!=='8108')throw Error('Native inspector boundary rejected');
  const socket=new WebSocket(url,{origin:'http://127.0.0.1:8108'}), pending=new Map();let id=0;
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Native connection timeout')),10000);
    socket.once('open',()=>{clearTimeout(timer);resolve()});socket.once('error',()=>{clearTimeout(timer);reject(Error('Native connection unavailable'))})});
  socket.on('message',data=>{const m=JSON.parse(data.toString());pending.get(m.id)?.(m);pending.delete(m.id)});
  const evaluate=expression=>new Promise((resolve,reject)=>{
    const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('Native response unavailable'))},15000);
    pending.set(n,m=>{clearTimeout(timer);if(m.error||m.result?.exceptionDetails)reject(Error('Native authorization rejected'));else resolve(m.result.result.value)});
    socket.send(JSON.stringify({id:n,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}));
  });
  // Hermes needs its debugger domain activated before Runtime requests on a
  // new inspector connection. Neither activation executes a scenario.
  for(const method of ['Debugger.enable','Runtime.enable']) {
    const enableId=++id;
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{socket.close();reject(Error('Native runtime unavailable'))},10000);
      pending.set(enableId,m=>{clearTimeout(timer);m.error?reject(Error('Native runtime unavailable')):resolve()});
      socket.send(JSON.stringify({id:enableId,method}));
    });
  }
  const installEncrypted=async envelope=>{
    // The legacy Expo inspector can return a Promise handle even with
    // awaitPromise=true. Poll only a sanitized completion acknowledgement.
    const key=`__petalpal_authorization_ack_${randomBytes(12).toString('hex')}`;
    await evaluate(`globalThis[${JSON.stringify(key)}]={completed:false};globalThis[${JSON.stringify(installer)}].install(${JSON.stringify(envelope)}).then(function(x){globalThis[${JSON.stringify(key)}]={completed:true,ready:x?.ready===true,scope:x?.scope===${JSON.stringify(scope)}?${JSON.stringify(scope)}:null}},function(){globalThis[${JSON.stringify(key)}]={completed:true,ready:false}});null`);
    try {
      for(let attempt=0;attempt<80;attempt++){
        const result=await evaluate(`globalThis[${JSON.stringify(key)}]`);
        if(result?.completed)return result;
        await new Promise(resolve=>setTimeout(resolve,250));
      }
      throw Error('Secure native handoff timeout');
    } finally {await evaluate(`delete globalThis[${JSON.stringify(key)}]`).catch(()=>{})}
  };
  return {close:()=>socket.close(),evaluate,installEncrypted};
}
async function main() {
  if(execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim()!=='integration/mobile-backend-test')throw Error('Branch boundary rejected');
  const backendOrigin=assertNativeSecurityHttps(process.argv[2]);
  const env={...local('.env.native-security.local'),FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify(local('.env.native-security-admin.local.json',true))};
  assertNativeSecurityEnvironment(env);
  const publicClient=local('mobile/.env.native-security.local');
  if(publicClient.EXPO_PUBLIC_FIREBASE_PROJECT_ID!=='petalpal-native-security-test'||publicClient.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!=='petalpal-native-security-test.firebaseapp.com')throw Error('Client project rejected');
  const get=async url=>{const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000)});readinessHttpStatus=r.status;if(!r.ok)throw Error('Isolated endpoint unavailable');return r.json()};
  const health=await get(backendOrigin);
  if(health.environment!=='native-security-test'||health.firebaseProject!=='petalpal-native-security-test'||health.database!=='petalpal_native_security_test')throw Error('Backend isolation rejected');
  renewalStage='native-readiness';
  const native=await nativeInspector();
  const available=await native.evaluate(`typeof HermesInternal!=="undefined" && typeof globalThis[${JSON.stringify(installer)}]?.install==="function"`);
  if(available!==true){native.close();throw Error('Native authorization installer unavailable')}
  renewalStage='exact-A-provider-proof';
  const accounts=readNativeTestAccounts();
  const savedA={email:accounts.NATIVE_TEST_A_EMAIL.trim().toLowerCase(),password:accounts.NATIVE_TEST_A_PASSWORD};
  const loginResponse=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(publicClient.EXPO_PUBLIC_FIREBASE_API_KEY)}`,{
    method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({...savedA,returnSecureToken:true}),signal:AbortSignal.timeout(15000),
  });
  if(!loginResponse.ok)throw Error('Saved A authentication rejected');
  const login=await loginResponse.json();
  const claims=JSON.parse(Buffer.from(login.idToken.split('.')[1],'base64url').toString());
  if(claims.aud!=='petalpal-native-security-test'||claims.sub!==login.localId)throw Error('Authenticated project rejected');
  const post=async(method,token)=>{
    const r=await fetch(`${backendOrigin}/native-security/harness/${method}`,{method:'POST',redirect:'error',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:'{}',signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw Error('Isolated backend authorization rejected');return r.json();
  };
  // Existing bridge independently verifies the Firebase token and exact A's
  // provider/DB linkage. Its broader token is retained only in this process.
  renewalStage='exact-A-backend-proof';
  const source=await post('bootstrap',login.idToken), upstream=source.capability;
  cleanupOnFailure=async()=>{await post('revoke',upstream).catch(()=>{})};
  if(continuing){
    if(source.environment!=='native-security-test'||source.firebaseProject!=='petalpal-native-security-test'||source.database!=='petalpal_native_security_test'||
       source.credentials?.A?.uid!==login.localId||source.credentials.A.email!==savedA.email||!source.credentials.C?.disposable||
       source.status.C.backendExists!==(recovering?false:true)||source.status.C.firebaseExists!==(recovering?false:true))throw Error('Continuation identities rejected');
    const pairing=await native.evaluate(`globalThis[${JSON.stringify(installer)}].prepare()`);
    if(!/^[a-f0-9]{64}$/.test(pairing?.publicKey))throw Error('Native public key unavailable');
    const ephemeral=nacl.box.keyPair.fromSecretKey(new Uint8Array(randomBytes(32))),nonce=new Uint8Array(randomBytes(24));
    const ciphertext=nacl.box(new Uint8Array(Buffer.from(JSON.stringify({origin:backendOrigin,capability:upstream}))),nonce,new Uint8Array(Buffer.from(pairing.publicKey,'hex')),ephemeral.secretKey);
    const packet={publicKey:Buffer.from(ephemeral.publicKey).toString('hex'),nonce:Buffer.from(nonce).toString('hex'),ciphertext:Buffer.from(ciphertext).toString('hex')};ephemeral.secretKey.fill(0);
    renewalStage='continuation-native-handoff';const ack=await native.installEncrypted(packet);native.close();
    if(!ack?.ready||ack.scope!==scope)throw Error('Continuation handoff not confirmed');
    console.log(JSON.stringify({continuationAuthorized:true,sourcePassVerified:true,authorizedScenarios:recovering?[5,6,7]:[2,3,4,5,6,7],scenariosStarted:false}));return;
  }
  const service=createScenarioOneAuthorization({env,backendOrigin,savedA,authenticatedA:{uid:login.localId,project:claims.aud},source,
    verifyBackend:()=>post('status',upstream)});
  await service.status(service.token);
  renewalStage='scoped-relay';
  const app=express();app.use(express.json({limit:'2kb'}));
  app.get('/',(_req,res)=>res.set('Cache-Control','no-store').json({...health,backendOrigin,authorizedScenarios:[1]}));
  app.get('/session',(_req,res)=>res.status(401).json({error:'Authentication required'}));
  app.use('/native-security/scenario1',rateLimit({windowMs:60000,limit:60,standardHeaders:true,legacyHeaders:false,validate:{xForwardedForHeader:false}}),scenarioOneAuthorizationRouter(service));
  app.use((_req,res)=>res.status(404).json({error:'Unavailable'}));
  app.use((_error,_req,res,_next)=>res.status(403).json({error:'Scoped authorization unavailable'}));
  const server=app.listen(3118,'127.0.0.1');
  await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',()=>reject(Error('Scoped relay port unavailable')))});
  const childEnv={};for(const key of ['PATH','HOME','TMPDIR','LANG'])if(process.env[key])childEnv[key]=process.env[key];
  const tunnel=spawn('cloudflared',['tunnel','--url','http://127.0.0.1:3118','--no-autoupdate'],{cwd:root,env:childEnv,stdio:['ignore','ignore','pipe']});
  cleanupOnFailure=async()=>{tunnel.kill('SIGTERM');server.close();await post('revoke',upstream).catch(()=>{})};
  const origin=await new Promise((resolve,reject)=>{
    let buffered='';const timer=setTimeout(()=>reject(Error('Scoped tunnel unavailable')),25000);
    tunnel.once('error',()=>{clearTimeout(timer);reject(Error('Scoped tunnel unavailable'))});
    tunnel.stderr.on('data',data=>{buffered=(buffered+data.toString()).slice(-8192);const match=buffered.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if(match){clearTimeout(timer);resolve(match[0]);buffered=''}});
  });
  renewalStage='scoped-HTTPS-proof';
  console.log(JSON.stringify({scopedHttpsCandidate:origin,scenariosStarted:false}));
  // Quick Tunnel publishes its URL before the HTTPS route is ready. Retry
  // only this anonymous readiness read, never authentication or a scenario.
  let publicHealth;
  for(let attempt=0;attempt<10;attempt++) {
    try {const response=await scopedPublicRead(origin);readinessHttpStatus=response.status;if(response.status!==200)throw Error('Scoped HTTPS not ready');publicHealth=response.json();break}
    catch(error) {readinessFailure=['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ETIMEDOUT'].includes(error.cause?.code)?error.cause.code:error.name==='SyntaxError'?'NON_JSON':error.name==='TimeoutError'?'TIMEOUT':'HTTP_OR_TRANSPORT';if(attempt===9)throw Error('Scoped HTTPS route unavailable');await new Promise(resolve=>setTimeout(resolve,1500))}
  }
  renewalStage='scoped-HTTPS-boundary';
  if(publicHealth.backendOrigin!==backendOrigin||publicHealth.authorizedScenarios?.join()!=='1')throw Error('Scoped public boundary rejected');
  renewalStage='scoped-anonymous-denial';
  const deny=await scopedPublicRead(origin,'/native-security/scenario1/session','POST');
  if(deny.status!==403||deny.headers['cache-control']!=='no-store')throw Error('Anonymous scope boundary failed');
  renewalStage='encrypted-native-handoff';
  const pairing=await native.evaluate('globalThis.__PETALPAL_NATIVE_SECURITY_AUTHORIZATION__.prepare()');
  if(!/^[a-f0-9]{64}$/.test(pairing?.publicKey))throw Error('Native public key unavailable');
  const ephemeral=nacl.box.keyPair.fromSecretKey(new Uint8Array(randomBytes(32))),nonce=new Uint8Array(randomBytes(24));
  const ciphertext=nacl.box(new Uint8Array(Buffer.from(JSON.stringify({origin,capability:service.token}))),nonce,
    new Uint8Array(Buffer.from(pairing.publicKey,'hex')),ephemeral.secretKey);
  const envelope={publicKey:Buffer.from(ephemeral.publicKey).toString('hex'),nonce:Buffer.from(nonce).toString('hex'),ciphertext:Buffer.from(ciphertext).toString('hex')};
  ephemeral.secretKey.fill(0);
  const acknowledgement=await native.installEncrypted(envelope);
  native.close();
  if(acknowledgement?.ready!==true||acknowledgement.scope!=='scenario-1')throw Error('Secure native handoff not confirmed');
  console.log(JSON.stringify({exactAAuthorizationRenewed:true,nativeSecureStoreHandoff:true,authorizedScenarios:[1],relayOrigin:origin,scenariosStarted:false}));
  let stopping=false;
  const stop=()=>{if(stopping)return;stopping=true;tunnel.kill('SIGTERM');server.close(()=>process.exit(0));void post('revoke',upstream).catch(()=>{})};
  process.once('SIGTERM',stop);process.once('SIGINT',stop);
  tunnel.once('exit',()=>{if(!stopping)stop()});
}
main().catch(async()=>{await cleanupOnFailure();console.error(JSON.stringify({renewalBlocked:true,stage:renewalStage,readinessHttpStatus,readinessFailure}));process.exit(1)});
