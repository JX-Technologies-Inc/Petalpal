from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent;S=OUT/'source';D=OUT/'review'
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image,ImageDraw
import numpy as np
def img(p):return Image.open(p).convert('RGBA')
land=img(S/'land06_world.png');new=img(S/'land06-approach.png');bridge=img(ROOT/'mobile/assets/garden/infrastructure/final/B02_bridge.png')
l,n,b=map(np.array,[land,new,bridge]);lp=l[:,:,3]>=250;npav=n[:,:,3]>=250;bp=b[:,:,3]>=250
# Full polygonal walking strip from within Land06 paving to beneath fixed deck.
corr=Image.new('L',(2400,1800));ImageDraw.Draw(corr).polygon([(1764,514),(1778,548),(1855,510),(1841,476)],fill=255)
cm=np.array(corr)>0;union=lp|npav;gaps=int((cm&~union).sum());assert gaps==0,gaps
fg0=np.array(img(ROOT/'mobile/assets/garden/infrastructure/seams/B02_feet_occlusion.png'))
fg1=np.array(img(ROOT/'mobile/assets/garden/infrastructure/b02-land06-connection/b02-foreground-local-opening.png'))
assert np.array_equal(fg0[:,:1700],fg1[:,:1700])
base=json.loads((S/'baseline.json').read_text());changed=[p for p,h in base.items() if hashlib.sha256((ROOT/p).read_bytes()).hexdigest()!=h]
assert changed==['mobile\\src\\components\\garden\\GardenInfrastructureLayer.tsx'],changed
runtime=ROOT/'mobile/src/components/garden/GardenInfrastructureLayer.tsx'
assert runtime.read_bytes()==(S/'final_GardenInfrastructureLayer.tsx').read_bytes(),'Bridge must be restored before final verification'
result={'baseline_files_checked':len(base),'changed_existing_files':changed,'all_existing_asset_files_unchanged':True,'central_side_foreground_pixels_identical':True,'land06_new_opaque_overlap_pixels':int((lp&npav).sum()),'bridge_new_opaque_overlap_pixels':int((bp&npav).sum()),'walking_corridor_polygon':[(1764,514),(1778,548),(1855,510),(1841,476)],'walking_corridor_pixels':int(cm.sum()),'walking_corridor_gap_pixels':gaps,'bridge_restored':True,'checkpoint_created':False}
(OUT/'verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
crop=(620,230,935,455)
for src,out in [('runtime_before.png','01_B02_land06_BEFORE.png'),('runtime_after.png','02_B02_land06_AFTER.png'),('runtime_hidden.png','04_B02_hidden_paving_debug.png')]:
 img(S/src).convert('RGB').crop(crop).resize((1260,900),Image.Resampling.LANCZOS).save(D/out)
img(S/'runtime_after.png').convert('RGB').crop((687,270,875,409)).resize((1316,973),Image.Resampling.LANCZOS).save(D/'03_B02_land06_EXTREME_CLOSEUP.png')
img(S/'runtime_full.png').convert('RGB').crop((735,150,1030,330)).save(D/'06_B02_land06_normal_scale.png')
img(S/'runtime_full.png').convert('RGB').save(D/'07_full_garden_runtime.png')
colors=np.zeros((1800,2400,3),dtype=np.uint8);colors[:]=(25,30,36);colors[lp]=(75,155,235);colors[npav]=(255,185,60);colors[bp]=(160,90,215);colors[lp&npav]=(75,215,135);colors[bp&npav]=(250,100,160)
panel=Image.new('RGB',(1240,1040),'#191e24');panel.paste(Image.fromarray(colors).crop((1600,420,1910,660)).resize((1240,960),Image.Resampling.NEAREST),(0,80))
dr=ImageDraw.Draw(panel);dr.text((20,12),'ACTUAL WORLD ALPHA MASKS | Land06 blue | new approach gold | fixed B02 purple',fill='white')
dr.text((20,36),f'Overlap: new/Land06 green {result["land06_new_opaque_overlap_pixels"]} px | new/B02 pink {result["bridge_new_opaque_overlap_pixels"]} px',fill='white')
dr.text((20,59),f'Walking corridor: {result["walking_corridor_pixels"]} opaque world pixels checked; zero gaps. Threshold: alpha >= 250.',fill='white')
panel.save(D/'05_B02_connection_mask_debug.png')
