"""Reconstruct curved paving from individual approved-master stone stamps.

The straight master and V1 strip examples are inputs only. Requires NumPy,
Pillow, and OpenCV. Produces the two transparent V2 roads and comparison.
"""
from __future__ import annotations
import hashlib, json, math, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.tools'))
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from build_road_poc import centerline, CANVAS, ROAD_CENTER_Y, SOURCE_CENTER_Y, APPROVED_SHA256

MASTER=ROOT/'source/road_straight_master.png'
POC=ROOT/'poc'
LIB=POC/'stone_library'
HALF_WIDTH=118.5
ROW_OFFSETS=(-88,-44,0,44,88)

def extract_library(src:np.ndarray):
    """Segment actual light stone centers; retain their painted rim/shadow."""
    r,g,b=[src[:,:,i] for i in range(3)]
    raw=((r>155)&(g>135)&(b>105)&(src[:,:,3]>180)).astype(np.uint8)
    raw[:420]=0;raw[615:]=0;raw[:,:35]=0;raw[:,1501:]=0
    count,labels,stats,centroids=cv2.connectedComponentsWithStats(raw,8)
    LIB.mkdir(parents=True,exist_ok=True)
    stones=[]
    for i in range(1,count):
        x,y,w,h,area=map(int,stats[i])
        if not (300<=area<=8000 and 16<=w<140 and 12<=h<95):continue
        x0=max(0,x-7);y0=max(0,y-7);x1=min(src.shape[1],x+w+7);y1=min(src.shape[0],y+h+7)
        component=(labels[y0:y1,x0:x1]==i).astype(np.uint8)
        # Four source pixels beyond the bright center retain the original
        # shaded stone edge and a trace of its mossy grout.
        silhouette=cv2.dilate(component,np.ones((7,7),np.uint8),iterations=1)
        alpha=cv2.GaussianBlur(silhouette.astype(np.float32),(5,5),.9)
        stamp=src[y0:y1,x0:x1].copy()
        stamp[:,:,3]=np.rint(np.clip(alpha*stamp[:,:,3],0,255)).astype(np.uint8)
        name=f'stone_{len(stones):03d}.png'
        Image.fromarray(stamp,'RGBA').save(LIB/name)
        stones.append({'file':name,'source_bbox':[x,y,w,h], 'source_area':area,
                       'size':[stamp.shape[1],stamp.shape[0]],'centroid':centroids[i].tolist()})
    assert len(stones)>=80,len(stones)
    (LIB/'manifest.json').write_text(json.dumps({'master_sha256':APPROVED_SHA256,'stones':stones},indent=2),encoding='utf-8')
    return stones,raw

def road_geometry(kind:str):
    x,y,arc=centerline(kind)
    dy=np.gradient(y,x)
    q=np.sqrt(1+dy*dy)
    nx=-dy/q;ny=1/q
    return x,y,arc,dy,nx,ny

def road_background(kind:str,src:np.ndarray,stone_mask:np.ndarray,geom):
    """Approved border follows the curve; only mortar under stones is inpainted."""
    x,y,arc,dy,nx,ny=geom
    # Remove approved stones only from the underlay. Actual stone pixels enter
    # again as isolated stamps above it, without geometric stretching.
    hole=cv2.dilate(stone_mask,np.ones((11,11),np.uint8),iterations=1)
    mortar=cv2.inpaint(src[:,:,:3],hole*255,9,cv2.INPAINT_TELEA)
    # Inpainting alone borrows too much beige from stone rims. Match its
    # textured result to the real dark moss/grout pixels of this master.
    region=src[420:615,50:1486,:3]
    grout=region[(region[:,:,0]<145)&(region[:,:,1]<140)&(region[:,:,2]<105)]
    target=np.median(grout,axis=0)
    present=np.median(mortar[hole>0],axis=0)
    recolored=np.clip(mortar[hole>0].astype(np.float32)*(target/present),0,255)
    mortar[hole>0]=np.rint(recolored).astype(np.uint8)
    X,Y=np.meshgrid(np.arange(CANVAS[0],dtype=np.float32),np.arange(CANVAS[1],dtype=np.float32))
    u=X.copy()
    for _ in range(5):
        cy=np.interp(u,x,y).astype(np.float32)
        slope=np.interp(u,x,dy).astype(np.float32)
        u=np.clip(X+(Y-cy)*slope,0,CANVAS[0]-1)
    cy=np.interp(u,x,y).astype(np.float32)
    slope=np.interp(u,x,dy).astype(np.float32)
    q=np.sqrt(1+slope*slope)
    v=(-(X-u)*slope+(Y-cy))/q
    su=((src.shape[1]-arc[-1])/2+np.interp(u,x,arc)).astype(np.float32)
    sv=(SOURCE_CENTER_Y+v).astype(np.float32)
    rgb=cv2.remap(mortar,su,sv,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
    alpha=cv2.remap(src[:,:,3],su,sv,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
    alpha=np.where(np.abs(v)>139,0,alpha).astype(np.uint8)
    # Only the outermost narrow band retains the source's moss, leaves, and
    # occasional tiny edge rocks; the central paving is entirely stamped.
    original=cv2.remap(src[:,:,:3],su,sv,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
    edge=np.clip((np.abs(v)-108)/6,0,1).astype(np.float32)
    rgb=np.rint(rgb*(1-edge[:,:,None])+original*edge[:,:,None]).astype(np.uint8)
    return Image.fromarray(np.dstack((rgb,alpha)),'RGBA')

def choose_stone(stones,rng,target_h:int,previous:set[int]):
    candidates=[(i,s) for i,s in enumerate(stones)
                if 28<=s['source_bbox'][3]<=56 and 35<=s['source_bbox'][2]<=112
                and abs(s['source_bbox'][3]-target_h)<16 and i not in previous]
    if not candidates:
        candidates=[(i,s) for i,s in enumerate(stones) if 28<=s['source_bbox'][3]<=56 and i not in previous]
    idx,stone=candidates[int(rng.integers(len(candidates)))]
    return idx,stone

def lay_stones(kind:str,background:Image.Image,stones:list[dict],geom):
    x,y,arc,dy,nx,ny=geom
    rng=np.random.default_rng(2406 if kind=='gentle_curve' else 6224)
    out=background.copy()
    placed=[]
    coverage=np.zeros((CANVAS[1],CANVAS[0]),dtype=np.float32)
    def stamp(sprite:Image.Image,cx:float,cy:float):
        left=int(round(cx-sprite.width/2));top=int(round(cy-sprite.height/2))
        out.alpha_composite(sprite,(left,top))
        a=np.asarray(sprite.getchannel('A'),dtype=np.float32)/255
        x0=max(0,left);y0=max(0,top);x1=min(CANVAS[0],left+sprite.width);y1=min(CANVAS[1],top+sprite.height)
        if x0<x1 and y0<y1:
            np.maximum(coverage[y0:y1,x0:x1],a[y0-top:y1-top,x0-left:x1-left],out=coverage[y0:y1,x0:x1])
    for row,v0 in enumerate(ROW_OFFSETS):
        px=x+v0*nx;py=y+v0*ny
        length=np.concatenate(([0.0],np.cumsum(np.hypot(np.diff(px),np.diff(py)))))
        distance=-25.0 + (row%2)*28 + float(rng.uniform(-9,9))
        previous_width=0.0;recent=[]
        while distance<length[-1]+65:
            idx,stone=choose_stone(stones,rng,42,set(recent[-7:]))
            sw,sh=stone['source_bbox'][2:4]
            gap=float(rng.uniform(0.5,3.0))
            distance+=previous_width/2+sw/2+gap if previous_width else sw/2
            if distance>length[-1]+70:break
            cx=float(np.interp(distance,length,px));cy=float(np.interp(distance,length,py))
            cx+=float(rng.normal(0,1.5));cy+=float(rng.normal(0,2.4))
            sx=float(np.interp(distance,length,x))
            tangent=math.degrees(math.atan2(float(np.interp(sx,x,dy)),1.0))
            angle=tangent+float(rng.uniform(-8,8))
            sprite=Image.open(LIB/stone['file']).convert('RGBA')
            rotated=sprite.rotate(-angle,resample=Image.Resampling.BICUBIC,expand=True)
            stamp(rotated,cx,cy)
            placed.append({'stone':idx,'row':row,'center':[round(cx,1),round(cy,1)],'angle':round(angle,2)})
            previous_width=sw
            recent.append(idx)
            distance+=float(rng.uniform(-2,1.5))
    # Fill larger interstices with genuinely small approved-source stones.
    Y,X=np.indices(coverage.shape)
    inside=np.abs(Y-np.interp(X,x,y))<94
    free=((coverage<.32)&inside).astype(np.uint8)
    dist=cv2.distanceTransform(free,cv2.DIST_L2,5)
    peaks=(dist==cv2.dilate(dist,np.ones((19,19),np.uint8)))&(dist>7.0)
    points=np.argwhere(peaks)
    points=sorted(points,key=lambda p:float(dist[p[0],p[1]]),reverse=True)
    small=[(i,s) for i,s in enumerate(stones) if 17<=s['source_bbox'][3]<=38 and 20<=s['source_bbox'][2]<=62]
    filler_count=0
    for py,px in points:
        if filler_count>=72:break
        if coverage[py,px]>.32:continue
        radius=float(dist[py,px])
        candidates=[(i,s) for i,s in small if s['source_bbox'][2]<3.5*radius and s['source_bbox'][3]<3.2*radius]
        if not candidates:continue
        idx,stone=candidates[int(rng.integers(len(candidates)))]
        slope=float(np.interp(px,x,dy))
        angle=math.degrees(math.atan2(slope,1))+float(rng.uniform(-12,12))
        sprite=Image.open(LIB/stone['file']).convert('RGBA').rotate(-angle,resample=Image.Resampling.BICUBIC,expand=True)
        left=int(round(px-sprite.width/2));top=int(round(py-sprite.height/2))
        x0=max(0,left);y0=max(0,top);x1=min(CANVAS[0],left+sprite.width);y1=min(CANVAS[1],top+sprite.height)
        if x0>=x1 or y0>=y1:continue
        alpha=np.asarray(sprite.getchannel('A'),dtype=np.float32)[y0-top:y1-top,x0-left:x1-left]/255
        occupied=coverage[y0:y1,x0:x1]
        if np.sum((alpha>.35)&(occupied>.55))/max(np.count_nonzero(alpha>.35),1)>.19:continue
        stamp(sprite,float(px),float(py))
        placed.append({'stone':idx,'row':'filler','center':[int(px),int(py)],'angle':round(angle,2)})
        filler_count+=1
    print(kind,'fillers',filler_count)
    return out,placed

def compare():
    labels=[('gentle_curve','GENTLE CURVE'),('s_curve','S-CURVE')]
    w,h=CANVAS
    top=66;crop_h=460
    sheet=Image.new('RGB',(w*2,top+2*h+crop_h+96),(43,55,50))
    draw=ImageDraw.Draw(sheet)
    try:font=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',27)
    except OSError:font=ImageFont.load_default()
    draw.text((35,18),'CURRENT STRIP METHOD',font=font,fill=(240,239,225))
    draw.text((w+35,18),'V2 RECONSTRUCTED PAVING',font=font,fill=(240,239,225))
    for i,(kind,label) in enumerate(labels):
        yy=top+i*h
        for col,path in enumerate((POC/f'road_poc_{kind}.png',POC/f'road_poc_{kind}_v2.png')):
            pane=Image.new('RGBA',CANVAS,(51,63,56,255))
            pane.alpha_composite(Image.open(path).convert('RGBA'))
            sheet.paste(pane.convert('RGB'),(col*w,yy))
        draw.text((28,yy+12),label,font=font,fill=(255,255,240),stroke_width=2,stroke_fill=(30,40,36))
        draw.text((w+28,yy+12),label,font=font,fill=(255,255,240),stroke_width=2,stroke_fill=(30,40,36))
    # The strongest S bend is the left-hand trough, identical crop/zoom.
    crop=(150,290,1050,750)
    cy=top+2*h+48
    draw.text((28,cy-40),'S-CURVE STRONGEST BEND — SAME PIXEL CROP',font=font,fill=(240,239,225))
    for col,path in enumerate((POC/'road_poc_s_curve.png',POC/'road_poc_s_curve_v2.png')):
        pane=Image.new('RGBA',CANVAS,(51,63,56,255));pane.alpha_composite(Image.open(path).convert('RGBA'))
        close=pane.crop(crop).convert('RGB')
        sheet.paste(close,(col*w+250,cy))
    sheet.save(POC/'road_poc_curve_method_compare.png',optimize=True)

def main():
    assert hashlib.sha256(MASTER.read_bytes()).hexdigest()==APPROVED_SHA256
    src=np.array(Image.open(MASTER).convert('RGBA'))
    stones,mask=extract_library(src)
    print('stone_library_count',len(stones))
    for kind in ('gentle_curve','s_curve'):
        geom=road_geometry(kind)
        bg=road_background(kind,src,mask,geom)
        out,placements=lay_stones(kind,bg,stones,geom)
        path=POC/f'road_poc_{kind}_v2.png';out.save(path,optimize=True)
        (POC/f'{kind}_v2_placements.json').write_text(json.dumps(placements,indent=2),encoding='utf-8')
        print(kind,'placed',len(placements),'output',path.name)
    compare()

if __name__=='__main__':main()
