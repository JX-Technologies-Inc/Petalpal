"""Non-destructive final circulation layers; original artwork remains untouched."""
from pathlib import Path
import sys, math, json, shutil, hashlib
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
sys.path.insert(0,str(ROOT/'Resources/garden/infrastructure_candidate'))
sys.path.insert(0,str(ROOT/'Resources/garden/bridge_reference_correction'))
sys.path.insert(0,str(ROOT/'Resources/garden/infrastructure_critical_correction'))
from PIL import Image,ImageDraw,ImageFilter,ImageChops,ImageEnhance
import numpy as np
import cv2
import build_candidate as garden
import build_bridge_correction as previous
import build_correction as geometry

OUT=Path(__file__).resolve().parent
RUNTIME=ROOT/'mobile/assets/garden/infrastructure/final'
WORLD=(2400,1800)
RUNTIME.mkdir(parents=True,exist_ok=True)
LAND={i:garden.transform_land(i) for i in ('central','0405','06','08','09','101112')}
ROAD=previous.existing_road_world()

def save(layer,name):
    layer.save(OUT/name,optimize=True)
    shutil.copyfile(OUT/name,RUNTIME/name)
    return layer

def foreground(parts):
    result=Image.new('RGBA',WORLD)
    for source,center,radius in parts:
        x,y=center;rx,ry=radius
        mask=Image.new('L',WORLD)
        ImageDraw.Draw(mask).ellipse((x-rx,y-ry,x+rx,y+ry),fill=255)
        mask=mask.filter(ImageFilter.GaussianBlur(3))
        piece=source.copy()
        piece.putalpha(ImageChops.multiply(source.getchannel('A'),mask))
        result.alpha_composite(piece)
    return result

def grounded_road(points=None):
    # Cubic curve joining the existing west T junction to Central's ring.
    pts=np.array(points if points is not None else [[718,724],[767,726],[840,710],[854,760]],dtype=float)
    t=np.linspace(0,1,1200)[:,None]
    curve=(1-t)**3*pts[0]+3*(1-t)**2*t*pts[1]+3*(1-t)*t*t*pts[2]+t**3*pts[3]
    arc=np.r_[0,np.cumsum(np.linalg.norm(np.diff(curve,axis=0),axis=1))]
    tangent=np.gradient(curve,axis=0);tangent/=np.linalg.norm(tangent,axis=1)[:,None]
    normals=np.c_[-tangent[:,1],tangent[:,0]]
    left=curve+normals*19.5;right=curve-normals*19.5
    mask=Image.new('L',WORLD)
    ImageDraw.Draw(mask).polygon([tuple(v) for v in np.r_[left,right[::-1]]],fill=255)
    a1=np.array(LAND['central'].getchannel('A'),dtype=float)/255
    a2=np.array(LAND['101112'].getchannel('A'),dtype=float)/255
    land_alpha=255*(1-(1-a1)*(1-a2))
    if points is not None:
        land_alpha=np.maximum.reduce([np.array(layer.getchannel('A'),dtype=float) for layer in LAND.values()])
    footprint=np.array(mask)>0
    bad=np.where(footprint&(land_alpha<240))
    if len(bad[0]):print('ground alpha',int(land_alpha[footprint].min()),'holes',len(bad[0]),'coordinates',list(zip(bad[1][:20].tolist(),bad[0][:20].tolist())),flush=True)
    assert not np.any(footprint&(land_alpha<16)), 'Road would cover open water'
    result=Image.new('RGBA',WORLD,(119,116,88,0));result.putalpha(mask)
    stone_layer=Image.new('RGBA',WORLD)
    manifest=json.loads((ROOT/'Resources/road/poc/stone_library/manifest.json').read_text())
    stones=[s for s in manifest['stones'] if 28<=s['source_bbox'][3]<=56 and 35<=s['source_bbox'][2]<=112]
    rng=np.random.default_rng(20260924)
    # Approved Curve V2: individual source stones remain rigid, only rotated.
    for offset in (-16,-8,0,8,16):
        distance=-5+(offset+13)*.22
        while distance<arc[-1]+8:
            source=stones[int(rng.integers(len(stones)))]
            stone=Image.open(ROOT/'Resources/road/poc/stone_library'/source['file']).convert('RGBA')
            factor=.21
            stone=stone.resize((max(2,round(stone.width*factor)),max(2,round(stone.height*factor))),Image.Resampling.LANCZOS)
            stone=ImageEnhance.Color(stone).enhance(.7)
            stone=ImageEnhance.Brightness(stone).enhance(.9)
            k=int(np.searchsorted(arc,np.clip(distance,0,arc[-1])))
            center=curve[k]+normals[k]*offset
            angle=-math.degrees(math.atan2(tangent[k,1],tangent[k,0]))+float(rng.uniform(-6,6))
            stone=stone.rotate(angle,Image.Resampling.BICUBIC,expand=True)
            stone_layer.alpha_composite(stone,(round(center[0]-stone.width/2),round(center[1]-stone.height/2)))
            distance+=max(4,source['source_bbox'][2]*factor*.67)
    # Keep paving inside the corridor; soften overlap at existing path feet.
    result.putalpha(mask.filter(ImageFilter.MinFilter(7)))
    result.alpha_composite(stone_layer)
    a=np.array(result);yy,xx=np.mgrid[:WORLD[1],:WORLD[0]]
    fade=np.minimum(np.clip((xx-718)/19,0,1),np.clip((760-yy)/12,0,1))
    if points is not None:
        direction=pts[-1]-pts[0];length=np.linalg.norm(direction);direction/=length
        along=(xx-pts[0,0])*direction[0]+(yy-pts[0,1])*direction[1]
        fade=np.minimum(np.clip(along/32,0,1),np.clip((length-along)/32,0,1))
        fade=fade*fade*(3-2*fade)
        across=np.abs((xx-pts[0,0])*direction[1]-(yy-pts[0,1])*direction[0])
        uneven=1.2*np.sin(along*.7)+.6*np.sin(along*1.7)
        fade*=np.clip((20+uneven-across)/3,0,1)
    a[:,:,3]=np.rint(np.minimum(a[:,:,3],np.array(mask.filter(ImageFilter.MaxFilter(5))))*fade).astype('uint8')
    result=Image.fromarray(a,'RGBA')
    return result,{'centerline':pts.tolist(),'width':39,'water_overlap_pixels':0,'method':'Curve V2 rigid stone stamps'}

def main():
    b01,scale,angle=geometry.bridge_at((1628,1442),(1830,1310))
    b02=Image.open(OUT/'backups/B02_bridge.png').convert('RGBA')
    # Existing pixels are re-used at exactly their original world positions.
    yy,xx=np.mgrid[:WORLD[1],:WORLD[0]]
    edge=1447+4*np.sin((xx-1600)*.18)+2*np.sin((xx-1600)*.35)
    mask=np.clip((yy-edge)/1.5,0,1)*((xx>1560)&(xx<1700)&(yy<1500))
    arr=np.array(ROAD);arr[:,:,3]=np.rint(arr[:,:,3]*mask).astype('uint8')
    b01fg=Image.fromarray(arr,'RGBA')
    b01fg.alpha_composite(foreground([(LAND['08'],(1830,1310),(48,48))]))
    b02fg=foreground([(LAND['central'],(1570,600),(55,61)),(LAND['06'],(1790,540),(55,48))])
    road,road_meta=grounded_road()
    for name,layer in [('B01_bridge.png',b01),('B02_bridge.png',b02),
                       ('B01_foreground.png',b01fg),('B02_foreground.png',b02fg),('Road_grounded_connection.png',road)]:save(layer,name)
    base=garden.base_without_road();base.alpha_composite(ROAD)
    for layer in (road,b01,b02,b01fg,b02fg):base.alpha_composite(layer)
    base.save(OUT/'working_composite.png',optimize=True)
    for name,box in [('working_B01.png',(1530,1210,1915,1515)),('working_B02.png',(1480,440,1870,695)),('working_road.png',(665,650,910,790))]:
        crop=base.crop(box);crop.resize((crop.width*3,crop.height*3),Image.Resampling.LANCZOS).save(OUT/name)
    data={'B01':{'start':[1628,1442],'end':[1830,1310],'scale':scale,'angle':angle},
          'B02':{'start':[1570,600],'end':[1790,540],'geometry_unchanged':True},'Road':road_meta}
    (OUT/'geometry.json').write_text(json.dumps(data,indent=2))
    print(json.dumps(data,indent=2))

if __name__=='__main__':main()
