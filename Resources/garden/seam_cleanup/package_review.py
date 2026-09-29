from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image,ImageDraw,ImageFont
OUT=Path(__file__).resolve().parent
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',25)
ims={(stage,key):Image.open(OUT/(stage+'_'+key+'.png')).convert('RGB') for stage in ('before','after') for key in ('full','b01','b02','st01','west','upper','lower')}
ims['after','full'].save(OUT/'01_seam_cleaned_runtime.png')
def sheet(items,cols,cell,name):
 w,h=cell;result=Image.new('RGB',(cols*w,((len(items)+cols-1)//cols)*(h+52)),(235,233,222));d=ImageDraw.Draw(result)
 for i,(label,stage,key,box) in enumerate(items):
  x=i%cols*w;y=i//cols*(h+52)
  d.text((x+18,y+12),label,font=font,fill=(45,51,42))
  crop=ims[stage,key].crop(box);s=min((w-24)/crop.width,(h-12)/crop.height)
  crop=crop.resize((round(crop.width*s),round(crop.height*s)),Image.Resampling.LANCZOS)
  result.paste(crop,(x+(w-crop.width)//2,y+52+(h-crop.height)//2))
 result.save(OUT/name)
b01=(425,385,635,605)
sheet([('BEFORE — B01 entrance','before','b01',b01),('AFTER — B01 entrance','after','b01',b01)],2,(750,720),'02_B01_entrance_before_after.png')
feet=[('B02 / Central','b02',(420,310,615,505)),('B02 / Land06','b02',(665,230,870,435)),('ST01 / Central','st01',(330,175,585,445)),('ST01 / Land08','st01',(735,355,995,635))]
sheet([(label,'after',key,box) for label,key,box in feet[:2]],2,(750,650),'03_B02_feet_final.png')
sheet([(label,'after',key,box) for label,key,box in feet[2:]],2,(750,700),'04_ST01_feet_final.png')
roads=[('West paths–Central','west',(495,290,795,470)),('Central–Land0405','upper',(545,295,800,490)),('Central–Land09','lower',(595,260,825,475)),('Land09–Main Entrance','b01',(175,390,435,625))]
sheet([(stage.upper()+' — '+label,stage,key,box) for label,key,box in roads for stage in ('before','after')],2,(900,610),'05_Road_junctions_before_after.png')
allfeet=[('B01 / Entrance','b01',b01),('B01 / Land08','b01',(625,225,835,445)),*feet,*roads]
sheet([(label,'after',key,box) for label,key,box in allfeet],2,(900,660),'06_FINAL_ALL_JUNCTIONS.png')
hashes=json.loads((OUT/'locked_hashes.json').read_text());assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in hashes.items())
(OUT/'README.md').write_text('''# Final seam cleanup review

All six review images are screenshots or crops of the actual localhost:8082/garden-test runtime. Before and after use identical camera focus settings and crop boxes. Contact-sheet captions sit outside the artwork. Crops are enlarged for inspection; the scene is not reconstructed offline.

## Changes

- B01 entrance: locally reused existing Main Entrance paving and vegetation edges, layered beneath and selectively over the locked wooden foot. Original Land08 foreground retained.
- B02: subpixel feather of the existing foreground mask only.
- ST01: expanded original, world-aligned receiving-path occlusion to seat exposed attachments. The approved master and placed stair image are unchanged.
- Four Road junctions: reused nearby existing paving in the accepted Road footprints, blended slab rhythm/color into the existing surfaces, and softened immediate entry edges. Land09/Main Entrance uses a short local transition; its master is unchanged.

All changes live in separate transparent seam layers. No bridge, stair, Land, or stepping-stone transforms changed. Water and source artwork were not edited. Infrastructure ON/OFF is preserved. TypeScript passed; visual inspection used the live runtime. See locked_hashes.json and verification.json for source preservation checks.
''',encoding='utf-8')
print('Six runtime review outputs saved; all locked hashes match')
