"""Review exports from actual /garden-test captures; no offline scene reconstruction."""
from pathlib import Path
import sys,json
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image,ImageDraw,ImageFont
OUT=Path(__file__).resolve().parent
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',26)
small=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',18)
ims={k:Image.open(OUT/f'runtime_{k}.png').convert('RGB') for k in
 ('full','treehouse','west','upper','lower','entrance','medium_entrance','medium_west','medium_upper','medium_lower')}
ims['full'].save(OUT/'01_complete_road_runtime.png')
clean=ims['full'].crop((190,63,1105,720))
clean.save(OUT/'10_complete_circulation_clean.png')
def sheet(items,columns,cell,name):
 w,h=cell;result=Image.new('RGB',(columns*w,((len(items)+columns-1)//columns)*(h+56)),(235,233,222));d=ImageDraw.Draw(result)
 for i,(label,crop) in enumerate(items):
  x=i%columns*w;y=i//columns*(h+56)
  d.text((x+18,y+13),label,font=font,fill=(43,51,44))
  s=min((w-24)/crop.width,(h-20)/crop.height)
  crop=crop.resize((round(crop.width*s),round(crop.height*s)),Image.Resampling.LANCZOS)
  result.paste(crop,(x+(w-crop.width)//2,y+56+(h-crop.height)//2))
 result.save(OUT/name)
reference=Image.open(ROOT/'Resources/structure-final-version.png').convert('RGB')
sheet([('Reference B — authoritative visual target',reference),('Actual /garden-test — complete circulation',clean)],2,(1100,830),'02_referenceB_vs_runtime.png')
boxes={
 'treehouse':(440,250,845,530),
 'west':(450,270,835,490),
 'upper':(480,265,860,510),
 'lower':(540,230,875,480),
 'entrance':(440,245,930,555),
}
names=['05_treehouse_road_closeup.png','06_west_central_road_closeup.png','07_central_land0405_closeup.png','08_central_land09_closeup.png','09_land09_entrance_closeup.png']
labels=['R01 / Treehouse → western path — both endpoints','R02 / West → Central — both endpoints','R03 / Central → Land0405 — both endpoints','R04 / Central → Land09 — both endpoints','R05 / Land09 → Entrance — both endpoints']
items=[]
for (key,box),name,label in zip(boxes.items(),names,labels):
 crop=ims[key].crop(box)
 crop.resize((crop.width*3,crop.height*3),Image.Resampling.LANCZOS).save(OUT/name)
 items.append((label,crop))
items.append(('R06 / Existing entrance stem and branch junction',ims['medium_entrance'].crop((560,310,885,715))))
sheet(items,2,(950,560),'04_all_road_junctions.png')
overlay=ims['full'].copy();d=ImageDraw.Draw(overlay)
# Actual runtime reset-view projection: world fit 657/1800, centered in 1280x657.
fit=657/1800;bx=(1280-2400*fit)/2;by=63
project=lambda p:(round(bx+p[0]*fit),round(by+p[1]*fit))
routes={
 'R01':[(703,433),(687,469),(653,501),(604,531),(556,529)],
 'R02':[(718,724),(785,727),(826,735),(854,760)],
 'R03':[(1320,430),(1356,398),(1400,375)],
 'R04':[(1215,955),(1220,1018),(1230,1078)],
 'R05':[(1388,1450),(1490,1505)],
 'R06':[(1600,1520),(1600,1800)],
 'R07 / B02':[(1570,600),(1790,540)],
 'R08 / ST01':[(1490,860),(1840,1030)],
 'R09 / B01':[(1628,1442),(1830,1310)],
 'R10 / SS01':[(2186,900),(2170,937),(2148,970),(2126,1004),(2107,1035),(2086,1063)],
}
labelpos={'R01':(325,185),'R02':(350,335),'R03':(660,150),'R04':(555,445),'R05':(530,605),'R06':(835,678),
 'R07 / B02':(780,218),'R08 / ST01':(745,360),'R09 / B01':(815,525),'R10 / SS01':(1015,435)}
for key,pts in routes.items():
 color=(48,113,244) if '/' not in key else (170,78,196)
 points=[project(p) for p in pts];d.line(points,fill=color,width=4)
 for x,y in (points[0],points[-1]):d.ellipse((x-4,y-4,x+4,y+4),fill=color,outline='white',width=1)
 x,y=labelpos[key];box=d.textbbox((x,y),key,font=small)
 d.rounded_rectangle((box[0]-5,box[1]-3,box[2]+5,box[3]+3),radius=4,fill=(250,249,243))
 d.text((x,y),key,font=small,fill=color)
d.rectangle((0,0,1280,62),fill=(30,38,35))
d.text((18,17),'Road topology: blue = ground Road | purple = locked infrastructure crossing',font=font,fill='white')
overlay.save(OUT/'03_road_topology_overlay.png')
sheet([(f'Medium runtime / {key}',ims['medium_'+key].crop((0,110,1280,720))) for key in ('west','upper','lower','entrance')],2,(960,520),'QA_medium_views.png')
outputs=sorted(p.name for p in OUT.glob('*.png') if p.name[:2].isdigit())
assert len(outputs)==10,outputs
for name in outputs:
 with Image.open(OUT/name) as im:
  assert im.format=='PNG';im.verify()
(OUT/'review_outputs.json').write_text(json.dumps({'source':'Actual localhost:8082/garden-test browser screenshots',
 'normal_camera':{'zoom':1,'offset':[0,0]},'closeup_zoom':3,'medium_zoom':1.65,
 'clean_crop':[190,63,1105,720],'outputs':outputs,'note':'Captions and topology IDs appear only in review composites; no runtime debug artwork added.'},indent=2))
print('Created and decoded all ten requested review PNGs.')
