"""Non-destructive PetalPal Garden infrastructure candidate assembly."""
from pathlib import Path
import sys,json,math,hashlib
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
sys.path.insert(0,str(ROOT/'Resources/decorations/bridge/B01/placement_preview'))
from PIL import Image,ImageDraw,ImageFilter,ImageChops,ImageFont
import numpy as np
import build_b01_preview as b01

OUT=Path(__file__).resolve().parent
WORLD=(2400,1800)
MANIFEST=json.loads((ROOT/'mobile/assets/garden/bridges/approved-circulation/manifest.json').read_text())

def entry(id):return next(x for x in MANIFEST['pieces'] if x['id']==id)
def save_layer(layer,name):layer.save(OUT/name,optimize=True);return layer

def road_neck():
    # Current entrance-road pixels only; shorten the shoulders toward B01.
    p=entry('main-road-connected')
    im=Image.open(ROOT/'mobile/assets/garden/bridges/approved-circulation/main-road-connected.png').convert('RGBA')
    im=im.resize((p['width'],p['height']),Image.Resampling.LANCZOS)
    layer=Image.new('RGBA',WORLD);layer.alpha_composite(im,(p['x'],p['y']))
    arr=np.array(layer)
    x0,x1,y0,y1=1510,1750,1360,1580
    yy,xx=np.mgrid[y0:y1,x0:x1].astype(np.float32)
    center=1644+0.48*(1425-yy)
    half=np.clip(33+(yy-1425)*0.20,33,70)
    edge=np.clip((half-np.abs(xx-center)+4)/8,0,1)
    t=np.clip((1460-yy)/35,0,1);t=t*t*(3-2*t)
    arr[y0:y1,x0:x1,3]=np.rint(arr[y0:y1,x0:x1,3]*(1-t*(1-edge))).astype(np.uint8)
    return Image.fromarray(arr,'RGBA')

def base_without_road():
    water=Image.open(ROOT/'mobile/assets/garden/water/water_base_calm_preview.png').convert('RGBA').resize(WORLD,Image.Resampling.LANCZOS)
    base=Image.new('RGBA',WORLD,'#78b8b2');base.alpha_composite(water)
    for id,_,_,_,_ in b01.LANDS:base.alpha_composite(transform_land(id))
    return base

def b01_foreground():
    layer=transform_land('08')
    mask=Image.new('L',WORLD,0);d=ImageDraw.Draw(mask)
    d.ellipse((1835,1280,1869,1325),fill=255)
    mask=mask.filter(ImageFilter.GaussianBlur(5))
    layer.putalpha(ImageChops.multiply(layer.getchannel('A'),mask))
    return layer

def transform_land(id):
    id,x,y,w,deg=next(row for row in b01.LANDS if row[0]==id)
    im=b01.land_image(id);h=round(w*im.height/im.width)
    im=im.resize((w,h),Image.Resampling.LANCZOS)
    turned=im.rotate(-deg,Image.Resampling.BICUBIC,expand=True) if deg else im
    x-=round((turned.width-w)/2);y-=round((turned.height-h)/2)
    layer=Image.new('RGBA',WORLD);layer.alpha_composite(turned,(x,y))
    return layer

def bridge_b02():
    # Reuse the approved B01 floral bridge. Rotate the entire render about its
    # metadata walking-path anchor; smaller scale fits Central/Land06 gap.
    source=Image.open(b01.SOURCE).convert('RGBA')
    scale=.154
    im=source.resize((round(source.width*scale),round(source.height*scale)),Image.Resampling.LANCZOS)
    ax=round(b01.META['anchor']['x']*scale);ay=round(b01.META['anchor']['y']*scale)
    tile=Image.new('RGBA',(520,520));tile.alpha_composite(im,(260-ax,260-ay))
    tile=tile.rotate(-32,Image.Resampling.BICUBIC,expand=False)
    layer=Image.new('RGBA',WORLD);layer.alpha_composite(tile,(1676-260,500-260))
    return layer

def stair_st01():
    p=entry('central-land08-stair')
    im=Image.open(ROOT/'Resources/bridges/approved-circulation'/p['file']).convert('RGBA')
    im=im.resize((p['width'],p['height']),Image.Resampling.LANCZOS)
    layer=Image.new('RGBA',WORLD);layer.alpha_composite(im,(p['x'],p['y']))
    return layer

def rock_sprite(source,box,size):
    crop=source.crop(box).convert('RGBA').resize(size,Image.Resampling.LANCZOS)
    mask=Image.new('L',size,0);d=ImageDraw.Draw(mask)
    d.ellipse((2,0,size[0]-3,size[1]-6),fill=255)
    mask=mask.filter(ImageFilter.GaussianBlur(1.5))
    crop.putalpha(ImageChops.multiply(crop.getchannel('A'),mask))
    return crop

def stones_ss01():
    # Distinct real Garden shoreline rocks, cropped and softly isolated.
    land08=transform_land('08')
    land07=transform_land('07')
    specs=[
      (land08,(1908,929,1941,953),(2153,919),(28,23)),
      (land08,(1870,942,1902,965),(2137,950),(29,24)),
      (land08,(1930,934,1963,957),(2118,978),(27,22)),
      (land08,(1908,929,1941,953),(2100,1006),(28,23)),
    ]
    layer=Image.new('RGBA',WORLD)
    for src,box,(cx,cy),size in specs:
        rock=rock_sprite(src,box,size)
        layer.alpha_composite(rock,(round(cx-size[0]/2),round(cy-size[1]/2)))
    return layer

def foreground_b02():
    # Tiny soft overlaps of existing path/shore pixels at the two bridge feet.
    result=Image.new('RGBA',WORLD)
    for id,box in [('central',(1551,477,1594,522)),('06',(1761,477,1807,526))]:
        layer=transform_land(id)
        mask=Image.new('L',WORLD,0);d=ImageDraw.Draw(mask);d.ellipse(box,fill=255)
        mask=mask.filter(ImageFilter.GaussianBlur(5))
        layer.putalpha(ImageChops.multiply(layer.getchannel('A'),mask))
        result.alpha_composite(layer)
    return result

def contact(crops):
    panes=[]
    for title,im in crops:
        pane=im.convert('RGB').resize((520,390),Image.Resampling.LANCZOS)
        panes.append((title,pane))
    sheet=Image.new('RGB',(1040,430),'#e9e8dc');d=ImageDraw.Draw(sheet)
    for i,(title,pane) in enumerate(panes):
        sheet.paste(pane,(i*520,40));d.text((i*520+14,12),title,fill='#17363c')
    sheet.save(OUT/'07_road_transitions.png')

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    assert WORLD==(2400,1800)
    before=b01.scene_base()
    before.save(OUT/'00_before.png',optimize=True)
    base=base_without_road()
    road=save_layer(road_neck(),'road_entrance_existing_neck.png')
    ss=save_layer(stones_ss01(),'SS01_stepping_stones.png')
    st=save_layer(stair_st01(),'ST01_stair.png')
    b2=save_layer(bridge_b02(),'B02_bridge.png')
    b1,bounds=b01.bridge_layer();save_layer(b1,'B01_bridge.png')
    b2fg=save_layer(foreground_b02(),'B02_shore_foreground.png')
    b1fg=save_layer(b01_foreground(),'B01_shore_foreground.png')
    full=base.copy()
    for layer in (road,ss,st,b2,b1,b2fg,b1fg):full.alpha_composite(layer)
    full.save(OUT/'01_infrastructure_full.png',optimize=True)
    left=before.resize((1200,900),Image.Resampling.LANCZOS).convert('RGB')
    right=full.resize((1200,900),Image.Resampling.LANCZOS).convert('RGB')
    pair=Image.new('RGB',(2400,950),'#e9e8dc');pair.paste(left,(0,50));pair.paste(right,(1200,50))
    d=ImageDraw.Draw(pair);d.text((20,15),'BEFORE: current Garden',fill='#17363c');d.text((1220,15),'AFTER: B01 + B02 + ST01 + SS01',fill='#17363c')
    pair.save(OUT/'02_infrastructure_before_after.png',optimize=True)
    for name,box,zoom in [
      ('03_B01_closeup.png',(1500,1170,1980,1560),2),
      ('04_B02_closeup.png',(1440,350,1900,650),2),
      ('05_ST01_closeup.png',(1350,730,1960,1200),2),
      ('06_SS01_closeup.png',(1840,760,2170,1100),3)]:
        im=full.crop(box);im.resize((im.width*zoom,im.height*zoom),Image.Resampling.LANCZOS).save(OUT/name,optimize=True)
    contact([('Existing Land09 to Main Entrance',full.crop((1200,1180,1750,1680))),('Main Entrance to B01 neck',full.crop((1450,1280,1820,1600)))])
    debug=full.copy();d=ImageDraw.Draw(debug)
    try:font=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',25)
    except OSError:font=ImageFont.load_default()
    items=[
      ('B01',(1740,1364),(1644,1425),(1836,1303),b1),
      ('B02',(1676,500),(1562,500),(1790,500),b2),
      ('ST01',(1630,980),(1490,895),(1797,1048),st),
      ('SS01',(2125,963),(2160,890),(2080,1040),ss),
    ]
    for name,(x,y),start,end,asset in items:
        bbox=asset.getchannel('A').getbbox()
        if bbox:d.rectangle(bbox,outline='#ff38c8',width=3)
        d.line((start,end),fill='#fff829',width=3)
        for pt in (start,end):d.ellipse((pt[0]-8,pt[1]-8,pt[0]+8,pt[1]+8),fill='#fff829',outline='#143036',width=2)
        d.ellipse((x-8,y-8,x+8,y+8),fill='#f82cd2',outline='#143036',width=2)
        d.text((x+18,y-27),name,font=font,fill='white',stroke_width=3,stroke_fill='#143036')
    d.text((30,1590),'Order: water > Lands > entrance road/neck > SS01 > ST01 > B02 > B01 > foreground',font=font,fill='white',stroke_width=3,stroke_fill='#17363c')
    d.text((30,1635),'Magenta: component bounds/anchor. Yellow: walking endpoints.',font=font,fill='white',stroke_width=3,stroke_fill='#17363c')
    d.text((30,1680),'New Road segments: none; existing Main Entrance route retained. R01 excluded.',font=font,fill='white',stroke_width=3,stroke_fill='#17363c')
    debug.save(OUT/'08_infrastructure_debug.png',optimize=True)
    print('full',full.size,'B01 bounds',bounds)

if __name__=='__main__':main()
