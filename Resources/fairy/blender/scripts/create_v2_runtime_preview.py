"""Resample only the real V2 SE render at 96, 108 and 120 px body height."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont
base=Path(__file__).resolve().parents[2]
report_path=base/'review/fairy_v2_model_report.json'
report=json.loads(report_path.read_text(encoding='utf-8'))
render=Image.open(base/'review/fairy_v2_SE.png').convert('RGBA');assert render.size==(512,512)
canvas=Image.new('RGBA',(560,230),(236,233,232,255));draw=ImageDraw.Draw(canvas)
try:font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',12)
except OSError:font=ImageFont.load_default()
draw.text((16,12),'Fairy V2 / SE — runtime readability review',font=font,fill='#51465C')
for x,height in [(100,96),(280,108),(460,120)]:
    size=round(512*height/report['projected_nominal_body_height_512'])
    sprite=render.resize((size,size),Image.Resampling.LANCZOS)
    canvas.alpha_composite(sprite,(round(x-size*.5),round(176-size*.875)))
    label=f'{height} px';box=draw.textbbox((0,0),label,font=font)
    draw.text((x-(box[2]-box[0])/2,196),label,font=font,fill='#51465C')
canvas.save(base/'review/fairy_v2_SE_runtime_preview.png')
alpha=render.getchannel('A');bbox=alpha.getbbox()
report.update({'alpha_extrema':list(alpha.getextrema()),'visible_bounds_512':list(bbox),
               'transparent_padding_ltrb':[bbox[0],bbox[1],512-bbox[2],512-bbox[3]]})
assert alpha.getextrema()==(0,255)
assert min(report['transparent_padding_ltrb'])>=32
report_path.write_text(json.dumps(report,indent=2),encoding='utf-8')
print('V2 preview and alpha validation passed:',report['transparent_padding_ltrb'])
