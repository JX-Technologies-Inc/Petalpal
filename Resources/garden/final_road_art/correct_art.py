"""Local paving corrections only; immutable masks/geometry and original backups."""
from pathlib import Path
import sys,json,hashlib,math
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
sys.path.insert(0,str(ROOT/'Resources/garden/infrastructure_candidate'))
sys.path.insert(0,str(ROOT/'Resources/garden/bridge_reference_correction'))
from PIL import Image
import numpy as np
import cv2
import build_candidate as garden
from build_bridge_correction import existing_road_world
W,H=2400,1800;yy,xx=np.mgrid[:H,:W]
smooth=lambda v:np.clip(v,0,1)**2*(3-2*np.clip(v,0,1))
central=np.array(garden.transform_land('central'))
Image.fromarray(central).crop((1070,920,1300,1000)).resize((1150,400)).save(OUT/'backup/paving_source.png')
paths=[p for p in (ROOT/'mobile/assets/garden').rglob('*') if p.is_file()]
paths += list((ROOT/'mobile/src/components/garden').rglob('*.tsx'))+list((ROOT/'mobile/src/components/garden').rglob('*.ts'))
paths += [ROOT/'Resources/garden/complete_road_system/road_topology_manifest.md']
lock=OUT/'backup/hashes.json'
if not lock.exists():lock.write_text(json.dumps({str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths},indent=2))
def clone(source,origin,target,angle=0,scale=1):
 a=math.radians(angle);c=math.cos(a)*scale;s=math.sin(a)*scale
 m=np.array([[c,-s,0],[s,c,0]],float);m[:,2]=np.array(target)-m[:,:2]@np.array(origin)
 return cv2.warpAffine(source,m,(W,H),flags=cv2.INTER_CUBIC).astype(float)
def save(a,path):Image.fromarray(np.uint8(np.clip(a,0,255))).save(ROOT/path)

# R01: replace RGB only. The complete approved alpha footprint remains exact.
old=np.array(Image.open(OUT/'backup/R01_treehouse_path.png'))
# Use broad receiving-path slabs, rigidly oriented in two overlapping patches.
a=clone(central,(1180,964),(608,520),-27)
b=clone(central,(1180,964),(683,464),-65)
mix=smooth((xx-625)/65)
tex=a[:,:,:3]*(1-mix[:,:,None])+b[:,:,:3]*mix[:,:,None]
result=old.copy();result[:,:,:3]=np.uint8(tex)
save(result,'mobile/assets/garden/roads/complete/R01_treehouse_path.png')

# R03: minimum local direction blend; lower R04 pixels never enter this mask.
old=np.array(Image.open(OUT/'backup/Road_other_seamed.png'));result=old.copy()
tex=clone(central,(1180,964),(1360,402.5),-35)
weight=smooth(1-((xx-1354)/24)**2-((yy-407)/22)**2)
result[:,:,:3]=np.uint8(old[:,:,:3]*(1-weight[:,:,None])+tex[:,:,:3]*weight[:,:,None])
save(result,'mobile/assets/garden/infrastructure/seams/Road_other_seamed.png')

# R05: restrained gray-to-warm scale/orientation progression in the existing mask.
old=np.array(Image.open(OUT/'backup/Road_entrance09_seamed.png'));result=old.copy()
dx,dy=102,55;length=math.hypot(dx,dy)
along=((xx-1388)*dx+(yy-1450)*dy)/length
across=(-(xx-1388)*dy+(yy-1450)*dx)/length
u=smooth((along+8)/115)
near=clone(central,(1180,964),(1404,1457),22,.92)
far=clone(central,(1180,964),(1466,1492),30,1.20)
tex=near[:,:,:3]*(1-u[:,:,None])+far[:,:,:3]*u[:,:,None]
tex+=u[:,:,None]*np.array([13,6,-1])
weight=smooth((along+24)/20)*smooth((138-along)/30)*smooth((38-np.abs(across))/10)
result[:,:,:3]=np.uint8(np.clip(old[:,:,:3]*(1-weight[:,:,None])+tex*weight[:,:,None],0,255))
save(result,'mobile/assets/garden/infrastructure/seams/Road_entrance09_seamed.png')
print('Three local RGB corrections saved. All alpha masks preserved.')
