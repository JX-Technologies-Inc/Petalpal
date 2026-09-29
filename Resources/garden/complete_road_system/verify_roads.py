"""Check the allowed code change and preservation of all V1 snapshot files."""
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
checkpoint=ROOT/'Resources/garden/checkpoints/APPROVED_CIRCULATION_V1_2026-09-23_155002'
manifest=json.loads((checkpoint/'manifest.json').read_text())
allowed={'mobile/src/components/garden/GardenScene.tsx'}
changed=[];unexpected=[]
for row in manifest['files']:
 p=ROOT/row['path']
 if not p.exists() or hashlib.sha256(p.read_bytes()).hexdigest()!=row['sha256']:
  changed.append(row['path'])
  if row['path'] not in allowed:unexpected.append(row['path'])
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image
import cv2
import numpy as np
road=Image.open(ROOT/'mobile/assets/garden/roads/complete/R01_treehouse_path.png')
mask=(np.array(road)[:,:,3]>32).astype('uint8')
n,labels,stats,centroids=cv2.connectedComponentsWithStats(mask,8)
components=[int(s[cv2.CC_STAT_AREA]) for s in stats[1:] if s[cv2.CC_STAT_AREA]>=20]
result={'checkpoint':checkpoint.name,'files_checked':len(manifest['files']),
 'changed_existing_files':changed,'unexpected_changes':unexpected,
 'all_existing_assets_and_transforms_unchanged':not unexpected,
 'road_rgba_canvas':list(road.size),'road_substantial_connected_components':len(components),
 'road_component_areas':components,'new_road_geometry':json.loads((OUT/'road_geometry.json').read_text()),
 'new_runtime_assets':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'mobile/assets/garden/roads/complete').glob('*.png')}}
(OUT/'verification.json').write_text(json.dumps(result,indent=2))
assert not unexpected,unexpected
assert len(components)==1,components
assert road.mode=='RGBA' and road.size==(2400,1800)
assert result['new_road_geometry']['R01']['visible_pixels_over_alpha_less_than_32']==0
print(json.dumps(result,indent=2))
