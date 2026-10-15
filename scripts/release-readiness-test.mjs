import { spawnSync, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const name = `petalpal-release-${randomUUID().slice(0,8)}`;
const docker = (...args) => execFileSync('docker', args, {encoding:'utf8',timeout:120000}).trim();
const system = Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const run = (args,env) => { const r=spawnSync(process.execPath,args,{env,stdio:'inherit',timeout:240000}); if(r.status!==0) throw new Error('Isolated command failed'); };
try {
  docker('run','-d','--rm','--name',name,'-e','POSTGRES_USER=fixture','-e','POSTGRES_PASSWORD=fixture','-e','POSTGRES_DB=petalpal_test','-p','127.0.0.1::5432','pgvector/pgvector:pg16');
  const port = docker('port',name,'5432/tcp').split(':').at(-1);
  let ready=false;
  // The image briefly starts a Unix-socket-only initialization server. Wait
  // for the final TCP server, not that temporary initialization process.
  for(let n=0;n<40;n++){try{docker('exec',name,'pg_isready','-h','127.0.0.1','-U','fixture','-d','petalpal_test');ready=true;break;}catch{await new Promise(r=>setTimeout(r,250));}}
  if(!ready)throw new Error('Disposable database did not become ready');
  const env = {...system,NODE_ENV:'test',DOTENV_CONFIG_PATH:'/dev/null',DEV_DATABASE_URL:`postgresql://fixture:fixture@127.0.0.1:${port}/petalpal_test`,REAL_POSTGRES_DATABASE_URL:`postgresql://fixture:fixture@127.0.0.1:${port}/petalpal_test`,PETALPAL_RELEASE_ISOLATED:'1',AI_ASYNC_EXECUTION_MODE:'manual',RATE_LIMIT_GENERAL_MAX:'10000',RATE_LIMIT_AI_MAX:'1000',MODERATOR_FIREBASE_UIDS:'moderator'};
  const args=process.argv.slice(2);
  if(args.length===1 && args[0]==='--upgrade') {
    run(['--test','test/back/release-upgrade.postgres.test.js'],env);
  } else {
    if(args.some(arg=>!/^test\/back\/[A-Za-z0-9.-]+\.test\.js$/.test(arg))) throw new Error('Only local backend tests are accepted');
    run(['node_modules/prisma/build/index.js','migrate','deploy'],env);
    run(['--test',...(args.length?args:['test/back/release-readiness.test.js'])],env);
  }
} finally { try{docker('rm','-f',name);}catch{} }
