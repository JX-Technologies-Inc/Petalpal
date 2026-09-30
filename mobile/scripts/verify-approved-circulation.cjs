const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),source=path.resolve(root,'../Resources/bridges/approved-circulation'),runtime=path.join(root,'assets/garden/bridges/approved-circulation');
const manifest=JSON.parse(fs.readFileSync(path.join(source,'manifest.json'),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
require('canvaskit-wasm/bin/full/canvaskit.js')({locateFile:f=>require.resolve('canvaskit-wasm/bin/full/'+f)}).then(CK=>{
 const report={assets:[],checks:[],runtimeVerification:'Browser /garden-test required in addition to these asset checks.'};
 for(const p of manifest.pieces){assert.equal(hash(path.join(source,p.file)),hash(path.join(runtime,p.file)));const im=CK.MakeImageFromEncoded(fs.readFileSync(path.join(source,p.file)));const pixels=im.readPixels(0,0,{width:im.width(),height:im.height(),colorType:CK.ColorType.RGBA_8888,alphaType:CK.AlphaType.Unpremul,colorSpace:CK.ColorSpace.SRGB});let clear=0,soft=0;for(let i=3;i<pixels.length;i+=4){if(!pixels[i])clear++;else if(pixels[i]<255)soft++;}assert(clear>0&&soft>0,p.id+' must have transparent antialiased edges');report.assets.push({id:p.id,sha256:hash(path.join(source,p.file)),width:im.width(),height:im.height(),transparent:clear,antialiased:soft});p.im=im;}
 assert.equal(hash(path.join(source,'manifest.json')),hash(path.join(runtime,'manifest.json')));
 function alpha(id,x,y){const p=manifest.pieces.find(p=>p.id===id),ix=Math.floor((x-p.x)/p.width*p.im.width()),iy=Math.floor((y-p.y)/p.height*p.im.height());if(ix<0||iy<0||ix>=p.im.width()||iy>=p.im.height())return 0;return p.im.readPixels(ix,iy,{width:1,height:1,colorType:CK.ColorType.RGBA_8888,alphaType:CK.AlphaType.Unpremul,colorSpace:CK.ColorSpace.SRGB})[3];}
 for(const id of ['central-land08-stair','land08-main-bridge']){const p=manifest.pieces.find(p=>p.id===id);for(let i=0;i<=20;i++){const t=i/20,x=p.start[0]+t*(p.end[0]-p.start[0]),y=p.start[1]+t*(p.end[1]-p.start[1]);assert(alpha(id,x,y)>240,id+' pavement continuity '+i);}report.checks.push(id+' continuous painted walking centerline');}
 for(const p of manifest.openings){for(let i=0;i<=10;i++){const t=i/10,a=p.centerline[0],b=p.centerline[1],x=a[0]+(b[0]-a[0])*(.02+t*.96),y=a[1]+(b[1]-a[1])*(.02+t*.96);assert(alpha(p.id,x,y)>240,p.id+' shore occlusion');}report.checks.push(p.id+' opaque local shore replacement');}
 for(const point of [[1400,1460],[1500,1500],[1610,1540],[1600,1750],[1640,2200],[1700,2900],[1710,4200],[1500,1755],[1710,1755]]){assert(alpha('main-road-connected',...point)>200,'Supported road/arch '+point);}
 report.checks.push('Land09 to off-map road continuous; both arch feet supported');
 const code=fs.readFileSync(path.join(root,'src/components/garden/GardenConnectionLayer.tsx'),'utf8');
 assert(!code.includes('<Path')&&!code.includes('<ImageShader')&&!code.includes('connections.stairs'));
 assert(code.includes("piece.id === 'main-road-connected'"));
 assert(!code.includes('PaintedPiece') && !code.includes('qingshi-arch-r1') && !code.includes('gardenConnections.json'));
 report.checks.push('Only entrance road remains active; historical circulation assets still intact');
 fs.mkdirSync(path.resolve(root,'../output/garden-circulation'),{recursive:true});
 fs.writeFileSync(path.resolve(root,'../output/garden-circulation/runtime-asset-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
});
