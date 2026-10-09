"""June-only A/B coverage measured from unchanged full-resolution source alpha."""
import json, math
from pathlib import Path
import numpy as np
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'mobile/src/components/garden/flower-density-sandbox'
catalog = {}
for folder in ['tulip-components', 'chamomile-components', 'hydrangea-components', 'batch-components']:
    for c in json.loads((BASE / folder / 'componentManifest.json').read_text())['components']:
        species = c.get('speciesCode', folder.split('-')[0].upper())
        catalog[species + ':' + c['componentId']] = c
pixels = {}
results = []
for scene in json.loads((ROOT / 'output/monthly-layered-bed-geometry.json').read_text()):
    points = np.array([[p['x'], p['y']] for p in scene['points']])
    alpha = np.zeros(len(points))
    for p in scene['pieces']:
        key = p['speciesCode'] + ':' + p['componentId']
        c = catalog[key]
        if key not in pixels:
            pixels[key] = np.array(Image.open(ROOT / c['asset']).getchannel('A')) / 255
        dx = points[:, 0] - p['worldX']; dy = points[:, 1] - p['worldY']
        co = math.cos(p['rotation']); si = math.sin(p['rotation'])
        u = np.floor((dx * co + dy * si) / p['scale'] + c['anchorX'] * c['canvasWidth']).astype(int)
        v = np.floor((-dx * si + dy * co) / p['scale'] + c['anchorY'] * c['canvasHeight']).astype(int)
        valid = (u >= 0) & (u < c['canvasWidth']) & (v >= 0) & (v < c['canvasHeight'])
        alpha[valid] += pixels[key][v[valid], u[valid]] * (1 - alpha[valid])
    coverage = float(np.count_nonzero(alpha >= .5) * 16 / scene['area'])
    assert abs(coverage - scene['sampledCoverage']) < .035
    results.append(dict(version=scene['version'], coverage=coverage, runtimeCoverage=scene['sampledCoverage']))
assert abs(results[1]['coverage'] - results[0]['coverage']) < .025, results
assert results[1]['coverage'] <= results[0]['coverage'] + .005, results
(ROOT / 'docs/flower-visuals/MONTHLY_GROWTH_V11_COVERAGE.json').write_text(json.dumps(results, indent=2) + '\n')
print('June V1 / V1.1 full-resolution alpha comparison passed:', results)
