from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image
before=Image.open(OUT/'backup/runtime_current.png').convert('RGB')
after=Image.open(OUT/'source/runtime_corrected.png').convert('RGB')
def crop(im,box,scale,name):
    im=im.crop(box);im.resize((im.width*scale,im.height*scale),Image.Resampling.LANCZOS).save(OUT/'review'/name)
box=(625,100,810,295)
crop(before,box,4,'01_B01_current.png')
crop(after,box,4,'02_B01_corrected.png')
crop(after,(640,140,770,265),7,'03_B01_extreme_closeup.png')
Image.open(OUT/'source/runtime_normal.png').convert('RGB').save(OUT/'review/04_B01_normal_garden_scale.png')
base=json.loads((OUT/'backup/baseline.json').read_text())
changed=[n for n,h in base.items() if not (ROOT/n).exists() or hashlib.sha256((ROOT/n).read_bytes()).hexdigest()!=h]
expected='mobile\\assets\\garden\\infrastructure\\entrance-connections\\b01-foot-landing.png'
assert changed==[expected],changed
im=Image.open(ROOT/expected)
report={'checked_files':len(base),'changed':changed,'locked_artwork_and_code_unchanged':True,'overlay_bounds':im.getchannel('A').getbbox(),'world_canvas':[2400,1800],'transform':{'x':0,'y':0,'width':2400,'height':1800,'rotation':0},'review_count':len(list((OUT/'review').glob('*.png')))}
assert report['review_count']==4
(OUT/'verification.json').write_text(json.dumps(report,indent=2))
(OUT/'README.md').write_text('''# B01 bridge-foot final local correction — visual review

Only `mobile/assets/garden/infrastructure/entrance-connections/b01-foot-landing.png` changed. All other baseline assets, code and transforms are unchanged, including approved Land09 V1 and Main Entrance V2.

Replaced round cobbles with staggered warm rectangular slabs matching the Main Entrance. The local paving candidate extends beneath the original bridge; original bridge alpha supplies foreground occlusion so deck, posts and bridge flowers remain visible above it. The unchanged arch also renders above the approach. The overlay has irregular local bounds, with no blur or broad alpha feather used to hide joints.

Built-in image_gen produced the local edit candidate. Exact prompt: `source/prompt.txt`. Only masked local pixels are installed; generated bridge/arch/water pixels are discarded. `source/paving-underlap.png` retains the underlap construction; `source/b01-foot-landing.png` is the runtime overlay. `build.py` reproduces it.

All four review images are actual `/garden-test` screenshots or enlarged crops. Before/after use the same camera and crop. Extreme closeup is an enlargement, not added detail. Normal-scale output retains the full 1280×720 Garden framing. Visually inspected both scales. No other review outputs are generated.

Restore `backup/b01-foot-landing.png` to the runtime path to undo this pass. Verification and baseline hashes are retained locally. Stopped for visual approval.
''',encoding='utf-8')
print(json.dumps(report,indent=2))
