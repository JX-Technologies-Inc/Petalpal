"""Strict V1 correction. No new generated artwork, no rig, no input mutations."""
from pathlib import Path
import json, hashlib, math, shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE=Path(__file__).resolve().parent
V1=HERE.parent/'animation_ready_v1'
ROOT=HERE.parents[4]
BASE=ROOT/'Resources/fairy/production'; MASTER=BASE/'master/fairy_first_approved.png'; OLD=BASE/'layers/first_approved'
N=1254
for d in ['images','review']: (HERE/d).mkdir(exist_ok=True)
v1=json.loads((V1/'manifest.json').read_text())
names=v1['draw_order_back_to_front']; idx={n:i for i,n in enumerate(names)}
inputs=[MASTER]+list((V1/'images').glob('*.png'))
hashes={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}
v1im={n:np.array(Image.open(V1/'images'/f'{n}.png').convert('RGBA')) for n in names}
# Recover V1's source ownership without running its writer or changing its files.
text=(V1/'build_package.py').read_text()
scope={'np':np,'Image':Image,'ImageDraw':ImageDraw,'json':json,'MASTER':MASTER,'OLD':OLD,'N':N}
exec(text[text.index('src=np.array'):text.index('\npivots=')],scope)
src=scope['src']; owner=scope['owner']; xx=scope['xx']; yy=scope['yy']; polygon=scope['polygon']; capsule=scope['capsule']
pivots={p['name']:tuple(p['pivot_source']) for p in v1['parts']}
pivots['calf_left']=(629,842);pivots['thigh_left']=(649,688)
# Replace the threshold-fragmented leg selection with continuous anatomical
# contours traced on the approved master. Every source pixel is still retained.
oldlegs=np.isin(owner,[idx[n] for n in names if n.startswith(('thigh_','calf_','foot_'))])
owner[oldlegs]=idx['dress_base']
legzone=polygon([(605,676),(626,659),(661,692),(680,669),(690,659),(700,714),(707,738),
 (697,769),(698,804),(696,830),(689,853),(691,919),(696,971),(706,1011),
 (727,1057),(751,1107),(779,1147),(790,1174),(760,1181),(679,1168),(663,1110),
 (650,1068),(650,1043),(647,1014),(642,979),(638,954),(639,932),(628,955),
 (615,983),(610,1004),(614,1054),(628,1102),(659,1125),(664,1150),
 (619,1161),(548,1146),(537,1106),(538,1066),(551,1032),(564,1004),(575,980),
 (581,946),(584,909),(586,882),(598,852),(617,824),(630,803),(635,778),(627,746),(613,717)])
boundary=np.interp(yy[:,0],[650,700,750,800,850,900,930,1000,1190],[635,642,649,652,646,647,654,647,660])[:,None]
# Use the painted continuous skin runs for the exposed legs, not the prior
# approximate polygon which omitted narrow strips along the calves.
rgb=src[:,:,:3].astype(int)
skin=(rgb[:,:,0]>rgb[:,:,2]+12)&(rgb[:,:,1]>rgb[:,:,2]+4)&(src[:,:,3]>150)
legzone=np.zeros((N,N),bool)
legzone[670:700]=skin[670:700]&((xx[670:700]>=615)&(xx[670:700]<=720))
for y in range(700,1035):
    xs=np.flatnonzero(skin[y,575:735])+575
    runs=np.split(xs,np.where(np.diff(xs)>1)[0]+1)
    runs=[q for q in runs if len(q)>18]
    for q in runs:
        legzone[y,max(0,q[0]-2):min(N,q[-1]+3)]=True
legzone[1035:]=(scope['old']('leg_left')|scope['old']('leg_right'))[1035:]
# Move the remaining low-alpha ankle/skin fringe with its limb, not the dress.
for y in range(850,1035):
    xs=np.flatnonzero(legzone[y])
    if len(xs):
        expanded=np.array(Image.fromarray((legzone[y:y+1]*255).astype(np.uint8)).resize((N,9)).filter(ImageFilter.MaxFilter(9)))[4]>0
        legzone[y]|=expanded&(src[y,:,3]>0)&(rgb[y,:,0]>rgb[y,:,2]+8)
for side,m in [('left',legzone&(xx<boundary)),('right',legzone&(xx>=boundary))]:
    owner[m&(yy<822)]=idx['thigh_'+side]
    owner[m&(yy>=822)&(yy<1004)]=idx['calf_'+side]
    owner[m&(yy>=1004)]=idx['foot_'+side]

unchanged=['hair_back','head_face','braided_updo','hair_front','flower_accessory']
wanted={n:(v1im[n][:,:,3]>0)|(owner==idx[n]) for n in names}
# Do not let V1 dress masks retain leg paint after anatomical ownership repair.
for n in ['dress_base','petals_front','petals_side','petals_back']:
    wanted[n]&=~legzone
for side,hip,knee,ankle in [('left',(649,688),(629,842),(606,1014)),('right',(662,682),(686,833),(699,1025))]:
    wanted['thigh_'+side]|=capsule(hip,knee,32,31)|capsule(knee,(knee[0],knee[1]+28),30,26)
    wanted['calf_'+side]|=capsule(knee,ankle,29,18)|capsule(ankle,(ankle[0],ankle[1]+24),21)
for side,shoulder,elbow,wrist in [('left',(587,290),(566,438),(507,620)),('right',(748,375),(787,491),(839,629))]:
    wanted['upper_arm_'+side]|=capsule(shoulder,elbow,22,22)|capsule(elbow,(elbow[0],elbow[1]+24),22)
    wanted['forearm_'+side]|=capsule(elbow,wrist,19,15)|capsule(wrist,(wrist[0],wrist[1]+18),15)
    # Costume backing under the moving arm/sleeve; never put leg paint here.
    wanted['dress_base']|=capsule(shoulder,elbow,27,23)|capsule(elbow,wrist,24,17)
    arm_owner=np.isin(owner,[idx['upper_arm_'+side],idx['forearm_'+side],idx['hand_'+side]])
    wanted['dress_base']|=arm_owner&(yy>=350)
    wanted['torso']|=arm_owner&(yy<350)

def material(name,box):
    return np.array(Image.open(V1/'reconstruction_sources'/f'{name}.png').convert('RGB').crop(box).resize((N,N),Image.Resampling.BICUBIC))
skintex=material('leg_underlap',(470,270,565,780)); armtex=material('arm_underlap',(665,230,715,450)); clothtex=material('costume_underlap',(500,300,700,600))
families={}
for side in ['left','right']:
    for group in [['thigh_'+side,'calf_'+side,'foot_'+side],['upper_arm_'+side,'forearm_'+side,'hand_'+side]]:
        for n in group: families[n]=group
hidden={};textures={}
for n in names:
    hidden[n]=wanted[n]&(owner>idx[n])&(src[:,:,3]>=220)&~np.isin(owner,[idx[k] for k in unchanged]) if n not in unchanged else np.zeros((N,N),bool)
    tex=skintex.copy() if n.startswith(('thigh_','calf_','foot_')) else armtex.copy() if n.startswith(('upper_arm_','forearm_','hand_')) else clothtex.copy()
    if n=='dress_base':
        # Back the vacated sleeve edge with adjacent approved costume paint,
        # rather than stretching a generic dark patch across the arm opening.
        for side,offset in [('left',90),('right',-100)]:
            m=np.isin(owner,[idx['upper_arm_'+side],idx['forearm_'+side],idx['hand_'+side]])&(yy>=350)
            sample=src[yy,np.clip(xx+offset,0,N-1)]
            ss=sample[:,:,:3].astype(int)
            sample_skin=(ss[:,:,0]>ss[:,:,2]+12)&(ss[:,:,1]>ss[:,:,2]+4)
            good=m&(sample[:,:,3]>220)&~sample_skin;tex[good]=sample[good,:3]
    same=np.isin(owner,[idx[g] for g in families.get(n,[])])
    tex[same]=src[same,:3]; textures[n]=tex
# Allocate alpha among hidden layers: never exceed a compositable background
# budget. RGB/alpha of the visible owner is then solved against the master.
counts=sum(m.astype(np.int16) for m in hidden.values())
amin=src[:,:,3].astype(float)/255
low=np.full((N,N,3),255.,dtype=float);high=np.zeros((N,N,3),float)
for n in names:
    h=hidden[n];low[h]=np.minimum(low[h],textures[n][h]);high[h]=np.maximum(high[h],textures[n][h])
ct=src[:,:,:3].astype(float);at=amin[:,:,None]
# Gamut-aware alpha budget: solve foreground colors without clipping. This is
# a compositing correction, not recoloring the visible resting image.
upper=at*(255-ct)/np.maximum(255-ct*at-low*(1-at),1e-9)
lower=ct*at/np.maximum(ct*at+high*(1-at),1e-9)
budget=np.minimum(np.minimum(amin-0.02,238/255),0.90*np.minimum(upper,lower).min(axis=2))
# Feather same-material limb overlaps through the joint rather than cutting
# the child at a hard horizontal seam. This affects only alpha distribution.
for child,start,end in [('calf_left',822,862),('calf_right',822,862),('foot_left',1004,1044),('foot_right',1004,1044)]:
    m=(owner==idx[child])&(counts==1)&(yy>=start)&(yy<end)
    same_color=(np.max(np.abs(low-ct),axis=2)<0.5)&(np.max(np.abs(high-ct),axis=2)<0.5)
    m &=same_color
    t=np.clip((yy-start)/(end-start),0,1); t=t*t*(3-2*t)
    af=amin*t
    want=(amin-af)/np.maximum(1-af,1e-9)
    budget[m]=want[m]
per=np.floor(255*(1-np.power(1-np.maximum(budget,0),1/np.maximum(counts,1)))).astype(np.uint8)
arrays={}; rows=[]; bg=Image.new('RGBA',(N,N))
for n in names:
    i=idx[n]; own=(owner==i)&(src[:,:,3]>0)
    if n in unchanged:
        a=v1im[n].copy()
    else:
        a=np.zeros_like(src);h=hidden[n];a[h,3]=per[h]
        tex=textures[n]
        a[h,:3]=tex[h]
        same=np.isin(owner,[idx[g] for g in families.get(n,[])])
        a[h&same,:3]=src[h&same,:3]
        behind=np.array(bg).astype(float);ab=behind[:,:,3];at=src[:,:,3].astype(float)
        af=np.clip(np.rint(255*(at-ab)/np.maximum(255-ab,1)),0,255)
        a[own,3]=af[own].astype(np.uint8)
        cf=(src[:,:,:3].astype(float)*at[:,:,None]*255-behind[:,:,:3]*ab[:,:,None]*(255-af[:,:,None]))/np.maximum(af[:,:,None]*255,1)
        a[own,:3]=np.clip(np.rint(cf[own]),0,255).astype(np.uint8)
        # Integer alpha-compositing compensation, independently tested below.
        for _ in range(10):
            c=np.array(Image.alpha_composite(bg,Image.fromarray(a)))
            delta=src.astype(int)-c.astype(int)
            if not np.any(delta[own]): break
            for ch in range(4):
                vals=a[:,:,ch].astype(int); vals[own]=np.clip(vals[own]+np.sign(delta[:,:,ch][own]),0,255);a[:,:,ch]=vals.astype(np.uint8)
    arrays[n]=a;bg=Image.alpha_composite(bg,Image.fromarray(a))
    rows.append({'name':n,'pivot_source':pivots[n],'hidden_pixels':int(hidden[n].sum()),'source_owned_pixels':int(own.sum())})

rest=np.array(bg);vis=src[:,:,3]>0;delta=np.abs(rest.astype(int)-src.astype(int))
exact=bool(np.array_equal(rest[:,:,3],src[:,:,3]) and np.array_equal(rest[vis],src[vis]))
for n in names:
    dest=HERE/'images'/f'{n}.png'
    if n in unchanged: shutil.copyfile(V1/'images'/f'{n}.png',dest)
    else: Image.fromarray(arrays[n]).save(dest)
bg.save(HERE/'review/resting_recomposition.png')
comparison=Image.new('RGB',(N*2,N),'#687582');comparison.paste(Image.fromarray(src),(0,0),Image.fromarray(src));comparison.paste(bg,(N,0),bg);comparison.save(HERE/'review/source_vs_recomposed.png')
diff=np.zeros_like(src);diff[:,:,:3]=np.clip(delta[:,:,:3]*32,0,255);diff[~vis,:3]=0;diff[:,:,3]=255;Image.fromarray(diff).save(HERE/'review/rest_difference_x32.png')

def rot(p,angle):
    a=math.radians(angle);c=math.cos(a);s=math.sin(a);x,y=p
    return np.array([[c,-s,x-c*x+s*y],[s,c,y-s*x-c*y],[0,0,1.]])
def warp(im,m):
    return im.transform((N,N),Image.Transform.AFFINE,tuple(np.linalg.inv(m)[:2].flatten()),Image.Resampling.BICUBIC)
def smooth_joint_mesh(parent_pivot,parent_angle,joint,joint_angle):
    """Shared 2D deformation field for the three parts of one limb.

    This is a diagnostic skinning contract, not an armature. All adjacent parts
    use the same field through the joint; independent rigid quad rotations are
    deliberately not claimed to be safe for painterly overlapped cutouts.
    """
    inv_parent=np.linalg.inv(rot(parent_pivot,parent_angle))
    def inverse(x,y):
        q=inv_parent@np.array([x,y,1.]);sx,sy=q[0],q[1]
        for _ in range(8):
            t=np.clip((sy-(joint[1]-30))/60,0,1);t=t*t*(3-2*t)
            a=math.radians(-joint_angle*t);c=math.cos(a);s=math.sin(a)
            dx=q[0]-joint[0];dy=q[1]-joint[1]
            sx=joint[0]+c*dx-s*dy;sy=joint[1]+s*dx+c*dy
        return float(sx),float(sy)
    mesh=[]
    for y in range(0,N,24):
        for x in range(0,N,24):
            x1=min(x+24,N);y1=min(y+24,N)
            quad=(*inverse(x,y),*inverse(x,y1),*inverse(x1,y1),*inverse(x1,y))
            mesh.append(((x,y,x1,y1),quad))
    return mesh
parents={}
for side in ['left','right']:
    parents['calf_'+side]='thigh_'+side;parents['foot_'+side]='calf_'+side
    parents['forearm_'+side]='upper_arm_'+side;parents['hand_'+side]='forearm_'+side
tests=[('mild_left_knee',{'calf_left':-6}),('mild_right_knee',{'calf_right':6}),
 ('mild_left_arm',{'forearm_left':-5}),('mild_right_arm',{'forearm_right':5}),
 ('restrained_step',{'thigh_left':2,'calf_left':-6,'thigh_right':-2,'calf_right':4,'forearm_left':-3,'forearm_right':3})]
poses=[]
for label,angles in tests:
    mats={};out=Image.new('RGBA',(N,N))
    fields={}
    for side in ['left','right']:
        for upper,lower in [('thigh_'+side,'calf_'+side),('upper_arm_'+side,'forearm_'+side)]:
            if angles.get(upper,0) or angles.get(lower,0):
                field=smooth_joint_mesh(pivots[upper],angles.get(upper,0),pivots[lower],angles.get(lower,0))
                for part in families[upper]: fields[part]=field
    for n in names:
        m=mats.get(parents.get(n),np.eye(3))@rot(pivots[n],angles.get(n,0));mats[n]=m
        im=Image.fromarray(arrays[n])
        posed=im.transform((N,N),Image.Transform.MESH,fields[n],Image.Resampling.BICUBIC) if n in fields else warp(im,m)
        out=Image.alpha_composite(out,posed)
    out.save(HERE/'review'/f'{label}.png');poses.append((label,out))
sheet=Image.new('RGB',(3*627,2*660),'#687582');draw=ImageDraw.Draw(sheet)
for j,(label,im) in enumerate([('resting',bg)]+poses):
    x=j%3*627;y=j//3*660;small=im.resize((627,627),Image.Resampling.LANCZOS);sheet.paste(small,(x,y+28),small);draw.text((x+10,y+6),label,fill='white')
sheet.save(HERE/'review/articulation_diagnostic_sheet.png')
report={'status':'PENDING_VISUAL_REVIEW','canvas':[N,N],'draw_order_back_to_front':names,'parts':rows,
 'rest_exact_visible_rgba':exact,'rest_alpha_exact':bool(np.array_equal(rest[:,:,3],src[:,:,3])),
 'rest_max_visible_rgba_delta':delta[vis].max(axis=0).tolist(),'rest_changed_visible_pixels':int(np.count_nonzero(np.any(delta[vis]>0,axis=1))),
 'unchanged_byte_identical_layers':unchanged,'diagnostic_deformation':'shared limb skinning field, smoothstep blend over 60 source px at knee/elbow; rigid feet/hands below bend',
 'diagnostics':[{'name':n,'angles':a} for n,a in tests],
 'source_hashes':hashes,'blender_rig_created':False}
assert hashes=={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}
(HERE/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k.startswith('rest_')},indent=2))
