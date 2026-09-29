"""Map-only derivatives. Full-quality PNGs are never overwritten."""
from pathlib import Path
from PIL import Image
import hashlib

root = Path(__file__).resolve().parents[1] / 'assets/garden/landmarks/waterfall'
out = root / 'map-animation'
out.mkdir(exist_ok=True)
sources = sorted((root/'animation').glob('waterfall_*.png')) + [root/'waterfall-static.png']
assert len(sources) == 44
for source in sources:
    before = hashlib.sha256(source.read_bytes()).digest()
    im = Image.open(source)
    assert im.mode == 'RGBA' and im.size == (1199, 1312), source
    # Odd source width: add ONE transparent source pixel on the RIGHT, never
    # stretch 1199 to 1200. At 50%, content is 599.5 x 656 inside 600 x 656.
    # Render at 2x in design space (1200 x 1312); original coordinates are exact.
    padded = Image.new('RGBA', (1200, 1312))
    padded.paste(im, (0, 0))
    padded.resize((600,656), Image.Resampling.LANCZOS).save(out/source.name)
    assert hashlib.sha256(source.read_bytes()).digest() == before
print(f'{len(sources)} RGBA derivatives: 600 x 656, exact 0.5 content scale; originals unchanged')
