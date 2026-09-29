"""Place the real /garden-test canvas beside the offline placement reference."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'Resources/road/.tools'))
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
runtime = Image.open(OUT / '01_mobile_infrastructure_on.png').convert('RGB')
offline = Image.open(ROOT / 'Resources/garden/infrastructure_corrected/01_infrastructure_corrected_full.png').convert('RGB')
fit = min(runtime.width / offline.width, runtime.height / offline.height)
size = (round(offline.width * fit), round(offline.height * fit))
reference = Image.new('RGB', runtime.size, '#78b8b2')
reference.paste(offline.resize(size, Image.Resampling.LANCZOS),
                ((runtime.width - size[0]) // 2, (runtime.height - size[1]) // 2))
header = 45
sheet = Image.new('RGB', (runtime.width * 2, runtime.height + header), '#f2f0e8')
sheet.paste(reference, (0, header))
sheet.paste(runtime, (runtime.width, header))
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 20)
except OSError:
    font = ImageFont.load_default()
draw.text((14, 10), 'OFFLINE CORRECTED PLACEMENT', fill='#17363c', font=font)
draw.text((runtime.width + 14, 10), 'ACTUAL /garden-test RUNTIME', fill='#17363c', font=font)
sheet.save(OUT / '03_mobile_vs_offline.png', optimize=True)
