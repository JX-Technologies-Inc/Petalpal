"""Copy approved V2 inputs and define a reproducible isolated Blender build."""
from pathlib import Path
import csv,json,hashlib,shutil
import numpy as np
from PIL import Image
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
V2=ROOT/'Resources/fairy/production/layers/animation_ready_v2'
for d in ['images','review','frames','mesh_cache']:(HERE/d).mkdir(exist_ok=True)
manifest=json.loads((V2/'manifest.json').read_text())
bones=list(csv.DictReader((ROOT/'Resources/fairy/spine/walk_prototype/bone_pivots.csv').open()))
pivots={p['name']:p['pivot_source'] for p in manifest['parts']}
mapping={'head_face':'head','flower_accessory':'flower','dress_base':'skirt_base'}
for b in bones:
    layer=next((k for k,v in mapping.items() if v==b['name']),b['name'])
    if layer in pivots: b['source_x'],b['source_y']=pivots[layer]
    b['source_x']=float(b['source_x']);b['source_y']=float(b['source_y'])
# Preserve established torso/chest anchors; V2 torso image pivot is an attachment
# control, not a request to move the torso bone to the pelvis.
for b in bones:
    if b['name']=='torso':b['source_x'],b['source_y']=686.,422.
grid=list(range(0,1254,16))+[1254]
layers=[];hashes={}
for n in manifest['draw_order_back_to_front']:
    src=V2/'images'/f'{n}.png';dst=HERE/'images'/src.name;shutil.copyfile(src,dst)
    hashes[str(src.relative_to(ROOT))]=hashlib.sha256(src.read_bytes()).hexdigest()
    a=np.array(Image.open(src))[:,:,3];cells=[]
    for j in range(len(grid)-1):
        for i in range(len(grid)-1):
            x,y,x1,y1=grid[i],grid[j],grid[i+1],grid[j+1]
            if a[max(0,y-2):min(1254,y1+2),max(0,x-2):min(1254,x1+2)].any():cells.append([x,y,x1,y1])
    layers.append({'name':n,'bone':mapping.get(n,n),'cells':cells})
master=ROOT/'Resources/fairy/production/master/fairy_first_approved.png'
hashes[str(master.relative_to(ROOT))]=hashlib.sha256(master.read_bytes()).hexdigest()
data={'canvas':1254,'root':[674,1178],'units_per_pixel':0.01,'fps':16,'frames':24,'duration_seconds':1.5,
      'stride_pixels_per_loop':20,'swing_lift_pixels':0.45,'bones':bones,'layers':layers,'source_hashes':hashes,
      'source_package':'animation_ready_v2','render_contract':'Blender evaluated geometry; source-over straight sRGB layer compositing'}
(HERE/'build_config.json').write_text(json.dumps(data,indent=2)+'\n')
print('Prepared 24 unchanged V2 copies;',sum(len(l['cells']) for l in layers),'textured grid cells')
