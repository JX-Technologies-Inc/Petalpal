from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image
paths=list((ROOT/'mobile/assets/garden').rglob('*'))+list((ROOT/'mobile/src/components/garden').rglob('*'))
baseline=OUT/'backup/baseline.json'
if not baseline.exists(): baseline.write_text(json.dumps({str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths if p.is_file()},indent=2))
im=Image.open(ROOT/'Resources/garden/main_entrance_v2/source/context_v2.png')
for name,box in [('land09',(60,65,280,255)),('b01',(295,70,455,240))]:
    crop=im.crop(box);crop.resize((crop.width*4,crop.height*4),Image.Resampling.LANCZOS).save(OUT/f'source/{name}_input.png')
