from pathlib import Path
from PIL import Image
import numpy as np,json,hashlib,re,base64
R=Path(__file__).resolve().parent;A=R.parent/'shoe_proportion_review_v1';S=R.parent/'long_skirt_walk_refined_v1'
meta=json.loads((R/'frames.json').read_text());assert meta['frame_duration_ms']==85 and meta['loop_duration_ms']==1360
for n in range(1,17):
 f=f'frame_{n:02}.png';a=np.array(Image.open(S/'frames'/f));im=Image.open(R/'frames'/f);b=np.array(im);m=np.array(Image.open(R/f'masks/frame_{n:02}_union.png'))>0
 assert im.mode=='RGBA' and im.size==(378,378)
 assert np.array_equal(a[~m],b[~m]);assert np.array_equal(a[:279],b[:279])
 assert np.where(a[:,:,3]>16)[0].max()==np.where(b[:,:,3]>16)[0].max()
 assert (S/'frames'/f).read_bytes()==(R/'original'/f).read_bytes()
 if n in [1,5,9,13]:assert (A/'variants/090'/f).read_bytes()==(R/'frames'/f).read_bytes()
for name in ['walk.gif','before_after.gif']:
 im=Image.open(R/'review'/name);assert im.n_frames==16;total=0
 for i in range(16):im.seek(i);assert im.info['duration']==[80,90][i%2];total+=im.info['duration']
 assert total==1360
html=(R/'index.html').read_text();assets=json.loads(re.search(r'const assets=(.*);\nconst el=',html).group(1))
for kind,folder in [('original','original'),('corrected','frames')]:
 assert len(assets[kind])==16
 for i,b64 in enumerate(assets[kind]):assert base64.b64decode(b64)==(R/f'{folder}/frame_{i+1:02}.png').read_bytes()
assert 'http://' not in html and 'https://' not in html
print('PASS: all 16 frames, 4 approved copies, outside-mask RGBA, static baseline, both GIF timings, embedded self-contained assets.')
