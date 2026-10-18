from pathlib import Path
import json,shutil,numpy as np
from PIL import Image,ImageDraw
p=Path('Resources/fairy/blender/walk_prototype_v3');(p/'reconstruction_sources').mkdir(exist_ok=True)
assert (p/'reconstruction_sources/complete_legs.png').exists(), 'Saved reconstruction source required'
gen=Image.open(p/'reconstruction_sources/complete_legs.png').convert('RGBA');print(gen.size)
for side in ['left','right']:
 if side=='left':
  ty=[678,760,842,940,1014,1155];gy=[50,160,270,440,580,795];tx=[649,650,629,614,606,607];gx=[460,485,500,440,418,414]
 else:
  ty=[678,760,833,940,1025,1180];gy=[45,170,290,470,590,816];tx=[676,686,686,684,699,728];gx=[1343,1380,1380,1390,1410,1440]
 mesh=[]
 for y in range(678,ty[-1],4):
  y1=min(y+4,ty[-1]);sy=float(np.interp(y,ty,gy));sy1=float(np.interp(y1,ty,gy));cx=float(np.interp(y,ty,tx));cx1=float(np.interp(y1,ty,tx));g=float(np.interp(y,ty,gx));g1=float(np.interp(y1,ty,gx))
  x0,x1=500,820;scale=.64
  mesh.append(((x0,y,x1,y1),((x0-cx)/scale+g,sy,(x0-cx1)/scale+g1,sy1,(x1-cx1)/scale+g1,sy1,(x1-cx)/scale+g,sy)))
 full=gen.transform((1254,1254),Image.Transform.MESH,mesh,Image.Resampling.BICUBIC);a=np.array(full)
 # Keep exact approved shoe painting, not the generated shoe variant.
 old=Image.new('RGBA',(1254,1254))
 for n in ['thigh','calf','foot']:old=Image.alpha_composite(old,Image.open(p/'rest_images'/f'{n}_{side}.png'))
 orig=np.array(old);start=1004 if side=='left' else 1015
 for y in range(start,1254):
  blend=min(1,(y-start)/25);a[y]=np.rint(a[y]*(1-blend)+orig[y]*blend).astype('uint8')
 # Extend the upper-thigh attachment conservatively beneath the skirt.
 for y in range(635,700):
  row=700;valid=np.flatnonzero(a[row,:,3]>240)
  if len(valid):
   a[y,valid]=a[row,valid]
 for n,lo,hi in [('thigh',0,885),('calf',795,1070),('foot',990,1254)]:
  b=a.copy();b[:lo,:,3]=0;b[hi:,:,3]=0;Image.fromarray(b).save(p/'images'/f'{n}_{side}.png')
# Mask only the detached leg/ankle residue in the costume's central void.
m=Image.new('L',(1254,1254));ImageDraw.Draw(m).polygon([(608,846),(713,846),(718,982),(796,1195),(533,1195),(533,1040),(571,955),(588,879)],fill=255);m=np.array(m)>0
for n in [l['name'] for l in json.loads((p/'build_config.json').read_text())['layers'] if not l['name'].startswith(('thigh','calf','foot'))]:
 a=np.array(Image.open(p/'rest_images'/f'{n}.png'));a[m,3]=0;a[1110:,:,3]=0;Image.fromarray(a).save(p/'images'/f'{n}.png')
c=json.loads((p/'build_config.json').read_text());grid=list(range(0,1254,12))+[1254]
for l in c['layers']:
 n=l['name'];a=np.maximum(np.array(Image.open(p/'images'/f'{n}.png'))[:,:,3],np.array(Image.open(p/'rest_images'/f'{n}.png'))[:,:,3]);l['cells']=[]
 for y,y1 in zip(grid,grid[1:]):
  for x,x1 in zip(grid,grid[1:]):
   if a[max(0,y-2):min(1254,y1+2),max(0,x-2):min(1254,x1+2)].any():l['cells'].append([x,y,x1,y1])
(p/'build_config.json').write_text(json.dumps(c,indent=2))
