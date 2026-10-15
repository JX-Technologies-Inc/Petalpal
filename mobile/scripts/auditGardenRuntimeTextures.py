"""Static runtime-import PNG inventory, not a measurement of GPU residency."""
from pathlib import Path
import re, json, hashlib, struct, collections
ROOT = Path(__file__).resolve().parents[2]
queue = [ROOT/'mobile/src/components/garden/GardenScene.tsx']
seen, assets = set(), set()
while queue:
    source = queue.pop()
    if source in seen or not source.is_file():
        continue
    seen.add(source)
    if source.suffix not in ('.ts', '.tsx', '.js', '.jsx', '.json'):
        continue
    text = source.read_text(encoding='utf-8', errors='replace')
    for ref in re.findall(r'''(?:from\s+|require\(\s*|import\s*)['"]([^'"]+)['"]''', text):
        if ref.startswith('@/assets/'):
            target = ROOT/'mobile/assets'/ref[len('@/assets/'):]
        elif ref.startswith('@/'):
            target = ROOT/'mobile/src'/ref[2:]
        elif ref.startswith('.'):
            target = source.parent/ref
        else:
            continue
        if not target.suffix:
            choices = [Path(str(target)+e) for e in ('.ts','.tsx','.js','.jsx','.json')] + [target/'index.ts',target/'index.tsx']
            target = next((p for p in choices if p.exists()), target)
        if target.suffix.lower() == '.png' and target.exists():
            assets.add(target.resolve())
        elif target.is_file():
            queue.append(target.resolve())
rows = []
for image in sorted(assets):
    data = image.read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        continue
    width, height = struct.unpack('>II', data[16:24])
    rows.append(dict(path=image.relative_to(ROOT).as_posix(), width=width, height=height,
                     rgbaBytes=width*height*4, diskBytes=len(data), sha256=hashlib.sha256(data).hexdigest()))
duplicates = collections.defaultdict(list)
for row in rows:
    duplicates[row['sha256']].append(row['path'])
output = ROOT/'output/garden-runtime-performance'
output.mkdir(parents=True, exist_ok=True)
(output/'textures.json').write_text(json.dumps(dict(
    scope='Literal PNG references reachable from GardenScene, including inactive alternatives and DEV calibration; not measured residency',
    count=len(rows), rgbaMiB=sum(r['rgbaBytes'] for r in rows)/1048576,
    duplicates=[v for v in duplicates.values() if len(v)>1], files=rows), indent=2)+'\n', encoding='utf-8')
print(f"{len(rows)} reachable PNGs; {sum(r['rgbaBytes'] for r in rows)/1048576:.2f} MiB RGBA upper-bound inventory")
