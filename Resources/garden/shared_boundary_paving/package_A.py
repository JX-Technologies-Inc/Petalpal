from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[3]; OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image
R=OUT/'review'
Image.open(OUT/'source/central_west_reference.png').convert('RGB').save(R/'01_central_land101112_reference.png')
def world_crop(im,box):
 # Existing Road junctions review camera: 3x about world (790,740).
 w,h=im.size; canvas_h=h-63; s=min(w/2400,canvas_h/1800)*3
 x0,y0=w/2,63+canvas_h/2
 return im.crop(tuple(round(v) for v in (x0+(box[0]-790)*s,y0+(box[1]-740)*s,x0+(box[2]-790)*s,y0+(box[3]-740)*s)))
for state,num in [('before','02'),('after','03')]:
 im=Image.open(OUT/f'backup/runtime_west_{state}.png').convert('RGB')
 world_crop(im,(610,560,1040,1015)).resize((860,910),Image.Resampling.LANCZOS).save(R/f'{num}_central_land101112_{state}.png')
after=Image.open(OUT/'backup/runtime_west_after.png').convert('RGB')
world_crop(after,(690,625,985,1000)).resize((708,900),Image.Resampling.LANCZOS).save(R/'04_central_land101112_closeup.png')
print('Four Correction A runtime/reference review images saved. B and final combined outputs remain pending clarification.')
