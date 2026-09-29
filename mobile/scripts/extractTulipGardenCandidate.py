"""Extract the supplied three-cluster candidate; no generation or background cleanup.
Only transparent-bound trimming, shared uniform normalization, and transparent padding.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'Resources/Garden Flowers/Tulip/tulip_garden_abc_candidate.png'
MANIFEST = ROOT / 'mobile/src/components/garden/flower-visuals/gardenArtManifest.json'

def main():
    source_bytes = SOURCE.read_bytes()
    im = Image.open(SOURCE)
    if im.mode != 'RGBA' or im.size != (2172, 724):
        raise ValueError('Unexpected candidate; extraction coordinates require this reviewed source')
    # Seams have no nonzero alpha. Keep even faint alpha=1 source fragments; no cleanup.
    regions = [('sparse', 0, 650, (300, 635)), ('normal', 650, 1355, (990, 641)),
               ('full', 1355, 2172, (1785, 650))]
    manifest = json.loads(MANIFEST.read_text())
    tulip = next(s for s in manifest if s['speciesCode'] == 'TULIP')
    records = []
    for variant, left, right, root in regions:
        cell = im.crop((left, 0, right, im.height))
        bounds = cell.getbbox()
        crop = cell.crop(bounds)
        # Shared 0.6 ratio preserves relative cluster mass. Integer rounding <1 px.
        size = tuple(round(value * .6) for value in crop.size)
        normalized = crop.resize(size, Image.Resampling.LANCZOS)
        offset = ((512 - size[0]) // 2, 512 - 12 - size[1])
        canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
        canvas.paste(normalized, offset)  # Copy alpha exactly; do not multiply it with a mask.
        anchorX = (offset[0] + (root[0] - left - bounds[0]) * size[0] / crop.width) / 512
        anchorY = (offset[1] + (root[1] - bounds[1]) * size[1] / crop.height) / 512
        slot = tulip['gardenAssets'][variant]
        if slot['status'] == 'APPROVED':
            raise ValueError('Do not overwrite approved artwork')
        target = ROOT / slot['asset']
        target.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(target)
        slot.update(anchorX=round(anchorX, 6), anchorY=round(anchorY, 6), visualScale=1,
                    status='READY_FOR_REVIEW', anchorStatus='PROVISIONAL', reviewedSha256=None)
        records.append(dict(composition=variant, asset=slot['asset'], sourceCell=[left, 0, right, im.height],
            sourceCrop=[left+bounds[0], bounds[1], left+bounds[2], bounds[3]],
            sourceGroundPoint=list(root), normalizedSize=list(size), canvasOffset=list(offset),
            anchorX=slot['anchorX'], anchorY=slot['anchorY'], visualScale=1,
            sha256=hashlib.sha256(target.read_bytes()).hexdigest()))
    MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n')
    report = dict(source=SOURCE.relative_to(ROOT).as_posix(), sourceSha256=hashlib.sha256(source_bytes).hexdigest(),
        canvas=[512,512], normalizationScale=.6, status='READY_FOR_REVIEW',
        note='Source artwork preserved; uniform raster downsampling only. No matte removal, alpha threshold, recoloring, repainting, sharpening or extra blur. Ground points are visual estimates pending manual review.', assets=records)
    (ROOT/'docs/flower-visuals/TULIP_CANDIDATE_EXTRACTION.json').write_text(json.dumps(report, indent=2)+'\n')
    assert SOURCE.read_bytes() == source_bytes
    print(json.dumps(records, indent=2))

if __name__ == '__main__': main()
