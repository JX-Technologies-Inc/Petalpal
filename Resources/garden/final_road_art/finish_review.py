from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image,ImageDraw,ImageFont
import numpy as np
OLD=ROOT/'Resources/garden/complete_road_system'
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',25)
before={k:Image.open(OLD/f'runtime_{k}.png').convert('RGB') for k in ('treehouse','upper','entrance')}
after={k:Image.open(OUT/f'backup/after_{k}.png').convert('RGB') for k in ('treehouse','upper','entrance','full')}
def sheet(items,name,cell=(900,600)):
 w,h=cell;im=Image.new('RGB',(len(items)*w,h+55),(235,233,222));d=ImageDraw.Draw(im)
 for i,(label,crop) in enumerate(items):
  d.text((i*w+18,14),label,font=font,fill=(40,49,43))
  scale=min((w-24)/crop.width,(h-20)/crop.height)
  crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS)
  im.paste(crop,(i*w+(w-crop.width)//2,55+(h-crop.height)//2))
 im.save(OUT/name)
for key,box,name,label in [
 ('treehouse',(440,250,845,530),'01_R01_before_after.png','R01 paving'),
 ('upper',(480,265,860,510),'04_R03_before_after.png','R03 local blend'),
 ('entrance',(440,245,930,555),'05_R05_before_after.png','R05 gradual transition')]:
 sheet([(label+' — BEFORE',before[key].crop(box)),(label+' — AFTER',after[key].crop(box))],name)
for key,box,name in [
 ('treehouse',(570,280,790,445),'02_R01_treehouse_closeup.png'),
 ('treehouse',(475,375,685,505),'03_R01_western_closeup.png'),
 ('entrance',(490,275,705,455),'06_R05_land09_closeup.png'),
 ('entrance',(605,345,850,540),'07_R05_entrance_closeup.png')]:
 crop=after[key].crop(box);crop.resize((crop.width*4,crop.height*4),Image.Resampling.LANCZOS).save(OUT/name)
after['full'].save(OUT/'08_FINAL_ROAD_RUNTIME.png')
sheet([('Reference B — visual target',Image.open(ROOT/'Resources/structure-final-version.png').convert('RGB')),
 ('Final local Road art / actual runtime',after['full'].crop((190,63,1105,720)))],'09_FINAL_REFERENCE_COMPARISON.png',(1100,830))

allowed=['mobile/assets/garden/roads/complete/R01_treehouse_path.png',
 'mobile/assets/garden/infrastructure/seams/Road_other_seamed.png',
 'mobile/assets/garden/infrastructure/seams/Road_entrance09_seamed.png']
hashes=json.loads((OUT/'backup/hashes.json').read_text())
changed=[Path(p).as_posix() for p,h in hashes.items() if hashlib.sha256((ROOT/p).read_bytes()).hexdigest()!=h]
assert set(changed)==set(allowed),changed
checks={}
for p in allowed:
 a=np.array(Image.open(OUT/'backup'/Path(p).name));b=np.array(Image.open(ROOT/p))
 assert np.array_equal(a[:,:,3],b[:,:,3]),p
 checks[Path(p).name]={'alpha_pixel_identical':True,'changed_visible_pixels':int(np.sum(np.any(a[:,:,:3]!=b[:,:,:3],axis=2)&(a[:,:,3]>0)))}
 if 'Road_other' in p:
  assert np.array_equal(a[700:],b[700:]),'R04 changed'
  checks[Path(p).name]['R04_RGBA_pixel_identical']=True
outputs=sorted(p.name for p in OUT.glob('[0-9][0-9]_*.png'))
assert len(outputs)==9
for name in outputs:
 with Image.open(OUT/name) as im:assert im.format=='PNG';im.verify()
(OUT/'backup/verification.json').write_text(json.dumps({'files_checked':len(hashes),'changed_files':changed,
 'all_other_runtime_assets_code_and_topology_manifest_unchanged':True,'checks':checks,
 'review_outputs':outputs,'before_source':'Prior actual runtime captures of the exact backed-up approved assets; same camera settings and crops',
 'after_source':'Current live /garden-test screenshots'},indent=2))
print(json.dumps(checks,indent=2));print('Nine review PNGs verified. All other files match pre-pass hashes.')
