from pathlib import Path
import sys, json, hashlib
ROOT=Path(__file__).resolve().parents[3]; OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image, ImageOps, ImageDraw
review=OUT/'review'; review.mkdir(exist_ok=True)
before=Image.open(OUT/'backup/runtime_before_full_close.png').convert('RGB')
after=Image.open(OUT/'source/runtime_after_full_close.png').convert('RGB')
full=Image.open(OUT/'source/runtime_after_full.png').convert('RGB')
ref=Image.open(OUT/'source/reference_entrance.png').convert('RGB')
def save(im,name): im.save(review/name)
def crop(im,box,scale=2):
    im=im.crop(box);return im.resize((im.width*scale,im.height*scale),Image.Resampling.LANCZOS)
def pair(a,b,labels,height=1000):
    panels=[]
    for im,label in zip((a,b),labels):
        im=im.resize((round(im.width*height/im.height),height),Image.Resampling.LANCZOS)
        p=Image.new('RGB',(im.width,height+48),'#202723');p.paste(im,(0,48));ImageDraw.Draw(p).text((16,15),label,fill='white');panels.append(p)
    result=Image.new('RGB',(sum(p.width for p in panels)+12,height+48),'#202723')
    result.paste(panels[0],(0,0));result.paste(panels[1],(panels[0].width+12,0));return result
box=(305,105,895,720)
save(ref,'01_reference_B_entrance.png')
save(crop(before,box),'02_main_entrance_before.png')
save(crop(after,box),'03_main_entrance_after.png')
save(pair(before.crop((405,185,885,620)),after.crop((405,185,885,620)),('CURRENT BEFORE','MAIN ENTRANCE V2')),'04_arch_before_after.png')
save(crop(after,(545,65,915,365)),'05_B01_junction_after.png')
save(crop(after,(285,85,625,345)),'06_upper_connection_after.png')
save(crop(after,(455,455,850,720)),'07_lower_entrance_after.png')
save(full,'08_full_garden_runtime.png')
save(pair(ref,after.crop(box),('REFERENCE B — ENTRANCE','ACTUAL /garden-test — V2')),'09_reference_B_vs_runtime.png')
save(crop(after,(280,64,940,720)),'10_MAIN_ENTRANCE_FULL_CLOSEUP.png')
baseline=json.loads((OUT/'backup/baseline.json').read_text())
changed=[];missing=[]
for name,h in baseline.items():
    p=ROOT/name
    if not p.exists(): missing.append(name)
    elif hashlib.sha256(p.read_bytes()).hexdigest()!=h: changed.append(name)
expected='mobile\\assets\\garden\\bridges\\approved-circulation\\main-road-connected.png'
verification={'checked_files':len(baseline),'changed':changed,'missing':missing,'only_main_entrance_changed':changed==[expected] and not missing,'runtime_matches_source':hashlib.sha256((ROOT/expected).read_bytes()).digest()==hashlib.sha256((OUT/'source/main-road-v2.png').read_bytes()).digest(),'review_files':[p.name for p in sorted(review.glob('*.png'))]}
(OUT/'verification.json').write_text(json.dumps(verification,indent=2))
assert verification['only_main_entrance_changed'] and verification['runtime_matches_source']
assert len(verification['review_files'])==10
(OUT/'README.md').write_text('''# Main Entrance Road V2 — pending visual approval

Implemented directly in `/garden-test`. Only `mobile/assets/garden/bridges/approved-circulation/main-road-connected.png` changed among the baseline Garden runtime assets and components.

## Appearance
Replaced the broad dense cobbled roadway with a narrower pedestrian route, larger warm beige irregular slabs, and irregular low planted edges. Local branches meet the existing Land09 circulation and B01 landing. The old road bitmap is replaced, so it is not rendered beneath the replacement.

## Unchanged runtime placement
Canvas: 680 × 2950. World x=1300, y=1350, width=680, height=2950, rotation=0, fit=fill. Rendered after Lands and before the approved infrastructure overlays and landmarks. Arch, B01 and all other transforms remain unchanged.

## Source and restoration
`backup/main-road-connected.png` is the previous asset; copy it back to the runtime path above to restore this change. Existing approved checkpoints remain untouched. `source/main-road-v2.png` is the transparent replacement. `source/prompt.txt`, `source/entrance_generated.png`, and `build.py` document generation and registration. The offscreen tail continues the asset below the normal Garden boundary; this tail is outside the reviewed normal framing.

## Runtime visual review
Reloaded actual localhost:8082/garden-test after replacement. Inspected normal full-Garden framing and zoomed entrance framing: narrower walking surface, larger warmer slabs, unobstructed paving, arch framing, both branch contacts, and organic edges. Existing locked landing/upper-contact stone remains its original cooler material. Review outputs are crops or paired composites of real browser screenshots, except the explicitly named Reference B image. No offline reconstruction is used as runtime evidence. Animated water/fish may differ between captures. Before/after arch crops use identical camera framing and pixel crop.

`verification.json` records the baseline hash audit. All 10 requested PNGs are in `review/`. No vegetation phase was started. Await visual approval.
''',encoding='utf-8')
print(json.dumps(verification,indent=2))
