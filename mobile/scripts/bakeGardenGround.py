"""Bake collision-only dry-ground coverage from the unchanged MAIN Garden art.

Usage: python scripts/bakeGardenGround.py --project <mobile> --output <json>
Requires Pillow/numpy. No source image is resized, edited or re-exported. The
runtime subtracts the approved planting masks from this terrain coverage.
All samples are world-space cell centers, 2 units apart. Terrain alpha sampling
mirrors GardenOuterBasin's placement shaders; land rotations mirror LandLayer.
"""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

parser = argparse.ArgumentParser()
parser.add_argument('--project', type=Path, default=Path(__file__).resolve().parents[1])
parser.add_argument('--output', type=Path)
parser.add_argument('--preview', type=Path)
args = parser.parse_args()
root = args.project.resolve()
output = args.output or root / 'src/components/garden/fairy/gardenGroundMask.json'
X0, Y0, WIDTH, HEIGHT, CELL = 0, -309, 2400, 2119, 2
COLS, ROWS = math.ceil(WIDTH/CELL), math.ceil(HEIGHT/CELL)
X, Y = np.meshgrid(X0+(np.arange(COLS)+.5)*CELL,
                  np.minimum(Y0+(np.arange(ROWS)+.5)*CELL, Y0+HEIGHT-.5))
sources, cache = {}, {}
dry = np.zeros((ROWS, COLS), dtype=bool)


def read(path):
    path = str(path)
    if path not in cache:
        content = (root/path).read_bytes()
        sources[path] = hashlib.sha256(content).hexdigest()
        cache[path] = np.asarray(Image.open(root/path).convert('RGBA'), dtype=np.float32)/255
    return cache[path]


def smooth(a, b, x):
    v = np.clip((x-a)/(b-a), 0, 1)
    return v*v*(3-2*v)


def mix(a, b, t):
    return a*(1-t)+b*t


def sample(path, bounds, px=X, py=Y, mode='decal', channel=3):
    data = read(path)[..., channel]
    h, w = data.shape
    bx, by, bw, bh = bounds
    u, v = (px-bx)/bw, (py-by)/bh
    inside = (u>=0)&(u<=1)&(v>=0)&(v<=1)
    if mode == 'mirror':
        u, v = 1-np.abs(np.mod(u,2)-1), 1-np.abs(np.mod(v,2)-1)
    elif mode == 'inlet':
        u, v = np.clip(u,0,1), 1-np.abs(np.mod(v,2)-1)
    ix, iy = np.clip(u*w-.5,0,w-1), np.clip(v*h-.5,0,h-1)
    ax, ay = ix.astype(int), iy.astype(int)
    bx, by = np.minimum(ax+1,w-1), np.minimum(ay+1,h-1)
    alpha = mix(mix(data[ay,ax],data[ay,bx],ix-ax), mix(data[by,ax],data[by,bx],ix-ax), iy-ay)
    return alpha*inside if mode=='decal' else alpha


def unrotate(px, py, cx, cy, degrees):
    a = math.radians(degrees)
    dx,dy = px-cx,py-cy
    return cx+dx*math.cos(a)+dy*math.sin(a), cy-dx*math.sin(a)+dy*math.cos(a)


def add(alpha):
    global dry
    # Opaque ground, not the translucent contact haze painted over water.
    dry |= alpha >= .72


def polygon(points, px=X, py=Y):
    inside = np.zeros(X.shape,dtype=bool)
    for i,(a,b) in enumerate(points):
        c,d = points[i-1]
        inside ^= ((b>py)!=(d>py)) & (px < (c-a)*(py-b)/(d-b+1e-20)+a)
    return inside


# Lands: parse the actual checked-in placements instead of maintaining a second
# source of island geometry. Native image aspect ratios determine their height.
layout = (root/'src/components/garden/gardenMapLayout.ts').read_text()
pattern = r"source: require\('@/(.*?)'\), x: ([\d.-]+), y: ([\d.-]+), width: ([\d.-]+), rotation: ([\d.-]+)"
for path,x,y,width,rotation in re.findall(pattern,layout):
    x,y,width,rotation = map(float,(x,y,width,rotation))
    h,w = read(path).shape[:2]
    height=width*h/w
    px,py=unrotate(X,Y,x+width/2,y+height/2,rotation)
    add(sample(path,(x,y,width,height),px,py))

# Ground-only infrastructure. These world-aligned layers provide paving, bridge
# decks, stepping stones and shoreline joins, not landmark roofs or canopies.
infrastructure = [
 'SS01_stepping_stones.png','seams/Road_west_seamed.png',
 'seams/Road_entrance09_seamed.png','seams/Road_other_seamed.png',
 'entrance-connections/land09-transition.png','entrance-connections/b01-foot-landing.png',
 'land09-interface-v2/land09-interface-foreground.png',
 'b02-land06-connection/land06-approach.png',
 'b02-land06-connection/b02-foreground-local-opening.png',
 'seams/B01_land08_occlusion.png','seams/ST01_feet_occlusion.png',
]
for path in infrastructure:
    add(sample('assets/garden/infrastructure/'+path,(0,0,2400,1800)))
for path in ['R01_treehouse_path.png','R01_existing_foreground.png']:
    add(sample('assets/garden/roads/complete/'+path,(0,0,2400,1800)))

# Decks use their painted alpha. Tiny disconnected flowers/rail pixels are
# excluded by the floor polygon so the surrounding water is never standable.
decks = {
 'B02_bridge.png':[(1556,568),(1603,547),(1669,520),(1765,507),(1790,552),(1795,571),(1724,580),(1655,610),(1594,637)],
 'B01_bridge.png':[(1602,1420),(1649,1374),(1708,1329),(1773,1297),(1798,1287),(1841,1329),(1782,1369),(1725,1416),(1660,1475)],
 'ST01_approved.png':[(1508,836),(1851,985),(1818,1076),(1480,929)],
}
for path,points in decks.items():
    add(sample('assets/garden/infrastructure/final/'+path,(0,0,2400,1800))*polygon(points))
manifest=json.loads((root/'assets/garden/bridges/approved-circulation/manifest.json').read_text())
road=next(piece for piece in manifest['pieces'] if piece['id']=='main-road-connected')
add(sample('assets/garden/bridges/approved-circulation/main-road-connected.png',tuple(road[k] for k in ['x','y','width','height'])))

# Swing's planted stone floor only. Upper arch/flowers are not ground coverage.
px,py=unrotate(X,Y,688+1312*.3/2,916+1199*.3/2,5.5)
sx,sy=(px-688)/.3,(py-916)/.3
floor=polygon([(75,994),(220,898),(395,877),(590,920),(830,905),(1100,980),(1250,1123),(1060,1198),(400,1198),(60,1112)],sx,sy)
add(sample('assets/garden/landmarks/swing/frame-static.png',(-112,35,1430*1.068,1100*1.068),sx,sy)*floor)
playable_ground = dry.copy()

# GardenOuterBasin alpha math, copied from the rendering shader rather than a
# loose ellipse: notably both lower cliffs and the source-water opening.
T='src/components/garden/terrain/'
inlet=T+'waterfall-source-banks-v1.png'
def inlet_alpha(px=X,py=Y): return sample(inlet,(645,-1160,600,900),px,py,'inlet')
source_bank=mix(1,inlet_alpha(),1-smooth(-325,-280,Y))
entrance_advance=mix(300,235,smooth(1550,1800,X))*smooth(850,1250,X)*(1-smooth(1900,2150,X))
edge=1820+12*np.sin(X/93)+8*np.sin(X/37)
left=1080+20*np.sin(Y/90)+15*np.sin(Y/37)
right=2000+15*np.sin(Y/81)
placement=smooth(left,left+40,X)*(1-smooth(right,right+40,X))*smooth(edge-10,edge+10,Y)
outer_cover=np.maximum.reduce([
 (1-smooth(-350,-270,Y))*source_bank,
 smooth(2130-entrance_advance+28*np.sin(X/163)+16*np.sin(X/57)-12,2130-entrance_advance+28*np.sin(X/163)+16*np.sin(X/57)+12,Y),
 np.maximum(1-smooth(-610,-490,X),smooth(2810,2910,X)),
])
add(sample(T+'outer-upland-v1.png',(-1700,-2250,3000,2000),mode='mirror')*outer_cover)

def terrain(path,bounds,top=0,right=0,lower=False):
    original=sample(T+path,bounds)
    moved=mix(sample(T+path,bounds,X-125,Y+300),sample(T+path,bounds,X+95,Y+235),smooth(1550,1800,X))
    alpha=mix(original,moved,placement if lower else 0)*source_bank
    x,y,w,h=bounds
    alpha*=((X>=x)&(X<x+w)&(Y>=y)&(Y<y+h))
    if top: alpha*=smooth(y,y+top,Y)
    if right: alpha*=1-smooth(x+w-right,x+w,X)
    add(alpha)

terrain('outer-basin-v2.png',(-700,-800,3800,3400),lower=True)
terrain('treehouse-cliff-backing-v1.png',(-350,-200,1300,1100),top=75)
terrain('outer-right-bank-v1.png',(1010,-1480,550,1660),right=150)
add(inlet_alpha()*smooth(645,700,X)*(1-smooth(1190,1245,X))*(1-smooth(-340,-260,Y)))
add(sample(T+'outer-right-bank-v1.png',(2140,-260,680,2300)))

def passage(ox,oy,scale):
    qx,qy=X+ox,Y+oy
    localy=qy-1870
    sy=localy/scale
    fx=mix(820,880,np.clip((sy-400)/200,0,1))
    fx=mix(fx,975,np.clip((sy-600)/200,0,1))
    fx=mix(fx,1045,np.clip((sy-800)/224,0,1))
    sx=fx+(qx-mix(1630,1700,smooth(3000,4000,Y)))/scale
    return sample(T+'entrance-mountain-pass-v1.png',(0,0,1536,1024),sx,sy,'clamp')*smooth(-80,80,sx)*(1-smooth(1456,1616,sx))*smooth(0,18,localy)*(1-smooth(960,1023,sy))
add(mix(passage(0,0,1.30),mix(passage(-125,300,1.60),passage(95,235,1.60),smooth(1550,1800,X)),placement)*(Y>=1790))

# Exposed right pond shelves: same seeded outlines as GardenRightPondShore.
# Submerged mineral stones are explicitly omitted.
submerged=[(1779,24,65,37),(1827,-12,43,29),(1880,-57,68,36),(1924,-1,51,32),(2015,6,39,24),(2248,72,58,34),(2323,98,46,31),(2372,167,48,34),(2410,307,48,33)]
shelves=[(1755,-13,78,51),(1795,-37,33,25),(1842,-95,65,46),(1948,-39,73,50),(1985,-40,30,22),(2040,-39,59,41),(2164,58,67,40),(2250,26,78,47),(2291,27,32,26),(2340,66,72,53),(2394,145,65,49),(2420,263,64,51)]
seed=73163
def random():
    global seed
    seed=(seed*1664525+1013904223)&0xffffffff
    return seed/4294967296
for i,(x,y,w,h) in enumerate(submerged+shelves):
    points=[]
    for n in range(9):
        angle=(n+random()*.26)*math.pi*2/9
        r=.88+random()*.16
        points.append((x+math.cos(angle)*w*.5*r,y+math.sin(angle)*h*.5*r))
    for _ in range(24*4):random()
    if i>=len(submerged):dry|=polygon(points)&(Y<=y+h*.32)

# The compact waterfall is a mixed water/rock painting. Reuse its renderer's
# water discriminator and exact vertical bands, admitting only dry banks and
# rocks. Wet painted pixels veto any terrain below the falling water.
fall='assets/garden/landmarks/waterfall-v2/waterfall-v2-compact-r3.png'
fx,fy=unrotate(X,Y,742.6+1024*.5/2,-656+2048*.5/2,-2.5)
fx,fy=(fx-742.6)/.5,(fy+656)/.5
for start,end,scale,shift in [(0,767,.58,676.14),(767,1652,.6,660.8),(1652,2048,1,0)]:
    sy=(fy-shift)/scale
    band=(sy>=start)&(sy<end)&(fx>=0)&(fx<1024)
    r,g,b,a=[sample(fall,(0,0,1024,2048),fx,sy,channel=c) for c in range(4)]
    wet=np.maximum(smooth(.015,.085,np.minimum(g-r,b-r)),smooth(.84,.96,np.minimum(np.minimum(r,g),b))*.65)
    # This is material membership, not visual recoloring. Keep all painted
    # bank vegetation/mineral pixels; neither foam nor water are solid ground.
    add(a*(wet<.08)*band)
    dry &= ~(band&(a>.7)&(wet>.08))

# Match scene draw order: land/infrastructure/floors paint above the waterfall.
# The wet veto removes covered basin terrain, never those foreground surfaces.
dry |= playable_ground

# The final partial row stays clipped to the unchanged retained world bounds.
dry &= (Y<Y0+HEIGHT)
rows=[]
for row in dry:
    edges=np.flatnonzero(np.diff(np.pad(row.astype(np.int8),(1,1)))).tolist()
    rows.append(edges)
result={'x':X0,'y':Y0,'width':WIDTH,'height':HEIGHT,'cellSize':CELL,'columns':COLS,'rows':rows}
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(result,separators=(',',':'))+'\n')
for code in ['gardenMapLayout.ts','GardenOuterBasin.tsx','GardenInfrastructureLayer.tsx','GardenConnectionLayer.tsx','GardenRoadApproachLayer.tsx','GardenRightPondShore.tsx','waterfallV2Placement.ts','waterfallV2Proportions.ts','swingMapPlacement.ts','SwingEntity.tsx']:
    path='src/components/garden/'+code
    sources[path]=hashlib.sha256((root/path).read_bytes()).hexdigest()
output.with_suffix('.sources.json').write_text(json.dumps({'generator':'scripts/bakeGardenGround.py','sample':'cell center; dry alpha >= 0.72','planting':'Subtract approvedPlantingMasks at runtime','sources':sources},indent=2)+'\n')
if args.preview:
    args.preview.parent.mkdir(parents=True,exist_ok=True)
    Image.fromarray(np.uint8(dry)*255).save(args.preview)
print(json.dumps({'output':str(output),'columns':COLS,'rows':ROWS,'dryCells':int(dry.sum()),'bytes':output.stat().st_size}))
