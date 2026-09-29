"""Read-only audit of the eight curated botanical folders; never edits source art."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
FOLDERS = ["Happy", "Love & Caring & Gratitude", "Sadness & Loneliness",
           "Anxiety & Stress & Fear", "Anger & Frustration",
           "Surprise & Excitement & Curiosity", "Tiredness, Numbness, Confusion", "Calm & Peace"]

def inventory():
    result = []
    for folder in FOLDERS:
        for path in sorted((ROOT / 'Resources' / folder).glob('*.png')):
            with Image.open(path) as im:
                alpha = 'A' in im.getbands() or 'transparency' in im.info
                extrema = im.convert('RGBA').getchannel('A').getextrema()
                result.append(dict(filename=path.name, sourceReference=path.relative_to(ROOT).as_posix(),
                    displayName=path.stem.replace('-', ' '), category=folder, width=im.width, height=im.height,
                    mode=im.mode, hasAlpha=alpha, hasTransparentPixels=extrema[0] < 255,
                    backgroundAssessment='Baked background; botanical reference, manual Garden redraw required',
                    suitableForDirectGardenUse=False, status='NEEDS_GARDEN_ART_ADAPTATION',
                    sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    return result

if __name__ == '__main__':
    print(json.dumps(inventory(), indent=2))
