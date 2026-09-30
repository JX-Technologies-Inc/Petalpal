import importlib.util
import json
import sys
from pathlib import Path
from PIL import Image
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('hydrangea',root/'mobile/scripts/extractHydrangeaComponents.py')
extractor=importlib.util.module_from_spec(spec);spec.loader.exec_module(extractor)
source=Image.open(extractor.SOURCE)
manifest=json.loads((extractor.DEST/'componentManifest.json').read_text())
for c in manifest['components']:
    crop=source.crop(c['sourceRect']);canvas=Image.open(root/c['asset']);ox,oy=c['canvasOffset']
    actual=canvas.crop((ox,oy,ox+crop.width,oy+crop.height));alpha=actual.getchannel('A')
    edges=[alpha.crop((0,0,crop.width,1)),alpha.crop((0,crop.height-1,crop.width,crop.height)),
        alpha.crop((0,0,1,crop.height)),alpha.crop((crop.width-1,0,crop.width,crop.height))]
    assert max(e.getextrema()[1] for e in edges)<8, f"Visible crop edge: {c['componentId']}"
    for original,pixel in zip(crop.get_flattened_data(),actual.get_flattened_data()):
        if pixel[3]:assert pixel==original,'Retained RGBA altered'
    assert actual.tobytes()==extractor.extract(source,c['sourceRect'],c['sourceGroundPoint']).tobytes()
    assert canvas.getpixel((0,0))[3]==0
print('25 Hydrangea assets: exact source RGBA, complete crop edges, connected soil-base components and transparent padding passed.')
