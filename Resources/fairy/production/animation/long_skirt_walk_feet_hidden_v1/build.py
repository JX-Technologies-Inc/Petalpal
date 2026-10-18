from pathlib import Path
import json,hashlib,zipfile,shutil,base64,math
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
R=Path(__file__).resolve().parent;S=R.parent/'long_skirt_walk_feet_v2'
for d in ['frames','masks','review','art']:(R/d).mkdir(parents=True,exist_ok=True)
meta=json.loads((S/'frames.json').read_text());z=zipfile.ZipFile('C:/Users/cjysu/Downloads/long_skirt_walk_feet_v2.zip')
for i in range(32):
 name=f'frames/frame_{i+1:02}.png'
 assert z.read('long_skirt_walk_feet_v2/'+name)==(S/name).read_bytes(),name
generated=Path('C:/Users/cjysu/.codex/generated_images/01a0e920-8626-7cc1-aa96-c0a2908bc06d/exec-4d950ae7-2011-4d48-89fc-3140c9d4d546.png')
shutil.copy2(generated,R/'art/coverage_donor.png')
# Only textile pixels; exclude donor hands, skin and shoes entirely.
donor=Image.open(generated).convert('RGBA')
patch=donor.crop((490,870,770,1088)).resize((106,83),Image.Resampling.LANCZOS)
patch.save(R/'art/lower_petals.png')
frames=[];original=[];checks=[]
Y,X=np.mgrid[:378,:378]
for i in range(32):
 src=np.array(Image.open(S/f'frames/frame_{i+1:02}.png').convert('RGBA'));original.append(Image.fromarray(src))
 # Existing body bob retained; a single donor avoids per-frame art regeneration.
 t=i/32;dx=round(.6*math.sin(2*math.pi*t));dy=round(.8*math.cos(4*math.pi*t))
 layer=Image.new('RGBA',(378,378));layer.paste(patch,(144+dx,250+dy))
 a=np.array(layer);m=np.zeros((378,378),np.float32)
 shape=Image.new('L',(378,378));ImageDraw.Draw(shape).polygon([(164+dx,253+dy),(227+dx,253+dy),(250+dx,331+dy),(146+dx,331+dy)],fill=255)
 m=np.array(shape.filter(ImageFilter.GaussianBlur(1.2)),dtype=np.float32)/255
 m*=np.clip((Y-258)/16,0,1);m*=a[:,:,3]/255
 # Protect original visible forefoot pixels. Higher shoe areas may be occluded,
 # but no shoe artwork is moved, deformed or repainted.
 protect=Y>=334
 for foot in meta['tracks'][i]['feet'].values():
  bx,by=foot['forefoot'];protect|=((X-bx)**2+(Y-by)**2<36)
 m[protect]=0;m[Y<258]=0
 overlay=a.copy();overlay[:,:,3]=np.rint(m*255).astype('uint8')
 out=np.array(Image.alpha_composite(Image.fromarray(src),Image.fromarray(overlay)))
 edit=overlay[:,:,3]>0;out[~edit]=src[~edit]
 p=R/f'frames/frame_{i+1:02}.png';Image.fromarray(out).save(p);frames.append(Image.fromarray(out))
 Image.fromarray((edit*255).astype('uint8')).save(R/f'masks/frame_{i+1:02}.png')
 checks.append(dict(frame=i+1,outside_mask_changed=int(np.any(out!=src,axis=2)[~edit].sum()),protected_forefoot_changed=int(np.any(out!=src,axis=2)[protect].sum()),source_sha256=hashlib.sha256((S/f'frames/frame_{i+1:02}.png').read_bytes()).hexdigest()))
def flat(im,bg):return Image.alpha_composite(Image.new('RGBA',im.size,bg),im).convert('RGB')
for dark,bg in [('light','#eeeae5'),('dark','#263340')]:
 sheet=Image.new('RGB',(8*378,4*230),bg);d=ImageDraw.Draw(sheet)
 for i,f in enumerate(frames):
  x=i%8*378;y=i//8*230
  sheet.paste(flat(original[i],bg).crop((120,248,270,349)).resize((180,121)),(x,y+26));sheet.paste(flat(f,bg).crop((120,248,270,349)).resize((180,121)),(x+190,y+26));d.text((x+8,y+6),f'{i+1:02} original / coverage',fill='#aa89ba')
 sheet.save(R/f'review/alpha_{dark}.png')
sheet=Image.new('RGB',(8*378,4*403),'#eeeae5');d=ImageDraw.Draw(sheet)
for i,f in enumerate(frames):
 x=i%8*378;y=i//8*403;sheet.paste(flat(original[i],'#eeeae5').resize((189,241)),(x,y+25));sheet.paste(flat(f,'#eeeae5').resize((189,241)),(x+189,y+25));d.text((x+8,y+6),f'{i+1} original / corrected',fill='#49344a')
sheet.save(R/'review/contact_comparison.png')
for travel in [False,True]:
 ims=[]
 for i,f in enumerate(frames):
  bg=Image.new('RGB',(500 if travel else 378,378),'#eeeae5');bg.paste(f,(round(i*meta['frame_duration_ms']/1000*meta['travel_speed_px_s']) if travel else 0,0),f);ims.append(bg)
 ims[0].save(R/('travelling.gif' if travel else 'walk.gif'),save_all=True,append_images=ims[1:],duration=meta['gif_durations_ms'],loop=0,disposal=2)
def uri(p):return 'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()
data=dict(old=[uri(S/f'frames/frame_{i+1:02}.png') for i in range(32)],new=[uri(R/f'frames/frame_{i+1:02}.png') for i in range(32)],dt=meta['frame_duration_ms'],travel=meta['travel_speed_px_s'])
html='''<!doctype html><meta charset="utf-8"><title>Skirt coverage review</title><style>body{font:16px system-ui;background:#eeeae5;color:#49344a}button,select{padding:8px;margin:6px}.pair{display:flex}.stage{width:500px;height:378px;overflow:hidden;position:relative;background:#eeeae5}.stage img{position:absolute;width:378px;height:378px}.dark{background:#263340}</style><h1>Coverage only · manual review required</h1><button id="play">Play</button><button id="prev">Previous</button><button id="next">Next</button><select id="speed"><option value=".25">¼×</option><option value="1" selected>1×</option></select><button id="bg">Light / dark</button><label><input id="travel" type="checkbox">Matched travel</label><b id="label"></b><div class="pair"><div><h2>Original</h2><div class="stage"><img id="a"></div></div><div><h2>Coverage candidate</h2><div class="stage"><img id="b"></div></div></div><p>Original 42.5ms timing and travel speed retained. See REPORT.md for visual limitations.</p><script>const D=DATA,$=s=>document.getElementById(s);let t=0,last=null,on=false;function draw(){let i=Math.floor(t/D.dt)%32;$('a').src=D.old[i];$('b').src=D.new[i];$('label').textContent=(i+1)+'/32';for(let id of ['a','b'])$(id).style.left=($('travel').checked?(t%1360)/1000*D.travel:0)+'px';}function step(d){on=false;$('play').textContent='Play';t=((Math.floor(t/D.dt)+d+32)%32)*D.dt;draw();}$('play').onclick=()=>{on=!on;last=null;$('play').textContent=on?'Pause':'Play';};$('prev').onclick=()=>step(-1);$('next').onclick=()=>step(1);$('travel').onchange=draw;$('bg').onclick=()=>document.querySelectorAll('.stage').forEach(s=>s.classList.toggle('dark'));function tick(n){if(on&&!document.hidden&&last!==null){t+=(n-last)*+$('speed').value;draw();}last=document.hidden?null:n;requestAnimationFrame(tick);}draw();requestAnimationFrame(tick);</script>'''
(R/'index.html').write_text(html.replace('DATA',json.dumps(data)),encoding='utf-8')
meta['status']='COVERAGE_CANDIDATE_MANUAL_REVIEW';meta['coverage_checks']=checks
(R/'frames.json').write_text(json.dumps(meta,indent=2))
assert all(c['outside_mask_changed']==0 and c['protected_forefoot_changed']==0 for c in checks)
print('32 frames; ZIP/source equal; outside-mask and forefoot preservation passed.')
