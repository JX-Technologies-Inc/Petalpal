from pathlib import Path
import sys,json,math,hashlib,zipfile
sys.dont_write_bytecode=True
import build as b
import numpy as np
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parent;S=b.S
result=json.loads((R/'validation.json').read_text())
errors=[]
for name in b.CONFIG:
 for lo,hi in [(0,.119),(.12,.459),(.46,.619)]:
  world=[]
  for p in np.linspace(lo,hi,50):
   _,_,r=b.foot_pose(name,float(p));q=r['active_contact'];world.append([q[0]+p*44/.62,q[1]])
   m=np.array(r['rigid_shoe_matrix']);assert np.allclose(m.T@m,np.eye(2),atol=1e-12)
  errors.append(float(np.ptp(np.array(world)[:,0])))
result['max_analytical_stance_contact_world_x_drift_px']=max(errors)
result['rigid_shoe_transform_scale']=1.0
result['ground_lock_scope']='Analytical heel/forefoot pivots, with root travel 52.182163 px/s. Not all antialiased sole pixels or perceptual ground lock.'
for boundary in [0,.12,.46,.62]:
 for name in b.CONFIG:
  _,a,_=b.foot_pose(name,(boundary-1e-7)%1);_,c,_=b.foot_pose(name,(boundary+1e-7)%1)
  assert np.linalg.norm(a-c)<.001
result['continuous_ankle_at_phase_boundaries']=True
for i in range(1,33):
 a=np.array(Image.open(S/f'frames/frame_{i:02}.png'));c=np.array(Image.open(R/f'frames/frame_{i:02}.png'));m=np.array(Image.open(R/f'masks/frame_{i:02}.png'))
 assert np.array_equal(a[m==0],c[m==0]);assert np.array_equal(a[:280],c[:280])
 assert c.shape==(378,378,4)
with Image.open(R/'review/walk.gif') as gif:
 n=gif.n_frames;duration=0
 for i in range(n):gif.seek(i);duration+=gif.info['duration']
 assert n==32 and duration==1360
result['decoded_gif_frames']=n;result['decoded_gif_duration_ms']=duration
meta=json.loads((R/'frames.json').read_text());assert all(hashlib.sha256((S/p).read_bytes()).hexdigest()==h for p,h in meta['source_hashes'].items())
# Paired close-ups of representative contact/down/passing/toe-off frames.
sheet=Image.new('RGB',(720,235*8),'#eeeeea');d=ImageDraw.Draw(sheet);font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',15)
for row,i in enumerate([1,5,9,13,17,21,25,29]):
 for col,folder in enumerate([S,R]):
  im=Image.open(folder/f'frames/frame_{i:02}.png').crop((135,280,255,348)).resize((360,204),Image.Resampling.NEAREST)
  sheet.paste(im,(360*col,row*235+27),im);d.text((col*360+6,row*235+4),f'{i:02} — '+('Before' if col==0 else 'Foot correction'),fill='black',font=font)
sheet.save(R/'review/key_pose_comparison.png')
(R/'validation.json').write_text(json.dumps(result,indent=2))
print(json.dumps({k:v for k,v in result.items() if k!='frames'},indent=2))
