from pathlib import Path
import sys,json
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'));sys.path.insert(0,str(ROOT/'Resources/garden/infrastructure_candidate'))
from PIL import Image,ImageFilter
import numpy as np
import build_candidate as g
im=Image.open(OUT/'source/entrance_generated.png').convert('RGBA').resize((680,1050),Image.Resampling.LANCZOS)
aligned=Image.new('RGBA',im.size)
# Register walking centerline to the unchanged arch and B01 topology.
for y in range(1050):
 shift=round(float(np.interp(y,[0,150,250,300,400,450,500,650,800,1000,1050],[-25,-20,-10,-6,-30,-40,-32,-66,-77,-91,-96])))
 aligned.alpha_composite(im.crop((0,y,680,y+1)),(shift,y))
road=Image.new('RGBA',(680,2950));road.alpha_composite(aligned)
# Continue the same pedestrian width below the normal 1800-world viewport.
# This continuation is outside all Lands, branches and landmarks.
tile=aligned.crop((0,700,680,1050))
for i,y in enumerate(range(1010,2950,310)):
 seg=tile.transpose(Image.Transpose.FLIP_TOP_BOTTOM) if i%2 else tile.copy()
 a=np.array(seg);fade=np.clip(np.arange(350)/40,0,1);a[:,:,3]=np.uint8(a[:,:,3]*fade[:,None]);seg=Image.fromarray(a)
 road.alpha_composite(seg,(min(50,10*i),y))
road.save(OUT/'source/main-road-v2.png')
base=Image.new('RGBA',(2400,2400),'#58b8c4');base.alpha_composite(g.base_without_road());base.alpha_composite(road,(1300,1350))
data=json.loads((ROOT/'Resources/garden/checkpoints/APPROVED_CIRCULATION_SHARED_PAVING_2026-09-23_172904/APPROVED_ASSETS_AND_TRANSFORMS.json').read_text())
for a in data['infrastructureLayers']:base.alpha_composite(Image.open(ROOT/a['path']).convert('RGBA'))
arch=Image.open(ROOT/'mobile/assets/garden/landmarks/garden-arch.png').convert('RGBA').resize((394,360),Image.Resampling.LANCZOS);rot=arch.rotate(6,Image.Resampling.BICUBIC,expand=True)
base.alpha_composite(rot,(1380-(rot.width-394)//2,1450-(rot.height-360)//2))
base.crop((1260,1300,1940,2180)).save(OUT/'source/context_v2.png')
print('Prepared replacement, original runtime not yet changed.')
