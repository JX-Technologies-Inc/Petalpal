// Render the actual source-water SkSL with CanvasKit; no production PNG writes.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const mobile = path.join(root, 'mobile');
const init = require('canvaskit-wasm/bin/full/canvaskit.js');
const output = path.join(root, 'output/water-top-correction');
const read = p => fs.readFileSync(path.join(mobile, p), 'utf8');
const assembly = read('src/components/garden/water/WaterTopAssembly.tsx');
const shaderSource = assembly.match(/Skia\.RuntimeEffect\.Make\(`([\s\S]*?)`\)/)[1];
const placementSource = read('src/components/garden/waterTopPlacement.ts');
const value = key => Number(placementSource.match(new RegExp(`\\b${key}:\\s*(-?[\\d.]+)`))[1]);
const top = { x:value('x'), y:value('y'), scale:value('scale'), rotation:value('rotation') };
const cliffX=value('cliffOffsetX'), cliffY=value('cliffOffsetY'), cliffScale=value('cliffScale');

init({locateFile:f=>require.resolve('canvaskit-wasm/bin/full/'+f)}).then(CK=>{
  fs.mkdirSync(output,{recursive:true});
  const effect=CK.RuntimeEffect.Make(shaderSource);
  if(!effect) throw Error('Production surface shader did not compile');
  const bankEffect=CK.RuntimeEffect.Make('uniform shader bank; half4 main(float2 p){return bank.eval(p)*clamp((p.y-700.0)/90.0,0.0,1.0);}');
  const load=p=>{const img=CK.MakeImageFromEncoded(fs.readFileSync(path.join(mobile,p)));if(!img)throw Error('Decode: '+p);return img;};
  const water=load('assets/garden/water/water-top/source-water-bespoke-v1.png');
  const cliff=load('assets/garden/water/water-top/source-banks-bespoke-v1.png');
  const child=im=>im.makeShaderOptions(CK.TileMode.Decal,CK.TileMode.Decal,CK.FilterMode.Linear,CK.MipmapMode.None);
  const waterShader=child(water), bankShader=child(cliff);
  const frames=[['waterfall-static',0,0],['waterfall_main_body_A',0,60],['waterfall_main_highlight_A',0,60],['waterfall_crest_A',0,60],['waterfall_secondary_body_A',28,0],['waterfall_secondary_highlight_A',28,0],['waterfall_impact_foam_A',0,184],['waterfall_splash_particles_A',0,184],['waterfall_mist_A',0,164]]
    .map(([name,x,y])=>({image:load('assets/garden/landmarks/waterfall/map-animation/'+name+'.png'),x,y}));
  const paint=new CK.Paint(); paint.setAntiAlias(true);
  function parent(c,p,w,h,sy=1){const cx=p.x+w*p.scale/2,cy=p.y+h*p.scale/2;c.translate(cx,cy);c.rotate(p.rotation,0,0);c.scale(1,sy);c.translate(-cx,-cy);c.translate(p.x,p.y);c.scale(p.scale,p.scale);}
  function drawImage(c,im,x=0,y=0,s=1){paint.setShader(null);c.drawImageRect(im,CK.XYWHRect(0,0,im.width(),im.height()),CK.XYWHRect(x,y,im.width()*s,im.height()*s),paint);}
  function drawWater(c,seconds,motion,outlet){const shader=effect.makeShaderWithChildren([seconds,motion,outlet],[waterShader]);paint.setShader(shader);c.drawRect(CK.XYWHRect(0,0,1536,1024),paint);paint.setShader(null);shader.delete();}
  const phone=process.argv.includes('--phone');
  const samples=phone ? Array.from({length:24},(_,i)=>['phone-'+i,i/4,1]) :
    [['static',0,0],['motion-0',0,1],['motion-1_5',1.5,1],['motion-3',3,1],['motion-4_5',4.5,1]];
  for(const [label,seconds,motion] of samples){
    const zoom=phone ? 0.9 : 3;
    const surface=CK.MakeSurface(Math.round(420*zoom),Math.round(500*zoom)), c=surface.getCanvas();c.clear(CK.Color(107,191,200));
    c.scale(zoom,zoom);c.translate(-800,170);
    c.save();parent(c,top,1536,1024);drawWater(c,seconds,motion,0);
    c.save();c.translate(cliffX,cliffY);c.scale(cliffScale,cliffScale);drawImage(c,cliff);c.restore();c.restore();
    c.save();parent(c,{x:930,y:45,scale:0.17,rotation:-2.5},1199,1312,0.96);
    for(const f of frames)drawImage(c,f.image,f.x,f.y,2);c.restore();
    c.save();parent(c,top,1536,1024);drawWater(c,seconds,motion,1);
    c.translate(cliffX+value('bankOffsetX'),cliffY+value('bankOffsetY'));
    c.scale(cliffScale*value('bankScale'),cliffScale*value('bankScale'));
    const front=bankEffect.makeShaderWithChildren([],[bankShader]);paint.setShader(front);
    c.drawRect(CK.XYWHRect(0,0,1536,1024),paint);paint.setShader(null);front.delete();c.restore();
    surface.flush();const snapshot=surface.makeImageSnapshot();
    fs.writeFileSync(path.join(output,label+'.png'),snapshot.encodeToBytes());snapshot.delete();surface.dispose();
  }
  if(phone)fs.writeFileSync(path.join(output,'phone-motion.html'),`<!doctype html><meta name="viewport" content="width=device-width"><title>Water-top actual shader samples</title><style>body{background:#263e41;color:white;font:14px system-ui}img{width:378px;max-width:100%}</style><p>Actual source-water shader, 24 samples / 6 seconds. Waterfall held on A for comparison.</p><button onclick="playing=!playing">Pause / Play</button><p><img id="preview" src="phone-0.png"></p><script>let playing=true,i=0;setInterval(()=>{if(playing)document.getElementById('preview').src='phone-'+(++i%24)+'.png'},250)</script>`);
  console.log('Production SkSL compiled. Rendered static and 0/1.5/3/4.5-second motion samples to '+output);
  console.log('Preserved placement:',JSON.stringify(top));
  // Check real shader output, including invisible alpha and the hidden UV reset.
  function sample(seconds) {
    const surface=CK.MakeSurface(384,256),c=surface.getCanvas();
    c.clear(CK.TRANSPARENT);c.scale(0.25,0.25);drawWater(c,seconds,1,0);
    surface.flush();
    const pixels=c.readPixels(0,0,{width:384,height:256,colorType:CK.ColorType.RGBA_8888,
      alphaType:CK.AlphaType.Unpremul,colorSpace:CK.ColorSpace.SRGB});
    const copy=Uint8Array.from(pixels);surface.dispose();return copy;
  }
  const first=sample(0),later=sample(1.5),before=sample(5.999),after=sample(6.001);
  let changed=0,alphaChanges=0,resetError=0;
  for(let i=0;i<first.length;i+=4){
    if(first[i+3]!==later[i+3])alphaChanges++;
    if(first[i]!==later[i]||first[i+1]!==later[i+1]||first[i+2]!==later[i+2])changed++;
    for(let j=0;j<3;j++)resetError+=Math.abs(before[i+j]-after[i+j]);
  }
  const resetMean=resetError/(first.length/4*3);
  if(alphaChanges!==0||changed<100||resetMean>0.2)throw Error('Flow regression: '+JSON.stringify({changed,alphaChanges,resetMean}));
  console.log('Shader checks passed:',JSON.stringify({changedPixels:changed,alphaChanges,resetMeanByteError:resetMean}));
}).catch(error=>{console.error(error);process.exitCode=1;});
