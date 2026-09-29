"""Place locked ST01 using a similarity transform; reuse existing bank pixels."""
from pathlib import Path
import sys,json,hashlib,shutil,math
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
sys.path.insert(0,str(ROOT/'Resources/garden/infrastructure_candidate'))
from PIL import Image
import numpy as np
import cv2
import build_candidate as garden
OUT=Path(__file__).resolve().parent/'approved_st01_finish'
OUT.mkdir(exist_ok=True)
RUNTIME=ROOT/'mobile/assets/garden/infrastructure/final'
SOURCE=ROOT/'Resources/decorations/stair/ST01/ST01_master.png'
protected=[SOURCE,ROOT/'mobile/assets/garden/infrastructure/SS01_stepping_stones.png',*[RUNTIME/n for n in ('B01_bridge.png','B02_bridge.png','B01_foreground.png','B02_foreground.png','Road_grounded_connection.png')]]
hashes={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}
for p in [ROOT/'mobile/src/components/garden/GardenInfrastructureLayer.tsx',ROOT/'mobile/src/components/garden/GardenScene.tsx']:
 target=OUT/(p.name+'.before');
 if not target.exists():shutil.copyfile(p,target)
high=np.array([1694.384694,621.05304]);low=np.array([505.614585,1619.808447])
a=np.array([1490.,860.]);b=np.array([1840.,1030.])
s=low-high;d=b-a
u=np.dot(s,d)/np.dot(s,s);v=(s[0]*d[1]-s[1]*d[0])/np.dot(s,s)
M=np.array([[u,-v,0],[v,u,0]])
M[:,2]=a-M[:,:2]@high
src=np.asarray(Image.open(SOURCE).convert('RGBA')).astype(np.float32)/255
src[:,:,:3]*=src[:,:,3:]
arr=cv2.warpAffine(src,M,(2400,1800),flags=cv2.INTER_LANCZOS4)
arr=np.clip(arr,0,1);arr[:,:,:3]/=np.maximum(arr[:,:,3:],1e-6)
Image.fromarray(np.uint8(np.clip(arr,0,1)*255)).save(RUNTIME/'ST01_approved.png')
yy,xx=np.mgrid[:1800,:2400];p=np.stack([xx,yy],axis=-1)
unit=d/np.linalg.norm(d);fg=Image.new('RGBA',(2400,1800))
for id,point,sign in [('central',a,-1),('08',b,1)]:
 land=np.array(garden.transform_land(id));q=p-point
 along=(q*unit).sum(2)*sign
 radial=np.sqrt((q*q).sum(2))
 mask=np.clip((along-1)/5,0,1)*np.clip((72-radial)/6,0,1)
 land[:,:,3]=np.uint8(land[:,:,3]*mask)
 fg.alpha_composite(Image.fromarray(land))
fg.save(RUNTIME/'ST01_foreground.png')
assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in hashes.items())
(OUT/'placement.json').write_text(json.dumps({'masterSha256':hashes[str(SOURCE)],'highCentral':a.tolist(),'lowLand08':b.tolist(),'uniformScale':math.hypot(u,v),'clockwiseRotationDegrees':math.degrees(math.atan2(v,u)),'affine':M.tolist(),'protectedHashes':hashes},indent=2))
print('ST01 placed; all locked assets unchanged',math.hypot(u,v),math.degrees(math.atan2(v,u)))
