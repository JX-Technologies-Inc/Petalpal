from pathlib import Path
import sys,json,hashlib,shutil
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image,ImageDraw
import numpy as np
S=OUT/'source';dst=ROOT/'mobile/assets/garden/infrastructure/land09-interface-v2'
generated=Path('C:/Users/cjysu/.codex/generated_images/01a0cafa-f870-7ed3-9090-231d7cac0a58/exec-8577f4cc-67af-4841-98e9-6348b3a08ead.png')
shutil.copy2(generated,S/'generated.png')
gen=Image.open(generated).convert('RGB').resize((1120,920),Image.Resampling.LANCZOS)
# Interior stone groups only. Hard masks follow the existing grout; no feather.
polys=[([(362,222),(450,210),(497,243),(453,275),(389,289)],.6), ([(424,343),(483,329),(510,386),(448,406)],.6), ([(589,354),(644,371),(676,402),(655,428),(602,416),(577,386)],.55), ([(493,405),(554,391),(583,407),(626,433),(667,451),(637,493),(588,482),(563,465),(536,457),(515,451)],.8), ([(656,544),(702,542),(735,568),(743,601),(698,631),(660,617),(625,590)],.55)]
mask=Image.new('L',(1120,920));d=ImageDraw.Draw(mask)
for poly,strength in polys:d.polygon(poly,fill=round(strength*255))
mask=mask.resize((280,230),Image.Resampling.NEAREST)
rgb=gen.resize((280,230),Image.Resampling.LANCZOS)
for name in ['land09-broad-interface.png','land09-interface-foreground.png']:
 old=Image.open(S/name).convert('RGBA');new=old.copy();part=old.crop((1250,1340,1530,1570));patch=Image.composite(rgb,part.convert('RGB'),mask).convert('RGBA');patch.putalpha(part.getchannel('A'));new.paste(patch,(1250,1340));assert np.array_equal(np.array(old)[:,:,3],np.array(new)[:,:,3]);new.save(dst/name)
baseline=json.loads((S/'baseline.json').read_text());changed=[p for p,h in baseline.items() if hashlib.sha256(Path(p).read_bytes()).hexdigest().upper()!=h]
assert set(changed)=={str(dst/n) for n in ['land09-broad-interface.png','land09-interface-foreground.png']},changed
result={'changed_files':changed,'alpha_masks_identical':True,'all_other_baseline_files_identical':True,'transforms_and_code_unchanged':True,'hard_interior_stone_masks_only':True}
(OUT/'verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
