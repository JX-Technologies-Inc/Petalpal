"""Read-only geometry analysis; writes diagnostic images, never runtime assets."""
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
sys.path.insert(0,str(ROOT/'Resources/garden/infrastructure_candidate'))
from PIL import Image,ImageDraw
import build_candidate as garden
out=Path(__file__).resolve().parent
base=garden.base_without_road()
tree=Image.open(ROOT/'mobile/assets/garden/landmarks/treehouse/tree-base.png').convert('RGBA')
tree=tree.resize((round(1448*.65),round(1086*.65)),Image.Resampling.LANCZOS)
base.alpha_composite(tree,(70,-140))
box=(350,280,840,650)
crop=base.crop(box).resize((980,740),Image.Resampling.LANCZOS)
d=ImageDraw.Draw(crop)
for x in range(350,841,50):
 d.line(((x-350)*2,0,(x-350)*2,740),fill=(255,255,255,90),width=1)
 d.text(((x-350)*2+2,2),str(x),fill='black',stroke_width=1,stroke_fill='white')
for y in range(300,651,50):
 d.line((0,(y-280)*2,980,(y-280)*2),fill=(255,255,255,90),width=1)
 d.text((2,(y-280)*2+2),str(y),fill='black',stroke_width=1,stroke_fill='white')
crop.save(out/'treehouse_ground_diagnostic.png')
print(out/'treehouse_ground_diagnostic.png')
