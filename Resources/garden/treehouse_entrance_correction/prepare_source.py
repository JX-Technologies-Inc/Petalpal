from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
sys.path.insert(0,str(ROOT/'Resources/garden/infrastructure_candidate'))
from PIL import Image
import build_candidate as garden
base=garden.base_without_road()
for name in ('tree-base','canopy-overlay','wisteria-overlay','foreground-overlay','mailbox'):
 im=Image.open(ROOT/f'mobile/assets/garden/landmarks/treehouse/{name}.png').convert('RGBA')
 im=im.resize((round(1448*.65),round(1086*.65)),Image.Resampling.LANCZOS)
 base.alpha_composite(im,(70+(39 if name=='mailbox' else 0),-140+(88 if name=='mailbox' else 0)))
base.crop((450,320,850,720)).resize((1200,1200),Image.Resampling.LANCZOS).save(OUT/'source/entrance_without_R01.png')
