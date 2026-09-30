// QA only: render the production SkSL and checked-in nearby scene geometry.
// No artwork is edited. Full React Native / physical device QA is separate.
const fs=require('node:fs'),path=require('node:path');
const mobile=path.resolve(__dirname,'..'),root=path.dirname(mobile);
const out=path.join(root,'output/waterfall-v2-transition');
const read=p=>fs.readFileSync(path.join(mobile,p),'utf8');
const source=read('src/components/garden/WaterfallV2Entity.tsx');
const placement=read('src/components/garden/waterfallV2Placement.ts');
const val=k=>Number(placement.match(new RegExp('\\b'+k+':\\s*(-?[\\d.]+)'))[1]);
const WIDTH=Number(placement.match(/WATERFALL_V2_WIDTH = (\d+)/)[1]);
const HEIGHT=Number(placement.match(/WATERFALL_V2_HEIGHT = (\d+)/)[1]);
const OFFSET=Number(placement.match(/WATERFALL_V2_CONTENT_OFFSET_Y = (\d+)/)[1]);
const spraySource=read('src/components/garden/water/WaterfallV2Spray.tsx');
const impactSource=read('src/components/garden/water/WaterfallV2Impact.tsx');
const emitters=JSON.parse(spraySource.match(/SPRAY_EMITTERS = (\[[\s\S]*?\]) as const/)[1]);
const init=require('canvaskit-wasm/bin/full/canvaskit.js');
init({locateFile:f=>require.resolve('canvaskit-wasm/bin/full/'+f)}).then(CK=>{
 fs.mkdirSync(out,{recursive:true});
 const load=p=>{const im=CK.MakeImageFromEncoded(fs.readFileSync(path.join(mobile,p)));if(!im)throw Error(p);return im;};
 const art=load(source.match(/require\('@\/([^']+)'\)/)[1]);
 const effect=CK.RuntimeEffect.Make(source.match(/Skia.RuntimeEffect.Make\(`([\s\S]*?)`\)/)[1]);
 if(!effect)throw Error('V2 shader compilation failed');
 const sprayEffect=CK.RuntimeEffect.Make(spraySource.match(/Skia.RuntimeEffect.Make\(`([\s\S]*?)`\)/)[1]);
 if(!sprayEffect)throw Error('Spray shader compilation failed');
 const impactEffect=CK.RuntimeEffect.Make(impactSource.match(/Skia.RuntimeEffect.Make\(`([\s\S]*?)`\)/)[1]);
 if(!impactEffect)throw Error('Impact shader compilation failed');
 const oldSource=fs.readFileSync(path.join(out,'before/WaterfallV2Entity.tsx'),'utf8');
 const oldEffect=CK.RuntimeEffect.Make(oldSource.match(/Skia.RuntimeEffect.Make\(`([\s\S]*?)`\)/)[1]);
 const texture=art.makeShaderOptions(CK.TileMode.Clamp,CK.TileMode.Clamp,CK.FilterMode.Linear,CK.MipmapMode.None,CK.Matrix.scaled(WIDTH/art.width(),HEIGHT/art.height()));
 const paint=new CK.Paint();paint.setAntiAlias(true);
 function draw(c,t,on,spray=false,old=false){const sh=(old?oldEffect:effect).makeShaderWithChildren([t,on],[texture]);paint.setShader(sh);c.drawRect(CK.XYWHRect(0,0,WIDTH,HEIGHT),paint);paint.setShader(null);sh.delete();if(spray){c.save();c.translate(0,OFFSET);const impact=impactEffect.makeShaderWithChildren([t,on],[texture]);paint.setShader(impact);c.drawRect(CK.XYWHRect(230,1485,660,410),paint);paint.setShader(null);impact.delete();if(on)for(const e of emitters){const s=sprayEffect.makeShader([t,on,e.originX,e.originY,e.power,e.direction,e.seed]);paint.setShader(s);c.drawRect(CK.XYWHRect(e.x,e.y,e.width,e.height),paint);paint.setShader(null);s.delete();}c.restore();}}
 function image(c,im,x,y,w,h){c.drawImageRect(im,CK.XYWHRect(0,0,im.width(),im.height()),CK.XYWHRect(x,y,w,h),paint);}
 function parent(c,x,y,s,r,w,h){c.translate(x+w*s/2,y+h*s/2);c.rotate(r,0,0);c.translate(-w*s/2,-h*s/2);c.scale(s,s);}
 const lands=[...read('src/components/garden/gardenMapLayout.ts').matchAll(/source: require\('(@[^']+)'\), x: ([-\d.]+), y: ([-\d.]+), width: ([-\d.]+), rotation: ([-\d.]+)/g)].map(m=>({im:load(m[1].replace('@/','')),x:+m[2],y:+m[3],w:+m[4],r:+m[5]}));
 const treeNames=['tree-base','canopy-overlay','wisteria-overlay','foreground-overlay','mailbox'];
 const trees=treeNames.map(n=>({name:n,im:load('assets/garden/landmarks/treehouse/'+n+'.png')}));
 const treeText=read('src/components/garden/treehouseMapPlacement.ts');
 const tv=k=>Number(treeText.match(new RegExp('TREEHOUSE_MAP_'+k+' = ([-\\d.]+)'))[1]);
 const base=load('assets/garden/water/water_base_calm_preview.png');
 const pav=load('assets/garden/landmarks/pavilion.png');
 const staticText=read('src/components/garden/staticLandmarkMapPlacements.ts');
 const pavilion=staticText.match(/pavilion:\s*\{([^}]+)\}/)[1];
 const pv=k=>Number(pavilion.match(new RegExp(k+':\\s*(-?[\\d.]+)'))[1]);
 for(let i=-1;i<(process.argv.includes('--still')?0:36);i++){
   const s=CK.MakeSurface(600,1067),c=s.getCanvas();c.clear(CK.Color(120,184,178));
   c.scale(.6,.6);c.translate(-530,650);
   image(c,base,0,0,2400,1800);
   c.save();parent(c,val('x'),val('y'),val('scale'),val('rotation'),WIDTH,HEIGHT);draw(c,Math.max(i,0)/12,i<0?0:1,true);c.restore();
   for(const l of lands){const h=l.w*l.im.height()/l.im.width();c.save();parent(c,l.x,l.y,1,l.r,l.w,h);image(c,l.im,0,0,l.w,h);c.restore();}
   for(const t of trees)image(c,t.im,tv('X')+(t.name==='mailbox'?60*tv('SCALE'):0),tv('Y')+(t.name==='mailbox'?135*tv('SCALE'):0),1448*tv('SCALE'),1086*tv('SCALE'));
   image(c,pav,pv('x'),pv('y'),1214*pv('scale'),1295*pv('scale'));
   s.flush();const shot=s.makeImageSnapshot();fs.writeFileSync(path.join(out,i<0?'scene-static.png':`scene-${i}.png`),shot.encodeToBytes());shot.delete();s.dispose();
 }
 function sample(t,on,composite=false,old=false){const s=CK.MakeSurface(WIDTH/2,HEIGHT/2),c=s.getCanvas();c.clear(CK.TRANSPARENT);c.scale(.5,.5);draw(c,t,on,composite,old);s.flush();const p=c.readPixels(0,0,{width:WIDTH/2,height:HEIGHT/2,colorType:CK.ColorType.RGBA_8888,alphaType:CK.AlphaType.Unpremul,colorSpace:CK.ColorSpace.SRGB});const a=Uint8Array.from(p);s.dispose();return a;}
 const previous=sample(.41,1,false,true),current=sample(.41,1),impactA=sample(0,1,true),impactB=sample(.41,1,true);
 let preservedRegionChanges=0,bottomMotionPixels=0,oldWhiteCoverage=0,newWhiteCoverage=0;
 for(let y=0;y<HEIGHT/2;y++)for(let x=0;x<WIDTH/2;x++){
   const j=(y*512+x)*4;
   if(y<(1460+OFFSET)/2&&[0,1,2,3].some(k=>previous[j+k]!==current[j+k]))preservedRegionChanges++;
   if(y>(1490+OFFSET)/2&&[0,1,2].some(k=>Math.abs(impactA[j+k]-impactB[j+k])>5))bottomMotionPixels++;
   if(y>(1530+OFFSET)/2&&y<(1650+OFFSET)/2&&x>180&&x<380&&Math.min(previous[j],previous[j+1],previous[j+2])>190){oldWhiteCoverage+=previous[j+3];newWhiteCoverage+=current[j+3];}
 }
 if(preservedRegionChanges||bottomMotionPixels<1000)throw Error(JSON.stringify({preservedRegionChanges,bottomMotionPixels}));
 const a=sample(0,1),b=sample(.41,1),off=sample(0,0),offLater=sample(8,0),pre=sample(2.899,1),post=sample(2.901,1);
 let alpha=0,changed=0,banks=0,staticChanges=0,reset=0;const columns=[0,0,0];
 for(let y=0;y<HEIGHT/2;y++)for(let x=0;x<WIDTH/2;x++){
   const j=(y*512+x)*4;const d=a[j]!==b[j]||a[j+1]!==b[j+1]||a[j+2]!==b[j+2];
   if(d){changed++;if(x<100||x>460)banks++;if(y<270&&x>=155&&x<350)columns[Math.min(2,Math.floor((x-155)/65))]++;}
   if(a[j+3]!==b[j+3])alpha++;
   for(let k=0;k<4;k++)if(off[j+k]!==offLater[j+k])staticChanges++;
   for(let k=0;k<3;k++)reset+=Math.abs(pre[j+k]-post[j+k]);
 }
 const resetMean=reset/(a.length/4*3);
 const foregroundWhiteCoverageReduction=1-newWhiteCoverage/Math.max(oldWhiteCoverage,1);
 // Coverage is not the target: this revision replaces punched holes with color dissipation.
 const report={decoded:[art.width(),art.height()],placement:{x:val('x'),y:val('y'),scale:val('scale'),rotation:val('rotation')},foregroundWhiteCoverageReduction,preservedRegionChanges,bottomMotionPixels,changed,upstreamChangedLeftCenterRight:columns,alphaChanges:alpha,outerBankChanges:banks,staticChanges,resetMean};
 if(alpha||banks||staticChanges||columns.some(n=>n<1000)||resetMean>1)throw Error(JSON.stringify(report));
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));
 fs.writeFileSync(path.join(out,'motion.html'),'<!doctype html><meta name="viewport" content="width=device-width"><title>Waterfall V2 production shader QA</title><style>body{background:#223d3c;color:white;font:14px system-ui}img{max-width:100%;width:420px}</style><p>Production shader + checked-in lands, treehouse, pavilion. Camera crop for QA; other animated systems omitted.</p><button onclick="play=!play">Pause / Play</button><p><img id="f" src="scene-0.png"></p><script>let i=0,play=true;setInterval(()=>{if(play)document.getElementById("f").src="scene-"+(++i%36)+".png"},1000/12)</script>');
 console.log(JSON.stringify(report));
}).catch(e=>{console.error(e);process.exitCode=1});
