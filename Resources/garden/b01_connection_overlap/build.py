from pathlib import Path
import sys,json
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image,ImageDraw
import numpy as np
im=Image.open(OUT/'source/extension_generated.png').convert('RGBA').resize((760,1000),Image.Resampling.LANCZOS)
poly=[(76,55),(92,62),(110,65),(133,78),(151,89),(158,102),(153,114),(157,130),(151,142),(153,152),(142,163),(127,158),(117,156),(106,153),(98,148),(84,146),(76,140),(64,137),(68,124),(72,112),(76,102),(76,91),(79,80),(73,73)]
mask=Image.new('L',im.size);ImageDraw.Draw(mask).polygon([(x*4,y*4) for x,y in poly],fill=255)
im.putalpha(mask);im=im.resize((190,250),Image.Resampling.LANCZOS)
new=Image.new('RGBA',(2400,1800));new.alpha_composite(im,(1510,1390))
# Keep the approved upper landing exactly; remove only its baked foreground
# fragments below the new structural neck. Real foreground is rendered later.
old=Image.open(OUT/'source/landing_before.png').convert('RGBA')
old.paste((0,0,0,0),(0,1460,2400,1800))
new.alpha_composite(old)
new.save(OUT/'source/connected-landing.png')
new.save(ROOT/'mobile/assets/garden/infrastructure/entrance-connections/b01-foot-landing.png')
road=Image.new('RGBA',new.size);road.alpha_composite(Image.open(ROOT/'mobile/assets/garden/bridges/approved-circulation/main-road-connected.png').convert('RGBA'),(1300,1350))
ra=np.array(road);la=np.array(new)
# Separate opaque warm paving from green edge vegetation in the road footprint.
rp=(ra[:,:,3]>=250)&(ra[:,:,0].astype(int)>ra[:,:,1].astype(int)+5)&(ra[:,:,2]>85)
lp=la[:,:,3]>=250
overlap=rp&lp
assert int(overlap.sum())>500
# Require substantial paved overlap at the lower neck, not just flowers/tiny alpha.
assert int(overlap[1500:1555,1570:1675].sum())>500
out=np.zeros((1800,2400,4),dtype=np.uint8);out[:]=[25,32,36,255]
out[ra[:,:,3]>127]=[50,112,220,255];out[lp]=[244,149,47,255];out[overlap]=[239,63,202,255]
dbg=Image.fromarray(out).crop((1490,1380,1730,1670)).resize((960,1160),Image.Resampling.NEAREST)
canvas=Image.new('RGBA',(960,1220),'#192024');canvas.alpha_composite(dbg,(0,60))
d=ImageDraw.Draw(canvas);d.text((15,12),'BLUE: Road footprint   ORANGE: B01 landing / extension',fill='white');d.text((15,34),f'MAGENTA: opaque paving overlap ({int(overlap.sum())} world pixels)',fill='white')
canvas.convert('RGB').save(OUT/'review/03_connection_mask_debug.png')
(OUT/'source/overlap.json').write_text(json.dumps({'opaque_paving_overlap_pixels':int(overlap.sum()),'lower_neck_overlap_pixels':int(overlap[1500:1555,1570:1675].sum()),'landing_bounds':new.getchannel('A').getbbox()},indent=2))
print((OUT/'source/overlap.json').read_text())
