import {spawnSync} from 'node:child_process';
const inherited=Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const env={...inherited,NODE_ENV:'test',DOTENV_CONFIG_PATH:'/dev/null',DEV_DATABASE_URL:'postgresql://fixture:fixture@127.0.0.1:1/petalpal_test',EXPO_NO_DOTENV:'1'};
const files=process.argv.slice(2);
if(!files.length||files.some(f=>!/^test\/back\/[A-Za-z0-9.-]+\.test\.js$|^mobile\/test\/[A-Za-z0-9.-]+\.test\.mjs$/.test(f)))throw new Error('Pass only local backend/mobile test paths');
const result=spawnSync(process.execPath,['--test','--test-concurrency=2',...files],{env,stdio:'inherit',timeout:300000});
if(result.error)throw result.error;process.exitCode=result.status??1;
