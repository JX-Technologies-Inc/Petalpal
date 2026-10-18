"""Validate saved rig-evaluated geometry and final review frames independently."""
from pathlib import Path
import json,hashlib
import numpy as np
from PIL import Image,ImageDraw
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
c=json.loads((HERE/'build_config.json').read_text());top=json.loads((HERE/'mesh_cache/topology.json').read_text());motion=json.loads((HERE/'motion_samples.json').read_text())
rv=json.loads((HERE/'render_validation.json').read_text());assert rv['rest_visible_rgba_exact'] and rv['rest_alpha_exact'] and rv['loop_closure_exact']
paths=sorted((HERE/'frames').glob('walk_*.png'));assert len(paths)==24
for path,sha in c['source_hashes'].items():assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==sha
summary=[];all_sv=[];visible_sv=[];flipped=0;max_ik_error=0.;min_joint_alpha=255
alphas={n:np.array(Image.open(HERE/'images'/f'{n}.png'))[:,:,3] for n in top}
for f,path in enumerate(paths,1):
    im=Image.open(path);assert im.size==(1254,1254) and im.mode=='RGBA';a=np.array(im);assert a[:,:,3].min()==0
    # Preserve faint source residue, but no substantial character pixels may
    # reach the export border.
    assert max(a[0,:,3].max(),a[-1,:,3].max(),a[:,0,3].max(),a[:,-1,3].max())<16
    coords=np.load(HERE/'mesh_cache'/f'frame_{f:03d}.npz');frame_sv=[]
    for n,t in top.items():
        s=np.array(t['source']);d=coords[n]
        ids=np.array([tri for q in t['quads'] for tri in [(q[0],q[1],q[2]),(q[0],q[2],q[3])]])
        sm=np.stack([s[ids[:,1]]-s[ids[:,0]],s[ids[:,2]]-s[ids[:,0]]],axis=2)
        dm=np.stack([d[ids[:,1]]-d[ids[:,0]],d[ids[:,2]]-d[ids[:,0]]],axis=2)
        jac=dm@np.linalg.inv(sm);det=np.linalg.det(jac);flipped+=int((det<=0).sum())
        sv=np.linalg.svd(jac,compute_uv=False);frame_sv.extend(sv.flatten().tolist())
        center=np.clip(s[ids].mean(axis=1).astype(int),0,1253);painted=alphas[n][center[:,1],center[:,0]]>128
        visible_sv.extend(sv[painted].flatten().tolist())
    all_sv.extend(frame_sv)
    for side in ['left','right']:
        leg=motion[f-1]['legs'][side]
        max_ik_error=max(max_ik_error,float(np.linalg.norm(np.array(leg['evaluated_ankle'])-leg['target_ankle'])))
    # Local center probes at knee and elbow regions follow the nearest actual
    # evaluated mesh vertex. They supplement—not replace—the contact-sheet review.
    probes={}
    for n,p in [('calf_left',(629,842)),('calf_right',(686,833)),('forearm_left',(566,438)),('forearm_right',(787,491))]:
        s=np.array(top[n]['source']);i=np.argmin(np.linalg.norm(s-np.array(p),axis=1));point=coords[n][i]+np.array(p)-s[i]
        x,y=np.rint(point).astype(int);region=a[y-1:y+2,x-1:x+2,3];value=int(region.min());probes[n]=value;min_joint_alpha=min(min_joint_alpha,value)
    summary.append({'frame':f,'min_scale':min(frame_sv),'max_scale':max(frame_sv),'joint_center_min_alpha':probes})
assert flipped==0
# Review major phases with large, unscaled joint details.
sheet=Image.new('RGB',(6*300,900),'#687582');draw=ImageDraw.Draw(sheet)
for j,f in enumerate([1,5,9,13,17,21]):
    im=Image.open(HERE/'frames'/f'walk_{f:03d}.png')
    legs=im.crop((530,750,800,1185));sheet.paste(legs,(j*300,25),legs)
    arm=im.crop((485,360,620,690));sheet.paste(arm,(j*300+50,520),arm);draw.text((j*300+5,5),f'Frame {f}',fill='white')
sheet.save(HERE/'review/joint_closeups.png')
report={'status':'PROTOTYPE_READY_FOR_MANUAL_REVIEW','rig_exists':(HERE/'fairy_v2_walk_prototype.blend').exists(),
 'frame_count':24,'rgba_canvas':[1254,1254],'fps':16,'duration_seconds':1.5,
 'rest_exact':True,'loop_closure_exact':True,'mesh_triangle_flips':flipped,
 'mesh_linear_scale_min':min(all_sv),'mesh_linear_scale_max':max(all_sv),
 'painted_triangle_centroid_scale_min':min(visible_sv),'painted_triangle_centroid_scale_max':max(visible_sv),
 'max_ankle_IK_target_error_source_px':max_ik_error,'minimum_joint_center_alpha':min_joint_alpha,
 'frame_checks':summary,'source_hashes_unchanged':True,
 'limits':['Short-stride single-view cutout study, not a production locomotion approval.',
 'Heel/toe roll is approximate; ankle targets are validated, not a physical shoe-ground simulation.',
 'Native Eevee layered-alpha preview differs from approved source; use supplied evaluated-mesh PNG exporter.',
 'Existing source edge residue and fine painterly cutout boundaries remain visible at high magnification.']}
(HERE/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='frame_checks'},indent=2))
