"""Read-only source audit; writes diagnostic images/data beside this script only."""
from pathlib import Path
import json, hashlib
import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
BASE = ROOT / 'Resources/fairy/production'
master = BASE / 'master/fairy_first_approved.png'
folder = BASE / 'layers/first_approved'
manifest = json.loads((folder / 'manifest.json').read_text())
names = [v['id'] for v in manifest['layers']]
paths = [master] + [folder / (n+'.png') for n in names]
hashes = {str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
src = np.array(Image.open(master))
layers = {n:Image.open(folder/(n+'.png')).convert('RGBA') for n in names}
ownership = sum((np.array(im)[:,:,3]>0).astype(np.uint8) for im in layers.values())
composite=Image.new('RGBA',(1254,1254))
for im in layers.values(): composite=Image.alpha_composite(composite,im)
a=np.array(composite); visible=src[:,:,3]>0
assert np.array_equal(a[:,:,3],src[:,:,3]) and np.array_equal(a[visible],src[visible])
panels=[('approved source',Image.open(master)),('leg_left',layers['leg_left']),('leg_right',layers['leg_right']),('dress_base',layers['dress_base']),('dress_front_petals',layers['dress_front_petals'])]
box=(530,630,810,1195)
sheet=Image.new('RGB',(280*len(panels),600),'#606b76'); draw=ImageDraw.Draw(sheet)
for i,(name,im) in enumerate(panels):
    crop=im.crop(box); sheet.paste(crop,(280*i,30),crop); draw.text((280*i+5,8),name,fill='white')
sheet.save(HERE/'leg_coverage.png')
report={'source_hashes':hashes,'rest_visible_rgba_exact':True,'alpha_exact':True,
        'overlapping_visible_pixels':int(np.count_nonzero(ownership>1)),
        'leg_alpha_counts_by_source_y_band':{}}
for n in ['leg_left','leg_right']:
    alpha=np.array(layers[n])[:,:,3]
    report['leg_alpha_counts_by_source_y_band'][n]={f'{lo}:{hi}':int(np.count_nonzero(alpha[lo:hi])) for lo,hi in [(650,750),(750,850),(850,950),(950,1050),(1050,1195)]}
# Separate diagnostic panels retain source-pixel scale; no source editing.
panels=[(n,layers[n]) for n in ['body_base','arm_left_upper','arm_left_lower','arm_right_upper','arm_right_lower','wing_left','wing_right']]
box=(390,250,880,710); sheet=Image.new('RGB',(490*4,490*2),'#606b76'); draw=ImageDraw.Draw(sheet)
for i,(n,im) in enumerate(panels):
    x=(i%4)*490;y=(i//4)*490; crop=im.crop(box);sheet.paste(crop,(x,y+25),crop);draw.text((x+4,y+4),n,fill='white')
sheet.save(HERE/'joint_coverage.png')
assert hashes=={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
report['sources_unchanged']=True
(HERE/'audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='source_hashes'},indent=2))
