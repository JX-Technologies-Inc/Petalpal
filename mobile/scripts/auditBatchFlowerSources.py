"""Audit every actual candidate before extraction. No background removal."""
import json
import hashlib
from pathlib import Path
from PIL import Image
import numpy as np
from batchFlowerSources import SPECS,PROTECTED

ROOT=Path(__file__).resolve().parents[2]
DEST=ROOT/'docs/flower-visuals/BATCH_SOURCE_AUDIT.json'
# Actual files visually inspected over gray on 2026-09-29. Changed/new sources require review.
REVIEWED_SHA256={'Resources/Garden Flowers/121213a0-fabc-42af-9580-3f7383f17583.png': 'e5dc3c3da4c16725ee30dbde0fbef9b55d64e70019ebd3972cc3f7d64c4081b3', 'Resources/Garden Flowers/59ec5368-7656-4110-9742-d3b36213429e.png': 'f9ef7fe5c529a117c025478b924581bb9b3ba16906e9bb1ea8900fec8f7e07aa', 'Resources/Garden Flowers/Chamomile/chamomile_garden_abc_candidate.png': '8842911c29ea4059a2beb2dfe5ee8bbccc253dea0ed5f8b638b37d144a306d6e', 'Resources/Garden Flowers/Coreopsis/coreopsis.png': '231be6fb7190f97680ad7c42090255144aa3f639a16c5512a77a43af7f985375', 'Resources/Garden Flowers/Hydrangea/hydrangea_garden_abc_candidate.png': '54db3ac0ac344c24d44cdad6b0cf007ff578daedab4cd81606760030ccdd661a', 'Resources/Garden Flowers/Rose/rose_garden_abc_candidate.png': 'fdfbb531acf34049adf11989bc4f1536fbca71180ab014121207650ba1e40beb', 'Resources/Garden Flowers/Tulip/tulip_garden_abc_candidate.png': 'b2b53af402762d33253a3c53ec93d5ff9083662e90d7ecf51ac52b75bfc3711b', 'Resources/Garden Flowers/Tulip/tulip_garden_component_sheet_v2.png': 'b2bd167213c6d919dbe9f0187c2d19aa7ff7272759094ea2421c31e2ace79257'}

def inspect(path, species=None, gap=None):
    record=dict(speciesCode=species,sourcePath=path.as_posix(),width=None,height=None,colorMode=None,
        hasAlpha=False,alphaMin=None,alphaMax=None,transparentPixelCount=0,backgroundStatus='UNREADABLE',extractionStatus='SKIPPED_INVALID_SOURCE')
    try:
        im=Image.open(ROOT/path);im.load();a=np.array(im.convert('RGBA'))[:,:,3]
        record.update(width=im.width,height=im.height,colorMode=im.mode,hasAlpha='A' in im.getbands() or 'transparency' in im.info,
            alphaMin=int(a.min()),alphaMax=int(a.max()),transparentPixelCount=int((a==0).sum()),
            sourceSha256=hashlib.sha256((ROOT/path).read_bytes()).hexdigest())
        if a.min()==255:
            record.update(backgroundStatus='BAKED_CHECKERBOARD' if species=='ROSE' else 'BAKED_BACKGROUND',reason='No usable decoded transparency; Rose checkerboard visually confirmed')
        else:
            # Alpha evidence alone is necessary, not sufficient. These existing sheets
            # were visually inspected over gray; opaque background impostors are excluded.
            clear=float(np.mean(a<=8))
            record['clearPixelFraction']=clear
            if clear>.2 and REVIEWED_SHA256.get(path.as_posix())==record['sourceSha256']:
                record.update(backgroundStatus='GENUINE_TRANSPARENT',extractionStatus='VALIDATED',reason='Actual alpha and gray-composited visual inspection agree')
            else:record.update(backgroundStatus='AMBIGUOUS',reason='Changed/unreviewed source or insufficient clear surroundings; manual inspection required')
        if gap:
            values=[int(a[y,x]) for x,y in gap];record['emptyAreaSamples']=[dict(x=x,y=y,alpha=v) for (x,y),v in zip(gap,values)]
            if max(values)>8:record.update(backgroundStatus='AMBIGUOUS',extractionStatus='SKIPPED_INVALID_SOURCE',reason='Inspected empty-area alpha is not clear')
    except Exception as error:record['reason']=str(error)
    if species in PROTECTED:record['extractionStatus']='PROTECTED_REFERENCE'
    return record

def audit():
    files=sorted((ROOT/'Resources/Garden Flowers').rglob('*.png'))
    records=[]
    for p in files:
        code=p.parent.name.upper() if p.parent.name!='Garden Flowers' else None
        records.append(inspect(p.relative_to(ROOT),code))
    candidates=[]
    for species,cls,form,source,pieces in SPECS:
        # Use clear margin between header and first bloom on each labeled source.
        candidates.append(dict(next(r for r in records if r['sourcePath']==source),speciesCode=species,flowerClass=cls,morphology=form,
            mappingEvidence='Explicit species label on inspected Garden sheet' if source.endswith('png') else '',
            extractionStatus=next(r['extractionStatus'] for r in records if r['sourcePath']==source)))
    candidates.extend(r.copy() for r in records if r['speciesCode'] in PROTECTED|{'ROSE'})
    for record in records:
        record['speciesCodes']=[s[0] for s in SPECS if s[3]==record['sourcePath']] or [record['speciesCode']]
    registry=json.loads((ROOT/'mobile/src/components/garden/flower-visuals/gardenArtManifest.json').read_text())
    covered={s[0] for s in SPECS}|PROTECTED|{'ROSE'}
    return dict(candidates=records,speciesCandidates=candidates,
        protectedReferences=sorted(PROTECTED),
        missingSource=[r['speciesCode'] for r in registry if r['speciesCode'] not in covered],
        unresolvedMappings=['TUMI: canonical registry entry has no supplied Garden candidate or resolved Primary Bloom mapping'],
        notes=['Rose RGB checkerboard is skipped, not repaired.','Two root UUID images are Garden atlases with explicit readable labels, not inferred species filenames.','Dedicated Coreopsis Garden component sheet preferred over duplicate Coreopsis atlas panel.','Olive is an existing registry species: M/12 branch-form DEV rendering, no primary-emotion mapping invented.'])

if __name__=='__main__':
    data=audit();DEST.write_text(json.dumps(data,indent=2)+'\n');print(json.dumps(data,indent=2))
