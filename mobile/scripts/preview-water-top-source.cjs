// Verify the current complete sprite with its actual production SkSL.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),mobile=path.join(root,'mobile');
const out=path.join(root,'output/water-top-cliff-source-v2');
const src=fs.readFileSync(path.join(mobile,'src/components/garden/water/WaterTopSource.tsx'),'utf8');
const init=require('canvaskit-wasm/bin/full/canvaskit.js');
init({locateFile:f=>require.resolve('canvaskit-wasm/bin/full/'+f)}).then(CK=>{
 fs.mkdirSync(out,{recursive:true});
 const load=p=>CK.MakeImageFromEncoded(fs.readFileSync(path.join(mobile,p)));
 const top=load('assets/garden/water/water-top/water-top-cliff-source-v2.png');
 if(top.height()!==top.width()*2)throw Error('Canvas aspect mismatch');
 const effect=CK.RuntimeEffect.Make(src.match(/Skia.RuntimeEffect.Make\(`([\s\S]*?)`\)/)[1]);
 if(!effect)throw Error('Shader compile failed');
 const texture=top.makeShaderOptions(CK.TileMode.Clamp,CK.TileMode.Clamp,CK.FilterMode.Linear,CK.MipmapMode.None,CK.Matrix.scaled(1536/top.width(),3072/top.height()));
 const paint=new CK.Paint();paint.setAntiAlias(true);
 const frames=[['waterfall-static',0,0],['waterfall_main_body_A',0,60],['waterfall_main_highlight_A',0,60],['waterfall_crest_A',0,60],['waterfall_secondary_body_A',28,0],['waterfall_secondary_highlight_A',28,0],['waterfall_impact_foam_A',0,184],['waterfall_splash_particles_A',0,184],['waterfall_mist_A',0,164]].map(([name,x,y])=>({image:load('assets/garden/landmarks/waterfall/map-animation/'+name+'.png'),x,y}));
 const placementText=fs.readFileSync(path.join(mobile,'src/components/garden/waterTopPlacement.ts'),'utf8');
 const val=k=>Number(placementText.match(new RegExp('\\b'+k+':\\s*(-?[\\d.]+)'))[1]);
 function transform(c,x,y,s,r,w,h,sy=1){const cx=x+w*s/2,cy=y+h*s/2;c.translate(cx,cy);c.rotate(r,0,0);c.scale(1,sy);c.translate(-cx,-cy);c.translate(x,y);c.scale(s,s);}
 function draw(c,t,on){const shader=effect.makeShaderWithChildren([t,on],[texture]);paint.setShader(shader);c.drawRect(CK.XYWHRect(0,0,1536,3072),paint);paint.setShader(null);shader.delete();}
 for(let i=-1;i<16;i++){
  const surface=CK.MakeSurface(420,540),c=surface.getCanvas();c.clear(CK.Color(107,191,200));c.translate(-800,200);
  c.save();transform(c,930,45,.17,-2.5,1199,1312,.96);
  for(const f of frames)c.drawImageRect(f.image,CK.XYWHRect(0,0,f.image.width(),f.image.height()),CK.XYWHRect(f.x,f.y,f.image.width()*2,f.image.height()*2),paint);c.restore();
  c.save();transform(c,val('x'),val('y'),val('scale'),val('rotation'),1536,1024);c.translate(0,-1536);draw(c,Math.max(0,i)/4,i<0?0:1);c.restore();surface.flush();
  const snapshot=surface.makeImageSnapshot();fs.writeFileSync(path.join(out,i<0?'static.png':`frame-${i}.png`),snapshot.encodeToBytes());snapshot.delete();surface.dispose();
 }
 function sample(t,on){const s=CK.MakeSurface(1536,3072),c=s.getCanvas();c.clear(CK.TRANSPARENT);draw(c,t,on);s.flush();const p=c.readPixels(0,0,{width:1536,height:3072,colorType:CK.ColorType.RGBA_8888,alphaType:CK.AlphaType.Unpremul,colorSpace:CK.ColorSpace.SRGB});const r=Uint8Array.from(p);s.dispose();return r;}
 const a=sample(0,1),b=sample(1.5,1);let changed=0,alpha=0,banks=0;
 for(let y=0;y<3072;y++)for(let x=0;x<1536;x++){const i=(y*1536+x)*4;const diff=a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2];if(diff)changed++;if(a[i+3]!==b[i+3])alpha++;if(diff&&(x<600||x>960||y>2420))banks++;}
 if(alpha||banks||changed<100)throw Error(JSON.stringify({alpha,banks,changed}));
 fs.writeFileSync(path.join(out,'motion.html'),'<!doctype html><meta name="viewport" content="width=device-width"><title>Central mouth flow review</title><style>body{background:#263e41;color:white;font:14px system-ui}img{max-width:100%;width:420px}</style><p>Actual shader samples; existing waterfall held on frame A.</p><button onclick="play=!play">Pause / Play</button><p><img id="f" src="frame-0.png"></p><script>let i=0,play=true;setInterval(()=>{if(play)document.getElementById("f").src="frame-"+(++i%16)+".png"},250)</script>');
 console.log(JSON.stringify({canvas:[top.width(),top.height()],changedWaterPixels:changed,changedAlpha:alpha,changedBanks: banks,output:out}));
}).catch(e=>{console.error(e);process.exitCode=1});
