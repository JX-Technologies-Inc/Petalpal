from pathlib import Path
import sys,json,shutil
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent;S=OUT/'source'
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image,ImageDraw,ImageChops
import numpy as np
gen=Path('C:/Users/cjysu/.codex/generated_images/01a0cafa-f870-7ed3-9090-231d7cac0a58/exec-713d10bb-dc76-448b-a534-bf1b3485bb92.png')
shutil.copy2(gen,S/'generated.png')
im=Image.open(gen).convert('RGBA').resize((1240,960),Image.Resampling.LANCZOS)
poly=[(580,291),(650,271),(706,289),(750,285),(788,310),(826,324),(865,332),(894,362),(936,387),(976,399),(1020,433),(976,468),(943,524),(902,573),(846,608),(778,622),(714,610),(682,552),(647,463),(603,378)]
mask=Image.new('L',im.size);ImageDraw.Draw(mask).polygon(poly,fill=255)
a=np.array(im);cyan=(a[:,:,1].astype(int)>a[:,:,0].astype(int)+35)&(a[:,:,2].astype(int)>a[:,:,0].astype(int)+45)
m=np.array(mask);m[cyan]=0;im.putalpha(Image.fromarray(m))
im=im.resize((310,240),Image.Resampling.LANCZOS)
layer=Image.new('RGBA',(2400,1800));layer.alpha_composite(im,(1600,420))
dest=ROOT/'mobile/assets/garden/infrastructure/b02-land06-connection';dest.mkdir(exist_ok=True)
layer.save(dest/'land06-approach.png');layer.save(S/'land06-approach.png')
fg=Image.open(ROOT/'mobile/assets/garden/infrastructure/seams/B02_feet_occlusion.png').convert('RGBA')
# The unchanged Central foreground remains exact. Old Land06 shoreline pixels
# covered by the new paved opening must no longer cover the bridge walking route.
fg.putalpha(ImageChops.multiply(fg.getchannel('A'),ImageChops.invert(layer.getchannel('A'))))
fg.save(dest/'b02-foreground-local-opening.png')
base=Image.open(S/'base.png').convert('RGBA');base.alpha_composite(layer)
base.crop((1600,420,1910,660)).resize((1240,960),Image.Resampling.LANCZOS).save(S/'paving_preview.png')
base.alpha_composite(Image.open(ROOT/'mobile/assets/garden/infrastructure/final/B02_bridge.png').convert('RGBA'));base.alpha_composite(fg)
base.crop((1600,420,1910,660)).resize((1240,960),Image.Resampling.LANCZOS).save(S/'composite_preview.png')
