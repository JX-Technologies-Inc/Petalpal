// Deterministic asset extraction from the user-approved blueprint. No generation.
// Run: node scripts/build-approved-circulation.cjs <approved-detail.png>
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const sourceDir = path.resolve(root, '../Resources/bridges/approved-circulation');
const runtimeDir = path.join(root, 'assets/garden/bridges/approved-circulation');
const input = process.argv[2] || path.join(sourceDir, 'approved-detail.png');
require('canvaskit-wasm/bin/full/canvaskit.js')({locateFile:f=>require.resolve('canvaskit-wasm/bin/full/'+f)}).then(CK => {
  fs.mkdirSync(sourceDir,{recursive:true}); fs.mkdirSync(runtimeDir,{recursive:true});
  if (path.resolve(input)!==path.join(sourceDir,'approved-detail.png')) fs.copyFileSync(input,path.join(sourceDir,'approved-detail.png'));
  const art=CK.MakeImageFromEncoded(fs.readFileSync(input));
  const paint=new CK.Paint(); paint.setAntiAlias(true);
  const rgba=art.readPixels(0,0,{width:art.width(),height:art.height(),colorType:CK.ColorType.RGBA_8888,alphaType:CK.AlphaType.Unpremul,colorSpace:CK.ColorSpace.SRGB});
  const cutPixels=new Uint8Array(rgba);
  for(let i=0;i<cutPixels.length;i+=4) {
    if(cutPixels[i+1]>cutPixels[i]*1.38&&cutPixels[i+2]>cutPixels[i]*1.48)cutPixels[i+3]=0;
  }
  const cutArt=CK.MakeImage({width:art.width(),height:art.height(),colorType:CK.ColorType.RGBA_8888,alphaType:CK.AlphaType.Unpremul,colorSpace:CK.ColorSpace.SRGB},cutPixels,art.width()*4);
  const manifest={version:1,source:'approved-detail.png',pieces:[],openings:[]};
  function save(name,s,bounds,extra={}) {
    s.flush(); const bytes=s.makeImageSnapshot().encodeToBytes();
    fs.writeFileSync(path.join(sourceDir,name+'.png'),bytes);fs.writeFileSync(path.join(runtimeDir,name+'.png'),bytes);
    manifest.pieces.push({id:name,file:name+'.png',x:bounds[0],y:bounds[1],width:bounds[2],height:bounds[3],...extra});s.dispose();
  }
  function cut(name,polygon,start,end,targetStart,targetEnd,width,bounds,sourceWidth=88) {
    const s=CK.MakeSurface(bounds[2]*2,bounds[3]*2),c=s.getCanvas();c.clear(CK.TRANSPARENT);c.scale(2,2);c.translate(-bounds[0],-bounds[1]);
    const sx=end[0]-start[0],sy=end[1]-start[1],dx=targetEnd[0]-targetStart[0],dy=targetEnd[1]-targetStart[1];
    c.translate(...targetStart);c.rotate(Math.atan2(dy,dx)*180/Math.PI,0,0);c.scale(Math.hypot(dx,dy)/Math.hypot(sx,sy),width/sourceWidth);c.rotate(-Math.atan2(sy,sx)*180/Math.PI,0,0);c.translate(-start[0],-start[1]);
    c.clipPath(CK.Path.MakeFromSVGString(polygon),CK.ClipOp.Intersect,true);c.drawImage(cutArt,0,0,paint);
    save(name,s,bounds,{start:targetStart,end:targetEnd,walkingWidth:width});
  }
  // The source is already painted with real risers, parapets, capstones and shadows.
  cut('central-land08-stair','M 430 498 L 449 474 L 481 450 Q 495 429 506 450 L 506 477 L 574 522 Q 582 503 594 518 L 594 538 L 640 574 Q 651 560 659 577 L 661 617 L 678 635 L 650 661 L 614 687 L 588 675 L 581 654 L 514 613 L 506 598 L 443 553 L 428 539 Z',
    [470,498],[631,639],[1490,895],[1797,1048],122,[1380,785,530,390]);
  // Small bridge is extracted separately. No stair/bridge shared slab.
  cut('land08-main-bridge','M 519 827 L 530 818 L 530 800 L 540 793 L 549 802 L 549 811 Q 576 774 625 764 L 630 744 L 641 740 L 650 750 L 650 766 L 671 769 L 674 786 L 664 803 L 658 816 Q 610 817 582 854 L 583 869 L 572 880 L 560 872 L 558 859 L 530 853 Z',
    [545,841],[651,787],[1638,1408],[1809,1289],88,[1545,1185,365,310],46);
  // Pre-rasterize a supported road from the approved painted road, including its
  // irregular rock/vegetation shoulders. No runtime polygon or ImageShader slab.
  function sample(x,y) { const ix=Math.max(0,Math.min(art.width()-1,Math.round(x))),iy=Math.max(0,Math.min(art.height()-1,Math.round(y))),i=(iy*art.width()+ix)*4;return [rgba[i],rgba[i+1],rgba[i+2],rgba[i+3]]; }
  function roadStrip(name,points,width,bounds,overlap=0) {
    const w=bounds[2],h=bounds[3],pixels=new Uint8Array(w*h*4);
    const segments=points.slice(1).map((b,i)=>{const a=points[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);return {a,b,dx,dy,len,offset:0};});
    let total=0;for(const g of segments){g.offset=total;total+=g.len;}
    for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
      const wx=x+bounds[0],wy=y+bounds[1];let best=null;
      if(name==='main-road' && (wy<points[0][1] || wy>points[points.length-1][1]))continue;
      for(const g of segments){const raw=((wx-g.a[0])*g.dx+(wy-g.a[1])*g.dy)/(g.len*g.len),t=Math.max(0,Math.min(1,raw));if((g===segments[0]&&raw<0)||(g===segments[segments.length-1]&&raw>1))continue;const cross=((wx-g.a[0])*-g.dy+(wy-g.a[1])*g.dx)/g.len,dist=Math.hypot(wx-g.a[0]-t*g.dx,wy-g.a[1]-t*g.dy);if(dist<width*.95&&(!best||dist<best.dist))best={cross,d:g.offset+t*g.len,dist};}
      if(!best)continue;
      const cycle=(best.d*.9)%520,sy=1550+(cycle<260?cycle:520-cycle),sc=447-(sy-1550)*.085,half=109+(sy-1550)*.19;
      const taper=1;
      const localWidth=width*taper;
      if(Math.abs(best.cross)>localWidth*.95)continue;
      const u=best.cross/(localWidth/2),color=sample(sc+u*half,sy);
      // Remove only turquoise exterior water, not moss, stone, or flower colors.
      if(color[1]>color[0]*1.38&&color[2]>color[0]*1.48)continue;
      let alpha=Math.min(1,(.95*localWidth-Math.abs(best.cross))/5);
      if(name==='main-road')alpha*=Math.min(1,(wy-points[0][1])/60);
      if(overlap)alpha*=Math.min(1,best.d/overlap,(total-best.d)/overlap);
      const i=(y*w+x)*4;pixels[i]=color[0];pixels[i+1]=color[1];pixels[i+2]=color[2];pixels[i+3]=Math.max(0,alpha)*255;
    }
    const alphaMask=new Uint8Array(w*h);
    for(let i=0;i<w*h;i++)alphaMask[i]=pixels[i*4+3];
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const i=y*w+x;if(!alphaMask[i])continue;
      const a=(alphaMask[i-1]+alphaMask[i+1]+alphaMask[i-w]+alphaMask[i+w]+4*alphaMask[i])/8;
      pixels[i*4+3]=Math.min(alphaMask[i],a);
    }
    const im=CK.MakeImage({width:w,height:h,colorType:CK.ColorType.RGBA_8888,alphaType:CK.AlphaType.Unpremul,colorSpace:CK.ColorSpace.SRGB},pixels,w*4);
    const s=CK.MakeSurface(w,h);s.getCanvas().clear(CK.TRANSPARENT);s.getCanvas().drawImage(im,0,0,paint);save(name,s,bounds,{centerline:points,walkingWidth:width*.66});im.delete();
  }
  roadStrip('main-road',[[1608,1620],[1600,1750],[1640,2200],[1700,2900],[1710,4300]],276,[1300,1370,700,2930]);
  roadStrip('land09-road-transition',[[1398,1457],[1502,1494],[1623,1540]],175,[1250,1250,620,520],12);
  // Small flush surface patches cover only the old impassable shoreline bands.
  // The original land artwork remains intact under the reversible entrance cuts.
  const paving=CK.MakeImageFromEncoded(fs.readFileSync(path.join(root,'assets/garden/bridges/qingshi-paving-r1.png')));
  function opening(id,land,a,b,width,bounds) {
    const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),nx=-dy/len*width/2,ny=dx/len*width/2;
    const polygon=`M ${a[0]+nx} ${a[1]+ny} L ${a[0]-nx} ${a[1]-ny} L ${b[0]-nx} ${b[1]-ny} L ${b[0]+nx} ${b[1]+ny} Z`;
    manifest.openings.push({id,land,path:polygon,centerline:[a,b],width});
    const s=CK.MakeSurface(bounds[2]*2,bounds[3]*2),c=s.getCanvas();c.clear(CK.TRANSPARENT);c.scale(2,2);c.translate(-bounds[0],-bounds[1]);
    c.clipPath(CK.Path.MakeFromSVGString(polygon),CK.ClipOp.Intersect,true);
    const shader=paving.makeShaderOptions(CK.TileMode.Repeat,CK.TileMode.Repeat,CK.FilterMode.Linear,CK.MipmapMode.None,CK.Matrix.scaled(110/paving.width(),110/paving.height()));paint.setShader(shader);c.drawRect(CK.XYWHRect(...bounds),paint);paint.setShader(null);shader.delete();save(id,s,bounds,{role:'landing'});
  }
  opening('central-entry','central',[1460,879],[1519,909],124,[1410,800,160,185]);
  opening('land08-stair-entry','08',[1769,1034],[1842,1070],124,[1700,960,220,190]);
  opening('land08-bridge-entry','08',[1785,1306],[1845,1264],88,[1730,1200,180,180]);
  // Transfer the actual approved junction, including its curved masonry banks.
  // Three surveyed control points register Land09, bridge foot, and main stem.
  const controls=[[310,1030,1400,1460],[535,860,1638,1408],[481,1180,1600,1670]];
  const [q0,q1,q2]=controls,ux=q1[0]-q0[0],uy=q1[1]-q0[1],vx=q2[0]-q0[0],vy=q2[1]-q0[1],det=ux*vy-uy*vx;
  const ax=((q1[2]-q0[2])*vy-(q2[2]-q0[2])*uy)/det,bx=(ux*(q2[2]-q0[2])-vx*(q1[2]-q0[2]))/det;
  const ay=((q1[3]-q0[3])*vy-(q2[3]-q0[3])*uy)/det,by=(ux*(q2[3]-q0[3])-vx*(q1[3]-q0[3]))/det;
  const js=CK.MakeSurface(620,520),jc=js.getCanvas();jc.clear(CK.TRANSPARENT);jc.translate(-1250,-1260);
  jc.concat([ax,bx,q0[2]-ax*q0[0]-bx*q0[1],ay,by,q0[3]-ay*q0[0]-by*q0[1],0,0,1]);
  jc.clipPath(CK.Path.MakeFromSVGString('M 303 993 L 330 983 Q 365 1006 395 1028 L 460 1050 Q 479 1030 484 984 L 494 918 L 515 869 L 530 842 L 575 846 L 564 924 L 559 986 L 553 1060 L 555 1120 L 550 1205 L 409 1205 L 422 1140 L 413 1108 Q 357 1080 315 1064 L 295 1049 Z'),CK.ClipOp.Intersect,true);
  jc.drawImage(cutArt,0,0,paint);save('approved-road-junction',js,[1250,1260,620,520],{controls});
  // Merge once at build time; no duplicate shoulders cross the walking corridor.
  const roadBounds=[1300,1350,680,2950];
  const rs=CK.MakeSurface(roadBounds[2],roadBounds[3]),rc=rs.getCanvas();rc.clear(CK.TRANSPARENT);rc.translate(-roadBounds[0],-roadBounds[1]);
  for(const id of ['main-road','approved-road-junction']) {
    const p=manifest.pieces.find(p=>p.id===id),im=CK.MakeImageFromEncoded(fs.readFileSync(path.join(sourceDir,p.file)));
    rc.drawImageRect(im,CK.XYWHRect(0,0,im.width(),im.height()),CK.XYWHRect(p.x,p.y,p.width,p.height),paint);im.delete();
  }
  save('main-road-connected',rs,roadBounds,{walkingWidth:182,land09:[1398,1457],archFeet:[[1500,1755],[1710,1755]],offMap:[1710,4300]});
  for(const dir of [sourceDir,runtimeDir])fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify(manifest,null,2));
});
