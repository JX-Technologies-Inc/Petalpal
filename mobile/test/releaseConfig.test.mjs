import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
const {validateStoreEnvironment}=createRequire(import.meta.url)('../release-config.cjs');
const fixture={PETALPAL_IOS_BUNDLE_ID:'org.petalpal.fixture',PETALPAL_ANDROID_PACKAGE:'org.petalpal.fixture',PETALPAL_IOS_BUILD_NUMBER:'1',PETALPAL_ANDROID_VERSION_CODE:'1',EXPO_PUBLIC_API_BASE_URL:'https://api.test.invalid',EXPO_PUBLIC_PRIVACY_POLICY_URL:'https://policy.test.invalid/privacy',EXPO_PUBLIC_TERMS_URL:'https://policy.test.invalid/terms',EXPO_PUBLIC_DELETION_URL:'https://policy.test.invalid/deletion',EXPO_PUBLIC_SUPPORT_URL:'https://policy.test.invalid/support',EXPO_PUBLIC_FIREBASE_API_KEY:'fixture',EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN:'fixture.invalid',EXPO_PUBLIC_FIREBASE_PROJECT_ID:'fixture',EXPO_PUBLIC_FIREBASE_APP_ID:'fixture'};
test('store configuration fails closed for missing, insecure or placeholder metadata',()=>{
 assert.throws(()=>validateStoreEnvironment({}),/owner-verified/);
 assert.throws(()=>validateStoreEnvironment(fixture),/HTTPS/);
 const valid={...fixture};for(const k of Object.keys(valid).filter(k=>k.endsWith('_URL')))valid[k]=valid[k].replace('test.invalid','petalpal.test');
 assert.doesNotThrow(()=>validateStoreEnvironment(valid));
 for(const url of ['http://petalpal.test','https://127.0.0.1','https://user:secret@petalpal.test','https://petalpal.test/?token=fixture'])assert.throws(()=>validateStoreEnvironment({...valid,EXPO_PUBLIC_API_BASE_URL:url}));
 assert.throws(()=>validateStoreEnvironment({...valid,EXPO_PUBLIC_NATIVE_SECURITY_TEST:'1'}));
});
