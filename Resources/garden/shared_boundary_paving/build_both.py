from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[3]; OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image,ImageDraw,ImageFilter
import numpy as np
specs={
'upper':((1110,235),(1000,580),[(140,230),(210,170),(290,195),(400,230),(550,270),(630,260),(680,240),(700,310),(770,370),(910,440),(990,440),(995,490),(870,515),(800,505),(720,530),(700,580),(620,580),(590,515),(530,430),(460,380),(380,335),(280,305),(160,300)]),
'lower':((1000,855),(920,680),[(140,205),(255,225),(365,230),(485,235),(620,210),(760,160),(810,175),(790,280),(753,345),(748,430),(750,510),(680,495),(637,449),(565,412),(492,395),(430,400),(365,432),(295,480),(250,522),(207,508),(215,452),(213,392),(174,341),(125,302)])}
combined=Image.open(OUT/'backup/Road_other_before_both.png').convert('RGBA')
for name,(anchor,size,points) in specs.items():
 gen=Image.open(OUT/f'source/{name}_generated.png').convert('RGBA').resize(size,Image.Resampling.LANCZOS)
 mask=Image.new('L',size);ImageDraw.Draw(mask).polygon(points,fill=255);mask=mask.filter(ImageFilter.GaussianBlur(6))
 a=np.array(gen);m=np.array(mask)
 water=(a[:,:,2].astype(int)>a[:,:,0].astype(int)+30)&(a[:,:,1].astype(int)>a[:,:,0].astype(int)+25)
 m[water]=0;gen.putalpha(Image.fromarray(m))
 check=Image.open(OUT/f'source/{name}_current.png').convert('RGBA');check.alpha_composite(gen);check.save(OUT/f'source/{name}_composite.png')
 layer=Image.new('RGBA',(2400,1800));layer.alpha_composite(gen.resize((size[0]//2,size[1]//2),Image.Resampling.LANCZOS),anchor)
 layer.save(OUT/f'source/{name}_overlay.png');combined.alpha_composite(layer)
combined.save(ROOT/'mobile/assets/garden/infrastructure/seams/Road_other_seamed.png')
print('Installed both local shared-boundary overlays. Approved west overlay is not touched.')
