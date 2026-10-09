from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image,ImageDraw,ImageFont
OUT=Path(__file__).resolve().parent
ims={k:Image.open(OUT/f).convert('RGB') for k,f in [('full','01_full_raw.png'),('b01','02_B01_raw.png'),('b02','03_B02_raw.png'),('st01','04_ST01_raw.png'),('west','05_Road_raw.png'),('upper','upper_raw.png'),('lower','lower_raw.png')]}
ims['full'].save(OUT/'01_final_garden_runtime.png')
for key,name,box in [('b01','02_B01_final_connections.png',(390,225,830,570)),('b02','03_B02_final_connections.png',(420,245,865,510)),('st01','04_ST01_final_connections.png',(335,175,1000,650))]:
 im=ims[key].crop(box);im.resize((im.width*2,im.height*2),Image.Resampling.LANCZOS).save(OUT/name)
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',22)
def sheet(items,cols,cell,name):
 w,h=cell;rows=(len(items)+cols-1)//cols
 im=Image.new('RGB',(cols*w,rows*(h+48)),(233,231,218));draw=ImageDraw.Draw(im)
 for i,(title,key,box) in enumerate(items):
  x=(i%cols)*w;y=(i//cols)*(h+48)
  draw.text((x+15,y+10),title,font=font,fill=(46,53,43))
  crop=ims[key].crop(box);factor=min((w-20)/crop.width,(h-10)/crop.height)
  crop=crop.resize((round(crop.width*factor),round(crop.height*factor)),Image.Resampling.LANCZOS)
  # All pixels below each caption come solely from the live runtime capture.
  im.paste(crop,(x+(w-crop.width)//2,y+48+(h-crop.height)//2))
 im.save(OUT/name)
roads=[('West paths – Central','west',(505,300,790,465)),('Central – Land0405','upper',(550,300,790,490)),('Central – Land09','lower',(600,265,815,470)),('Land09 – Main Entrance','b01',(175,395,425,615))]
sheet(roads,2,(600,390),'05_Road_final_connections.png')
contacts=[
 ('B01 / Entrance','b01',(420,390,625,585)),('B01 / Land08','b01',(630,230,830,440)),
 ('B02 / Central','b02',(425,315,615,505)),('B02 / Land06','b02',(670,235,865,425)),
 ('ST01 / Central','st01',(335,185,580,435)),('ST01 / Land08','st01',(735,360,975,620)),
 *roads]
sheet(contacts,2,(620,360),'06_all_connections_contact_sheet.png')
meta=json.loads((OUT/'placement.json').read_text())
checks={p:hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in meta['protectedHashes'].items()}
assert all(checks.values()),checks
(OUT/'verification.json').write_text(json.dumps({'protectedAssetHashesMatch':checks,'captureSource':'Actual localhost:8082/garden-test; camera-only DEV focus controls; screenshots cropped, no offline scene reconstruction','typeScript':'npx tsc --noEmit passed','infrastructureToggle':'OFF and ON verified; restored ON','sourceMasterRegenerated':False},indent=2))
print('Six final review PNGs generated; locked source hashes verified')
