from pathlib import Path
import sys,hashlib,json
ROOT=Path(__file__).resolve().parents[3]; OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
sys.path.insert(0,str(ROOT/'Resources/garden/infrastructure_candidate'))
from PIL import Image
import build_candidate as garden
base=garden.base_without_road()
for p in ['seams/Road_west_seamed.png','seams/Road_other_seamed.png']:
 base.alpha_composite(Image.open(ROOT/'mobile/assets/garden/infrastructure'/p).convert('RGBA'))
base.crop((590,460,1010,1110)).resize((840,1300),Image.Resampling.LANCZOS).save(OUT/'source/central_west_current.png')
Image.open(ROOT/'Resources/structure-final-version.png').crop((330,300,640,670)).resize((775,925),Image.Resampling.LANCZOS).save(OUT/'source/central_west_reference.png')
paths=list((ROOT/'mobile/assets/garden').rglob('*'))+list((ROOT/'mobile/src/components/garden').rglob('*'))
lock=OUT/'backup/baseline_hashes.json'
if not lock.exists():lock.write_text(json.dumps({str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths if p.is_file()},indent=2))
