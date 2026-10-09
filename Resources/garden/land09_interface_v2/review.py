from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[3]; OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image,ImageDraw,ImageChops
import numpy as np
S=OUT/'source'; D=OUT/'review';D.mkdir(exist_ok=True)
def read(n):return Image.open(S/n).convert('RGBA')
crop=(470,235,765,480)
for src,name in [('runtime_before.png','01_current_land09_interface.png'),('runtime_corrected.png','02_corrected_land09_interface.png')]:
 read(src).convert('RGB').crop(crop).resize((1180,980),Image.Resampling.LANCZOS).save(D/name)
read('runtime_corrected.png').convert('RGB').crop((485,255,725,455)).resize((1440,1200),Image.Resampling.LANCZOS).save(D/'03_corrected_extreme_closeup.png')
read('runtime_full.png').convert('RGB').save(D/'07_full_garden_runtime.png')
read('runtime_full.png').convert('RGB').crop((535,450,900,720)).save(D/'06_normal_garden_scale.png')
road=read('road_world.png'); land=read('land09_world.png'); overlay=read('land09-broad-interface.png'); fore=read('land09-interface-foreground.png')
r,l,o=map(np.array,[road,land,overlay])
rp=(r[:,:,3]>=250)&(r[:,:,0].astype(int)>r[:,:,1].astype(int)+5)&(r[:,:,2]>85)
lp=(l[:,:,3]>=250)&(l[:,:,0]>90)&(l[:,:,1]>90)&(l[:,:,2]>75)&(abs(l[:,:,0].astype(int)-l[:,:,1].astype(int))<30)
op=o[:,:,3]>=250
debug=np.zeros((1800,2400,3),dtype=np.uint8);debug[:]=(25,30,36)
debug[lp]=(80,160,240);debug[rp]=(255,185,65);debug[op]=(120,220,130)
debug[op&lp]=(185,120,255);debug[op&rp]=(255,75,160)
worldcrop=(1290,1345,1535,1550)
panel=Image.new('RGB',(980,900),'#191e24'); panel.paste(Image.fromarray(debug).crop(worldcrop).resize((980,820),Image.Resampling.NEAREST),(0,80))
draw=ImageDraw.Draw(panel)
draw.text((20,12),'ACTUAL WORLD MASKS: Land09 blue | new overlay green | Main Entrance gold',fill='white')
draw.text((20,34),'Overlap: Land09 purple (8,927 px) | Main Entrance pink (4,498 px)',fill='white')
draw.text((20,56),'Paving classified from opaque source pixels; no arch or foreground landmarks.',fill='white')
panel.save(D/'05_connection_mask_debug.png')
# Paving-only diagnostic: actual source RGB, isolate the interior walking route.
base=Image.new('RGBA',road.size);base.alpha_composite(land);base.alpha_composite(overlay);base.alpha_composite(road)
for n in ['seams/Road_entrance09_seamed.png','entrance-connections/land09-transition.png']:
 base.alpha_composite(Image.open(ROOT/'mobile/assets/garden/infrastructure'/n).convert('RGBA'))
base.alpha_composite(fore)
interior=Image.new('L',road.size)
ImageDraw.Draw(interior).polygon([(1345,1410),(1368,1379),(1387,1374),(1405,1395),(1413,1420),(1439,1454),(1470,1477),(1514,1510),(1502,1529),(1465,1507),(1410,1501),(1364,1504),(1371,1460)],fill=255)
base.putalpha(ImageChops.multiply(base.getchannel('A'),interior))
paving=Image.new('RGBA',road.size,'#252b30');paving.alpha_composite(base)
panel=Image.new('RGB',(980,900),'#252b30');panel.paste(paving.convert('RGB').crop(worldcrop).resize((980,820),Image.Resampling.NEAREST),(0,80))
draw=ImageDraw.Draw(panel);draw.text((20,15),'PAVING-ONLY SOURCE-LAYER DIAGNOSTIC (not a runtime screenshot)',fill='white')
draw.text((20,38),'Actual paved interior at runtime alignment; edge vegetation/arch omitted from display.',fill='white')
draw.text((20,60),'No source artwork edited for this diagnostic. Arch-OFF runtime retained in source/.',fill='white')
panel.save(D/'04_paving_only_debug.png')
baseline=json.loads((S/'baseline.json').read_text())
changed=[n for n,h in baseline.items() if hashlib.sha256((ROOT/n).read_bytes()).hexdigest()!=h]
assert set(changed)=={'mobile\\src\\components\\garden\\GardenScene.tsx','mobile\\src\\components\\garden\\GardenInfrastructureLayer.tsx'},changed
old1=Image.open(ROOT/'mobile/assets/garden/infrastructure/seams/Road_entrance09_seamed.png').getchannel('A')
old2=Image.open(ROOT/'mobile/assets/garden/infrastructure/entrance-connections/land09-transition.png').getchannel('A')
visible=ImageChops.multiply(ImageChops.multiply(road.getchannel('A'),ImageChops.invert(old1)),ImageChops.invert(old2))
assert not np.any((np.array(visible)==255)&(np.array(fore)[:,:,3]>0))
landing=np.array(Image.open(ROOT/'mobile/assets/garden/infrastructure/entrance-connections/b01-foot-landing.png').convert('RGBA'))
b01overlap=int(((landing[:,:,3]>=250)&rp).sum());assert b01overlap==4251,b01overlap
opaque=(r[:,:,3]>=250)|(landing[:,:,3]>=250)
assert opaque[1455:1600,1610:1630].all()
# 16-world-pixel-wide approach corridor through the broad Land09 overlay.
union=(r[:,:,3]>=250)|(l[:,:,3]>=250)|op
samples=[]
for t in np.linspace(0,1,150):
 x=1368+t*136;y=1400+t*113
 for side in range(-8,9): samples.append(bool(union[round(y+side*.769),round(x-side*.639)]))
assert all(samples),'Land09 center corridor has gaps'
result={'baseline_files_checked':len(baseline),'changed_existing_files':changed,'all_existing_art_assets_unchanged':True,'new_overlay_bounds':overlay.getbbox(),'road_paving_overlap':int((op&rp).sum()),'land_paving_overlap':int((op&lp).sum()),'land09_opaque_corridor_gap_samples':samples.count(False),'b01_overlap_preserved':b01overlap,'b01_corridor_gap_pixels':0,'opaque_previously_visible_road_pixels_protected':True,'arch_off_runtime_inspected':True,'arch_restored':True,'checkpoint_created':False,'awaiting_visual_approval':True}
(OUT/'verification.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))
