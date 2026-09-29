"""Decoded-alpha, original-pixel preservation and failure-isolation regression tests."""
import sys,json,hashlib,tempfile
from pathlib import Path
from PIL import Image
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import auditBatchFlowerSources as audit
import extractBatchFlowerComponents as extraction
from batchFlowerSources import SPECS

root=extraction.ROOT
saved=json.loads((root/'docs/flower-visuals/BATCH_SOURCE_AUDIT.json').read_text())
assert saved==audit.audit(),'Source audit must describe every current source'
assert {r['sourcePath'] for r in saved['candidates']}=={p.relative_to(root).as_posix() for p in (root/'Resources/Garden Flowers').rglob('*.png')}
required={'speciesCode','sourcePath','width','height','colorMode','hasAlpha','alphaMin','alphaMax','transparentPixelCount','backgroundStatus','extractionStatus'}
for r in saved['speciesCandidates']:
    assert required<=r.keys()
    if r['extractionStatus']=='VALIDATED':assert r['hasAlpha'] and r['transparentPixelCount']>0 and r['alphaMin']==0
rose=next(r for r in saved['candidates'] if r['speciesCode']=='ROSE')
assert rose['backgroundStatus']=='BAKED_CHECKERBOARD' and rose['alphaMin']==255 and rose['transparentPixelCount']==0
with tempfile.TemporaryDirectory() as temp:
    opaque=Path(temp)/'opaque.png';Image.new('RGBA',(20,20),(0,100,0,255)).save(opaque)
    assert audit.inspect(opaque)['backgroundStatus']=='BAKED_BACKGROUND','RGBA does not prove transparency'
    damaged=Path(temp)/'broken.png';damaged.write_bytes(b'not a png')
    assert audit.inspect(damaged)['backgroundStatus']=='UNREADABLE'
    clear=Path(temp)/'unknown.png';Image.new('RGBA',(20,20)).save(clear)
    assert audit.inspect(clear)['backgroundStatus']=='AMBIGUOUS','Unreviewed transparency alone is insufficient'
invalid=('ROSE','M','invalid source',rose['sourcePath'],[])
result=extraction.run(specs=[invalid,SPECS[0],('BROKEN','S','missing','not-present.png',[]),SPECS[1]],audit=saved,write=False)
assert [s['speciesCode'] for s in result['species']]==['COREOPSIS','DAISY']
assert [s['speciesCode'] for s in result['skipped']]==['ROSE','BROKEN'],'Failures must not prevent following valid species'
manifest=json.loads((extraction.DEST/'componentManifest.json').read_text())
actual={p.relative_to(root).as_posix() for p in (root/'mobile/assets/garden/flowers/species').glob('*/components/batch/**/*.png')}
assert actual=={c['asset'] for c in manifest['components']},'No stale/orphan batch assets'
for c in manifest['components']:
    img=Image.open(root/c['asset']);assert img.mode=='RGBA' and img.size==(512,512)
    a=np.array(img);assert a[:,:,3].min()==0 and a[:,:,3].max()>100
    source=Image.open(root/c['sourcePath']).crop(c['sourceRect'])
    x,y=c['canvasOffset'];crop=np.array(img.crop((x,y,x+source.width,y+source.height)))
    visible=crop[:,:,3]>0
    assert np.array_equal(crop[visible],np.array(source)[visible]),'No recoloring, resampling, or output alpha modification'
    assert max(a[0,:,3].max(),a[-1,:,3].max(),a[:,0,3].max(),a[:,-1,3].max())==0
    assert hashlib.sha256((root/c['asset']).read_bytes()).hexdigest()==c['sha256']
extraction.run(check=True)
print('Batch source audit, opaque RGBA rejection, unreadable/unknown isolation, 59 original-RGBA components, exact regeneration and no stale assets passed.')
