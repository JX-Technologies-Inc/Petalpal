from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'));sys.path.insert(0,str(ROOT/'Resources/garden/infrastructure_candidate'))
from PIL import Image
import build_candidate as g
S=OUT/'source';S.mkdir(parents=True,exist_ok=True);(OUT/'review').mkdir(exist_ok=True)
files=list((ROOT/'mobile/assets/garden').rglob('*'))+list((ROOT/'mobile/src/components/garden').rglob('*'))
if not (S/'baseline.json').exists():(S/'baseline.json').write_text(json.dumps({str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files if p.is_file()},indent=2))
land=g.transform_land('06');land.save(S/'land06_world.png')
base=g.base_without_road()
bridge=Image.open(ROOT/'mobile/assets/garden/infrastructure/final/B02_bridge.png').convert('RGBA')
fg=Image.open(ROOT/'mobile/assets/garden/infrastructure/seams/B02_feet_occlusion.png').convert('RGBA')
print('bridge bounds',bridge.getbbox(),'foreground bounds',fg.getbbox())
base.save(S/'base.png');base.alpha_composite(bridge);base.alpha_composite(fg)
crop=(1600,420,1910,660)
base.crop(crop).resize((1240,960),Image.Resampling.LANCZOS).save(S/'edit_reference.png')
g.base_without_road().crop(crop).resize((1240,960),Image.Resampling.LANCZOS).save(S/'ground_reference.png')
(S/'crop.json').write_text(json.dumps(crop))
