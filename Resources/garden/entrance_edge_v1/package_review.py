from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image,ImageDraw
import numpy as np
def shot(name):return Image.open(OUT/f'source/{name}.png').convert('RGB')
def crop(im,box,scale,name):
    im=im.crop(box);im.resize((im.width*scale,im.height*scale),Image.Resampling.LANCZOS).save(OUT/'review'/name)
crop(shot('runtime_before'),(650,295,960,720),3,'01_edge_before.png')
crop(shot('runtime_after'),(650,295,960,720),3,'02_edge_after.png')
crop(shot('runtime_after'),(688,438,825,690),5,'03_left_edge_closeup.png')
crop(shot('runtime_after'),(825,350,940,710),4,'04_right_edge_closeup.png')
crop(shot('runtime_arch_on'),(630,230,1020,720),2,'05_connection_after_edge_cleanup.png')
shot('runtime_normal').save(OUT/'review/06_normal_garden_scale.png')
road=Image.open(ROOT/'mobile/assets/garden/bridges/approved-circulation/main-road-connected.png').convert('RGBA')
landing=Image.open(OUT/'source/landing_original.png').convert('RGBA')
world=Image.new('RGBA',(2400,1800));world.alpha_composite(road,(1300,1350));world.alpha_composite(landing)
view=world.crop((1450,1410,1750,1800)).resize((900,1170),Image.Resampling.NEAREST)
debug=Image.new('RGBA',view.size,'#bd76ae');debug.alpha_composite(view);debug.convert('RGB').save(OUT/'review/07_EDGE_ALPHA_DEBUG.png')
base=json.loads((OUT/'source/baseline.json').read_text())
changed=[n for n,h in base.items() if hashlib.sha256((ROOT/n).read_bytes()).hexdigest()!=h]
assert changed==['mobile\\assets\\garden\\bridges\\approved-circulation\\main-road-connected.png']
a=np.array(road);old=np.array(Image.open(OUT/'source/road_original.png'))
assert np.array_equal(a[:,:,:3],old[:,:,:3])
l=np.array(landing);m=l[1350:1800,1300:1980,3]>=250
assert np.array_equal(a[:450][m],old[:450][m])
worldroad=Image.new('RGBA',(2400,1800));worldroad.alpha_composite(road,(1300,1350))
r=np.array(worldroad);opaque=(r[:,:,3]>=250)|(l[:,:,3]>=250)
assert opaque[1455:1600,1610:1630].all()
overlap=(r[:,:,3]>=250)&(r[:,:,0].astype(int)>r[:,:,1].astype(int)+5)&(r[:,:,2]>85)&(l[:,:,3]>=250)
assert int(overlap.sum())==4251
result=json.loads((OUT/'source/edge_change.json').read_text())
result.update({'checked_files':len(base),'changed':changed,'overlap_pixels_unchanged':4251,'connection_corridor_gap_pixels':0,'review_files':len(list((OUT/'review').glob('*.png')))})
assert result['review_files']==7
(OUT/'verification.json').write_text(json.dumps(result,indent=2))
(OUT/'README.md').write_text('''# Entrance edge silhouette V1 — pending visual review

Only outer vegetation alpha on the Main Entrance PNG changed. All original RGB values remain identical. Protected paving, whole selected flower clusters, the complete landing, all opaque overlap pixels, runtime code, transforms, Land09 and other artwork are unchanged. Existing source was retained in source/road_original.png for reversal.

Used built-in image_gen to explore an edge contour (prompt retained). Its RGB artwork was rejected because it altered stones. Only its alpha contour was used outside protected paving/overlap/flower areas, with a pair of local interruptions adjusted to avoid broad notches. No new vegetation or decoration was added. build.py documents the masks.

Runtime inspected at close and normal Garden scale. Before/after and left/right closeups temporarily hide landmarks so the arch does not obscure the edges. The connection image and normal view show the arch restored. Alpha debug composites the actual final road and unchanged landing against solid mauve; it is not a generated candidate. Review crops are enlarged actual browser screenshots. Foreground visibility restored after QA.

The original 4,251 opaque paving overlap pixels and gap-free 20×145 world-pixel corridor remain unchanged. All seven requested outputs are in review/. Stopped for visual approval.
''',encoding='utf-8')
print(json.dumps(result,indent=2))
