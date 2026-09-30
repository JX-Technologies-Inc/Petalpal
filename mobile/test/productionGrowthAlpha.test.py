"""Independent original-PNG alpha measurement; no rendering or image editing."""
import json, math
from pathlib import Path
import numpy as np
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'mobile/src/components/garden/flower-density-sandbox'
catalog = {}
for folder in ['tulip-components', 'chamomile-components', 'hydrangea-components', 'batch-components']:
    for c in json.loads((BASE / folder / 'componentManifest.json').read_text())['components']:
        catalog[c.get('speciesCode', folder.split('-')[0].upper()) + ':' + c['componentId']] = c
pixels, results = {}, []
for scene in json.loads((ROOT / 'output/production-growth-integration-checks/land-aware-alpha-geometry.json').read_text()):
    points = np.array([[p['x'], p['y']] for p in scene['points']])
    alpha = np.zeros(len(points))
    for p in scene['pieces']:
        key = p['speciesCode'] + ':' + p['componentId']; c = catalog[key]
        if key not in pixels:
            pixels[key] = np.array(Image.open(ROOT / c['asset']).getchannel('A')) / 255
        dx = points[:, 0] - p['worldX']; dy = points[:, 1] - p['worldY']
        co, si = math.cos(p['rotation']), math.sin(p['rotation'])
        u = np.floor((dx * co + dy * si) / p['scale'] + c['anchorX'] * c['canvasWidth']).astype(int)
        v = np.floor((-dx * si + dy * co) / p['scale'] + c['anchorY'] * c['canvasHeight']).astype(int)
        valid = (u >= 0) & (v >= 0) & (u < c['canvasWidth']) & (v < c['canvasHeight'])
        alpha[valid] += pixels[key][v[valid], u[valid]] * (1 - alpha[valid])
    coverage = float(np.count_nonzero(alpha >= .5) * 16 / scene['area'])
    assert abs(coverage - scene['runtimeCoverage']) < .025
    results.append(dict(name=scene['name'], sourceAlphaCoverage=coverage))
assert abs(results[0]['sourceAlphaCoverage'] - results[1]['sourceAlphaCoverage']) < .02
assert .72 <= results[1]['sourceAlphaCoverage'] <= .78
(ROOT / 'output/production-growth-integration-checks/land-aware-source-alpha.json').write_text(json.dumps(results, indent=2) + '\n')
print('Independent source-PNG alpha coverage:', results)
