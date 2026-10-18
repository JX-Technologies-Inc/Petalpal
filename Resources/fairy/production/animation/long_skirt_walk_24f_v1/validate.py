from pathlib import Path
from PIL import Image
import json,hashlib,numpy as np,re,base64
R=Path(__file__).resolve().parent;S=R.parent/'long_skirt_walk_shoes_v2'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
m=json.loads((R/'frames.json').read_text());expected=[]
for i in range(1,17):
 expected.append(str(i))
 if i%2:expected.append(f'{i}.5')
assert [f['label'] for f in m['frames']]==expected
checks=[]
for f in m['frames']:
 p=R/f"frames/frame_{f['index']:02}.png";im=Image.open(p);assert im.mode=='RGBA' and im.size==(378,378)
 assert sha(p)==f['sha256'];a=np.array(im);bbox=im.getchannel('A').point(lambda x:255 if x>16 else 0).getbbox()
 assert bbox and bbox[0]>0 and bbox[1]>0 and bbox[2]<378 and bbox[3]<378
 if f['kind']=='anchor':
  src=S/f"frames/frame_{f['anchor']:02}.png";assert p.read_bytes()==src.read_bytes()==(R/'anchors'/src.name).read_bytes()
 else:
  n=f['between'][0];assert p.read_bytes()==(R/f'inbetweens/frame_{n:02}_5.png').read_bytes()
  assert all(not np.array_equal(a,np.array(Image.open(S/f'frames/frame_{j:02}.png'))) for j in f['between'])
 checks.append({'label':f['label'],'alpha_gt16_bbox':bbox})
for p,h in json.loads((R/'source_hashes.json').read_text()).items():assert sha(S/p)==h
im=Image.open(R/'review/walk_24.gif');assert im.n_frames==24;delays=[]
for i in range(24):im.seek(i);delays.append(im.info['duration'])
assert delays==m['gif_durations_ms'] and sum(delays)==1360 and set(delays)=={50,60}
html=(R/'index.html').read_text(encoding='utf-8');assets=json.loads(re.search(r'const assets=(.*);\nconst el=',html).group(1))
for name,folder,count in [('original','anchors',16),('refined','frames',24)]:
 for i in range(count):assert base64.b64decode(assets[name][i])==(R/f'{folder}/frame_{i+1:02}.png').read_bytes()
(R/'validation.json').write_text(json.dumps({'anchors_byte_identical':16,'new_distinct_midpoints':8,'canvas':[378,378],'gif_duration_ms':sum(delays),'source_package_unchanged':True,'alpha_bounds':checks,'visual_smoothness':'manual review pending; not proven by pixel checks'},indent=2))
print('PASS: 16 byte-identical anchors; 8 distinct midpoints; exact order; unchanged source package; RGBA/padding; 1360 ms GIF; embedded HTML images.')
