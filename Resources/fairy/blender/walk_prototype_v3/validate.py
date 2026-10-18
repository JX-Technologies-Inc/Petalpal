from pathlib import Path
import json,hashlib,math
import numpy as np
from PIL import Image
p=Path(__file__).resolve().parent;c=json.loads((p/'build_config.json').read_text());m=json.loads((p/'motion_samples.json').read_text());top=json.loads((p/'mesh_cache/topology.json').read_text());root=p.parents[3]
rest=np.array(Image.open(p/'review/resting_recomposition.png'));master=np.array(Image.open(root/'Resources/fairy/production/master/fairy_first_approved.png'));vis=master[:,:,3]>0
assert np.array_equal(rest[vis],master[vis]) and np.array_equal(rest[:,:,3],master[:,:,3])
assert all(hashlib.sha256((root/f).read_bytes()).hexdigest()==h for f,h in c['source_hashes'].items())
order=[]
for f in [1,13]:
 l=m[f-1]['legs'];delta=l['left']['evaluated_ankle'][0]-l['right']['evaluated_ankle'][0];order.append(delta)
assert order[0]>50 and order[1]<-50
errors=[];flips=0;scales=[];painted_scales=[]
alphas={n:np.array(Image.open(p/'images'/f'{n}.png'))[:,:,3] for n in top}
for f in range(1,25):
 im=Image.open(p/'frames'/f'walk_{f:03d}.png');assert im.mode=='RGBA' and im.size==(1254,1254)
 coords=np.load(p/'mesh_cache'/f'frame_{f:03d}.npz')
 for n,t in top.items():
  src=np.array(t['source']);dst=coords[n];ids=np.array([tri for q in t['quads'] for tri in [(q[0],q[1],q[2]),(q[0],q[2],q[3])]])
  sm=np.stack([src[ids[:,1]]-src[ids[:,0]],src[ids[:,2]]-src[ids[:,0]]],axis=2);dm=np.stack([dst[ids[:,1]]-dst[ids[:,0]],dst[ids[:,2]]-dst[ids[:,0]]],axis=2);j=dm@np.linalg.inv(sm);bad=np.linalg.det(j)<=0
  if bad.any():print("FOLD",f,n,src[ids[bad]].mean(axis=1).tolist())
  flips+=int(bad.sum());sv=np.linalg.svd(j,compute_uv=False);scales.extend(sv.flatten().tolist())
  centers=np.clip(src[ids].mean(axis=1).astype(int),0,1253);painted=alphas[n][centers[:,1],centers[:,0]]>128;painted_scales.extend(sv[painted].flatten().tolist())
 for side in ['left','right']:
  l=m[f-1]['legs'][side];errors.append(float(np.linalg.norm(np.array(l['evaluated_ankle'])-l['target_ankle'])))
# Heel, flat sole and toe stages each keep their actual support contact fixed
# in world space while root advances. Test each stage independently.
drifts=[]
for side in ['left','right']:
 for stage in ['heel','flat','toe']:
  points=[]
  for row in m[:24]:
   l=row['legs'][side];ph=l['phase']
   if l['state']!='stance':continue
   active='heel' if ph<.12 else 'toe' if ph>=.36 else 'flat'
   if active!=stage:continue
   v=np.array([-50.,120.]) if side=='left' else np.array([-10.,125.])
   if stage=='toe':v=np.array([50.,133.]) if side=='left' else np.array([75.,148.])
   if stage=='flat':v=np.zeros(2)
   a=math.radians(l['foot_roll_degrees']);r=np.array([[math.cos(a),-math.sin(a)],[math.sin(a),math.cos(a)]])
   points.append(np.array(l['evaluated_ankle'])+r@v+[row['root_travel_px'],0])
  drifts.append(float(np.max(np.ptp(np.array(points),axis=0))))
a=np.load(p/'mesh_cache/frame_001.npz');b=np.load(p/'mesh_cache/frame_025.npz');closure=max(float(np.max(abs(a[n]-b[n]))) for n in a.files)
changed=[x.name for x in (p/'images').glob('*.png') if x.read_bytes()!=(p/'rest_images'/x.name).read_bytes()]
r={'status':'EXPORTED_FOR_MANUAL_REVIEW','frames':24,'fps':16,'duration_seconds':1.5,'rest_visible_rgba_and_alpha_exact':True,'approved_sources_unchanged':True,'opposing_contact_left_minus_right_ankle_x':order,'swing_lift_px':35,'root_travel_px_per_loop':280,'max_ik_error_px':max(errors),'max_support_contact_drift_px':max(drifts),'mesh_folded_triangles':flips,'mesh_scale_range':[min(scales),max(scales)],'painted_mesh_scale_range':[min(painted_scales),max(painted_scales)],'loop_geometry_error_px':closure,'motion_layers_changed':changed,'rest_texture_state':'original V2, frame 0','motion_texture_state':'repaired separate local copies, frames 1..25','native_eevee_exact':False}
print("CHECK_METRICS",max(errors),max(drifts),flips)
assert max(errors)<.001 and max(drifts)<.001 and flips==0
(p/'validation.json').write_text(json.dumps(r,indent=2));print(json.dumps(r,indent=2))
