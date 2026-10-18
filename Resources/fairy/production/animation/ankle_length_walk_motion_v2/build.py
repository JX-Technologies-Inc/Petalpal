"""Continuous contact-driven review experiment. Never writes source packages.
One painting, continuous local joint/cloth fields, two rigid shoes. No optical
flow, adjacent-pose blending or illustration switching. Not a production rig.
"""
from pathlib import Path
import sys,json,math,hashlib,base64,shutil
import numpy as np
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parent
PREV=R.parent/'ankle_length_walk_64f_v1'
sys.path.insert(0,str(PREV))
import build as old
cv2=old.cv2
N=48; DT=30; W=378; STRIDE=120.
old.STRIDE=STRIDE
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def savejson(p,v):p.write_text(json.dumps(v,indent=2)+'\n',encoding='utf-8')
def smooth(x):return np.clip(x,0,1)**2*(3-2*np.clip(x,0,1))
def pm(a):
 a=a.astype(np.float32)/255;a[:,:,:3]*=a[:,:,3:4];return a
def flat(im,bg='#eeeae5'):return Image.alpha_composite(Image.new('RGBA',im.size,bg),im).convert('RGB')
for d in ['frames','parts','review']:(R/d).mkdir(parents=True,exist_ok=True)
source=old.S16/'frames/frame_01.png'
sourcehash=sha(source)
base=np.array(Image.open(source).convert('RGBA'))
templates=[]
for name,heel,toe in [('near',[227.,341.],[247.,341.]),('far',[143.,336.],[171.,342.])]:
 p=PREV/f'parts/shoe_{name}.png';shutil.copy2(p,R/f'parts/shoe_{name}.png')
 delta=np.array(toe)-heel
 templates.append(dict(name=name,image=np.array(Image.open(p)),heel=np.array(heel),toe=np.array(toe),sole_length=float(np.linalg.norm(delta)),neutral_angle=-math.atan2(delta[1],delta[0])))
mask=np.maximum(old.polygon_mask(old.REAR_TOP[0]),old.polygon_mask(old.FRONT_TOP[0]))
mask=cv2.GaussianBlur(mask,(3,3),.45)
body=pm(base);body*=1-mask[:,:,None]
Image.fromarray(old.unpm(body)).save(R/'parts/body_plate.png')
Image.fromarray(np.rint(mask*255).astype('uint8')).save(R/'parts/shoe_removal_mask.png')
yy,xx=np.mgrid[:W,:W];xx=xx.astype(np.float32);yy=yy.astype(np.float32)

def body_render(q):
 """Continuous root/pelvis, local shoulder and fabric displacement fields.
 Source is sampled once; shoes never enter this deformation field.
 Head is damped. Garment lag is independent of the instantaneous shoe pose.
 """
 a=2*math.pi*q
 pelvis_x=.65*math.sin(a)
 rise=.48*math.cos(2*a-.7)
 lower=smooth((yy-177)/152)
 head_damping=.35+.65*smooth((yy-95)/100)
 # Cloth flex grows gradually from a pinned waist, never splits into panels.
 cloth=lower**1.6
 dx=pelvis_x*head_damping + cloth*(1.9*math.sin(a-.5)+.6*math.sin(2*a-.9))
 dy=rise*head_damping + cloth*.55*math.sin(a-.85)
 # Restrained near-arm counter-swing around shoulder. Support blends through
 # costume because the flattened painting has no clean hidden arm layer.
 arm=np.exp(-((xx-201)/15)**4)*smooth((yy-144)/49)*(1-smooth((yy-213)/18))
 dx+=arm*.75*math.sin(a+math.pi)
 # Nearly stationary wing roots; subpixel delayed tip response.
 wing=np.exp(-((xx-133)/33)**4)*np.exp(-((yy-119)/39)**4)
 dx+=wing*.3*math.sin(a-.4);dy+=wing*.2*math.sin(a-.6)
 return cv2.remap(body,xx-dx.astype(np.float32),yy-dy.astype(np.float32),cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)

def render(q):
 states=[old.gait(q,templates[0]['sole_length']),old.gait(q+.5,templates[1]['sole_length'])]
 layers=[old.shoe_layer(t,s) for t,s in zip(templates,states)]
 b=body_render(q)
 return old.unpm(old.over(b,old.over(layers[0],layers[1]))),states,[int(np.sum(l[:,:,3]*(1-b[:,:,3])>.25)) for l in layers]

rows=[];ims=[]
for n in range(N):
 out,states,visible=render(n/N);im=Image.fromarray(out);p=R/f'frames/frame_{n+1:02}.png';im.save(p);ims.append(im)
 rows.append(dict(index=n+1,file=f'frames/{p.name}',duration_ms=DT,phase=n/N,root_travel_x=STRIDE*n/N,near=states[0],far=states[1],visible_shoe_pixels=visible,sha256=sha(p)))
assert sha(source)==sourcehash
loop_same=bool(np.array_equal(render(0)[0],render(1)[0]))
# Verify contact points in world space within EACH uninterrupted stance.
errors=[]
for t in templates:
 for lo,hi,key in [(0,.12,'heel'),(.12,.5,'heel'),(.5,.62,'toe')]:
  points=[]
  for q in np.linspace(lo,hi-1e-8,200):
   p=np.array(old.gait(q,t['sole_length'])[key]);p[0]+=STRIDE*q;points.append(p)
  errors.append(float(np.max(np.ptp(points,axis=0))))
meta=dict(status='REVIEW_CANDIDATE_NOT_APPROVED',frame_count=N,canvas=[W,W],frame_duration_ms=DT,loop_duration_ms=N*DT,loop=True,stride_px=STRIDE,source=str(source),source_sha256=sourcehash,method='Single stable painting; continuous contact-driven rigid shoes; restrained local body and garment displacement fields. No optical flow or adjacent-frame interpolation.',frames=rows)
savejson(R/'frames.json',meta)
validation=dict(unique_frames=len(set(r['sha256'] for r in rows)),source_unchanged=sha(source)==sourcehash,analytic_loop_endpoint_equal=loop_same,max_analytic_stance_drift_px=max(errors),all_rgba=all(i.mode=='RGBA' for i in ims),all_canvas_equal=all(i.size==(W,W) for i in ims),empty_canvas_border=all(not np.any(np.array(i)[[0,-1],:,3]) and not np.any(np.array(i)[:,[0,-1],3]) for i in ims),visual_status='Pending sheet inspection; mathematical contact and periodicity do not certify painted motion')
savejson(R/'validation.json',validation)
for kind,crop,size in [('contact',None,(252,252)),('feet',(120,305,275,349),(465,132)),('hem',(100,265,282,349),(455,210))]:
 for bg,suffix in [('#eeeae5','light'),('#263340','dark')]:
  cols=6;cw,ch=size;sheet=Image.new('RGB',(cols*cw,8*(ch+25)),bg);d=ImageDraw.Draw(sheet)
  for n,im in enumerate(ims):
   tile=flat(im,bg);tile=tile.crop(crop) if crop else tile
   x=n%cols*cw;y=n//cols*(ch+25);sheet.paste(tile.resize(size,Image.Resampling.NEAREST if crop else Image.Resampling.LANCZOS),(x,y+25));d.text((x+7,y+7),f'{n+1:02}  N:{rows[n]["near"]["contact"]} F:{rows[n]["far"]["contact"]}',fill='#b9aacc' if suffix=='dark' else '#42354b')
  sheet.save(R/f'review/{kind}_{suffix}.png')
palette=Image.new('RGB',(W*8,W*6))
for n,im in enumerate(ims):palette.paste(flat(im),(n%8*W,n//8*W))
pal=palette.quantize(colors=256)
gifs=[flat(im).quantize(palette=pal,dither=Image.Dither.NONE) for im in ims]
gifs[0].save(R/'review/walk_48f.gif',save_all=True,append_images=gifs[1:],duration=DT,loop=0,disposal=2,optimize=False)
def data(p):return 'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()
payload=dict(new=[data(R/r['file']) for r in rows],old=[data(PREV/f'frames/frame_{i+1:02}.png') for i in range(64)],rows=rows,duration=1440,oldDuration=1360,stride=STRIDE)
html=r'''<!doctype html><meta charset="utf-8"><title>Fairy continuous motion review</title>
<style>body{font:15px system-ui;background:#f6f1eb;color:#42344b;margin:25px}main{max-width:1000px;margin:auto}button,select{padding:8px;margin:4px}section{display:flex;gap:15px;flex-wrap:wrap}.stage{width:378px;height:378px;position:relative;background:#eeeae5;overflow:hidden}.stage img{position:absolute;width:378px;height:378px;top:0;left:0}.ground{position:absolute;top:343px;height:30px;width:100%;background:repeating-linear-gradient(90deg,transparent 0 29px,#8d9c89 29px 30px);border-top:1px solid #8d9c89}.dark{background:#263340}.travel{width:850px;max-width:100%}#status{background:#ecd8ca;padding:12px}a{color:#6b487d}</style>
<main><h1>Continuous Fairy motion · 48 frames</h1><p id="status">REVIEW ONLY — inspect the report for remaining visual failures. This is not production approval.</p>
<p>New: 1.44 s / 48 × 30 ms. Previous: 1.36 s / 64 frames. Each runs at its own original timing. No frame blending.</p>
<button id="play">Play</button><button id="prev">Previous</button><button id="next">Next</button><select id="speed"><option value=".25">¼×</option><option value=".5">½×</option><option value="1" selected>1×</option></select><select id="bg"><option>Light</option><option>Dark</option></select><label><input id="phase" type="checkbox">Phase-lock comparison (changes previous speed for review)</label><br><input id="seek" type="range" min="0" max="47" value="0"><b id="counter"></b>
<section><article><h2>Previous 64</h2><div class="stage"><div class="ground" id="groundOld"></div><img id="old"></div></article><article><h2>Continuous 48 candidate</h2><div class="stage"><div class="ground" id="groundNew"></div><img id="new"></div></article></section><pre id="contacts"></pre>
<h2>Fixed-ground travel test</h2><div class="stage travel"><div class="ground"></div><img id="traveler"></div><p>120 px per cycle. Viewport reset is outside the animation loop. Numerical contact stability is not proof of convincing painted foot contact.</p>
<p><a href="REPORT.md">Report</a> · <a href="review/contact_light.png">Contact sheet</a> · <a href="review/feet_dark.png">Feet / dark</a> · <a href="review/hem_light.png">Hem</a> · <a href="review/walk_48f.gif">GIF</a></p>
<script>const D=__DATA__,$=s=>document.getElementById(s);let time=0,last=null,playing=false;
function draw(){const i=Math.floor(time/30)%48,q=(time%D.duration)/D.duration,oi=Math.floor(($('phase').checked?q:(time%D.oldDuration)/D.oldDuration)*64);$('new').src=D.new[i];$('old').src=D.old[oi];$('traveler').src=D.new[i];$('traveler').style.left=((Math.floor(time/30)*D.stride/48)%1000-180)+'px';$('groundNew').style.backgroundPositionX=(-Math.floor(time/30)*D.stride/48)+'px';$('groundOld').style.backgroundPositionX=(-Math.floor(time/21.25)*72/64)+'px';$('counter').textContent=` ${i+1}/48 | previous ${oi+1}/64`;$('seek').value=i;$('contacts').textContent=`Near: ${D.rows[i].near.stage}\nFar: ${D.rows[i].far.stage}`;}
function step(i){playing=false;last=null;$('play').textContent='Play';time=((i+48)%48)*30;draw();}
$('play').onclick=()=>{playing=!playing;last=null;$('play').textContent=playing?'Pause':'Play';};$('prev').onclick=()=>step(Math.floor(time/30)-1);$('next').onclick=()=>step(Math.floor(time/30)+1);$('seek').oninput=()=>step(+$('seek').value);$('bg').onchange=()=>document.querySelectorAll('.stage').forEach(s=>s.classList.toggle('dark',$('bg').value==='Dark'));$('phase').onchange=draw;$('speed').onchange=()=>last=null;
function tick(t){if(playing&&!document.hidden){if(last!==null)time+=(t-last)*+$('speed').value;last=t;draw();}else last=null;requestAnimationFrame(tick);}document.addEventListener('visibilitychange',()=>last=null);draw();requestAnimationFrame(tick);</script></main>'''
(R/'index.html').write_text(html.replace('__DATA__',json.dumps(payload,separators=(',',':'))),encoding='utf-8')
print(json.dumps(validation,indent=2))
