from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'));sys.path.insert(0,str(ROOT/'Resources/garden/infrastructure_candidate'))
from PIL import Image
import build_candidate as g
paths=list((ROOT/'mobile/assets/garden').rglob('*'))+list((ROOT/'mobile/src/components/garden').rglob('*'))
p=OUT/'source/baseline.json'
if not p.exists():p.write_text(json.dumps({str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in paths if f.is_file()},indent=2))
land=g.transform_land('09');land.save(OUT/'source/land09_world.png')
road=Image.new('RGBA',(2400,1800));road.alpha_composite(Image.open(ROOT/'mobile/assets/garden/bridges/approved-circulation/main-road-connected.png').convert('RGBA'),(1300,1350));road.save(OUT/'source/road_world.png')
base=g.base_without_road();base.alpha_composite(road)
data=json.loads((ROOT/'Resources/garden/checkpoints/APPROVED_MAIN_ENTRANCE_FINAL_V1_2026-09-24_122031/APPROVED_ASSETS_AND_TRANSFORMS.json').read_text())
for layer in data['infrastructureBackToFront']:base.alpha_composite(Image.open(ROOT/layer['path']).convert('RGBA'))
base.crop((1250,1340,1530,1570)).resize((1120,920),Image.Resampling.LANCZOS).save(OUT/'source/current_interface.png')
