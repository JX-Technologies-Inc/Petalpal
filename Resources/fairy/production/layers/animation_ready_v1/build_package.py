"""Versioned reconstruction candidate. Never modifies approved inputs or app files."""
from pathlib import Path
import json, hashlib, shutil, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
BASE=ROOT/'Resources/fairy/production'
MASTER=BASE/'master/fairy_first_approved.png'
OLD=BASE/'layers/first_approved'
N=1254
for d in ['images','review','reconstruction_sources']: (HERE/d).mkdir(exist_ok=True)
GEN=Path('C:/Users/cjysu/.codex/generated_images/01a0e920-8626-7cc1-aa96-c0a2908bc06d')
generated={'leg_underlap':'exec-d48fdc6f-67b0-4885-b30f-e1f9a1ca768f.png',
           'arm_underlap':'exec-1107d80c-fb87-4814-94e6-fe45ee0fc7d9.png',
           'costume_underlap':'exec-40524cd9-a972-47ff-bdba-bd5358053f30.png'}
for name,file in generated.items(): shutil.copyfile(GEN/file,HERE/'reconstruction_sources'/f'{name}.png')
sources=[MASTER,ROOT/'Resources/Icon/fairy structure.png',ROOT/'Resources/Icon/fairy.png']+list(OLD.glob('*.png'))
hashes={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sources}
src=np.array(Image.open(MASTER).convert('RGBA')); yy,xx=np.mgrid[:N,:N]
manifest=json.loads((OLD/'manifest.json').read_text())
oldnames=[v['id'] for v in manifest['layers']]
oldowner=np.zeros((N,N),np.int16)
for i,n in enumerate(oldnames): oldowner[np.array(Image.open(OLD/(n+'.png')))[:,:,3]>0]=i
def old(n): return oldowner==oldnames.index(n)
def polygon(points):
    im=Image.new('L',(N,N));ImageDraw.Draw(im).polygon(points,fill=255);return np.array(im)>0
def capsule(a,b,ra,rb=None):
    rb=ra if rb is None else rb
    vx=b[0]-a[0];vy=b[1]-a[1]
    t=np.clip(((xx-a[0])*vx+(yy-a[1])*vy)/(vx*vx+vy*vy),0,1)
    r=ra*(1-t)+rb*t
    return (xx-a[0]-t*vx)**2+(yy-a[1]-t*vy)**2<=r*r
names=['petals_back','wing_left','wing_right','torso','thigh_left','calf_left','foot_left',
       'thigh_right','calf_right','foot_right','dress_base','petals_side','petals_front',
       'upper_arm_right','forearm_right','hand_right','upper_arm_left','forearm_left','hand_left',
       'hair_back','head_face','braided_updo','hair_front','flower_accessory']
idx={n:i for i,n in enumerate(names)}
rename={'dress_back_petals':'petals_back','dress_side_petals':'petals_side','dress_front_petals':'petals_front','body_base':'torso',
        'arm_left_upper':'upper_arm_left','arm_left_lower':'forearm_left','arm_right_upper':'upper_arm_right','arm_right_lower':'forearm_right',
        'leg_left':'calf_left','leg_right':'calf_right'}
owner=np.zeros((N,N),np.int16)
for n in oldnames: owner[old(n)]=idx[rename.get(n,n)]
# Correct anatomical ownership of the lower-body skin, excluding hanging fabric.
zone=polygon([(607,660),(671,674),(714,782),(721,916),(732,1004),(752,1050),(790,1184),(668,1184),(650,1080),(653,1033),(627,967),(604,1008),(638,1066),(665,1162),(539,1164),(536,1070),(575,997),(595,899),(587,820),(603,751)])
r=src[:,:,0].astype(int);g=src[:,:,1].astype(int);b=src[:,:,2].astype(int)
skin=(r>b+8)&(g>b+2)&(r>130)
legpixels=(zone&skin&(yy<1035))|((old('leg_left')|old('leg_right'))&(yy>=1035))
owner[old('leg_left')|old('leg_right')]=idx['dress_base']
boundary=np.interp(yy[:,0],[650,750,835,900,1000,1040,1190],[642,650,637,627,645,651,664])[:,None]
left=legpixels&(xx<boundary);right=legpixels&~left
for side,mask in [('left',left),('right',right)]:
    owner[mask&(yy<842)]=idx['thigh_'+side]
    owner[mask&(yy>=842)&(yy<1025)]=idx['calf_'+side]
    owner[mask&(yy>=1025)]=idx['foot_'+side]
# Bodice stays on torso; petals start below waist.
owner[(old('dress_front_petals')|old('dress_base'))&(yy<438)]=idx['torso']
owner[old('arm_left_lower')&(yy>=614)]=idx['hand_left']
owner[old('arm_right_lower')&(yy>=625)]=idx['hand_right']
# Visible wing mask spill at the right shoulder belongs to body, not wing.
owner[old('wing_right')&skin&(xx<762)&(yy>270)&(yy<365)]=idx['torso']

pivots={'torso':(655,676),'head_face':(650,266),'hair_back':(585,230),'hair_front':(650,150),'braided_updo':(578,239),'flower_accessory':(550,177),
 'upper_arm_left':(587,290),'forearm_left':(566,438),'hand_left':(507,620),'upper_arm_right':(748,375),'forearm_right':(787,491),'hand_right':(839,629),
 'thigh_left':(649,688),'calf_left':(655,842),'foot_left':(606,1014),'thigh_right':(662,682),'calf_right':(686,833),'foot_right':(699,1025),
 'wing_left':(567,357),'wing_right':(724,358),'dress_base':(686,422),'petals_front':(686,422),'petals_side':(590,460),'petals_back':(655,450)}
desired={n:owner==idx[n] for n in names}
for side,hip,knee,ankle in [('left',(649,688),(655,842),(606,1014)),('right',(662,682),(686,833),(699,1025))]:
    desired['thigh_'+side]|=capsule(hip,knee,33,25)
    desired['calf_'+side]|=capsule(knee,ankle,25,17)
    desired['foot_'+side]|=capsule((ankle[0],ankle[1]-12),(ankle[0],ankle[1]+20),17)
for side,shoulder,elbow,wrist in [('left',(587,290),(566,438),(507,620)),('right',(748,375),(787,491),(839,629))]:
    desired['upper_arm_'+side]|=capsule(shoulder,elbow,22,15)
    desired['forearm_'+side]|=capsule(elbow,wrist,15,11)
    desired['hand_'+side]|=capsule((wrist[0],wrist[1]-10),(wrist[0],wrist[1]+14),11)
desired['torso']|=polygon([(604,270),(702,272),(740,334),(733,410),(710,476),(639,475),(599,381)])
for n in ['wing_left','wing_right','dress_base','petals_front','petals_side','petals_back']:
    # Short conservative attachment backing, not a new outer silhouette.
    px,py=pivots[n];desired[n]|=capsule((px,py-10),(px,py+20),15)

def texture(name,box):
    im=Image.open(HERE/'reconstruction_sources'/f'{name}.png').convert('RGBA').crop(box).convert('RGB').resize((N,N),Image.Resampling.BICUBIC)
    return np.array(im)
# Use only the interiors of reconstructed material, excluding generated exterior glow.
skintex=texture('leg_underlap',(470,270,565,780))
armtex=texture('arm_underlap',(665,230,715,450))
clothtex=texture('costume_underlap',(500,300,700,600))
images={};rows=[]
for n in names:
    i=idx[n];own=(owner==i)&(src[:,:,3]>0)
    same=np.zeros((N,N),bool)
    for side in ['left','right']:
        family=['thigh_'+side,'calf_'+side,'foot_'+side] if n in ['thigh_'+side,'calf_'+side,'foot_'+side] else ['upper_arm_'+side,'forearm_'+side,'hand_'+side] if n in ['upper_arm_'+side,'forearm_'+side,'hand_'+side] else []
        if family: same=np.isin(owner,[idx[k] for k in family])
    # Candidate underlap beneath near-opaque pixels. Unlike strictly opaque-only
    # coverage, this can change resting alpha/color; measure and report the drift.
    overlap=desired[n]&same&(src[:,:,3]>=250)
    hidden=desired[n]&(owner>i)&(src[:,:,3]>=250)&~same
    out=np.zeros_like(src)
    tex=armtex if any(k in n for k in ['arm','hand']) else skintex if any(k in n for k in ['thigh','calf','foot']) else clothtex
    out[hidden,:3]=tex[hidden];out[hidden,3]=255
    out[own|overlap]=src[own|overlap]
    images[n]=Image.fromarray(out);images[n].save(HERE/'images'/f'{n}.png')
    rows.append({'name':n,'pivot_source':pivots[n],'source_pixels':int(own.sum()),'joint_overlap_pixels':int(overlap.sum()),'reconstructed_hidden_pixels':int(hidden.sum())})
def compose(ims):
    result=Image.new('RGBA',(N,N))
    for n in names: result=Image.alpha_composite(result,ims[n])
    return result
rest=compose(images);rest.save(HERE/'review/resting_recomposition.png')
ar=np.array(rest);vis=src[:,:,3]>0
rest_exact=bool(np.array_equal(ar[:,:,3],src[:,:,3]) and np.array_equal(ar[vis],src[vis]))
rest_delta=np.abs(ar.astype(int)-src.astype(int))
panel=Image.new('RGB',(N*2,N),'#697580')
panel.paste(Image.fromarray(src),(0,0),Image.fromarray(src));panel.paste(rest,(N,0),rest);panel.save(HERE/'review/source_vs_recomposed.png')
sheet=Image.new('RGB',(6*260,4*290),'#697580');d=ImageDraw.Draw(sheet)
for j,n in enumerate(names):
    im=images[n].copy();im.thumbnail((250,250));x=j%6*260;y=j//6*290;sheet.paste(im,(x,y),im);d.text((x+4,y+253),n,fill='white')
sheet.save(HERE/'review/contact_sheet.png')
def rotate_at(p,angle):
    a=math.radians(angle);c=math.cos(a);s=math.sin(a);x,y=p
    return np.array([[c,-s,x-c*x+s*y],[s,c,y-s*x-c*y],[0,0,1.]])
def warp(im,m):
    inv=np.linalg.inv(m)
    return im.transform((N,N),Image.Transform.AFFINE,tuple(inv[:2,:].flatten()),Image.Resampling.BICUBIC)
parents={}
for side in ['left','right']:
    parents['calf_'+side]='thigh_'+side;parents['foot_'+side]='calf_'+side
    parents['forearm_'+side]='upper_arm_'+side;parents['hand_'+side]='forearm_'+side
diagnostics=[]
for label,angles in [('leg_separation',{'thigh_left':8,'calf_left':-16,'thigh_right':-6,'calf_right':10}),('elbow_bend',{'upper_arm_left':3,'forearm_left':-12,'upper_arm_right':-3,'forearm_right':10}),('secondary',{'wing_left':-1,'wing_right':1,'petals_side':1,'petals_back':-1})]:
    matrices={};posed={}
    for n in names:
        m=rotate_at(pivots[n],angles.get(n,0));m=matrices.get(parents.get(n),np.eye(3))@m
        matrices[n]=m;posed[n]=warp(images[n],m)
    result=compose(posed);result.save(HERE/'review'/f'{label}.png')
    diagnostics.append({'name':label,'angles_degrees':angles,'status':'FAILED_VISUAL_GATE' if label!='secondary' else 'NOT_CERTIFIED'})
report={'status':'FAILED_VALIDATION_DO_NOT_RIG','canvas':[N,N],'draw_order_back_to_front':names,'parts':rows,
 'rest_visible_rgba_exact':rest_exact,'rest_alpha_exact':bool(np.array_equal(ar[:,:,3],src[:,:,3])),
 'rest_max_rgba_difference':rest_delta.max(axis=(0,1)).tolist(),'rest_changed_visible_pixels':int(np.count_nonzero(np.any(rest_delta[vis]>0,axis=1))),
 'source_hashes':hashes,'diagnostics':diagnostics,
 'rig_created':False,'motion_gate_passed':False,'generated_method':'built-in image_gen; only reconstructed interior coverage composited beneath approved pixels',
 'limitations':['Near-opaque source pixels change alpha/color when new underlaps are added.',
 'Leg separation exposes knee transition seams and residual garment boundaries.',
 'Elbow bending exposes gaps between arms and costume; underdress backing remains incomplete.',
 'Parts are reconstruction candidates, not complete animation-ready production artwork.']}
assert hashes=={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sources}
(HERE/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print('24 candidate parts written; rest exact:',rest_exact,'max RGBA difference:',rest_delta.max(axis=(0,1)).tolist(),'; FAILED VALIDATION, DO NOT RIG.')
