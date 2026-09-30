from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image
paths=list((ROOT/'mobile/assets/garden').rglob('*'))+list((ROOT/'mobile/src/components/garden').rglob('*'))
p=OUT/'backup/baseline.json'
if not p.exists():p.write_text(json.dumps({str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in paths if f.is_file()},indent=2))
base=Image.open(ROOT/'Resources/garden/main_entrance_v2/source/context_v2.png').convert('RGBA')
for name in ['land09-transition','b01-foot-landing']:
    im=Image.open(ROOT/f'mobile/assets/garden/infrastructure/entrance-connections/{name}.png').convert('RGBA')
    base.alpha_composite(im.crop((1260,1300,1940,1800)))
arch=Image.open(ROOT/'mobile/assets/garden/landmarks/garden-arch.png').convert('RGBA').resize((394,360),Image.Resampling.LANCZOS).rotate(6,Image.Resampling.BICUBIC,expand=True)
base.alpha_composite(arch,(1380-(arch.width-394)//2-1260,1450-(arch.height-360)//2-1300))
base.crop((290,60,465,255)).resize((700,780),Image.Resampling.LANCZOS).save(OUT/'source/current_input.png')
base.crop((285,295,415,495)).resize((520,800),Image.Resampling.LANCZOS).save(OUT/'source/approved_slab_reference.png')
