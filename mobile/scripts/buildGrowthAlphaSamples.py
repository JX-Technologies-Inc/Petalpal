"""Read-only artwork alpha metadata for DEV visual coverage; never rewrites PNGs."""
import argparse,json,hashlib
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'mobile/src/components/garden/flower-density-sandbox'
def build():
    records={}
    for folder in ['tulip-components','chamomile-components','hydrangea-components','batch-components']:
        for c in json.loads((BASE/folder/'componentManifest.json').read_text())['components']:
            im=Image.open(ROOT/c['asset']).getchannel('A').resize((64,64),Image.Resampling.BOX)
            box=im.getbbox();crop=im.crop(box)
            species=c.get('speciesCode',folder.split('-')[0].upper())
            records[species+':'+c['componentId']]=dict(left=box[0],top=box[1],width=crop.width,height=crop.height,
                alpha=list(crop.get_flattened_data()),sourceSha256=hashlib.sha256((ROOT/c['asset']).read_bytes()).hexdigest())
    return json.dumps(dict(sourcePixelsPerSample=8,components=records),separators=(',',':'))+'\n'
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');args=p.parse_args()
    target=BASE/'monthly-growth/alphaSamples.json';data=build()
    if args.check:assert target.read_text()==data
    else:target.write_text(data)
    print('Original PNG alpha samples verified; artwork untouched.')
