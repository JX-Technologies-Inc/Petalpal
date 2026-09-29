from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image
before=Image.open(OUT/'backup/runtime_before.png').convert('RGB')
after=Image.open(OUT/'source/runtime_after.png').convert('RGB')
full=Image.open(OUT/'source/runtime_full_entrance.png').convert('RGB')
def save(im,box,scale,name):
    im=im.crop(box);im.resize((im.width*scale,im.height*scale),Image.Resampling.LANCZOS).save(OUT/'review'/name)
land=(485,255,730,465);bridge=(775,240,950,440)
save(before,land,3,'01_land09_connection_before.png')
save(after,land,3,'02_land09_connection_after.png')
save(after,(520,290,700,440),6,'03_land09_connection_extreme_closeup.png')
save(before,bridge,4,'04_B01_connection_before.png')
save(after,bridge,4,'05_B01_connection_after.png')
save(after,(790,300,915,405),7,'06_B01_connection_extreme_closeup.png')
save(full,(285,64,950,720),2,'07_full_main_entrance_runtime.png')
baseline=json.loads((OUT/'backup/baseline.json').read_text())
changed=[name for name,h in baseline.items() if not (ROOT/name).exists() or hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=h]
assert changed==['mobile\\src\\components\\garden\\GardenInfrastructureLayer.tsx'],changed
layers={}
for name in ['land09-transition','b01-foot-landing']:
    p=ROOT/f'mobile/assets/garden/infrastructure/entrance-connections/{name}.png'
    im=Image.open(p);layers[name]={'path':str(p.relative_to(ROOT)),'canvas':list(im.size),'world_transform':{'x':0,'y':0,'width':2400,'height':1800,'rotation':0},'alpha_bounds':im.getchannel('A').getbbox(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
report={'baseline_files_checked':len(baseline),'changed_existing_files':changed,'all_preexisting_artwork_unchanged':True,'new_layers':layers,'review_count':len(list((OUT/'review').glob('*.png')))}
assert report['review_count']==7
(OUT/'verification.json').write_text(json.dumps(report,indent=2))
(OUT/'README.md').write_text('''# Main Entrance local landing correction — pending visual approval

## Scope
Two separate transparent world-aligned connection overlays only. Main Entrance V2 artwork, width, flowers, vegetation and placement are unchanged. All pre-existing Garden artwork is byte-identical to the start of this pass. Land09, B01 and all other transforms remain unchanged.

## Land09
Staggered interlocking groups of gray, intermediate gray-beige, and warm stones replace the straight local material collision. Two short capped curb ends frame the path opening. The mask follows an irregular local masonry region; no blur or broad alpha feather is used to hide the seam.

## B01
Compact fitted stone landing beneath the existing bridge foot. The unchanged original bridge alpha excludes the overlay from bridge pixels, retaining the deck, rails, posts, and flowers. Original arch renders in front. No bridge transform or source artwork changes.

## Runtime
`mobile/src/components/garden/GardenInfrastructureLayer.tsx` loads the two new assets after the existing infrastructure layers and before landmarks. Assets and world bounds are in `verification.json`. Both canvases are 2400×1800 at world origin, rotation zero. Their nontransparent pixels are confined to the two local connections.

## Review evidence
Seven requested images in `review/` are crops of actual `/garden-test` screenshots, with identical before/after framing. Extreme closeups are enlarged runtime crops, not new generated detail. `source/construction-preview.png` is an offline assembly check only, not a runtime review image. Runtime inspection covered the two joins and full visible entrance. Animated water/fish may differ between captures.

## Generation and restore
Used built-in image_gen for local edit candidates. Exact prompts are in `source/exact-prompts.json`; full candidates retained alongside tightly masked transparent exports. Generated pixels outside local connection masks are discarded. Existing assets were never overwritten. Restore `backup/GardenInfrastructureLayer.tsx` to its original runtime path to disable both additions. `backup/baseline.json` stores original hashes. `build.py` reproduces layer extraction; `package_review.py` verifies locked files and exports review crops.

Stopped for visual approval. No other circulation or vegetation work performed.
''',encoding='utf-8')
print(json.dumps(report,indent=2))
