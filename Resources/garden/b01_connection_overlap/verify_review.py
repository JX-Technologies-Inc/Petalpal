from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image
import numpy as np
for mode,num in [('on','01'),('off','02')]:
    im=Image.open(OUT/f'source/runtime_arch_{mode}.png').convert('RGB')
    c=im.crop((690,235,1010,665));c.resize((960,1290),Image.Resampling.LANCZOS).save(OUT/f'review/{num}_connection_with_arch_{mode.upper()}.png')
im=Image.open(OUT/'source/runtime_arch_on.png').convert('RGB').crop((475,135,1070,720))
im.resize((1190,1170),Image.Resampling.LANCZOS).save(OUT/'review/04_final_runtime_closeup.png')
base=json.loads((OUT/'source/baseline.json').read_text())
changed=[n for n,h in base.items() if hashlib.sha256((ROOT/n).read_bytes()).hexdigest()!=h]
expected=['mobile\\assets\\garden\\infrastructure\\entrance-connections\\b01-foot-landing.png','mobile\\src\\components\\garden\\GardenInfrastructureLayer.tsx']
assert set(changed)==set(expected),changed
landing=Image.open(ROOT/expected[0]).convert('RGBA')
road=Image.new('RGBA',landing.size);road.alpha_composite(Image.open(ROOT/'mobile/assets/garden/bridges/approved-circulation/main-road-connected.png'),(1300,1350))
opaque=(np.array(road)[:,:,3]>=250)|(np.array(landing)[:,:,3]>=250)
# A 20-world-pixel-wide opaque center corridor spans landing through road.
corridor=opaque[1455:1600,1610:1630]
assert corridor.all(),f'{int((~corridor).sum())} nonopaque pixels in center corridor'
result=json.loads((OUT/'source/overlap.json').read_text())
result.update({'checked_files':len(base),'changed_files':changed,'all_other_files_unchanged':True,'continuous_opaque_corridor':{'bounds':[1610,1455,1630,1600],'gap_pixels':int((~corridor).sum())},'runtime_arch_off_inspected':True,'arch_restored':True,'approved':False,'checkpoint_created':False})
(OUT/'verification.json').write_text(json.dumps(result,indent=2))
(OUT/'README.md').write_text('''# B01 physical connection correction — not approved / not checkpointed

Extended the current warm-stone landing into the actual Main Entrance paved surface. Kept the approved upper landing pixels; replaced the baked foreground fragments in its lower end with a short continuous warm-slab neck. Original bridge, road, Land09 transition, arch, all other artwork and transforms remain unchanged.

The connected landing replaces the two obsolete B01 entrance underlay/foreground patches in the render list; their original files remain intact. Draw order is Main Entrance → connected landing → original B01 bridge → original B01 Land08 foreground → landmarks/entrance arch. Other circulation render relationships remain unchanged.

Verified 4,251 opaque road-paving overlap pixels, including 2,249 in the lower neck. A 20×145 world-pixel opaque corridor crosses the landing-to-road connection with zero gap pixels. The diagnostic uses actual runtime PNG masks at their runtime world transforms, not an illustration. Magenta marks overlap with warm opaque road paving; blue includes the complete road footprint, and orange is the landing/extension.

The arch-off view is an actual /garden-test screenshot captured using the existing Landmarks visibility toggle. This temporarily hides all landmarks; only the entrance is cropped for review. Foreground visibility was restored afterward. The arch-on and arch-off crops have identical camera and bounds. Runtime inspected with no foreground concealing the connection.

Built-in image_gen was used to extend local paving, with exact prompt in source/prompt.txt. Only the extension was masked into the landing asset; generated pixels outside that region were discarded. No alpha blur was used to join surfaces. Build and verification scripts are retained. No approval or checkpoint was created.
''',encoding='utf-8')
print(json.dumps(result,indent=2))
