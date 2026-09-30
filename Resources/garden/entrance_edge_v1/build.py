from pathlib import Path
import sys,json
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image,ImageDraw
import numpy as np
road=Image.open(OUT/'source/road_original.png').convert('RGBA');a=np.array(road)
# Coordinates are on the 600x1080 review crop; all stone RGB stays untouched.
right=[(435,0),(438,52),(436,105),(452,140),(452,205),(455,250),(448,279),(447,300),(437,348),(442,382),(434,412),(426,460),(422,505),(432,550),(433,610),(426,648),(435,680),(445,711),(436,752),(438,800),(444,858),(448,925),(444,979),(440,1020),(445,1080)]
left=[(213,0),(224,60),(214,110),(211,166),(200,201),(187,225),(0,245),(0,375),(86,384),(107,399),(132,420),(146,440),(160,469),(174,499),(183,521),(184,550),(193,580),(184,626),(178,660),(186,705),(180,747),(159,787),(151,821),(148,880),(156,925),(168,980),(163,1015),(154,1080)]
protect=Image.new('L',road.size);d=ImageDraw.Draw(protect)
def pt(p):return (round(210+p[0]/3),round(90+p[1]/3))
d.polygon([pt(p) for p in right+left[::-1]],fill=255)
cuts=[
 [(440,164),(451,176),(443,192),(442,210),(451,232),(476,248),(600,252),(600,151),(475,153)],
 [(442,399),(424,416),(414,438),(409,466),(423,480),(460,494),(600,493),(600,392)],
 [(446,649),(428,666),(428,681),(445,698),(475,712),(600,714),(600,643)],
 [(458,923),(440,940),(432,958),(439,976),(467,990),(600,994),(600,917)],
 [(0,431),(135,433),(160,447),(165,464),(179,486),(167,500),(130,506),(0,507)],
 [(0,770),(144,776),(166,790),(157,807),(149,823),(121,837),(0,838)]
]
cut=Image.new('L',road.size);d=ImageDraw.Draw(cut)
for poly in cuts:d.polygon([pt(p) for p in poly],fill=255)
protected=np.array(protect)>0
# Also protect every warm stone pixel close to the traced paving boundary.
from PIL import ImageFilter
near=np.array(protect.filter(ImageFilter.MaxFilter(9)))>0
stone=(a[:,:,0].astype(int)>a[:,:,1].astype(int)+5)&(a[:,:,2]>85)
protected|=near&stone
flowers=Image.new('L',road.size);fd=ImageDraw.Draw(flowers)
for x,y,r in [(477,106,35),(496,205,18),(475,390,19),(469,542,19),(445,591,17),(480,615,20),(545,755,34),(113,477,19),(119,601,19),(136,739,20)]:
    cx,cy=pt((x,y));rr=r/3
    fd.ellipse((cx-rr,cy-rr,cx+rr,cy+rr),fill=255)
protected |= np.array(flowers)>0
landing=np.array(Image.open(OUT/'source/landing_original.png').convert('RGBA'))
protected[0:450,0:680]|=(landing[1350:1800,1300:1980,3]>=250)
# Recess each gap gradually through the original outer contour. This avoids
# cutting vegetation clusters off along horizontal rectangle boundaries.
remove=np.zeros(a.shape[:2],dtype=bool)
for side,start,end,power in [('right',423,475,0.4),('left',448,485,0.6)]:
    sy=round(90+start/3);ey=round(90+end/3)
    for y in range(sy,ey+1):
        row=np.flatnonzero(a[y,:,3]>16)
        safe=np.flatnonzero(protected[y])
        if not len(row) or not len(safe):continue
        t=(y-sy)/(ey-sy)
        strength={423:1.0,448:0.85}[start]
        depth=(np.sin(np.pi*t)**power)*strength
        jitter=0.6*np.sin(y*2.7)+0.4*np.sin(y*4.1)
        if side=='right':
            edge=row[-1]+2;target=safe[-1]+1
            boundary=round(edge+(target-edge)*depth+jitter)
            remove[y,max(boundary,0):]=True
        else:
            edge=row[0]-2;target=safe[0]-1
            boundary=round(edge+(target-edge)*depth+jitter)
            remove[y,:max(boundary,0)]=True
# Use only the draft's alpha contour, never its redrawn RGB. Limit this to the
# original crop and outside all protected masonry/overlap pixels.
draft=Image.open(OUT/'source/edge_reference_draft.png').convert('RGBA').resize((200,360),Image.Resampling.LANCZOS)
remove[90:450,210:410] |= np.array(draft)[:,:,3]<64
remove &= ~protected
original=a.copy();a[remove,3]=0
assert np.array_equal(a[:,:,:3],original[:,:,:3])
assert np.array_equal(a[np.array(protect)>0],original[np.array(protect)>0])
result=Image.fromarray(a);result.save(OUT/'source/road_edge_cleaned.png')
# Review before installation; the connected landing is never edited.
world=Image.new('RGBA',(2400,1800));world.alpha_composite(result,(1300,1350));world.alpha_composite(Image.open(OUT/'source/landing_original.png'))
view=world.crop((1510,1440,1710,1800)).resize((600,1080),Image.Resampling.NEAREST)
bg=Image.new('RGBA',view.size,'#bd76ae');bg.alpha_composite(view);bg.convert('RGB').save(OUT/'source/alpha_preview.png')
(OUT/'source/edge_change.json').write_text(json.dumps({'removed_nontransparent_pixels':int(((original[:,:,3]>0)&(a[:,:,3]==0)).sum()),'rgb_unchanged':True,'protected_paving_unchanged':True,'landing_unchanged':True},indent=2))
print((OUT/'source/edge_change.json').read_text())
