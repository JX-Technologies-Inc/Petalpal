"""Reproducible static isolation bounds. No simulated FPS or live render counts."""
from pathlib import Path
import re,json,time,hashlib
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'mobile/src/components/garden'
OUT=ROOT/'output/garden-runtime-performance'
textures=json.loads((OUT/'textures.json').read_text(encoding='utf-8'))
lookup={r['path']:r for r in textures['files']}
refs=re.compile(r"(?:from\s+|require\(\s*|import\s*)['\"]([^'\"]+)['\"]")
def closure(entries):
 queue=[BASE/e for e in entries]; seen=set(); assets=set()
 while queue:
  p=queue.pop().resolve()
  if p in seen or not p.is_file():continue
  seen.add(p)
  if p.suffix not in ('.tsx','.ts','.json','.js'):continue
  for ref in refs.findall(p.read_text(encoding='utf-8',errors='replace')):
   target=ROOT/'mobile/src'/ref[2:] if ref.startswith('@/') and not ref.startswith('@/assets/') else ROOT/'mobile/assets'/ref[9:] if ref.startswith('@/assets/') else p.parent/ref if ref.startswith('.') else None
   if target is None:continue
   if not target.suffix:target=next((Path(str(target)+e) for e in ('.ts','.tsx','.json','.js') if Path(str(target)+e).exists()),target/'index.ts')
   if target.suffix=='.png':assets.add(target.resolve().relative_to(ROOT).as_posix())
   elif target.exists():queue.append(target)
 return seen,assets
categories={'Land':['LandLayer.tsx'],'Infrastructure':['GardenInfrastructureLayer.tsx','GardenRoadApproachLayer.tsx','GardenConnectionLayer.tsx','GardenLand09InterfaceLayer.tsx'],
'Landmarks':['TreehouseEntity.tsx','SwingEntity.tsx','MoonBedEntity.tsx','TeaSetEntity.tsx','StaticLandmarkEntities.tsx'],
'Water':['water/GardenWaterField.tsx','water/SurfaceRippleLayer.tsx','water/WaterTopSource.tsx','water/WaterfallImpactUnderlay.tsx'],
'Waterfall':['WaterfallEntity.tsx'],'Fish':['water/FishLayer.tsx'],'Lotus':['water/LotusLayer.tsx']}
category_rows={};sets={};loops=[]
for name,entries in categories.items():
 before=time.perf_counter(); sources,assets=closure(entries);sets[name]=assets
 category_rows[name]={'scope':'literal reachable PNG references including inactive alternatives, NOT loaded textures','uniqueTextureReferences':len(assets),'rgbaMiB':sum(lookup[a]['rgbaBytes'] for a in assets if a in lookup)/1048576,'inventoryCpuMs':(time.perf_counter()-before)*1000,'textures':[lookup[a] for a in sorted(assets) if a in lookup]}
 for p in sorted(sources):
  if p.suffix not in ('.ts','.tsx') or '/performance/' in p.as_posix():continue
  for line,text in enumerate(p.read_text(encoding='utf-8',errors='replace').splitlines(),1):
   if re.search(r'\b(?:setInterval|setTimeout|requestAnimationFrame|useFrameCallback|withRepeat|withTiming|useClock)\s*\(',text):
    loops.append({'category':name,'file':p.relative_to(ROOT).as_posix(),'line':line,'code':text.strip(),'scope':'static call-site; imports/references are not measured runtime callbacks'})
proxy=json.loads((OUT/'flower-render-proxy.json').read_text(encoding='utf-8'))['rows'][-1]
full=list(categories)+['Flowers','LandmarkAnimation']
configs={'A Land':['Land'],'B + Infrastructure':['Land','Infrastructure'],'C + Static landmarks':['Land','Infrastructure','Landmarks'],
'D + Flowers':['Land','Infrastructure','Landmarks','Flowers'],'E Water only':['Land','Water'],'F Waterfall only':['Land','Waterfall'],
'G Fish':['Land','Water','Fish'],'H Lotus':['Land','Water','Lotus'],'I Landmark animations':['Land','Infrastructure','Landmarks','LandmarkAnimation'],'J Full':full}
for remove in ['Flowers','Water','Waterfall','Fish','Lotus','LandmarkAnimation']:configs['Full minus '+remove]=[c for c in full if c!=remove]
rows=[]
for name,enabled in configs.items():
 assets=set().union(*(sets.get(c,set()) for c in enabled))
 rows.append({'configuration':name,'enabled':enabled,'reachableTextureReferences':len(assets),'referenceRgbaMiB':sum(lookup[a]['rgbaBytes'] for a in assets if a in lookup)/1048576,'flowerProxy':proxy if 'Flowers' in enabled else None,
 'liveFps':None,'reactRenders':None,'skiaRedraws':None,'gpuMs':None,'liveJsCpuMs':None,'actualResidentMiB':None})
world=BASE/'world-time/WorldTimeProvider.tsx'
for i,line in enumerate(world.read_text(encoding='utf-8').splitlines(),1):
 if 'setInterval(' in line:loops.append({'category':'World time','file':world.relative_to(ROOT).as_posix(),'line':i,'code':line.strip()})
result={'scope':'AUTOMATED STATIC ISOLATION, not live subsystem benchmarking. Same June mature flower proxy reused; camera/viewport do not affect import bounds. Cross-category texture references deduplicated. Inactive assets make memory an upper-bound inventory, not simultaneous residency.',
'fixture':{'month':6,'land':'Land06','parents':30,'pieces':591,'viewport':[390,844],'camera':'fixed conceptual viewport; no raster execution','debug':False,'calibration':False},'matrix':rows,'categories':category_rows,'animationCallSites':loops,
'fullReferenceUnionMiB':rows[9]['referenceRgbaMiB']+proxy['requestedTextureRgbaMiB'],'actualSimultaneousResidencyMiB':None,'byteIdenticalDuplicatesInReachableInventory':textures['duplicates']}
(OUT/'isolation-static-matrix.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
for r in rows:print(r['configuration'],r['reachableTextureReferences'],round(r['referenceRgbaMiB'],2),'MiB reference bound; flowers',bool(r['flowerProxy']))
print('Full union including actual flower requests:',round(result['fullReferenceUnionMiB'],2),'MiB; residency unknown')
