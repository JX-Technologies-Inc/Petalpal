"""Scale the real Blender render only; does not touch the source character sheet.

Run with Python + Pillow after create_fairy_v1.py. No invented art or animation.
"""
from pathlib import Path
import math, json
from PIL import Image, ImageDraw, ImageFont

base=Path(__file__).resolve().parents[2]
source=base/'review'/'fairy_v1_SE.png'
render=Image.open(source).convert('RGBA')
assert render.size==(512,512)
# Fixed orthographic projection of nominal sole/crown, not the wing alpha bbox.
body_height=(.995*math.cos(math.radians(30))+.008*math.sin(math.radians(30)))*512/1.75
canvas=Image.new('RGBA',(420,210),(236,233,232,255))
draw=ImageDraw.Draw(canvas)
try: font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',12)
except OSError: font=ImageFont.load_default()
draw.text((16,12),'Fairy V1 / SE — same real render, no added shadow',font=font,fill='#51465C')
for x,height,label in [(110,64,'64 px: current spec target'),(310,104,'104 px: readability comparison')]:
    scale=height/body_height
    size=round(512*scale)
    sprite=render.resize((size,size),Image.Resampling.LANCZOS)
    # World-origin anchor consistently sits at y=157 on this review canvas.
    canvas.alpha_composite(sprite,(round(x-size*.5),round(157-size*.875)))
    box=draw.textbbox((0,0),label,font=font)
    draw.text((x-(box[2]-box[0])/2,175),label,font=font,fill='#51465C')
canvas.save(base/'review'/'fairy_v1_SE_runtime_preview.png')
report_path=base/'review'/'fairy_v1_model_report.json'
report=json.loads(report_path.read_text(encoding='utf-8'))
alpha=render.getchannel('A');bbox=alpha.getbbox()
report.update({'alpha_extrema':list(alpha.getextrema()),'visible_bounds_512':list(bbox),
               'transparent_padding_ltrb':[bbox[0],bbox[1],512-bbox[2],512-bbox[3]],
               'preview_body_heights_px':[64,104],'projected_nominal_body_height_512':body_height})
assert min(report['transparent_padding_ltrb'])>=32
assert alpha.getextrema()==(0,255)
report_path.write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
