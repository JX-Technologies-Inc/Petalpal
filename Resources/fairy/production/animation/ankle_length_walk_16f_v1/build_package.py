"""Extract the approved ankle-length sheet. No pose synthesis or optical flow."""
from pathlib import Path
import sys,math,json,hashlib,base64,zipfile
sys.dont_write_bytecode=True
R=Path(__file__).resolve().parent;ROOT=R.parents[4]
SOURCE=R.parent.parent/'review/ankle_length_skirt_16f_v1/fairy_walk_16f_ankle_length_skirt.png'
sys.path.insert(0,str(R.parent/'long_skirt_walk_24f_v1/_tool_deps'))
import cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont
W=378;YY,XX=np.mgrid[:W,:W]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def smooth(x):x=np.clip(x,0,1);return x*x*(3-2*x)
def matte(im):
 rgb=np.asarray(im).astype('float32')
 # Fit the neutral paper/illumination from the margins only, not pale petals.
 border=(XX<55)|(XX>300)|(YY<15)|(YY>360)
 terms=np.stack([np.ones((W,W)),XX/W,YY/W,(XX/W)**2,(YY/W)**2,XX*YY/(W*W)],axis=2)
 keep=border.copy()
 for _ in range(3):
  coef=np.linalg.lstsq(terms[keep],rgb[keep],rcond=None)[0];bg=terms@coef
  residual=np.linalg.norm(rgb-bg,axis=2);keep=border&(residual<6)
 difference=np.linalg.norm(rgb-bg,axis=2)
 seed=(difference>10).astype('uint8')
 n,labels,stats,centroids=cv2.connectedComponentsWithStats(seed,8)
 largest=1+np.argmax(stats[1:,cv2.CC_STAT_AREA]);main=labels==largest
 nearby=cv2.dilate(main.astype('uint8'),np.ones((7,7),np.uint8))>0
 # Keep faint antialiased edge pixels only near the character, rejecting
 # disconnected paper noise. Pale interior is retained by filled silhouette.
 raw=(difference>3)&nearby
 contours,_=cv2.findContours(main.astype('uint8'),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
 filled=np.zeros((W,W),dtype='uint8');cv2.drawContours(filled,contours,-1,1,cv2.FILLED)
 inside=cv2.distanceTransform(filled,cv2.DIST_L2,5)
 # Estimate actual edge coverage against nearby reliable foreground colors.
 # A luminance cutoff alone would leave a pale paper halo on dark scenes.
 core=(inside>=3)&(difference>30)
 _,nearest=cv2.distanceTransformWithLabels((~core).astype('uint8'),cv2.DIST_L2,5,labelType=cv2.DIST_LABEL_PIXEL)
 colors=np.zeros((int(nearest.max())+1,3),dtype='float32')
 colors[nearest[core]]=rgb[core]
 fg=colors[nearest];v=fg-bg
 estimate=np.sum((rgb-bg)*v,axis=2)/np.maximum(np.sum(v*v,axis=2),1)
 alpha=np.clip(estimate,0,1)*raw
 # Preserve the illustration's pale/translucent-looking interior colors.
 alpha[inside>=3]=1
 # Re-open genuine connected spaces between petals/arms/feet using the
 # observed paper, instead of punching out white foreground pixels.
 paper=(difference<3.0).astype('uint8');_,p_labels,p_stats,_=cv2.connectedComponentsWithStats(paper,8)
 for j in range(1,len(p_stats)):
  if p_stats[j,cv2.CC_STAT_AREA]>=3:alpha[p_labels==j]=0
 alpha[~nearby]=0
 # Undo background contribution at partially covered outer edges only.
 out=rgb.copy();partial=(alpha>.015)&(alpha<.995)
 out[partial]=(rgb[partial]-(1-alpha[partial,None])*bg[partial])/alpha[partial,None]
 out=np.clip(out,0,255);a=np.rint(alpha*255).astype('uint8');a[a<3]=0
 rgba=np.dstack([np.rint(out).astype('uint8'),a]);rgba[a==0,:3]=0
 return Image.fromarray(rgba),{'background_rgb_median':np.median(bg.reshape(-1,3),axis=0).tolist(),'edge_matte':'spatially fitted paper + connected trimap + alpha-edge decontamination','partial_alpha_pixels':int(((a>0)&(a<255)).sum())}
def uri(p):return 'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()
def main():
 for name in ['frames','review','work']: (R/name).mkdir(exist_ok=True)
 source_hash=sha(SOURCE);sheet=Image.open(SOURCE).convert('RGB');sx=sheet.width/1512;sy=sheet.height/1620
 raw=[];records=[]
 for i in range(16):
  cx=i%4*378;cy=i//4*405+20
  # Same source-to-output scale for every cell; no per-frame size adjustment.
  box=(cx*sx,cy*sy,(cx+378)*sx,(cy+378)*sy)
  crop=sheet.transform((W,W),Image.Transform.EXTENT,box,Image.Resampling.BICUBIC)
  crop.save(R/f'work/frame_{i+1:02}_source_crop.png')
  im,info=matte(crop);arr=np.array(im);a=arr[:,:,3]
  significant=a>160;ys,xs=np.where(significant)
  hair=(YY>20)&(YY<108)&(XX>100)&(XX<260)&(arr[:,:,:3].mean(axis=2)<155)&(a>200)
  hx=float(np.median(XX[hair]));bottom=int(ys.max());top=int(ys.min())
  raw.append(im);records.append({'frame':i+1,'source_box':list(box),'source_bottom':bottom,'source_top':top,'hair_center_x':hx,**info})
 target_x=float(np.median([r['hair_center_x'] for r in records]));frames=[]
 for i,(im,rec) in enumerate(zip(raw,records)):
  dx=round(target_x-rec['hair_center_x']);dy=342-rec['source_bottom']
  registered=Image.new('RGBA',(W,W));registered.paste(im,(dx,dy))
  a=np.array(registered)[:,:,3];ys,xs=np.where(a>160)
  rec.update(translation_xy=[dx,dy],scale_xy=[1,1],baseline_y=342,registered_top=int(ys.min()),registered_bottom=int(ys.max()),alpha_bbox=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)])
  registered.save(R/f'frames/frame_{i+1:02}.png');rec['sha256']=sha(R/f'frames/frame_{i+1:02}.png');rec['file']=f'frames/frame_{i+1:02}.png';rec['duration_ms']=85;frames.append(registered)
 font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)
 for name,dark,detail in [('contact_sheet',False,False),('alpha_dark',True,False),('hem_details',False,True),('hem_details_dark',True,True)]:
  cw,ch=(378,405) if not detail else (540,255);canvas=Image.new('RGB',(cw*4,ch*4),'#292d38' if dark else '#eeeae4');d=ImageDraw.Draw(canvas)
  for i,im in enumerate(frames):
   x=i%4*cw;y=i//4*ch;tile=im if not detail else im.crop((105,275,285,350)).resize((540,225),Image.Resampling.NEAREST)
   canvas.paste(tile,(x,y+25),tile);d.text((x+8,y+4),f'{i+1:02}',fill='white' if dark else '#302b39',font=font)
  canvas.save(R/f'review/{name}.png')
 previews=[]
 for im in frames:
  bg=Image.new('RGB',(W,W),'#eeeae4');bg.paste(im,mask=im.getchannel('A'));previews.append(bg)
 delays=[80,90]*8
 previews[0].save(R/'review/walk.gif',save_all=True,append_images=previews[1:],duration=delays,loop=0,disposal=2)
 metadata={'status':'EXPORTED_AWAITING_FINAL_VISUAL_QA','frame_count':16,'canvas':[378,378],'frame_duration_ms':85,'loop_duration_ms':1360,'fps':1000/85,'gif_frame_durations_ms':delays,'order':list(range(1,17)),'loop':True,'anchor':{'x':target_x,'y':342,'meaning':'fixed sprite registration anchor; not verified world-space foot locking'},'source':str(SOURCE),'source_sha256':source_hash,'source_mode':'flattened RGB','alpha_limit':'Reconstructed edge matte. Original optical transparency of wings/petals cannot be recovered exactly from RGB. Pale painted interiors preserved.','frames':records}
 (R/'frames.json').write_text(json.dumps(metadata,indent=2))
 payload=[uri(R/f'frames/frame_{i+1:02}.png') for i in range(16)]
 html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PetalPal ankle-length walk review</title><style>body{font:16px system-ui;background:#f3f0ec;color:#322a3b;max-width:1150px;margin:28px auto;padding:0 18px}h1{font-size:26px}button,select{font:inherit;padding:9px 12px;margin:5px;border:1px solid #b8aabc;border-radius:6px;background:white}section{display:flex;gap:22px;flex-wrap:wrap}.stage{background:#eeeae4;width:378px;height:378px;position:relative;overflow:hidden}.dark{background:#292d38}.checker{background-color:#fff;background-image:linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%);background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0}.stage img{position:absolute;inset:0;width:378px;height:378px}.ground{position:absolute;top:342px;width:100%;border-top:1px solid #bd8b75;z-index:1;display:none}.guides .ground{display:block}#close{width:540px;height:225px;position:relative;overflow:hidden;background:#eeeae4}#close img{position:absolute;width:1134px;height:1134px;max-width:none;left:-315px;top:-825px;image-rendering:pixelated}#close.dark{background:#292d38}p{line-height:1.5}.runtime img{object-fit:contain;display:block;width:auto}label{display:inline-block}input{width:260px}</style><h1>PetalPal · ankle-length walk</h1><p>16 transparent PNGs · 378 × 378 · 85 ms per frame · 1.36-second loop. The longer skirt direction is approved; this exported package is for final visual review.</p><button id="play">Pause</button><button id="prev">Previous</button><button id="next">Next</button><label>Speed <select id="speed"><option value=".25">0.25×</option><option value=".5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label><label>Background <select id="bg"><option value="light">Light</option><option value="dark">Dark</option><option value="checker">Checker</option></select></label><button id="guide">Baseline guide</button><p><input id="seek" type="range" min="0" max="15" value="0"> <span id="label"></span></p><section><div><h2>Full frame</h2><div class="stage" id="stage"><img id="sprite"><div class="ground"></div></div></div><div><h2>Hem and shoe detail · 3×</h2><div id="close"><img id="detail"></div></div></section><h2>Runtime-size checks</h2><section class="runtime"><div>96 px character height<img id="r96" style="height:118px"></div><div>108 px character height<img id="r108" style="height:133px"></div><div>120 px character height<img id="r120" style="height:147px"></div></section><p>Playback is in-place; this review does not assert world-space ground locking. The matte was reconstructed from the RGB reference sheet. Use the dark background to inspect pale edge contamination and step frame-by-frame to check shoe separation.</p><script>const FRAMES=FRAME_DATA;let f=0,playing=true,last=null,acc=0;const $=id=>document.getElementById(id);function show(){for(const id of ['sprite','detail','r96','r108','r120'])$(id).src=FRAMES[f];$('label').textContent='Frame '+(f+1)+' / 16';$('seek').value=f}function pause(){playing=false;$('play').textContent='Play';acc=0}function step(n){pause();f=(f+n+16)%16;show()}$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Pause':'Play';acc=0};$('prev').onclick=()=>step(-1);$('next').onclick=()=>step(1);$('seek').oninput=()=>{pause();f=Number($('seek').value);show()};$('speed').onchange=()=>acc=0;$('bg').onchange=()=>{const bg=$('bg').value;$('stage').className='stage '+(bg==='light'?'':bg);$('close').className=bg==='light'?'':bg};$('guide').onclick=()=>$('stage').classList.toggle('guides');document.addEventListener('visibilitychange',()=>{last=null;acc=0});function tick(t){if(last!==null&&playing&&!document.hidden){acc+=Math.min(t-last,250)*Number($('speed').value);while(acc>=85){f=(f+1)%16;acc-=85;show()}}last=t;requestAnimationFrame(tick)}show();requestAnimationFrame(tick);</script></html>'''
 (R/'index.html').write_text(html.replace('FRAME_DATA',json.dumps(payload)),encoding='utf-8')
 assert sha(SOURCE)==source_hash
 print(json.dumps({'frames':16,'translations':[r['translation_xy'] for r in records],'registered_height_range':[min(343-r['registered_top'] for r in records),max(343-r['registered_top'] for r in records)],'source_unchanged':True},indent=2))
if __name__=='__main__':main()
