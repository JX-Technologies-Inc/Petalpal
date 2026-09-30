from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'));sys.path.insert(0,str(ROOT/'Resources/garden/infrastructure_candidate'))
from PIL import Image
import build_candidate as g
paths=list((ROOT/'mobile/assets/garden').rglob('*'))+list((ROOT/'mobile/src/components/garden').rglob('*'))
lock=OUT/'backup/baseline.json'
if not lock.exists():lock.write_text(json.dumps({str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths if p.is_file()},indent=2))
base=Image.new('RGBA',(2400,2400),'#58b8c4');base.alpha_composite(g.base_without_road())
road=Image.open(OUT/'backup/main-road-connected.png').convert('RGBA');base.alpha_composite(road,(1300,1350))
data=json.loads((ROOT/'Resources/garden/checkpoints/APPROVED_CIRCULATION_SHARED_PAVING_2026-09-23_172904/APPROVED_ASSETS_AND_TRANSFORMS.json').read_text())
for a in data['infrastructureLayers']:base.alpha_composite(Image.open(ROOT/a['path']).convert('RGBA'))
arch=Image.open(ROOT/'mobile/assets/garden/landmarks/garden-arch.png').convert('RGBA').resize((394,360),Image.Resampling.LANCZOS)
rot=arch.rotate(6,Image.Resampling.BICUBIC,expand=True);base.alpha_composite(rot,(1380-(rot.width-394)//2,1450-(rot.height-360)//2))
base.crop((1260,1300,1940,2180)).save(OUT/'source/entrance_current_context.png')
road.crop((0,0,680,1050)).save(OUT/'source/entrance_current_road.png')
