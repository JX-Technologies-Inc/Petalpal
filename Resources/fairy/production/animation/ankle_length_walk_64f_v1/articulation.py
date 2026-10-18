"""Deterministic, pose-directed local cutout inbetweens. Never edits source anchors.

Shoes use separate rigid translations (unit scale, zero shear). Pinned lower-
petal panels follow the hidden ankle attachment tracks. Forearm controls follow
the endpoint wrist landmarks. Head, hair and wings reuse the endpoint painting
with at most one pixel of pose-derived body rise, sampled once.
No optical flow, frame blending, generated anatomy, or whole-sprite transform.
"""
from pathlib import Path
import sys, json, hashlib, shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
SRC = OUT.parent / 'ankle_length_walk_16f_v1'
sys.path.insert(0, str(OUT.parent / 'long_skirt_walk_24f_v1' / '_tool_deps'))
import cv2

N = 378
# Screen-space track names deliberately do not assert unproven anatomical sides.
# Point = visible forefoot tip/contact, not a new sprite origin.
LEFT = [(172,342),(166,339),(162,335),(164,334),(193,341),(158,334),
        (156,335),(173,338),(155,340),(147,336),(148,333),(150,329),
        (194,342),(163,335),(164,337),(173,342)]
RIGHT = [(257,342),(263,342),(258,342),(245,342),(217,342),(231,342),
         (227,342),(230,342),(257,342),(246,342),(241,342),(244,342),
         (215,342),(264,342),(259,342),(258,342)]
BODY_TOP = [37,38,37,37,37,35,37,38,36,36,37,37,38,39,38,38]
# Upper boundary follows the petal/shoe overlap; these include a short concealed
# join so its painting translates with the shoe. Both shoes remain independent.
SHOES = [
 [(134,314,178,346),(219,316,266,346)],
 [(132,311,171,342),(221,319,270,346)],
 [(131,300,163,336),(220,320,265,346)],
 [(134,298,166,335),(217,321,264,346)],
 [(156,320,194,346),(191,321,222,346)],
 [(137,301,165,335),(194,322,232,346)],
 [(131,298,161,336),(195,322,237,346)],
 [(138,299,174,339),(195,320,239,346)],
 [(121,312,163,345),(220,318,265,346)],
 [(119,305,159,342),(225,320,268,346)],
 [(122,300,160,337),(222,319,265,346)],
 [(126,296,160,336),(228,318,271,346)],
 [(159,320,195,346),(192,320,223,346)],
 [(135,309,174,343),(223,320,269,346)],
 [(130,310,174,344),(226,320,275,346)],
 [(140,319,184,346),(227,320,273,346)],
]
WRIST = [(204,216),(203,216),(206,216),(209,217),(202,216),(201,216),
         (198,218),(201,218),(176,213),(176,211),(178,214),(180,215),
         (206,220),(204,216),(205,217),(203,216)]

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def savejson(p,data): p.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
def smooth(t):
    t=np.clip(t,0,1); return t*t*(3-2*t)

def art_pose(i,t):
    j=(i+1)%16
    # Use the more separated endpoint as the cutout donor. Moving its petal
    # panels inward gives legitimate overlap instead of stretching a closed
    # pose apart and inventing painting behind the occlusion.
    donor=max([i,j],key=lambda k: RIGHT[k][0]-LEFT[k][0])
    a=np.array(Image.open(SRC/'frames'/f'frame_{donor+1:02}.png').convert('RGBA'))
    dl=(np.array(LEFT[j],float)*t+np.array(LEFT[i])*(1-t))-LEFT[donor]
    dr=(np.array(RIGHT[j],float)*t+np.array(RIGHT[i])*(1-t))-RIGHT[donor]
    dw=(np.array(WRIST[j],float)*t+np.array(WRIST[i])*(1-t))-WRIST[donor]
    body_dy=(BODY_TOP[i]*(1-t)+BODY_TOP[j]*t)-BODY_TOP[donor]
    boxes=SHOES[donor]
    def move(p):
        x,y=p
        d=np.array([0.,0.])
        # Local shoulder/elbow-to-wrist articulation; head has no deformation.
        center=195+(WRIST[donor][0]-195)*np.clip((y-160)/55,0,1)
        arm_x=np.clip(1-abs(x-center)/27,0,1)
        arm_y=smooth((y-160)/45)*(1-smooth((y-224)/14))
        d+=dw*arm_x*arm_y
        return np.array(p)+d

    # A local mesh below the shoulder; untouched upper painting is overwritten
    # byte-exact after rasterization. Extra shoe boundary points enforce rigidity.
    pts={(0.,0.),(377.,0.),(0.,377.),(377.,377.)}
    for y in [0,120,145,160,180,200,220,235,250,270,285,300,315,330,346,360,377]:
        for x in [0,65,85,105,125,145,165,185,205,225,245,265,285,315,345,377]:
            if not any(b[0]<x<b[2] and b[1]<y<b[3] for b in boxes): pts.add((float(x),float(y)))
    for x0,y0,x1,y1 in boxes:
        for x in np.linspace(x0,x1,7):
            for y in np.linspace(y0,y1,5): pts.add((float(x),float(y)))
    pts=np.array(sorted(pts),np.float32)
    dst=np.array([move(p) for p in pts],np.float32)
    sub=cv2.Subdiv2D((0,0,N,N))
    for p in pts: sub.insert(tuple(float(v) for v in p))
    triangles=sub.getTriangleList().reshape(-1,3,2)
    yy,xx=np.mgrid[0:N,0:N]
    maps=np.stack([xx,yy],axis=-1).astype(np.float32)
    jac=[]
    for tri in triangles:
        ids=[np.argmin(np.sum((pts-p)**2,axis=1)) for p in tri]
        st=pts[ids]; dt=dst[ids]
        u,v=st[1]-st[0],st[2]-st[0];oldcross=u[0]*v[1]-u[1]*v[0]
        u,v=dt[1]-dt[0],dt[2]-dt[0];newcross=u[0]*v[1]-u[1]*v[0]
        if abs(oldcross)>1e-4: jac.append(float(newcross/oldcross))
        if abs(newcross)<1e-4: continue
        x0=max(0,int(np.floor(dt[:,0].min())));x1=min(N,int(np.ceil(dt[:,0].max()))+1)
        y0=max(0,int(np.floor(dt[:,1].min())));y1=min(N,int(np.ceil(dt[:,1].max()))+1)
        if x1<=x0 or y1<=y0: continue
        roi=np.zeros((y1-y0,x1-x0),np.uint8)
        cv2.fillConvexPoly(roi,np.rint((dt-[x0,y0])*256).astype(np.int32),1,shift=8)
        inv=cv2.getAffineTransform(dt,st)
        q=np.stack([xx[y0:y1,x0:x1],yy[y0:y1,x0:x1],np.ones_like(roi)],axis=-1)
        uv=q@inv.T
        maps[y0:y1,x0:x1][roi>0]=uv[roi>0]
    # Exact inverse rigid maps inside transported shoe rectangles. This avoids
    # any Delaunay triangle crossing from stretching the approved shoe geometry.
    for box,d in zip(boxes,[dl,dr]):
        x0,y0,x1,y1=np.array(box)+np.tile(d,2)
        m=(xx>=x0)&(xx<=x1)&(yy>=y0)&(yy<=y1)
        maps[m]=np.stack([xx[m]-d[0],yy[m]-d[1]],axis=-1)
    # Pose-derived body rise, not independent recentering. One source sampling
    # pass; identity texture has a rigid vertical translation of at most 1 px.
    maps[:,:,1]-=body_dy*(1-smooth((yy-180)/55))
    f=a.astype(np.float32)/255
    f[:,:,:3]*=f[:,:,3:4]
    rem=cv2.remap(f,maps[:,:,0],maps[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
    rem[:,:,:3]=np.divide(rem[:,:,:3],rem[:,:,3:4],out=np.zeros_like(rem[:,:,:3]),where=rem[:,:,3:4]>1e-6)
    # Lower petals are two overlapping painted panels, not a shrinking mesh.
    # Each panel retains its horizontal proportions and is pinned above y=235.
    # Shoes and their existing hidden hem overlap share a rigid translation.
    # This removes compression needles at the two critical crossing intervals.
    join=(boxes[0][2]+boxes[1][0])/2
    end=min(boxes[0][1],boxes[1][1])-3
    source_split=195+(join-195)*smooth((yy-235)/(end-235))
    panel_pm=[]
    for side,d in enumerate([dl,dr]):
        sy=yy.astype(np.float32)
        for _ in range(12): sy=yy-d[1]*smooth((sy-235)/(end-235))
        amount=smooth((sy-235)/(end-235))
        sx=xx-d[0]*amount
        # Complementary masks at rest; closed poses overlap at the destination.
        mask=(xx<=source_split) if side==0 else (xx>source_split)
        part=f.copy();part*=mask[:,:,None]
        panel_pm.append(cv2.remap(part,sx.astype(np.float32),sy.astype(np.float32),cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT))
    l,r=panel_pm
    lower=r+l*(1-r[:,:,3:4])
    lower[:,:,:3]=np.divide(lower[:,:,:3],lower[:,:,3:4],out=np.zeros_like(lower[:,:,:3]),where=lower[:,:,3:4]>1e-6)
    rem[235:]=lower[235:]
    out=np.rint(np.clip(rem,0,1)*255).astype(np.uint8)
    if body_dy==0:out[:145]=a[:145]
    out[out[:,:,3]==0]=0
    meta={'label':f'{i+1}.5','pair':[i+1,j+1], 'donor_anchor':donor+1,
          'rear_shoe_translation':dl.tolist(),'front_shoe_translation':dr.tolist(),
          'wrist_translation':dw.tolist(),'rear_tip_midpoint':((np.array(LEFT[i])+LEFT[j])/2).tolist(),
          'front_tip_midpoint':((np.array(RIGHT[i])+RIGHT[j])/2).tolist(),
          'shoe_scale':[1,1], 'shoe_rotation_degrees':0,
          'shoe_regions_source':boxes,'petal_panel_split_x':float(join),'petal_motion_full_at_y':float(end),
          'upper_identity_translation_xy':[0,float(body_dy)], 'lower_panel_horizontal_scale':1,
          'upper_mesh_inverted_triangles':sum(v<=0 for v in jac)}
    return Image.fromarray(out),meta

def flat(im,bg='#eeeae5'):
    return Image.alpha_composite(Image.new('RGBA',im.size,bg),im).convert('RGB')

