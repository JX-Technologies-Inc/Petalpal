"""Local pixel compositing only: no asset geometry or route generation."""
from pathlib import Path
import sys,json,hashlib,shutil,math
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
sys.path.insert(0,str(ROOT/'Resources/garden/infrastructure_candidate'))
sys.path.insert(0,str(ROOT/'Resources/garden/bridge_reference_correction'))
from PIL import Image,ImageFilter
import numpy as np
import cv2
import build_candidate as garden
from build_bridge_correction import existing_road_world
OUT=Path(__file__).resolve().parent
R=ROOT/'mobile/assets/garden/infrastructure';FINAL=R/'final';DEST=R/'seams';DEST.mkdir(exist_ok=True)
W,H=2400,1800
yy,xx=np.mgrid[:H,:W];xy=np.stack([xx,yy],-1)
lands={id:garden.transform_land(id) for id in ('central','0405','06','08','09','101112')}
road=existing_road_world()
protected=[ROOT/'Resources/decorations/stair/ST01/ST01_master.png',R/'SS01_stepping_stones.png',*[FINAL/n for n in ('B01_bridge.png','B02_bridge.png','ST01_approved.png','Road_grounded_connection.png','Road_ground_junctions.png')],ROOT/'mobile/assets/garden/bridges/approved-circulation/main-road-connected.png']
manifest=OUT/'locked_hashes.json'
if not manifest.exists():manifest.write_text(json.dumps({str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in protected},indent=2))
code=ROOT/'mobile/src/components/garden/GardenInfrastructureLayer.tsx'
if not (OUT/'GardenInfrastructureLayer.before.tsx').exists():shutil.copyfile(code,OUT/'GardenInfrastructureLayer.before.tsx')
def smooth(a):
 a=np.clip(a,0,1);return a*a*(3-2*a)
def save(a,name):
 if isinstance(a,np.ndarray):a=Image.fromarray(np.uint8(np.clip(a,0,255)))
 a.save(DEST/name)
def clone(source,origin,target,angle=0,scale=1):
 # Rigid nearby pixel extraction. No new stone rendering or path generation.
 a=math.radians(angle);c=math.cos(a)*scale;s=math.sin(a)*scale
 m=np.array([[c,-s,0],[s,c,0]],dtype=float);m[:,2]=np.array(target)-m[:,:2]@np.array(origin)
 return cv2.warpAffine(np.array(source),m,(W,H),flags=cv2.INTER_CUBIC).astype(float)
def local_axes(a,b):
 a=np.array(a);d=np.array(b)-a;length=np.linalg.norm(d);u=d/length;q=xy-a
 return (q*u).sum(2),q[:,:,0]*(-u[1])+q[:,:,1]*u[0],length

# Existing Road footprints stay unchanged; borrow receiving-path paving at seams.
def road_surface(file,regions,out):
 old=np.array(Image.open(FINAL/file).convert('RGBA')).astype(float);result=old.copy()
 for a,b,origin,angle in regions:
  along,across,length=local_axes(a,b)
  tex=clone(lands['central'],origin,((a[0]+b[0])/2,(a[1]+b[1])/2),angle)
  zone=(along>-10)&(along<length+10)&(np.abs(across)<33)
  # Source slab rhythm dominates at both feet; retained road stones softly
  # emerge inside the existing connection rather than forming a separate blob.
  endmix=.85+.15*np.cos(np.clip(along/length,0,1)*math.pi*2)**2
  mix=zone*endmix
  result[:,:,:3]=result[:,:,:3]*(1-mix[:,:,None])+tex[:,:,:3]*mix[:,:,None]
  # A small feather along the existing edge removes the cut mask boundary.
  edge=cv2.GaussianBlur((old[:,:,3]/255).astype(np.float32),(0,0),.65)
  result[:,:,3]=np.minimum(old[:,:,3],edge*255)
 save(result,out)
road_surface('Road_grounded_connection.png',[
 ((718,724),(854,760),(1180,964),0)],'Road_west_seamed.png')
road_surface('Road_ground_junctions.png',[
 ((1320,430),(1400,375),(1180,964),-35),
 ((1215,955),(1230,1078),(1180,964),83)],'Road_other_seamed.png')

# Restore nearby Land09 paving over the literal cut end of Main Entrance.
land=np.array(lands['09']).astype(float)
along,across,length=local_axes((1388,1450),(1490,1505))
restore=smooth((3-along)/22)*smooth((65-np.abs(across))/12)*smooth((along+65)/15)
restored=land.copy();restored[:,:,3]*=restore
overlay=Image.fromarray(np.uint8(restored))
tex=clone(lands['central'],(1180,964),(1425,1470),28,.9)
ra=np.array(road)[:,:,3]/255
mask=smooth((along+13)/17)*smooth((95-along)/58)*smooth((37-np.abs(across))/8)*ra
tex[:,:,3]=255*mask
overlay.alpha_composite(Image.fromarray(np.uint8(np.clip(tex,0,255))))
save(overlay,'Road_entrance09_seamed.png')

# B01: reuse a short full-width section of the Main Entrance artwork, including
# its own irregular vegetation edges. It overlaps the existing narrow tip;
# there is no newly generated connector surface or change to the bridge.
tex=clone(road,(1600,1640),(1643,1487),0,.76)
foot=(yy-1441)-.62*(xx-1628)
crossfoot=((xx-1628)+.62*(yy-1441))/1.177
mask=smooth((foot+6)/12)*smooth((1542-yy)/27)
mask*=smooth((39+np.clip(foot-20,0,40)*.22-np.abs(crossfoot))/6)
mask*=smooth((92-np.abs(xx-1623))/16)
mask*=smooth((1677-xx)/7)
tex[:,:,3]*=mask
save(tex,'B01_entrance_underlay.png')
# Blend only a few pixels of the existing entrance over the wooden attachment.
under=tex.copy();q=foot
under[:,:,3]*=smooth((q+2)/7)
under[:,:,3]*=smooth((1505-yy)/20)
save(under,'B01_entrance_foreground.png')
original=np.array(Image.open(FINAL/'B01_foreground.png').convert('RGBA'))
original[:,:,3]=np.where(xx>1750,original[:,:,3],0)
save(original,'B01_land08_occlusion.png')

# ST01: original receiving-land pixels at exactly their existing world position.
# Occlude the attachment, including stray floral/wood pixels beyond each end.
fg=Image.new('RGBA',(W,H))
a=np.array([1490.,860.]);b=np.array([1840.,1030.]);u=(b-a)/np.linalg.norm(b-a)
for id,point,sign in [('central',a,-1),('08',b,1)]:
 q=xy-point;behind=(q*u).sum(2)*sign;cross=q[:,:,0]*(-u[1])+q[:,:,1]*u[0]
 radial=np.sqrt((q*q).sum(2))
 # Irregular two-pixel contour follows the path-edge vegetation softness.
 edge=2*np.sin(cross*.22)+np.sin(cross*.51)
 mask=smooth((behind+13+edge)/6)*smooth((122-radial)/10)
 arr=np.array(lands[id]).astype(float);arr[:,:,3]*=mask
 fg.alpha_composite(Image.fromarray(np.uint8(arr)))
save(fg,'ST01_feet_occlusion.png')

# B02 retains the approved existing-pixel mask with a subpixel edge soften.
im=Image.open(FINAL/'B02_foreground_seated.png').convert('RGBA')
im.putalpha(im.getchannel('A').filter(ImageFilter.GaussianBlur(.55)))
save(im,'B02_feet_occlusion.png')
checks={p:hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in json.loads(manifest.read_text()).items()}
assert all(checks.values()),checks
(OUT/'verification.json').write_text(json.dumps({'lockedHashesMatch':checks,'operation':'local texture reuse and alpha/foreground masks only; bridge/stair/land transforms unchanged'},indent=2))
print('Local seam layers exported; locked assets verified')
