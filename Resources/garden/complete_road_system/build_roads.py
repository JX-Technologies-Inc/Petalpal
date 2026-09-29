"""Independent Road layers only. Approved source art and infrastructure are read-only."""
from pathlib import Path
import sys,json,hashlib,math
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
sys.path.insert(0,str(ROOT/'Resources/garden/infrastructure_candidate'))
from PIL import Image,ImageDraw,ImageFilter,ImageEnhance
import numpy as np
import cv2
import build_candidate as garden
OUT=Path(__file__).resolve().parent
DEST=ROOT/'mobile/assets/garden/roads/complete'
DEST.mkdir(parents=True,exist_ok=True)
W,H=2400,1800
yy,xx=np.mgrid[:H,:W]
west=garden.transform_land('101112')
tree=Image.new('RGBA',(W,H))
im=Image.open(ROOT/'mobile/assets/garden/landmarks/treehouse/tree-base.png').convert('RGBA')
im=im.resize((round(1448*.65),round(1086*.65)),Image.Resampling.LANCZOS)
tree.alpha_composite(im,(70,-140))
ground=np.maximum(np.array(west)[:,:,3],np.array(tree)[:,:,3])
controls=[[[703,433],[690,452],[690,481],[653,501]],[[653,501],[616,521],[594,550],[556,529]]]
curves=[]
for pts in controls:
 p=np.array(pts,float);t=np.linspace(0,1,400)[:,None]
 curves.append((1-t)**3*p[0]+3*(1-t)**2*t*p[1]+3*(1-t)*t*t*p[2]+t**3*p[3])
curve=np.concatenate(curves)
arc=np.r_[0,np.cumsum(np.linalg.norm(np.diff(curve,axis=0),axis=1))]
tangent=np.gradient(curve,axis=0);tangent/=np.linalg.norm(tangent,axis=1)[:,None]
norm=np.c_[-tangent[:,1],tangent[:,0]]
width=39+9*np.exp(-arc/23)+5*np.exp(-(arc[-1]-arc)/22)
mask=Image.new('L',(W,H));d=ImageDraw.Draw(mask)
d.polygon([tuple(v) for v in np.r_[curve+norm*width[:,None]/2,(curve-norm*width[:,None]/2)[::-1]]],fill=255)
# Near-field coordinates, used only for clipping and fades; stones remain rigid.
dist=np.full((H,W),10000.,dtype=np.float32);along=np.zeros((H,W),np.float32)
for k in range(0,len(curve),3):
 q=np.hypot(xx-curve[k,0],yy-curve[k,1]);use=q<dist
 dist[use]=q[use];along[use]=arc[k]
smooth=lambda a: np.clip(a,0,1)**2*(3-2*np.clip(a,0,1))
alpha=np.array(mask,dtype=float)/255
edge=cv2.distanceTransform(np.array(mask),cv2.DIST_L2,3)
alpha*=smooth((edge-.35-.35*np.sin(along*.67))/1.9)
alpha*=smooth(along/10)*smooth((arc[-1]-along)/19)
unsupported=int(np.sum((alpha>.1)&(ground<32)))
print('Unsupported footprint pixels before ground clipping:',unsupported,flush=True)
alpha*=smooth((ground.astype(float)-32)/160)
road=Image.new('RGBA',(W,H),(121,121,100,0));road.putalpha(Image.fromarray(np.uint8(alpha*255)))
stones=json.loads((ROOT/'Resources/road/poc/stone_library/manifest.json').read_text())['stones']
stones=[s for s in stones if 28<=s['source_bbox'][3]<=65 and 35<=s['source_bbox'][2]<=112]
rng=np.random.default_rng(92351)
texture=Image.new('RGBA',(W,H))
for row in range(4):
 a=-7+row*2.7
 while a<arc[-1]+10:
  k=min(len(arc)-1,np.searchsorted(arc,max(0,a)))
  s=stones[int(rng.integers(len(stones)))];factor=float(rng.uniform(.14,.19))
  stone=Image.open(ROOT/'Resources/road/poc/stone_library'/s['file']).convert('RGBA')
  stone=stone.resize((round(stone.width*factor),round(stone.height*factor)),Image.Resampling.LANCZOS)
  stone=ImageEnhance.Color(stone).enhance(.65)
  stone=ImageEnhance.Brightness(stone).enhance(float(rng.uniform(.81,.94)))
  angle=90-math.degrees(math.atan2(tangent[k,1],tangent[k,0]))+float(rng.uniform(-10,10))
  stone=stone.rotate(angle,Image.Resampling.BICUBIC,expand=True)
  c=curve[k]+norm[k]*((row-1.5)*10+float(rng.uniform(-1.3,1.3)))
  texture.alpha_composite(stone,(round(c[0]-stone.width/2),round(c[1]-stone.height/2)))
  a+=max(4,s['source_bbox'][3]*factor*float(rng.uniform(.68,.85)))
road.alpha_composite(texture)
arr=np.array(road);arr[:,:,3]=np.uint8(alpha*255)
# Low-amplitude lighting variation sampled from the actual supporting ground.
support=np.array(tree).astype(float)
shade=cv2.GaussianBlur(support[:,:,:3].mean(2),(0,0),8)
shade=np.clip(.88+shade/900,.90,1.04)
arr[:,:,:3]=np.uint8(np.clip(arr[:,:,:3]*shade[:,:,None]+np.array([3,4,-2]),0,255))
# Blend the last 36px with rigidly reused receiving-path paving, keeping its scale.
central=garden.transform_land('central')
angle=math.radians(-25);c=math.cos(angle);s=math.sin(angle)
m=np.array([[c,-s,0],[s,c,0]],float);m[:,2]=np.array([582,533])-m[:,:2]@np.array([1180,964])
tex=cv2.warpAffine(np.array(central),m,(W,H),flags=cv2.INTER_CUBIC)
mix=smooth((along-(arc[-1]-85))/65)
arr[:,:,:3]=np.uint8(arr[:,:,:3]*(1-mix[:,:,None])+tex[:,:,:3]*mix[:,:,None])
# Restore the existing final stair tread over only its contact line.
stair=np.array(tree);edge=444-.38*(xx-710)
stairmask=smooth((edge-yy)/2)*smooth((xx-658)/7)*smooth((753-xx)/7)*smooth((yy-408)/8)
stair[:,:,3]=np.uint8(stair[:,:,3]*stairmask)
road=Image.fromarray(arr)
road.save(DEST/'R01_treehouse_path.png')
occlusion=Image.fromarray(stair)
# Existing roots and boulder edges seat the paving without relocating artwork.
original=np.array(tree)
brown=(original[:,:,0]>original[:,:,1]*1.16)&(original[:,:,1]>original[:,:,2]*1.04)
edge_restore=smooth((dist-15)/6)*(dist<26)*(along>17)*(along<arc[-1]-24)*brown
rock=smooth((1-((xx-600)/30)**2-((yy-481)/27)**2)*5)
foreground=original.copy();foreground[:,:,3]=np.uint8(original[:,:,3]*np.maximum(edge_restore,rock))
occlusion.alpha_composite(Image.fromarray(foreground))
occlusion.save(DEST/'R01_existing_foreground.png')
road.alpha_composite(occlusion)
base=garden.base_without_road();base.alpha_composite(tree);base.alpha_composite(road)
base.crop((450,365,775,605)).resize((975,720),Image.Resampling.LANCZOS).save(OUT/'treehouse_working.png')
data={'R01':{'centerline_cubics':controls,'ordinary_width':39,'endpoint_widths':[48,44],
 'method':'Curve V2 rigid source stone stamps; short receiving-path paving blend',
 'source':'Resources/decorations/road/road_straight_master.png',
 'runtime_asset':str((DEST/'R01_treehouse_path.png').relative_to(ROOT)),
 'canvas':[W,H],'runtime_transform':{'x':0,'y':0,'width':W,'height':H,'rotation':0},
 'unsupported_pixels_before_clip':unsupported,'visible_pixels_over_alpha_less_than_32':int(np.sum((arr[:,:,3]>0)&(ground<32)))}}
(OUT/'road_geometry.json').write_text(json.dumps(data,indent=2))
print(json.dumps(data,indent=2))
