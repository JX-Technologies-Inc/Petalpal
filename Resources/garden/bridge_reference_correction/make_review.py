"""Create matched reference and actual /garden-test runtime review images."""
from pathlib import Path
import json, sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT/'Resources/road/.tools'))
from PIL import Image, ImageDraw, ImageFont

OUT=Path(__file__).resolve().parent
data=json.loads((OUT/'alignment.json').read_text())
runtime=Image.open(OUT/'runtime_canvas.png').convert('RGB')
ref=Image.open(ROOT/'mobile/assets/garden/reference/structure-final-version.png').convert('RGB')
W,H=runtime.size
fit=W/2400
ref_fit=W/ref.width
land_h=round(1800*fit)
top=(H-land_h)//2
reference=Image.new('RGB',(W,H),'#78b8b2')
reference.paste(ref.resize((W,land_h),Image.Resampling.LANCZOS),(0,top))
try: FONT=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',20)
except OSError: FONT=ImageFont.load_default()

def side_by_side(a,b,labels,name):
    assert a.size==b.size
    header=45
    result=Image.new('RGB',(a.width*2,a.height+header),'#f2f0e8')
    result.paste(a,(0,header));result.paste(b,(a.width,header))
    draw=ImageDraw.Draw(result)
    draw.text((12,10),labels[0],font=FONT,fill='#143a3e')
    draw.text((a.width+12,10),labels[1],font=FONT,fill='#143a3e')
    result.save(OUT/name,optimize=True)

def crop_pair(ref_box,run_box,scale,labels,name):
    a=reference.crop(ref_box);b=runtime.crop(run_box)
    assert a.size==b.size
    size=(a.width*scale,a.height*scale)
    side_by_side(a.resize(size,Image.Resampling.LANCZOS),
                 b.resize(size,Image.Resampling.LANCZOS),labels,name)

side_by_side(reference,runtime,('COMPLETED GARDEN REFERENCE A','CORRECTED LIVE /garden-test'),
             '01_reference_vs_runtime.png')
crop_pair((575,500,820,700),(600,500,845,700),3,
          ('REFERENCE A · B01','RUNTIME · B01'),'02_B01_reference_vs_runtime.png')
crop_pair((565,180,810,310),(580,150,825,280),3,
          ('REFERENCE A · B02','RUNTIME · B02'),'03_B02_reference_vs_runtime.png')
runtime.crop((630,500,805,675)).resize((875,875),Image.Resampling.LANCZOS).save(
    OUT/'04_B01_landing_closeup.png',optimize=True)
runtime.crop((590,160,805,275)).resize((1075,575),Image.Resampling.LANCZOS).save(
    OUT/'05_B02_landing_closeup.png',optimize=True)

debug=Image.new('RGB',(W*2,H+140),'#f2f0e8')
debug.paste(reference,(0,45));debug.paste(runtime,(W,45))
draw=ImageDraw.Draw(debug)
draw.text((12,9),'REFERENCE A · traced centerlines',font=FONT,fill='#143a3e')
draw.text((W+12,9),'RUNTIME · mapped lines / final feet / bounds',font=FONT,fill='#143a3e')

def rp(p):return (round(p[0]*ref_fit),round(top+p[1]*ref_fit+45))
def wp(p):return (round(W+p[0]*fit),round(top+p[1]*fit+45))
colors={'B01':'#ffea35','B02':'#ff52a4'}
for name in ('B01','B02'):
    info=data['bridges'][name]
    refpoints=[rp(p) for p in data['reference_centerlines'][name].values()]
    mapped=[wp(p) for p in info['mapped_reference_centerline']]
    final=[wp(p) for p in info['endpoints']]
    color=colors[name]
    draw.line(refpoints,fill=color,width=4)
    draw.line(mapped,fill='#ffffff',width=3)
    draw.line(final,fill=color,width=5)
    for p in refpoints+mapped+final:
        draw.ellipse((p[0]-5,p[1]-5,p[0]+5,p[1]+5),fill=color,outline='#102b32',width=2)
    box=info['bounds']
    draw.rectangle((*wp((box[0],box[1])),*wp((box[2],box[3]))),outline=color,width=2)
    draw.text((final[0][0]-38,final[0][1]-26),name,font=FONT,fill='#ffffff',stroke_width=2,stroke_fill='#17363c')
    text=f"{name}: A {info['endpoints'][0]}  B {info['endpoints'][1]}  scale {info['scale']:.4f}  rotation {info['pil_ccw_degrees']:+.1f}° CCW"
    draw.text((18,H+52+(0 if name=='B01' else 33)),text,font=FONT,fill='#143a3e')
draw.text((W+18,H+52),'White: centroid-affine mapping. Color: final path feet. Box: asset alpha bounds.',font=FONT,fill='#143a3e')
debug.save(OUT/'06_bridge_alignment_debug.png',optimize=True)
