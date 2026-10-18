from pathlib import Path
from collections import deque
from PIL import Image
import numpy as np,json,hashlib
P=Path(__file__).resolve().parent;root=P.parents[4];m=json.loads((P/'manifest.json').read_text());results={}
for side in ['left','right']:
 path=P/'images'/f'leg_{side}_complete.png';im=Image.open(path);a=np.array(im);assert im.mode=='RGBA' and im.size==(1254,1254)
 mask=a[:,:,3]>16;labels=np.zeros(mask.shape,np.int32);counts=[];label=0
 for y,x in zip(*np.nonzero(mask)):
  if labels[y,x]:continue
  label+=1;q=deque([(y,x)]);labels[y,x]=label;count=0
  while q:
   yy,xx=q.popleft();count+=1
   for ny,nx in [(yy-1,xx),(yy+1,xx),(yy,xx-1),(yy,xx+1)]:
    if 0<=ny<1254 and 0<=nx<1254 and mask[ny,nx] and not labels[ny,nx]:labels[ny,nx]=label;q.append((ny,nx))
  counts.append(count)
 anchors=m['parts'][f'leg_{side}_complete'];points=[anchors[k] for k in ['hip','knee','ankle']]+([[745,1155]] if side=='left' else [[624,1135]])
 ids=[int(labels[y,x]) for x,y in points];assert len(set(ids))==1 and ids[0]!=0,(side,ids)
 src=Image.open(P/'sources'/('left_near_visible_source.png' if side=='left' else 'right_far_visible_source.png'));s=np.array(src);v=s[1025:,:,3]>0
 assert np.array_equal(a[1025:][v],s[1025:][v]);assert np.array_equal(a[1025:,:,3],s[1025:,:,3])
 box=im.getchannel('A').point(lambda z:255 if z>16 else 0).getbbox();assert box[0]>0 and box[1]>0 and box[2]<1254 and box[3]<1254
 results[side]={'canvas':[1254,1254],'mode':'RGBA','alpha_min_max':[int(a[:,:,3].min()),int(a[:,:,3].max())],'bbox_alpha_gt16':box,'hip_knee_ankle_shoe_same_component':True,'source_shoe_visible_rgba_and_alpha_exact_below_y1025':True,'main_component_pixels':max(counts),'other_components_gt16px':sum(c>16 for c in counts)-1,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
assert results['left']['sha256']!=results['right']['sha256']
for f,h in json.loads((P/'source_hashes.json').read_text()).items():assert hashlib.sha256((root/f).read_bytes()).hexdigest()==h
report={'technical_checks':'PASS','anatomical_and_visual_gate':'PENDING_USER_REVIEW','independent_reconstruction_provenance':'two separately generated sources; right attempt01 not selected; no flip/mirror or cross-leg pixel copying','distinct_hashes_are_not_anatomical_proof':True,'source_references_unchanged':True,'animation_created_or_modified':False,'assets':results,'diagnostic_views':5,'separated_views':'same two assets translated independently, not gait frames or 3D pose claims'}
(P/'validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2))
