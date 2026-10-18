from pathlib import Path
from PIL import Image
import hashlib,json
R=Path(__file__).resolve().parent
m=json.loads((R/'frames.json').read_text(encoding='utf-8'))
src=Image.open(R/'source/candidate_sheet.png').convert('RGBA')
hashes=[]
for f in m['frames']:
    im=Image.open(R/f"frames/frame_{f['frame']:02}.png")
    assert im.mode=='RGBA' and list(im.size)==m['canvas']
    assert im.getchannel('A').getextrema()==(0,255)
    crop=src.crop(tuple(f['source_rect']))
    assert im.crop((32,32,32+crop.width,32+crop.height)).tobytes()==crop.tobytes()
    hashes.append(hashlib.sha256(im.tobytes()).hexdigest())
assert len(set(hashes))==16
for name in ['walk.gif','walk.png']:
    im=Image.open(R/'review'/name);assert im.n_frames==16
    duration=0
    for i in range(16):im.seek(i);duration+=im.info['duration']
    assert duration==2720
for row in json.loads((R/'source/reference_hashes.json').read_text(encoding='utf-8-sig')):
    assert hashlib.sha256(Path(row['Path']).read_bytes()).hexdigest().upper()==row['Hash']
print('PASS: 16 unique equal-sized RGBA frames, lossless grid extraction, alpha range, GIF/APNG timing, authoritative source hashes unchanged.')
print('Technical checks do NOT certify gait, anatomical alternation, registration quality, or visual fidelity.')
