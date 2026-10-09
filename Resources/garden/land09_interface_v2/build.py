from pathlib import Path
import sys,json
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image,ImageDraw,ImageChops
import numpy as np
im=Image.open(OUT/'source/generated.png').convert('RGBA').resize((1120,920),Image.Resampling.LANCZOS)
poly=[(77,55),(103,43),(126,28),(141,33),(156,50),(179,77),(181,100),(198,127),(222,146),(250,170),(229,191),(207,181),(172,176),(131,179),(105,175),(99,164),(98,145),(107,119),(96,99),(87,80)]
mask=Image.new('L',im.size);ImageDraw.Draw(mask).polygon([(x*4,y*4) for x,y in poly],fill=255)
im.putalpha(mask);im=im.resize((280,230),Image.Resampling.LANCZOS)
overlay=Image.new('RGBA',(2400,1800));overlay.alpha_composite(im,(1250,1340))
overlay.save(OUT/'source/land09-broad-interface.png')
dest=ROOT/'mobile/assets/garden/infrastructure/land09-interface-v2';dest.mkdir(exist_ok=True)
overlay.save(dest/'land09-broad-interface.png')
road=Image.open(OUT/'source/road_world.png').convert('RGBA');land=Image.open(OUT/'source/land09_world.png').convert('RGBA')
old1=Image.open(ROOT/'mobile/assets/garden/infrastructure/seams/Road_entrance09_seamed.png').convert('RGBA')
old2=Image.open(ROOT/'mobile/assets/garden/infrastructure/entrance-connections/land09-transition.png').convert('RGBA')
# Existing visible Main Entrance pixels are protected. Only the Land09-side
# interface that was already occluded by its old overlays may be reconstructed.
road_visible=ImageChops.multiply(road.getchannel('A'),ImageChops.invert(old1.getchannel('A')))
road_visible=ImageChops.multiply(road_visible,ImageChops.invert(old2.getchannel('A')))
foreground=overlay.copy();foreground.putalpha(ImageChops.multiply(overlay.getchannel('A'),ImageChops.invert(road_visible)))
foreground.save(OUT/'source/land09-interface-foreground.png');foreground.save(dest/'land09-interface-foreground.png')
base=Image.new('RGBA',overlay.size,'#58b8c4');base.alpha_composite(land);base.alpha_composite(overlay);base.alpha_composite(road)
base.alpha_composite(old1);base.alpha_composite(old2);base.alpha_composite(foreground)
base.crop((1250,1340,1530,1570)).resize((1120,920)).save(OUT/'source/construction_preview.png')
r=np.array(road);l=np.array(land);o=np.array(overlay)
rp=(r[:,:,3]>=250)&(r[:,:,0].astype(int)>r[:,:,1].astype(int)+5)&(r[:,:,2]>85)
lp=(l[:,:,3]>=250)&(l[:,:,0]>90)&(l[:,:,1]>90)&(l[:,:,2]>75)&(abs(l[:,:,0].astype(int)-l[:,:,1].astype(int))<30)
op=o[:,:,3]>=250
print(json.dumps({'road_paving_overlap':int((op&rp).sum()),'land_paving_overlap':int((op&lp).sum()),'bounds':overlay.getbbox()}))
