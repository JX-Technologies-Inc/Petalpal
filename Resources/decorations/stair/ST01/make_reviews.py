from pathlib import Path
import sys,json
ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image,ImageDraw,ImageFont
OUT=Path(__file__).resolve().parent
master=Image.open(OUT/'ST01_master.png').convert('RGBA')
bridge=Image.open(ROOT/'Resources/decorations/bridge/rendered/bridge_entrance_to_right.png').convert('RGBA')
bg=(224,223,212,255)
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',32)
def cropped(im):return im.crop(im.getchannel('A').getbbox())
def fit(im,w,h):
 im=cropped(im);im.thumbnail((w,h),Image.Resampling.LANCZOS);return im
compare=Image.new('RGBA',(2400,1500),bg);d=ImageDraw.Draw(compare)
d.text((55,35),'APPROVED FLORAL BRIDGE',fill='#464A3D',font=font)
d.text((1255,35),'ST01 — STONE STAIR VARIANT',fill='#464A3D',font=font)
for im,x in [(bridge,0),(master,1200)]:
 im=fit(im,1120,1310);compare.alpha_composite(im,(x+(1200-im.width)//2,110+(1310-im.height)//2))
compare.convert('RGB').save(OUT/'ST01_bridge_family_compare.png')
sil=Image.new('RGBA',(1600,1700),bg);im=fit(master,1480,1570);sil.alpha_composite(im,((1600-im.width)//2,(1700-im.height)//2));sil.convert('RGB').save(OUT/'ST01_silhouette_preview.png')
# Native-resolution central detail includes consecutive treads and both floral rails.
detail=master.crop((530,540,1740,1740));base=Image.new('RGBA',detail.size,bg);base.alpha_composite(detail);base.convert('RGB').save(OUT/'ST01_detail.png')
assert master.getchannel('A').getextrema()==(0,255)
print(json.dumps({'master':master.size,'alphaBounds':master.getchannel('A').getbbox(),'outputs':[p.name for p in OUT.glob('*.png')]}))
