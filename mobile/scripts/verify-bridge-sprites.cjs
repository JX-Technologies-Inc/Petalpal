const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),folder=path.join(root,'Resources/decorations/bridge/rendered');
const read=name=>JSON.parse(fs.readFileSync(path.join(folder,name+'.json')));
const reference=read('bridge_camera_55');
const samples=[0,45,90,135].map(a=>read('orbit_verification/bridge_orbit_verify_'+a));
samples.push(read('bridge_current_view'));
for(const m of samples){
 assert.equal(m.fixedGeometrySha256,samples[0].fixedGeometrySha256);
 assert.deepEqual(m.fixedBridgeTransform,samples[0].fixedBridgeTransform);
 assert.deepEqual(m.path,reference.path);assert.deepEqual(m.geometry,reference.geometry);
 assert.deepEqual(m.placement,{x:1722,y:1342,scale:.1753});
 const [x,y,z]=m.camera.location,t=m.camera.target;
 assert(Math.abs(Math.hypot(x-t[0],y-t[1])-12)<1e-5);
 assert(Math.abs(Math.atan2(z-t[2],Math.hypot(x-t[0],y-t[1]))*180/Math.PI-55)<1e-5);
 assert(Math.abs(m.camera.orthoScale-7.8)<1e-5);
 for(const [name,i] of [['EntryA',0],['Crest',16],['EntryB',32]]){
  const p=m.path[i],v=m.projection;
  for(const axis of ['x','y'])assert(Math.abs(p.x*v.along[axis]+p.y*v.across[axis]+p.elevation*v.elevation[axis]-m.projectedMarkers[name][axis])<.001);
 }
}
assert.equal(new Set(samples.slice(0,4).map(m=>m.imageSha256)).size,4);
const renderCode=fs.readFileSync(path.join(root,'mobile/src/components/garden/GardenBridge.tsx'),'utf8');
assert(!/\{\s*(rotate|scaleX|scaleY)\s*:/.test(renderCode));
const files=[...['0','45','90','135'].map(a=>'orbit_verification/bridge_orbit_verify_'+a),'bridge_current_view'];
require('canvaskit-wasm/bin/full/canvaskit.js')({locateFile:f=>require.resolve('canvaskit-wasm/bin/full/'+f)}).then(CK=>{
 for(const name of files){
  const bytes=fs.readFileSync(path.join(folder,name+'.png')),m=read(name);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),m.imageSha256);
  const image=CK.MakeImageFromEncoded(bytes),w=image.width(),h=image.height();assert.equal(w,1536);assert.equal(h,1280);
  const rgba=image.readPixels(0,0,{width:w,height:h,colorType:CK.ColorType.RGBA_8888,alphaType:CK.AlphaType.Unpremul,colorSpace:CK.ColorSpace.SRGB});
  let clear=0,opaque=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=rgba[(y*w+x)*4+3];if(a===0)clear++;else opaque++;if(x===0||y===0||x===w-1||y===h-1)assert.equal(a,0);}
  assert(clear>0&&opaque>0);image.delete();
 }
 for(const ext of ['png','json'])assert(fs.readFileSync(path.join(folder,'bridge_current_view.'+ext)).equals(fs.readFileSync(path.join(root,'mobile/assets/garden/decorations/bridge/rendered/bridge_current_view.'+ext))));
 console.log('PASS: fixed geometry/root/local path; 55-degree elevation; radius/scale; projected markers; distinct orbit views; RGBA padding; matching runtime; no bitmap rotation');
}).catch(e=>{console.error(e);process.exitCode=1});
