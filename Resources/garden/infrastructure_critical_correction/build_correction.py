"""Rebuild only B02 and ST01 against the current Garden land masks."""
from pathlib import Path
import json, math, sys, shutil

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'Resources/road/.tools'))
sys.path.insert(0, str(ROOT / 'Resources/garden/infrastructure_candidate'))
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance
import numpy as np
import cv2
import build_candidate as garden

OUT = Path(__file__).resolve().parent
ASSETS = ROOT / 'mobile/assets/garden/infrastructure'
WORLD = (2400, 1800)
META = json.loads((ROOT/'Resources/decorations/bridge/rendered/bridge_entrance_to_right.json').read_text())
BRIDGE = Image.open(ROOT/'Resources/decorations/bridge/rendered/bridge_entrance_to_right.png').convert('RGBA')
EA, EB = META['endPixels']['A'], META['endPixels']['B']
SV = (EB['x']-EA['x'], EB['y']-EA['y'])
SL = math.hypot(*SV)
SA = math.degrees(math.atan2(SV[1],SV[0]))

def path_mask(arr):
    rgb=arr[:,:,:3].astype(np.int16)
    hi=rgb.max(2);lo=rgb.min(2)
    return (arr[:,:,3]>220)&(lo>75)&((hi-lo)<75)&(rgb[:,:,0]>rgb[:,:,1]*.88)

def bridge_at(a,b):
    dx,dy=b[0]-a[0],b[1]-a[1]
    scale=math.hypot(dx,dy)/SL
    ang=math.degrees(math.atan2(dy,dx))
    im=BRIDGE.resize((round(BRIDGE.width*scale),round(BRIDGE.height*scale)),Image.Resampling.LANCZOS)
    tile=Image.new('RGBA',(700,700))
    tile.alpha_composite(im,(round(350-META['anchor']['x']*scale),round(350-META['anchor']['y']*scale)))
    tile=tile.rotate(SA-ang,Image.Resampling.BICUBIC,expand=False)
    layer=Image.new('RGBA',WORLD)
    layer.alpha_composite(tile,(round((a[0]+b[0])/2-350),round((a[1]+b[1])/2-350)))
    return layer,scale,ang

def circle_count(mask,p,r):
    x,y=p
    return int(mask[max(0,y-r):y+r+1,max(0,x-r):x+r+1].sum())

def assess(a,b,land,with_image=False):
    layer,scale,ang=bridge_at(a,b)
    alpha=np.asarray(layer.getchannel('A'))>16
    occ=land['0405'][:,:,3]>16
    exclusion=cv2.dilate(occ.astype('uint8'),np.ones((15,15),'uint8'))>0
    overlap=int((alpha&occ).sum())
    clearance=int((alpha&exclusion).sum())
    start=circle_count(path_mask(land['central']),a,19)
    end=circle_count(path_mask(land['06']),b,19)
    info=dict(start=a,end=b,scale=scale,angle=ang,bridge_0405_alpha_overlap=overlap,
              bridge_0405_7px_clearance_overlap=clearance,
              central_path_pixels_19px=start,land06_path_pixels_19px=end,
              bounds=layer.getchannel('A').getbbox())
    return (info,layer) if with_image else info

def stair_layer(a=(1530,860),b=(1770,1010)):
    """Small individual stone treads, textured with the approved road master."""
    length=round(math.dist(a,b))
    angle=math.degrees(math.atan2(b[1]-a[1],b[0]-a[0]))
    master=Image.open(ROOT/'Resources/decorations/road/road_straight_master.png').convert('RGB')
    master=master.resize((384,256),Image.Resampling.LANCZOS)
    master=ImageEnhance.Color(ImageEnhance.Brightness(master).enhance(.86)).enhance(.78)
    side=540; center=side//2
    tile=Image.new('RGBA',(side,side))
    draw=ImageDraw.Draw(tile)
    rng=np.random.default_rng(2105)
    n=4; stair_length=136; step=stair_length/n; width=39
    start=round(center-length/2)
    base=master.crop((28,112,28+length,112+width+5))
    base=Image.blend(Image.new('RGB',base.size,(174,158,130)),base,.75).convert('RGBA')
    base_mask=Image.new('L',base.size)
    ImageDraw.Draw(base_mask).rounded_rectangle((0,0,base.width-1,base.height-1),radius=3,fill=255)
    tile.paste(base,(start,center-width//2-2),base_mask)
    draw.rounded_rectangle((start,center-width//2-2,start+length,center+width//2+3),
                           radius=3,outline=(105,91,66,220),width=2)
    for i in range(n):
        x0=round(start+i*step+1)
        x1=round(start+(i+1)*step-1)
        y0=center-width//2+int(rng.integers(-2,3))
        y1=center+width//2+int(rng.integers(-2,3))
        # Separate pieces read as shallow steps; subtle irregularity keeps
        # them in the existing painterly stone family.
        pts=[(x0,y0+2),(x0+3,y0),(x1-3,y0+1),(x1,y0+3),
             (x1-1,y1-2),(x1-4,y1),(x0+2,y1-1),(x0,y1-4)]
        shadow=[(x,y+3) for x,y in pts]
        draw.polygon(shadow,fill=(68,67,56,155))
        tex=master.crop((20+i*41,112,20+i*41+(x1-x0+1),112+(y1-y0+1)))
        tex=Image.blend(Image.new('RGB',tex.size,(178,160,131)),
                        tex.filter(ImageFilter.GaussianBlur(1.3)),.68).convert('RGBA')
        mask=Image.new('L',(x1-x0+1,y1-y0+1))
        ImageDraw.Draw(mask).polygon([(x-x0,y-y0) for x,y in pts],fill=255)
        tile.paste(tex,(x0,y0),mask)
        draw.line(pts+[pts[0]],fill=(112,95,70,200),width=1)
        # A light tread nose and darker riser run across the walking width.
        draw.line([(x0+3,y0+3),(x0+3,y1-3)],fill=(213,194,161,200),width=2)
        draw.line([(x1-2,y0+3),(x1-2,y1-3)],fill=(100,78,55,200),width=3)
    tile=tile.rotate(-angle,Image.Resampling.BICUBIC,expand=False)
    result=Image.new('RGBA',WORLD)
    result.alpha_composite(tile,(round((a[0]+b[0])/2-center),round((a[1]+b[1])/2-center)))
    return result

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    land={i:np.asarray(garden.transform_land(i)) for i in ('central','0405','06','08')}
    # Derived from the current Central/06 path masks; seven-pixel clearance
    # from all 0405 pixels also excludes the shoreline rocks and plants.
    info,bridge=assess((1570,600),(1790,540),land,True)
    if not (info['central_path_pixels_19px']>150 and info['land06_path_pixels_19px']>150 and
            info['bridge_0405_alpha_overlap']==0 and info['bridge_0405_7px_clearance_overlap']==0):
        raise AssertionError(info)
    bridge.save(OUT/'B02_bridge.png',optimize=True)
    shutil.copyfile(OUT/'B02_bridge.png',ASSETS/'B02_bridge.png')
    # Old foreground sampled the wrong Land0405 pixels; clear its runtime layer.
    blank=Image.new('RGBA',WORLD)
    blank.save(OUT/'B02_foreground_occlusion.png',optimize=True)
    shutil.copyfile(OUT/'B02_foreground_occlusion.png',ASSETS/'B02_foreground_occlusion.png')
    stair=stair_layer()
    stair.save(OUT/'ST01_stair.png',optimize=True)
    shutil.copyfile(OUT/'ST01_stair.png',ASSETS/'ST01_stair.png')
    blank.save(OUT/'ST01_foreground_occlusion.png',optimize=True)
    shutil.copyfile(OUT/'ST01_foreground_occlusion.png',ASSETS/'ST01_foreground_occlusion.png')
    info['stair']={'start':[1530,860],'end':[1770,1010],'treads':4,'stair_run_px':136,
                   'nominal_width_px':39,
                   'central_path_pixels_20px':circle_count(path_mask(land['central']),(1530,860),20),
                   'land08_path_pixels_20px':circle_count(path_mask(land['08']),(1770,1010),20),
                   'bounds':stair.getchannel('A').getbbox()}
    (OUT/'geometry.json').write_text(json.dumps(info,indent=2),encoding='utf-8')
    print(json.dumps(info,indent=2))

if __name__=='__main__': main()
