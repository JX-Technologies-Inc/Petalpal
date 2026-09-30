from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image
paths=list((ROOT/'mobile/assets/garden').rglob('*'))+list((ROOT/'mobile/src/components/garden').rglob('*'))
p=OUT/'source/baseline.json'
if not p.exists():p.write_text(json.dumps({str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in paths if f.is_file()},indent=2))
road=Image.open(ROOT/'mobile/assets/garden/bridges/approved-circulation/main-road-connected.png').convert('RGBA')
landing=Image.open(ROOT/'mobile/assets/garden/infrastructure/entrance-connections/b01-foot-landing.png').convert('RGBA')
road.save(OUT/'source/road_original.png');landing.save(OUT/'source/landing_original.png')
world=Image.new('RGBA',(2400,1800));world.alpha_composite(road,(1300,1350));world.alpha_composite(landing)
world.crop((1510,1440,1710,1800)).resize((600,1080),Image.Resampling.LANCZOS).save(OUT/'source/edge_input.png')
