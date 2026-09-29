from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[3]; OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image,ImageDraw,ImageFilter
import numpy as np
gen=Image.open(OUT/'source/entrance_generated.png').convert('RGBA').resize((1200,1200),Image.Resampling.LANCZOS)
# Local silhouette only: preserve all original landmark pixels above final tread.
points=[(740,415),(793,395),(855,408),(945,421),(995,460),(1000,610),(947,715),(870,800),(815,930),(750,970),(690,945),(623,907),(572,883),(541,868),(505,835),(453,822),(427,795),(404,770),(403,720),(450,650),(560,595),(610,560),(658,534),(680,480),(720,430)]
mask=Image.new('L',gen.size); ImageDraw.Draw(mask).polygon(points,fill=255)
mask=mask.filter(ImageFilter.GaussianBlur(3))
a=np.array(gen); m=np.array(mask)
# Generated water must never enter the runtime overlay. Preserve actual live water.
water=(a[:,:,2].astype(int)>a[:,:,0].astype(int)+30)&(a[:,:,1].astype(int)>a[:,:,0].astype(int)+25)
m[water]=0; gen.putalpha(Image.fromarray(m))
patch=gen.resize((400,400),Image.Resampling.LANCZOS)
world=Image.new('RGBA',(2400,1800)); world.alpha_composite(patch,(450,320))
world.save(ROOT/'mobile/assets/garden/roads/complete/R01_treehouse_path.png')
# Old narrow-strip occlusion is superseded; original landmark remains underneath.
Image.new('RGBA',(2400,1800)).save(ROOT/'mobile/assets/garden/roads/complete/R01_existing_foreground.png')
base=Image.open(OUT/'source/entrance_without_R01.png').convert('RGBA');base.alpha_composite(gen)
base.save(OUT/'source/composition_check.png')
print('Installed local R01 landscape overlay; all other runtime art remains untouched.')

