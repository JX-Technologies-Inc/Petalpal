"""Static environment layers. All production Land/circulation/landmark assets read-only."""
from pathlib import Path
import sys,json,math,hashlib
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
sys.path.insert(0,str(ROOT/'Resources/garden/infrastructure_candidate'))
from PIL import Image,ImageDraw,ImageFont
import numpy as np
import cv2
import build_candidate as garden
DEST=ROOT/'mobile/assets/garden/environment'
atlas=Image.open(OUT/'source/vegetation_atlas.png').convert('RGBA')
names=['flowers/crocus_lavender','flowers/ivory_wildflowers','flowers/crocus_ivory','flowers/pale_blue',
 'foliage/fern_groundcover','flowers/crocus_crescent','flowers/ivory_sage','flowers/pale_pink',
 'foliage/leaf_tuft','shoreline/crocus_pebble','shoreline/fern_pebble','flowers/sparse_sprig']
sprites=[]
for i,name in enumerate(names):
 col=i%4;row=i//4;box=(col*384,round(row*1024/3),(col+1)*384,round((row+1)*1024/3))
 im=atlas.crop(box);bounds=im.getchannel('A').getbbox();im=im.crop(bounds)
 path=DEST/(name+'.png');im.save(path);sprites.append(im)
W,H=2400,1800
lands={id:garden.transform_land(id) for id in ('central','101112','0405','06','07','08','09')}
protect=np.zeros((H,W),np.uint8)
for folder in ('mobile/assets/garden/infrastructure/final','mobile/assets/garden/infrastructure/seams','mobile/assets/garden/roads/complete'):
 for p in (ROOT/folder).glob('*.png'):
  if p.name in ('Road_grounded_connection.png','Road_ground_junctions.png','B01_foreground.png','B02_foreground.png'):continue
  a=Image.open(p)
  if a.size==(W,H):protect=np.maximum(protect,np.array(a.getchannel('A')))
protect=np.maximum(protect,np.array(Image.open(ROOT/'mobile/assets/garden/infrastructure/SS01_stepping_stones.png').getchannel('A')))
protect=cv2.dilate((protect>8).astype('uint8'),np.ones((13,13),np.uint8))
# Each explicit zone has a distinct center, elliptical spread, and target count.
# Existing grass classification rejects paving/rocks and all protected circulation.
zones={
 '101112':[(215,575,115,90,18),(576,753,75,72,12),(241,1005,100,95,18),(560,1160,100,70,16),(158,790,60,85,9),(470,938,85,60,10),(450,584,65,45,7),(653,619,33,27,3)],
 'central':[(1116,455,86,38,12),(1327,478,62,40,8),(993,680,42,70,12),(1346,790,49,84,14),(1070,868,65,35,8)],
 '0405':[(1375,103,78,38,13),(1450,285,57,47,12),(1285,210,38,40,7)],
 '06':[(1920,390,72,36,10),(2015,503,47,42,10),(1820,469,36,27,5)],
 '07':[(1995,807,91,32,16),(2250,695,40,71,12),(1890,772,45,24,6)],
 '08':[(1966,1367,68,60,16),(2180,1242,42,58,12),(2032,1156,55,30,8),(1829,1110,35,30,4)],
 '09':[(1164,1190,61,57,13),(1196,1433,52,61,12),(1335,1206,40,51,10),(1260,1360,30,40,5)]}
shore_zones={'central':[(850,555),(1120,981)],'101112':[(97,880),(430,1280),(770,1160)],
 '0405':[(1219,178),(1590,331)],'06':[(1790,360),(2060,548)],'07':[(2290,735),(1950,870)],
 '08':[(1820,1240),(2135,1480)],'09':[(1081,1190),(1290,1530)]}
rng=np.random.default_rng(202609231)
records=[];layers=[];coverage={};debug=garden.base_without_road()
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',18)
for id,land in lands.items():
 rgba=np.array(land);rgb=rgba[:,:,:3];hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV)
 grass=((hsv[:,:,0]>=28)&(hsv[:,:,0]<=49)&(hsv[:,:,1]>100)&(hsv[:,:,2]>65)&(rgba[:,:,3]>245)&(protect==0)).astype('uint8')
 grass=cv2.morphologyEx(grass,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
 grass[protect>0]=0
 distance=cv2.distanceTransform(grass,cv2.DIST_L2,5)
 rim=cv2.distanceTransform((rgba[:,:,3]>200).astype('uint8'),cv2.DIST_L2,5)
 eligible=np.argwhere(distance>8)
 layer=Image.new('RGBA',(W,H));occupied=[]
 def place(cx,cy,size,kind,zone):
  shoreline=zone=='shoreline'
  if not (0<=cx<W and 0<=cy<H) or distance[cy,cx]<(2 if shoreline else 8):return False
  if any(math.hypot(cx-x,cy-y)<min(size,s)*.50 for x,y,s in occupied):return False
  sprite=sprites[kind];height=round(size*sprite.height/sprite.width)
  sprite=sprite.resize((size,height),Image.Resampling.LANCZOS)
  angle=float(rng.uniform(-14,14));sprite=sprite.rotate(angle,Image.Resampling.BICUBIC,expand=True)
  if rng.random()<.35:sprite=sprite.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
  # Lower-center is the planting anchor; foliage grows above its support.
  x=round(cx-sprite.width/2);y=round(cy-sprite.height*.70)
  if x<0 or y<0 or x+sprite.width>W or y+sprite.height>H:return False
  a=np.array(sprite.getchannel('A'))>40;region=rgba[y:y+sprite.height,x:x+sprite.width,3]
  if np.mean(region[a]>200)<.99:return False
  if np.any(protect[y:y+sprite.height,x:x+sprite.width][a]):return False
  # All flower silhouettes must stay away from gray walking surfaces. Ground
  # leaves may overlap only existing planted borders, never pavement.
  g=grass[y:y+sprite.height,x:x+sprite.width]
  if np.mean(g[a])<(.48 if shoreline else .88):return False
  if shoreline:
   # Shoreline plants remain within the narrow outer rock/foliage margin.
   if np.max(rim[y:y+sprite.height,x:x+sprite.width][a])>45:return False
  layer.alpha_composite(sprite,(x,y));occupied.append((cx,cy,size))
  records.append({'land':id,'zone':zone,'asset':names[kind]+'.png','planting_anchor':[cx,cy],
   'world_bbox':[x,y,sprite.width,sprite.height],'width':size,'rotation':round(angle,2)})
  return True
 for zi,(zx,zy,rx,ry,count) in enumerate(zones[id]):
  placed=0
  for attempt in range(count*70):
   if placed>=count:break
   cx=round(zx+rng.normal()*rx*.48);cy=round(zy+rng.normal()*ry*.48)
   kind=int(rng.choice([0,1,2,3,4,5,6,8,9,10,11],p=[.19,.16,.13,.04,.09,.10,.12,.07,.03,.03,.04]))
   if id=='08' and zi==1 and placed==1:kind=7
   size=int(rng.integers(27,49)) if kind not in (4,8,10) else int(rng.integers(32,57))
   if placed<2 and zi%2==0:size+=9
   placed+=place(cx,cy,size,kind,zi)
  # Supporting tiny sprigs are intentionally separate from the richer pockets.
 for n in range({'101112':30,'central':20}.get(id,13)):
  for attempt in range(80):
   cy,cx=eligible[int(rng.integers(len(eligible)))]
   if distance[cy,cx]>46 and rng.random()<.80:continue
   if place(int(cx),int(cy),int(rng.integers(15,25)),int(rng.choice([0,1,8,11])), 'isolated'):break
 rim_points=np.argwhere((grass>0)&(rim>12)&(rim<28)&(distance>2))
 for zx,zy in shore_zones[id]:
  near=rim_points[np.hypot(rim_points[:,1]-zx,rim_points[:,0]-zy)<125]
  if not len(near):continue
  planted=0
  for attempt in range(500):
   if planted>=7:break
   cy,cx=near[int(rng.integers(len(near)))]
   planted+=place(int(cx),int(cy),int(rng.integers(22,37)),int(rng.choice([1,4,6,8,11])), 'shoreline')
 # Discard only invisible antialias tails inside the protective clearance band.
 a=np.array(layer);a[:,:,3][protect>0]=0;layer=Image.fromarray(a)
 box=layer.getbbox();crop=layer.crop(box);name=f'layers/land_{id}_environment.png';crop.save(DEST/name)
 layers.append({'land':id,'asset':name,'x':box[0],'y':box[1],'width':crop.width,'height':crop.height,'rotation':0,'scale':1})
 alpha=np.array(layer.getchannel('A'))
 coverage[id]={'clusters':len(occupied),'grass_pixels':int(grass.sum()),'decorated_grass_pixels':int(np.sum((alpha>32)&(grass>0))),
 'grass_coverage_percent':round(100*np.sum((alpha>32)&(grass>0))/max(1,grass.sum()),2),'protected_overlap_pixels':int(np.sum((alpha>0)&(protect>0)))}
 debug.alpha_composite(layer)
data={'world':[W,H],'placement':'Deterministic hand-selected planting zones plus sparse edge-biased supporting sprigs; all sprites validated against original Land grass and circulation exclusion mask.',
 'runtime_layer':'GardenEnvironmentLayer','draw_order':'After LandLayer, before Main Entrance, infrastructure and landmarks; seven tightly cropped RGBA Land overlays.',
 'source_atlas':'Resources/garden/environment_v1/source/vegetation_atlas.png','generation':'Built-in image_gen; prompt archived in source/prompt.txt',
 'reusable_assets':[{'path':'mobile/assets/garden/environment/'+n+'.png','category':n.split('/')[0]} for n in names],
 'layers':layers,'coverage':coverage,'placements':records}
(DEST/'manifest.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
(DEST/'layers.json').write_text(json.dumps(layers,indent=2),encoding='utf-8')
(OUT/'asset_manifest.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
debug.resize((1200,900),Image.Resampling.LANCZOS).save(OUT/'source/composition_check.png')
print(json.dumps({'coverage':coverage,'layer_bounds':layers,'total_clusters':len(records)},indent=2))
