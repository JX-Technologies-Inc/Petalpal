"""Foot/ankle-only correction. Never writes into the source package."""
from pathlib import Path
import sys, math, json, hashlib, base64, zipfile
R=Path(__file__).resolve().parent
S=R.parent/'long_skirt_walk_natural_v1'
sys.dont_write_bytecode=True
import importlib.util
spec=importlib.util.spec_from_file_location('fairy_source_builder',S/'build.py')
old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
import numpy as np
from PIL import Image, ImageDraw, ImageFont
X,Y,G=old.X,old.Y,old.G
def rot(deg):
 a=math.radians(deg);return np.array([[math.cos(a),-math.sin(a)],[math.sin(a),math.cos(a)]])
def smooth(a):
 a=np.clip(a,0,1);return a*a*(3-2*a)
CONFIG={
 'far':{'heel':[141,336],'ball':[164,340],'ankle':[157,306],'toe':[168,341],'root':[176,266]},
 'near':{'heel':[226,340],'ball':[249,339],'ankle':[229,308],'toe':[249,340],'root':[218,268]}}
def old_leg(name,p,t,part):
 dx,lift,angle,support=old.gait(p);toe=np.array([200+dx,342-lift]);rr=rot(angle)
 c=CONFIG[name];ot=np.array(c['toe']);oa=np.array(c['ankle']);orr=np.array(c['root'])
 ankle=toe+rr@(oa-ot);root=np.array([194+.6*math.sin(2*math.pi*t) if name=='far' else 206+.6*math.sin(2*math.pi*t),266+.8*math.cos(4*math.pi*t)])
 knee=(root+ankle)*.5+np.array([3*math.sin(math.pi*max(0,(p-.62)/.38)),0])
 f=np.clip((Y-root[1])/(ankle[1]-root[1]),0,1)
 cx=(1-f)*root[0]+f*ankle[0]+4*f*(1-f)*(knee[0]-(root[0]+ankle[0])/2)
 ox=(1-f)*orr[0]+f*oa[0]
 calf=np.stack((X-cx+ox,orr[1]+f*(oa[1]-orr[1])),axis=2)
 shoe=(G-toe)@rr+ot;b=smooth((Y-(ankle[1]-4))/8)
 coords=calf*(1-b[:,:,None])+shoe*b[:,:,None]
 leg=old.remap(part,coords);leg[Y<root[1]-1]=0
 return coords,leg,ankle
def foot_pose(name,p):
 c=CONFIG[name];heel=np.array(c['heel']);ball=np.array(c['ball']);delta=ball-heel
 neutral=-math.degrees(math.atan2(delta[1],delta[0]));length=float(np.linalg.norm(delta))
 dx,lift,_,support=old.gait(p);base=np.array([200+dx,342.])
 if p<.12:
  pitch=-8*(1-smooth(p/.12));stage='heel_contact';pivot=heel;target=base+[-length,0]
 elif p<.46:
  pitch=0.;stage='flat_support';pivot=ball;target=base
 elif p<.62:
  pitch=15*float(smooth((p-.46)/.16));stage='toe_off';pivot=ball;target=base
 else:
  u=(p-.62)/.38;pitch=15-23*float(smooth(u));stage='swing';pivot=ball
  # Match the backward stance velocity at toe-off and heel strike. The foot
  # retracts before landing rather than stopping abruptly at either endpoint.
  tangent=-44/.62*.38
  base[0]=200+(2*u**3-3*u*u+1)*-22+(u**3-2*u*u+u)*tangent+(-2*u**3+3*u*u)*22+(u**3-u*u)*tangent
  # End at the next heel-contact orientation without a discontinuity.
  target=base+np.array([-length+length*math.cos(math.radians(pitch)),min(0,length*math.sin(math.radians(pitch)))])*float(smooth((u-.65)/.35))
  target[1]-=8*math.sin(math.pi*u)**2
 rr=rot(neutral+pitch)
 h=target+rr@(heel-pivot);b=target+rr@(ball-pivot)
 return (G-target)@rr+pivot,target+rr@(np.array(c['ankle'])-pivot),{
  'phase':p,'stage':stage,'support':support,'pitch_degrees':pitch,'source_neutral_degrees':neutral,
  'heel':h.tolist(),'forefoot':b.tolist(),'active_contact':h.tolist() if stage=='heel_contact' else (b.tolist() if support else None),
  'rigid_shoe_scale':1.0,'rigid_shoe_matrix':rr.tolist()}
def uri(p):return 'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()
def main():
 for d in ['frames','masks','review']: (R/d).mkdir(exist_ok=True)
 hashes={str(p.relative_to(S)):hashlib.sha256(p.read_bytes()).hexdigest() for p in S.rglob('*') if p.is_file()}
 parts={n:old.pm(Image.open(S/f'source_parts/{n}_leg.png').convert('RGBA')) for n in CONFIG}
 body=old.pm(Image.open(S/'source_parts/body.png').convert('RGBA'))
 frames=[];records=[];checks=[];speed=44/(.62*1.36)
 for i in range(32):
  t=i/32;canvas=np.zeros((378,378,4),dtype='float32');oldcanvas=canvas.copy();mask=np.zeros((378,378),dtype='float32');row={'frame':i+1,'feet':{}}
  for name,p in [('far',(t+.5)%1),('near',t)]:
   oc,ol,oa=old_leg(name,p,t,parts[name]);fc,na,record=foot_pose(name,p)
   # Preserve the existing calf path above a short ankle join. All painted
   # footwear and lower straps are below the blend and remain rigid/unscaled.
   start=min(oa[1],na[1])-19;end=na[1]-5
   b=smooth((Y-start)/(end-start));coords=oc*(1-b[:,:,None])+fc*b[:,:,None]
   nl=old.remap(parts[name],coords);nl[Y<280]=0
   local=((ol[:,:,3]+nl[:,:,3])>0).astype('float32')*(b>0)
   mask=np.maximum(mask,local);oldcanvas=old.over(ol,oldcanvas);canvas=old.over(nl,canvas)
   Image.fromarray((local*255).astype('uint8')).save(R/f'masks/frame_{i+1:02}_{name}.png')
   record['ankle_blend_y']=[float(start),float(end)];row['feet'][name]=record
  bob=.8*math.cos(4*math.pi*t);sway=.6*math.sin(2*math.pi*t)
  cloth=np.clip((Y-220)/100,0,1)*.65*math.sin(2*math.pi*t-.6)
  overlay=old.remap(body,np.stack((X-sway-cloth,Y-bob),axis=2))
  rendered=np.array(old.unpm(old.over(overlay,canvas)))
  original=np.array(Image.open(S/f'frames/frame_{i+1:02}.png').convert('RGBA'))
  # Opaque garment pixels are locked; preserve all other pixels outside mask.
  mask[overlay[:,:,3]>.995]=0
  out=original.copy();out[mask>0]=rendered[mask>0]
  changed=np.any(out!=original,axis=2)
  assert not np.any(changed & (mask==0))
  im=Image.fromarray(out);im.save(R/f'frames/frame_{i+1:02}.png');frames.append(im)
  Image.fromarray((mask*255).astype('uint8')).save(R/f'masks/frame_{i+1:02}.png')
  checks.append({'frame':i+1,'outside_mask_changed_pixels':int(np.sum(changed & (mask==0))),'changed_pixels':int(changed.sum()),'upper_280_rows_identical':bool(np.array_equal(out[:280],original[:280]))})
  records.append(row)
 font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',15)
 for kind,crop,scale,bg in [('contact_sheet',(0,0,378,378),1,'#eeeeea'),('feet_light',(135,285,255,349),3,'#eeeeea'),('feet_dark',(135,285,255,349),3,'#303039')]:
  w=(crop[2]-crop[0])*scale;h=(crop[3]-crop[1])*scale
  sheet=Image.new('RGB',(w*8,(h+25)*4),bg);draw=ImageDraw.Draw(sheet)
  for i,im in enumerate(frames):
   x=i%8*w;y=i//8*(h+25);tile=im.crop(crop).resize((w,h),Image.Resampling.NEAREST)
   sheet.paste(tile,(x,y+25),tile);draw.text((x+5,y+4),str(i+1),font=font,fill='white' if kind=='feet_dark' else 'black')
  sheet.save(R/f'review/{kind}.png')
 durations=[round((i+1)*136/32)*10-round(i*136/32)*10 for i in range(32)]
 for travelling in [False,True]:
  gif=[]
  for i,im in enumerate(frames):
   bg=Image.new('RGB',(500 if travelling else 378,378),'#eeeeea');d=ImageDraw.Draw(bg)
   if travelling:
    d.line((0,342,500,342),fill='#666666')
    for x in range(0,500,15):d.line((x,342,x,350),fill='#999999')
   bg.paste(im,(round(i*1.36/32*speed) if travelling else 0,0),im);gif.append(bg)
  gif[0].save(R/('review/travelling.gif' if travelling else 'review/walk.gif'),save_all=True,append_images=gif[1:],duration=durations,loop=0,disposal=2)
 metadata={'status':'FOOT_CORRECTION_MANUAL_REVIEW_REQUIRED','source_package':S.name,'canvas':[378,378],'frame_count':32,'frame_duration_ms':42.5,'loop_duration_ms':1360,'gif_durations_ms':durations,'travel_speed_px_s':speed,'shoe_calibration':CONFIG,'tracks':records,'source_hashes':hashes}
 (R/'frames.json').write_text(json.dumps(metadata,indent=2))
 assert all(hashlib.sha256((S/p).read_bytes()).hexdigest()==h for p,h in hashes.items())
 (R/'validation.json').write_text(json.dumps({'frames':checks,'source_files_unchanged':True,'all_canvas_rgba_378':all(im.size==(378,378) and im.mode=='RGBA' for im in frames),'gif_duration_ms':sum(durations),'note':'Pixel and transform tests are not anatomical or perceptual approval.'},indent=2))
 a=[uri(S/f'frames/frame_{i+1:02}.png') for i in range(32)];b=[uri(R/f'frames/frame_{i+1:02}.png') for i in range(32)]
 html='''<!doctype html><meta charset="utf-8"><title>Fairy foot correction review</title><style>body{font:16px system-ui;background:#eeeae4;color:#222;margin:24px}section{display:flex;gap:24px;flex-wrap:wrap}.stage{width:500px;height:390px;position:relative;overflow:hidden;background:#efefed}.stage.dark{background:#303039}.stage img{position:absolute;width:378px;height:378px;top:0;left:35px}.ground{position:absolute;top:342px;width:100%;border-top:1px solid #888}button,select{padding:8px;margin:8px}#detail img{width:378px;image-rendering:pixelated}p{max-width:1000px}</style><h1>Feet and ankles — focused correction</h1><p>32 frames · 42.5 ms/frame · 1.36 s. Same body/skirt motion. Shoes use distinct rigid source paintings. Visual approval is pending.</p><button id="play">Pause</button><button id="prev">Previous</button><button id="next">Next</button><select id="speed"><option value=".25">0.25×</option><option value=".5">0.5×</option><option value="1" selected>1×</option></select><button id="bg">Light / dark</button><button id="move">Toggle matched ground travel</button><span id="label"></span><section><div><h2>Current source</h2><div class="stage"><div class="ground"></div><img id="a"></div></div><div><h2>Foot correction</h2><div class="stage"><div class="ground"></div><img id="b"></div></div></section><p>In-place feet must sweep backward to support forward movement. Ground travel uses 52.18 px/s. The viewport resets at each loop; this is not a pose jump. No crossfades or invented frames.</p><script>const A=SOURCE_A,B=SOURCE_B;let f=0,playing=true,last=0,acc=0,travel=false;const a=document.getElementById('a'),b=document.getElementById('b'),label=document.getElementById('label'),play=document.getElementById('play'),speed=document.getElementById('speed');function show(){a.src=A[f];b.src=B[f];a.style.left=b.style.left=(35+(travel?f*1.36/32*52.182163:0))+'px';label.textContent='Frame '+(f+1)+' / 32'}function stop(){playing=false;play.textContent='Play';acc=0}play.onclick=()=>{playing=!playing;play.textContent=playing?'Pause':'Play';acc=0};document.getElementById('prev').onclick=()=>{stop();f=(f+31)%32;show()};document.getElementById('next').onclick=()=>{stop();f=(f+1)%32;show()};document.getElementById('bg').onclick=()=>document.querySelectorAll('.stage').forEach(s=>s.classList.toggle('dark'));document.getElementById('move').onclick=()=>{travel=!travel;show()};function tick(t){if(last&&playing){acc+=(t-last)*Number(speed.value);while(acc>=42.5){f=(f+1)%32;acc-=42.5;show()}}last=t;requestAnimationFrame(tick)}show();requestAnimationFrame(tick);</script>'''
 (R/'index.html').write_text(html.replace('SOURCE_A',json.dumps(a)).replace('SOURCE_B',json.dumps(b)),encoding='utf-8')
 print('Built isolated 32-frame correction; source hashes and outside-mask equality passed.')
if __name__=='__main__':main()
