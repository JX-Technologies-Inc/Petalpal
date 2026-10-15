const {validateStoreEnvironment}=require('./release-config.cjs');
module.exports=({config})=>{
 const env=process.env;
 if(env.EAS_BUILD_PROFILE==='production'||env.PETALPAL_STORE_BUILD==='1')validateStoreEnvironment(env);
 return {...config,name:'PetalPal',
  ios:{...config.ios,...(env.PETALPAL_IOS_BUNDLE_ID?{bundleIdentifier:env.PETALPAL_IOS_BUNDLE_ID}:{}),...(env.PETALPAL_IOS_BUILD_NUMBER?{buildNumber:env.PETALPAL_IOS_BUILD_NUMBER}:{}),supportsTablet:false},
  android:{...config.android,...(env.PETALPAL_ANDROID_PACKAGE?{package:env.PETALPAL_ANDROID_PACKAGE}:{}),...(env.PETALPAL_ANDROID_VERSION_CODE?{versionCode:Number(env.PETALPAL_ANDROID_VERSION_CODE)}:{})},
 };
};
