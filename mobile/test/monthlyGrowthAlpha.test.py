"""Independently measure coverage using full-resolution, unmodified source alpha."""
import json,math
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'mobile/src/components/garden/flower-density-sandbox'
catalog={}
for folder in ['tulip-components','chamomile-components','hydrangea-components','batch-components']:
    for c in json.loads((BASE/folder/'componentManifest.json').read_text())['components']:
        species=c.get('speciesCode',folder.split('-')[0].upper())
        catalog[species+':'+c['componentId']]=(c,np.array(Image.open(ROOT/c['asset']).getchannel('A'))/255)
results=[]
for scene in json.loads((ROOT/'output/monthly-growth-alpha-geometry.json').read_text()):
    points=np.array([[p['x'],p['y']] for p in scene['points']]);alpha=np.zeros(len(points))
    for p in scene['pieces']:
        c,pixels=catalog[p['speciesCode']+':'+p['componentId']]
        dx=points[:,0]-p['worldX'];dy=points[:,1]-p['worldY'];co=math.cos(p['rotation']);si=math.sin(p['rotation'])
        u=np.floor((dx*co+dy*si)/p['scale']+c['anchorX']*c['canvasWidth']).astype(int)
        v=np.floor((-dx*si+dy*co)/p['scale']+c['anchorY']*c['canvasHeight']).astype(int)
        valid=(u>=0)&(u<512)&(v>=0)&(v<512)
        alpha[valid]+=pixels[v[valid],u[valid]]*(1-alpha[valid])
    fraction=float(np.count_nonzero(alpha>=.5)*16/scene['area'])
    assert .70<=fraction<=.85,(scene['month'],fraction)
    assert abs(fraction-scene['sampledCoverage'])<.035,'Downsampled alpha estimator diverges from full source alpha'
    results.append(dict(month=scene['month'],fullResolutionAlphaCoverage=fraction,runtimeEstimate=scene['sampledCoverage']))
(ROOT/'docs/flower-visuals/MONTHLY_GROWTH_ALPHA_VERIFICATION.json').write_text(json.dumps(results,indent=2)+'\n')
print('Full-resolution PNG alpha verification:',results)
