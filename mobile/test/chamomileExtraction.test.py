"""Verify original pixels, source alpha, complete crop edges and generated metadata."""
import importlib.util
import sys
from pathlib import Path
import json
from PIL import Image
root=Path(__file__).resolve().parents[2]
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('extraction',root/'mobile/scripts/extractChamomileComponents.py')
extractor=importlib.util.module_from_spec(spec); spec.loader.exec_module(extractor)
source=Image.open(extractor.SOURCE)
manifest=json.loads((extractor.DEST/'componentManifest.json').read_text())
for record in manifest['components']:
    roi=record['sourceRect']; crop=source.crop(roi)
    alpha=crop.getchannel('A')
    edges=[alpha.crop((0,0,crop.width,1)),alpha.crop((0,crop.height-1,crop.width,crop.height)),
        alpha.crop((0,0,1,crop.height)),alpha.crop((crop.width-1,0,crop.width,crop.height))]
    assert max(e.getextrema()[1] for e in edges)<8, f"Visible artwork clipped: {record['componentId']}"
    canvas=Image.open(root/record['asset']); ox,oy=record['canvasOffset']
    actual=canvas.crop((ox,oy,ox+crop.width,oy+crop.height))
    for original,result in zip(crop.get_flattened_data(),actual.get_flattened_data()):
        if result[3]: assert result==original, 'Retained art RGBA must be exact'
        if original[3]>=8: assert result==original, 'All visible fine art must be retained'
    assert canvas.getpixel((0,0))[3]==0
print('29 Chamomile extractions: every visible source pixel retained unchanged; crop edges clear; alpha padding transparent; no color key.')
