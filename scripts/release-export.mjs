// Compilation evidence only: synthetic public client configuration, no login,
// inference, EAS operation or deploy. Output is NOT a distributable release.
import {spawnSync} from 'node:child_process';
const inherited=Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const env={...inherited,CI:'1',NODE_ENV:'production',EXPO_NO_DOTENV:'1',EXPO_PUBLIC_API_BASE_URL:'https://api.example.invalid',EXPO_PUBLIC_FIREBASE_API_KEY:'synthetic-export-only',EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN:'synthetic-export.firebaseapp.com',EXPO_PUBLIC_FIREBASE_PROJECT_ID:'synthetic-export',EXPO_PUBLIC_FIREBASE_APP_ID:'synthetic-export-only'};
const result=spawnSync(process.execPath,['node_modules/expo/bin/cli','export','--platform','all','--max-workers','2'],{cwd:'mobile',env,stdio:'inherit',timeout:600000});
if(result.error)throw result.error;process.exitCode=result.status??1;
