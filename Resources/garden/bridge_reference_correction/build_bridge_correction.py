"""Place existing floral bridge art from completed-reference centerlines in Garden world space."""
from pathlib import Path
import sys, json, math

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'Resources/road/.tools'))
sys.path.insert(0, str(ROOT / 'Resources/garden/infrastructure_candidate'))
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import build_candidate as candidate

OUT = Path(__file__).resolve().parent
WORLD = (2400, 1800)
SOURCE = Image.open(ROOT / 'Resources/decorations/bridge/rendered/bridge_entrance_to_right.png').convert('RGBA')
META = json.loads((ROOT / 'Resources/decorations/bridge/rendered/bridge_entrance_to_right.json').read_text())
END_A = META['endPixels']['A']; END_B = META['endPixels']['B']
SOURCE_VECTOR = (END_B['x'] - END_A['x'], END_B['y'] - END_A['y'])
SOURCE_LENGTH = math.hypot(*SOURCE_VECTOR)
SOURCE_ANGLE = math.degrees(math.atan2(SOURCE_VECTOR[1], SOURCE_VECTOR[0]))

# Reference A centerlines, traced from the completed Garden at 1448 x 1086.
# The physical current-Land/path feet below follow local shoreline registration;
# Land and road transforms are locked and differ modestly from the illustration.
REFERENCE = {
    'B01': {'entrance': (919, 815), 'land08': (1038, 760)},
    'B02': {'central': (900, 325), 'land06': (1060, 292)},
}
FINAL = {
    'B01': {'A': (1640, 1410), 'B': (1830, 1310)},
    'B02': {'A': (1545, 475), 'B': (1785, 425)},
}
# Seven-island grass-centroid affine measured in analyze_reference.py.
REF_TO_CURRENT_REFERENCE_SIZE = ((.96173203, .02698302, 24.14150941),
                                 (.02830505, .95613875, -12.8923895))

def mapped_reference(point):
    x, y = point
    m = REF_TO_CURRENT_REFERENCE_SIZE
    return ((m[0][0]*x + m[0][1]*y + m[0][2]) * 2400/1448,
            (m[1][0]*x + m[1][1]*y + m[1][2]) * 1800/1086)

def bridge(name):
    a, b = FINAL[name]['A'], FINAL[name]['B']
    dx, dy = b[0]-a[0], b[1]-a[1]
    scale = math.hypot(dx,dy) / SOURCE_LENGTH
    target_angle = math.degrees(math.atan2(dy,dx))
    pil_ccw = SOURCE_ANGLE - target_angle
    mid = ((a[0]+b[0])/2, (a[1]+b[1])/2)
    im = SOURCE.resize((round(SOURCE.width*scale), round(SOURCE.height*scale)), Image.Resampling.LANCZOS)
    side = 680
    tile = Image.new('RGBA',(side,side))
    ax = META['anchor']['x']*scale
    ay = META['anchor']['y']*scale
    tile.alpha_composite(im,(round(side/2-ax),round(side/2-ay)))
    tile = tile.rotate(pil_ccw,Image.Resampling.BICUBIC,expand=False)
    layer = Image.new('RGBA',WORLD)
    layer.alpha_composite(tile,(round(mid[0]-side/2),round(mid[1]-side/2)))
    layer.save(OUT/f'{name}_bridge.png',optimize=True)
    return {'endpoints': [a,b], 'midpoint':mid,'scale':scale,
            'pil_ccw_degrees':pil_ccw, 'target_centerline_degrees':target_angle,
            'bounds':layer.getchannel('A').getbbox()}

def existing_road_world():
    p=candidate.entry('main-road-connected')
    im=Image.open(ROOT/'mobile/assets/garden/bridges/approved-circulation/main-road-connected.png').convert('RGBA')
    im=im.resize((p['width'],p['height']),Image.Resampling.LANCZOS)
    layer=Image.new('RGBA',WORLD)
    layer.alpha_composite(im,(p['x'],p['y']))
    return layer

def foreground(name):
    result=Image.new('RGBA',WORLD)
    if name=='B01':
        pieces=[(existing_road_world(),(1612,1404,1672,1450),4),
                (candidate.transform_land('08'),(1804,1282,1864,1340),5)]
    else:
        pieces=[(candidate.transform_land('0405'),(1516,446,1574,500),4),
                (candidate.transform_land('06'),(1755,397,1815,453),5)]
    for source,box,blur in pieces:
        mask=Image.new('L',WORLD,0)
        ImageDraw.Draw(mask).ellipse(box,fill=255)
        mask=mask.filter(ImageFilter.GaussianBlur(blur))
        source.putalpha(ImageChops.multiply(source.getchannel('A'),mask))
        result.alpha_composite(source)
    result.save(OUT/f'{name}_foreground_occlusion.png',optimize=True)

def main():
    data={'world':WORLD,'reference_dimensions':(1448,1086),
          'grass_centroid_affine':REF_TO_CURRENT_REFERENCE_SIZE,
          'reference_centerlines':REFERENCE,'bridges':{}}
    for name in ('B01','B02'):
        data['bridges'][name]=bridge(name)
        foreground(name)
        data['bridges'][name]['mapped_reference_centerline']=[mapped_reference(p) for p in REFERENCE[name].values()]
    (OUT/'alignment.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
    print(json.dumps(data['bridges'],indent=2))

if __name__=='__main__': main()
