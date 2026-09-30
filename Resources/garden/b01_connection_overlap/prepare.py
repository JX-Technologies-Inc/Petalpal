from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image
paths=list((ROOT/'mobile/assets/garden').rglob('*'))+list((ROOT/'mobile/src/components/garden').rglob('*'))
p=OUT/'source/baseline.json'
if not p.exists():p.write_text(json.dumps({str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in paths if f.is_file()},indent=2))
base=Image.new('RGBA',(2400,1800),'#58b8c4')
road=Image.open(ROOT/'mobile/assets/garden/bridges/approved-circulation/main-road-connected.png').convert('RGBA');base.alpha_composite(road,(1300,1350))
data=json.loads((ROOT/'Resources/garden/checkpoints/APPROVED_CIRCULATION_SHARED_PAVING_2026-09-23_172904/APPROVED_ASSETS_AND_TRANSFORMS.json').read_text())
for a in data['infrastructureLayers']:base.alpha_composite(Image.open(ROOT/a['path']).convert('RGBA'))
for n in ['land09-transition','b01-foot-landing']:base.alpha_composite(Image.open(ROOT/f'mobile/assets/garden/infrastructure/entrance-connections/{n}.png'))
base.crop((1510,1390,1700,1640)).resize((760,1000),Image.Resampling.LANCZOS).save(OUT/'source/uncovered_input.png')
