from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[3]; OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image,ImageDraw,ImageFilter
import numpy as np
# Generated edit is normalized to the original world crop. Original grass and
# all remote artwork are excluded; blend ends on native paving and shoreline.
source=Image.open(OUT/'source/central_west_current.png').convert('RGBA')
gen=Image.open(OUT/'source/central_west_generated.png').convert('RGBA').resize(source.size,Image.Resampling.LANCZOS)
mask=Image.new('L',source.size)
points=[(152,292),(268,334),(347,355),(434,331),(487,287),(528,233),(577,246),(552,334),(528,424),(533,526),(552,621),(598,711),(658,769),(734,819),(825,850),(839,922),(837,1126),(744,1070),(653,1059),(613,1092),(590,1203),(572,1299),(320,1299),(344,1190),(352,1080),(347,960),(330,862),(308,793),(290,748),(270,714),(280,688),(292,679),(305,630),(288,578),(258,541),(228,518),(230,490),(264,482),(280,456),(265,416),(234,374),(193,341)]
ImageDraw.Draw(mask).polygon(points,fill=255)
mask=mask.filter(ImageFilter.GaussianBlur(7))
# Limit incoming patch to terrestrial pixels; actual runtime water stays visible.
a=np.array(gen);m=np.array(mask)
water=(a[:,:,2].astype(int)>a[:,:,0].astype(int)+30)&(a[:,:,1].astype(int)>a[:,:,0].astype(int)+25)
m[water]=0
fade=np.clip((1300-np.arange(1300))/150,0,1);fade=fade*fade*(3-2*fade)
m=np.uint8(m*fade[:,None])
gen.putalpha(Image.fromarray(m))
check=source.copy();check.alpha_composite(gen);check.save(OUT/'source/central_west_composite.png')
layer=Image.new('RGBA',(2400,1800));layer.alpha_composite(gen.resize((420,650),Image.Resampling.LANCZOS),(590,460))
layer.save(OUT/'source/central_west_overlay.png')


