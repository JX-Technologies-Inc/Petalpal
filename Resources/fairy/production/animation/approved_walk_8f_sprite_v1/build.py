from pathlib import Path
import sys,json,hashlib,shutil,base64
import numpy as np
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parent
sys.path.insert(0,str(R.parent/'long_skirt_walk_24f_v1/_tool_deps'))
import cv2
S=Path('C:/Users/cjysu/AppData/Local/Temp/codex-clipboard-5e095ae0-b9c2-46bc-bff2-b26c19948760.png')
for d in ['frames','original_crops','masks','review']:(R/d).mkdir(parents=True,exist_ok=True)
im=Image.open(S).convert('RGB');shutil.copy2(S,R/'source_sheet.png')
rows=[];frames=[]
for i in range(8):
 x=i%4*362;y=(i//4)*522
 a=np.array(im.crop((x,y,x+362,y+482)))
 Image.fromarray(a).save(R/f'original_crops/frame_{i+1:02}.png')
 chroma=a.max(2).astype(float)-a.min(2)
 seed=((chroma>13)&(a.min(2)<238)).astype('uint8')
 seed[470:]=0
 n,lab,stats,_=cv2.connectedComponentsWithStats(seed,8)
 k=1+np.argmax(stats[1:,cv2.CC_STAT_AREA]);core=(lab==k).astype('uint8')
 # Preserve pale interiors enclosed by the connected character silhouette.
 core=cv2.morphologyEx(core,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
 contours,_=cv2.findContours(core,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
 solid=np.zeros_like(core);cv2.drawContours(solid,contours,-1,1,cv2.FILLED)
 outer=cv2.dilate(solid,np.ones((7,7),np.uint8))
 g=np.where(outer,cv2.GC_PR_FGD,cv2.GC_BGD).astype('uint8')
 g[solid>0]=cv2.GC_PR_FGD
 g[cv2.erode(core,np.ones((3,3),np.uint8))>0]=cv2.GC_FGD
 g[(chroma<12)&(a.min(2)>215)]=cv2.GC_PR_BGD
 g[473:]=cv2.GC_BGD
 cv2.grabCut(a,g,None,np.zeros((1,65)),np.zeros((1,65)),3,cv2.GC_INIT_WITH_MASK)
 fg=((g==1)|(g==3)).astype('uint8')
 n,l,st,_=cv2.connectedComponentsWithStats(fg,8);fg=(l==(1+np.argmax(st[1:,cv2.CC_STAT_AREA]))).astype('uint8')
 alpha=cv2.GaussianBlur(fg.astype('float32'),(3,3),.45)
 interior=cv2.erode(fg,np.ones((5,5),np.uint8))>0
 alpha[interior]=1
 alpha[~interior]*=np.clip((chroma[~interior]-5)/12,0,1)
 out=np.dstack([a,np.rint(alpha*255).astype('uint8')])
 # RGB is copied directly, including edge paint; no decontamination/repainting.
 p=R/f'frames/frame_{i+1:02}.png';Image.fromarray(out).save(p)
 Image.fromarray(out[:,:,3]).save(R/f'masks/frame_{i+1:02}.png')
 frames.append(Image.fromarray(out));rows.append(dict(index=i+1,file=f'frames/{p.name}',duration_ms=100,crop=[x,y,x+362,y+482],scale=1,translation=[0,0],rgb_source_exact=bool(np.array_equal(out[:,:,:3],a)),sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
meta=dict(source_sha256=hashlib.sha256(S.read_bytes()).hexdigest(),canvas=[362,482],baseline_y=472,frame_count=8,loop_duration_ms=800,frames=rows,registration='Fixed 362px column grid and 522px row pitch. No individual scaling or bounding-box recentering.')
(R/'frames.json').write_text(json.dumps(meta,indent=2))
def flat(f,bg):return Image.alpha_composite(Image.new('RGBA',f.size,bg),f).convert('RGB')
for bg,name in [('#eeeae5','light'),('#263340','dark')]:
 sheet=Image.new('RGB',(362*4,512*2),bg);d=ImageDraw.Draw(sheet)
 for i,f in enumerate(frames):
  x=i%4*362;y=i//4*512;sheet.paste(flat(f,bg),(x,y+25));d.text((x+8,y+5),str(i+1),fill='#9c79b4')
 sheet.save(R/f'review/contact_{name}.png')
gif=[flat(f,'#eeeae5').quantize(colors=256) for f in frames]
gif[0].save(R/'review/walk.gif',save_all=True,append_images=gif[1:],duration=100,loop=0,disposal=2)
data=['data:image/png;base64,'+base64.b64encode((R/r['file']).read_bytes()).decode() for r in rows]
html='''<!doctype html><meta charset="utf-8"><title>Approved Fairy · eight sprites</title><style>body{font:16px system-ui;background:#eeeae5;color:#493852;margin:24px}button,select,input{margin:6px;padding:6px}.stage{position:relative;height:482px;overflow:hidden;border-bottom:1px solid #888}.stage img{position:absolute;width:362px;height:482px;top:0}.dark{background:#263340}#still{left:0}#travel{left:0}</style><h1>Approved Fairy · 8-frame sprite review</h1><button id="play">Play</button><button id="prev">Previous</button><button id="next">Next</button><b id="label"></b><label>Animation <select id="speed"><option value=".5">0.5×</option><option value="1" selected>1× (100ms)</option><option value="2">2×</option></select></label><label>Travel px/s <input id="velocity" type="range" min="0" max="240" value="60"><span id="v">60</span></label><button id="bg">Light / dark</button><div class="stage"><img id="still"></div><h2>Horizontal travel</h2><div class="stage" id="track"><img id="travel"></div><p>Exact order 1–8. No interpolation or crossfades. Travel is a review control, not proof of foot locking.</p><script>const F=DATA;const $=id=>document.getElementById(id);let i=0,t=0,x=0,last=null,on=false;function draw(){$('still').src=$('travel').src=F[i];$('travel').style.left=x+'px';$('label').textContent=(i+1)+' / 8';}function step(d){on=false;$('play').textContent='Play';i=(i+d+8)%8;t=i*100;draw();}$('prev').onclick=()=>step(-1);$('next').onclick=()=>step(1);$('play').onclick=()=>{on=!on;last=null;$('play').textContent=on?'Pause':'Play';};$('velocity').oninput=()=>{$('v').textContent=$('velocity').value;};$('bg').onclick=()=>document.querySelectorAll('.stage').forEach(s=>s.classList.toggle('dark'));function tick(now){if(on&&!document.hidden&&last!==null){const dt=Math.min(now-last,100);t+=dt*+$('speed').value;i=Math.floor(t/100)%8;x+=dt/1000*+$('velocity').value;if(x>$('track').clientWidth)x=-362;draw();}last=document.hidden?null:now;requestAnimationFrame(tick);}draw();requestAnimationFrame(tick);</script>'''
(R/'index.html').write_text(html.replace('DATA',json.dumps(data)),encoding='utf-8')
dest=Path('mobile/assets/dev/fairy-approved-walk-8');dest.mkdir(parents=True,exist_ok=True)
for r in rows:shutil.copy2(R/r['file'],dest/Path(r['file']).name)
print('Exported 8 unchanged-RGB cutouts and previews.')
