"""Review plates using the captured, actual /garden-test Skia frame."""
from pathlib import Path
import sys,json
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
sys.path.insert(0,str(ROOT/'Resources/garden/infrastructure_candidate'))
from PIL import Image,ImageDraw,ImageFont
import numpy as np,cv2
import build_candidate as garden

OUT=Path(__file__).resolve().parent
runtime=Image.open(OUT/'04_corrected_full_runtime.png').convert('RGB')
reference=Image.open(ROOT/'mobile/assets/garden/reference/structure-final-version.png').convert('RGB')
info=json.loads((OUT/'geometry.json').read_text())
W,H=runtime.size
scale=min(W/2400,H/1800)
left=(W-2400*scale)/2
top=(H-1800*scale)/2
ref=Image.new('RGB',(W,H),'#78b8b2')
ref.paste(reference.resize((round(2400*scale),round(1800*scale)),Image.Resampling.LANCZOS),(round(left),round(top)))
try: font=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',20)
except OSError: font=ImageFont.load_default()

def panel_pair(refbox,runbox,name,title):
    left=ref.crop(refbox).resize(((refbox[2]-refbox[0])*3,(refbox[3]-refbox[1])*3),Image.Resampling.LANCZOS)
    right=runtime.crop(runbox).resize(left.size,Image.Resampling.LANCZOS)
    sheet=Image.new('RGB',(left.width*2,left.height+48),'#f1eee5')
    sheet.paste(left,(0,48));sheet.paste(right,(left.width,48))
    draw=ImageDraw.Draw(sheet)
    draw.text((14,10),'REFERENCE A  |  '+title,font=font,fill='#17383d')
    draw.text((left.width+14,10),'ACTUAL /garden-test  |  '+title,font=font,fill='#17383d')
    sheet.save(OUT/name,optimize=True)

def worldbox(box):
    return (round(left+box[0]*scale),round(top+box[1]*scale),
            round(left+box[2]*scale),round(top+box[3]*scale))
panel_pair(worldbox((1445,400,1845,660)),worldbox((1470,425,1870,685)),
           '02_B02_reference_vs_runtime.png','Central → Land06')
panel_pair(worldbox((1365,835,1755,1145)),worldbox((1445,780,1835,1090)),
           '03_ST01_reference_vs_runtime.png','Central → Land08')

dbg=runtime.copy();draw=ImageDraw.Draw(dbg)
def wp(point): return (round(left+point[0]*scale),round(top+point[1]*scale))
def contour(id,color):
    alpha=np.asarray(garden.transform_land(id).getchannel('A'))
    contours,_=cv2.findContours((alpha>16).astype('uint8'),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    for c in contours:
        if cv2.contourArea(c)<100:continue
        pts=[wp((int(p[0][0]),int(p[0][1]))) for p in c[::max(1,len(c)//500)]]
        if len(pts)>2:draw.line(pts+[pts[0]],fill=color,width=3)
contour('central','#15ffff')
contour('0405','#ff38b2')
contour('06','#a6ff48')
bounds=info['bounds'];draw.rectangle((wp(bounds[:2]),wp(bounds[2:])),outline='#ffdf33',width=3)
a=wp(info['start']);b=wp(info['end'])
draw.line((a,b),fill='#ffffff',width=4)
for p,label in ((a,'START · CENTRAL'),(b,'END · LAND06')):
    draw.ellipse((p[0]-6,p[1]-6,p[0]+6,p[1]+6),fill='#ffffff',outline='#15343c',width=2)
    draw.text((p[0]+10,p[1]+8),label,font=font,fill='white',stroke_width=3,stroke_fill='#17343d')
draw.rectangle((10,H-128,W-10,H-8),fill='#102c34')
draw.text((25,H-118),'B02 GEOMETRY · cyan Central · magenta Land0405 · lime Land06 · yellow bridge bounds',font=font,fill='white')
draw.text((25,H-88),f"Central path contact: {info['central_path_pixels_19px']} px    Land06 path contact: {info['land06_path_pixels_19px']} px",font=font,fill='white')
draw.text((25,H-58),f"Land0405 overlap: {info['bridge_0405_alpha_overlap']} px    Land0405 + 7 px shoreline buffer: {info['bridge_0405_7px_clearance_overlap']} px",font=font,fill='#a6ff48')
dbg.save(OUT/'01_B02_geometry_debug.png',optimize=True)
print('created',[(p.name,Image.open(p).size) for p in OUT.glob('0*.png')])
