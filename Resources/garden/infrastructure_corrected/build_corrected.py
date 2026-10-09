"""Visual correction pass for ST01, B02, SS01; B01 is loaded unchanged."""
from pathlib import Path
import sys, math, hashlib, json
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
sys.path.insert(0,str(ROOT/'Resources/garden/infrastructure_candidate'))
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageFont
import numpy as np
import build_candidate as old

OUT=Path(__file__).resolve().parent
PREV=ROOT/'Resources/garden/infrastructure_candidate'
WORLD=(2400,1800)
BRIDGE=ROOT/'Resources/decorations/bridge/rendered/bridge_entrance_to_right.png'

def layer(name): return Image.open(PREV/name).convert('RGBA')
def save(im,name): im.save(OUT/name,optimize=True); return im

def b02_bridge():
    # Same sprite, whole-image scale/orientation adjustment only.
    source=Image.open(BRIDGE).convert('RGBA')
    scale=.158
    im=source.resize((round(source.width*scale),round(source.height*scale)),Image.Resampling.LANCZOS)
    ax=round(old.b01.META['anchor']['x']*scale)
    ay=round(old.b01.META['anchor']['y']*scale)
    tile=Image.new('RGBA',(540,540))
    tile.alpha_composite(im,(270-ax,270-ay))
    tile=tile.rotate(-32,Image.Resampling.BICUBIC,expand=False)
    result=Image.new('RGBA',WORLD)
    result.alpha_composite(tile,(1676-270,490-270))
    return result

def b02_foreground():
    # The left foot is on connected 04/05 artwork, not Central's transparent
    # outer canvas. Copy just the original shoreline/path pixels at each foot.
    result=Image.new('RGBA',WORLD)
    for id,box,blur in [
        ('0405',(1540,460,1597,511),5),
        ('06',(1762,466,1814,524),5),
    ]:
        land=old.transform_land(id)
        mask=Image.new('L',WORLD,0);draw=ImageDraw.Draw(mask)
        draw.ellipse(box,fill=255)
        mask=mask.filter(ImageFilter.GaussianBlur(blur))
        land.putalpha(ImageChops.multiply(land.getchannel('A'),mask))
        result.alpha_composite(land)
    return result

def stair_st01():
    # A thin, low-profile stone stair in the current path palette. All tread
    # texture is synthesized from sampled Garden stone colors; no rejected
    # large stair geometry or railing pixels enter this asset.
    A=(1490.0,895.0);B=(1797.0,1048.0)
    dx=B[0]-A[0];dy=B[1]-A[1];length=math.hypot(dx,dy)
    ux,uy=dx/length,dy/length
    nx,ny=-uy,ux
    aa=3
    x0,y0,x1,y1=1440,840,1850,1110
    W,H=(x1-x0)*aa,(y1-y0)*aa
    canvas=Image.new('RGBA',(W,H));draw=ImageDraw.Draw(canvas)
    def pt(s,lateral,down=0):
        return (round((A[0]+ux*s+nx*lateral-x0)*aa),
                round((A[1]+uy*s+ny*lateral+down-y0)*aa))
    half=25.5
    # Quiet sidewalls make the span physically legible over water.
    for side in (-1,1):
        pts=[pt(0,side*(half+1),1),pt(length,side*(half+1),1),
             pt(length,side*(half+4),6),pt(0,side*(half+4),6)]
        draw.polygon(pts,fill=(70,75,63,220))
        draw.line([pt(0,side*(half+1)),pt(length,side*(half+1))],fill=(115,114,96,235),width=2*aa)
    # Ten shallow treads, with readable but low-contrast risers.
    count=10
    rng=np.random.default_rng(4018)
    for i in range(count):
        s0=length*i/count;s1=length*(i+1)/count
        w0=half+float(rng.uniform(-1.1,1.1));w1=half+float(rng.uniform(-1.1,1.1))
        polygon=[pt(s0,-w0),pt(s1,-w1),pt(s1,w1),pt(s0,w0)]
        shade=int(rng.integers(-5,6))
        draw.polygon(polygon,fill=(151+shade,149+shade,131+shade,255))
        # A restrained darker riser, rather than deep white step highlights.
        if i:
            draw.line([pt(s0,-w0+1),pt(s0,w0-1)],fill=(99,100,82,255),width=3*aa)
            draw.line([pt(s0+4,-w0+2),pt(s0+4,w0-2)],fill=(171,167,142,255),width=aa)
        # Fine, low-contrast irregular stone flecks; deterministic and sparse.
        for _ in range(9):
            s=float(rng.uniform(s0+3,s1-3));v=float(rng.uniform(-w0+3,w0-3))
            cx,cy=pt(s,v)
            rad=int(rng.integers(1,3))*aa//2
            delta=int(rng.integers(-8,9))
            draw.ellipse((cx-rad,cy-rad,cx+rad,cy+rad),fill=(151+delta,149+delta,131+delta,255))
        # A few worn mineral seams keep treads from reading as flat panels.
        for _ in range(2):
            s=float(rng.uniform(s0+6,s1-6));v=float(rng.uniform(-w0+9,w0-9))
            p0=pt(s,v);p1=pt(s+float(rng.uniform(2,5)),v+float(rng.uniform(-3,3)))
            draw.line((p0,p1),fill=(128,130,110,255),width=aa)
    # Thin old-stone curbs only. They recede at the endpoints into the paths.
    for side in (-1,1):
        draw.line([pt(7,side*(half-1)),pt(length-7,side*(half-1))],
                  fill=(109,111,94,255),width=2*aa)
        draw.line([pt(7,side*(half-3)),pt(length-7,side*(half-3))],
                  fill=(169,166,142,255),width=aa)
    # Multiscale stone mottling, applied to RGB only. Full opacity prevents
    # cyan water from showing through the tread texture.
    pixels=np.array(canvas)
    coarse=rng.normal(0,11,(max(2,H//55),max(2,W//55))).astype(np.float32)
    coarse=np.array(Image.fromarray(coarse,'F').resize((W,H),Image.Resampling.BILINEAR))
    grain=rng.normal(0,6,(max(2,H//8),max(2,W//8))).astype(np.float32)
    grain=np.array(Image.fromarray(grain,'F').resize((W,H),Image.Resampling.BILINEAR))
    noise=coarse+grain
    opaque=pixels[:,:,3]>=240
    for channel,factor in ((0,1.0),(1,1.0),(2,.88)):
        values=pixels[:,:,channel].astype(np.float32)+noise*factor
        pixels[:,:,channel]=np.where(opaque,np.clip(values,0,255),pixels[:,:,channel]).astype(np.uint8)
    canvas=Image.fromarray(pixels,'RGBA').resize((x1-x0,y1-y0),Image.Resampling.LANCZOS)
    # Very short end fade merges with unchanged path stone rather than a cut.
    arr=np.array(canvas)
    yy,xx=np.mgrid[y0:y1,x0:x1]
    s=(xx-A[0])*ux+(yy-A[1])*uy
    taper=np.minimum(np.clip(s/8,0,1),np.clip((length-s)/8,0,1))
    arr[:,:,3]=np.rint(arr[:,:,3]*taper).astype(np.uint8)
    canvas=Image.fromarray(arr,'RGBA')
    result=Image.new('RGBA',WORLD);result.alpha_composite(canvas,(x0,y0))
    return result

def stair_foreground():
    result=Image.new('RGBA',WORLD)
    for id,box in [('central',(1472,872,1514,914)),('08',(1777,1029,1820,1072))]:
        land=old.transform_land(id)
        mask=Image.new('L',WORLD,0);ImageDraw.Draw(mask).ellipse(box,fill=255)
        mask=mask.filter(ImageFilter.GaussianBlur(5))
        land.putalpha(ImageChops.multiply(land.getchannel('A'),mask))
        result.alpha_composite(land)
    return result

def ss01_stones():
    source=old.transform_land('08')
    # Six source-rock tops follow the actual diagonal water gap, enlarged
    # enough to read as deliberate steps at the 1200 px review scale.
    specs=[
        ((1908,929,1941,953),(2186,900),(35,29)),
        ((1870,942,1902,965),(2170,937),(38,31)),
        ((1930,934,1963,957),(2148,970),(36,29)),
        ((1908,929,1941,953),(2126,1004),(40,32)),
        ((1870,942,1902,965),(2107,1035),(37,30)),
        ((1930,934,1963,957),(2086,1063),(35,29)),
    ]
    result=Image.new('RGBA',WORLD)
    for box,(cx,cy),size in specs:
        rock=old.rock_sprite(source,box,size)
        result.alpha_composite(rock,(round(cx-size[0]/2),round(cy-size[1]/2)))
    return result

def comparison(before,after,box,name,zoom=2):
    a=before.crop(box).resize(((box[2]-box[0])*zoom,(box[3]-box[1])*zoom),Image.Resampling.LANCZOS).convert('RGB')
    b=after.crop(box).resize(a.size,Image.Resampling.LANCZOS).convert('RGB')
    sheet=Image.new('RGB',(a.width*2,a.height+46),'#ecebe2')
    sheet.paste(a,(0,46));sheet.paste(b,(a.width,46))
    d=ImageDraw.Draw(sheet)
    try:font=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',21)
    except OSError:font=ImageFont.load_default()
    d.text((14,11),'CURRENT CANDIDATE',font=font,fill='#15383e')
    d.text((a.width+14,11),'CORRECTED',font=font,fill='#15383e')
    sheet.save(OUT/name,optimize=True)

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    locked={n:hashlib.sha256((PREV/n).read_bytes()).hexdigest() for n in
            ('B01_bridge.png','B01_shore_foreground.png','road_entrance_existing_neck.png')}
    before=Image.open(PREV/'01_infrastructure_full.png').convert('RGBA')
    base=old.base_without_road()
    road=layer('road_entrance_existing_neck.png')
    b01=layer('B01_bridge.png');b01fg=layer('B01_shore_foreground.png')
    st=save(stair_st01(),'ST01_restrained_stair.png')
    stfg=save(stair_foreground(),'ST01_shore_foreground.png')
    b02=save(b02_bridge(),'B02_seated_bridge.png')
    b02fg=save(b02_foreground(),'B02_shore_foreground.png')
    ss=save(ss01_stones(),'SS01_walkable_stones.png')
    after=base.copy()
    for im in (road,ss,st,b02,b01,stfg,b02fg,b01fg):after.alpha_composite(im)
    after.save(OUT/'01_infrastructure_corrected_full.png',optimize=True)
    comparison(before,after,(0,0,2400,1800),'02_current_vs_corrected.png',zoom=1)
    comparison(before,after,(1360,760,1900,1160),'03_ST01_before_after.png',zoom=2)
    comparison(before,after,(1450,350,1900,650),'04_B02_before_after.png',zoom=2)
    comparison(before,after,(2030,785,2260,1140),'05_SS01_before_after.png',zoom=2)
    (OUT/'manifest.json').write_text(json.dumps({
        'world':WORLD,'locked_previous_asset_sha256':locked,
        'B02':{'anchor':[1676,490],'scale':.158,'clockwise_degrees':32,'left_land':'0405 connected to Central','right_land':'06'},
        'ST01':{'endpoints':[[1490,895],[1797,1048]],'treads':10,'nominal_width_px':51},
        'SS01':{'stone_centers':[[2186,900],[2170,937],[2148,970],[2126,1004],[2107,1035],[2086,1063]]}
    },indent=2),encoding='utf-8')
    print('full',after.size,'locked B01 sha',locked['B01_bridge.png'])

if __name__=='__main__':main()
