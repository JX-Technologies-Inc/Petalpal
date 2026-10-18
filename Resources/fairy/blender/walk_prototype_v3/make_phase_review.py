from pathlib import Path
from PIL import Image,ImageDraw
import json,numpy as np
p=Path(__file__).resolve().parent
names=['Left Contact','Left Down','Left Passing','Left Up','Right Contact','Right Down','Right Passing','Right Up'];m=json.loads((p/'motion_samples.json').read_text());sheet=Image.new('RGB',(8*360,540),'#687582');d=ImageDraw.Draw(sheet)
for i,n in enumerate(names):
 f=1+3*i;im=Image.open(p/'frames'/f'walk_{f:03d}.png');thumb=im.resize((360,360),Image.Resampling.LANCZOS);sheet.paste(thumb,(360*i,35),thumb);d.text((360*i+10,10),n,fill='white')
 for side,col in [('left','#7be3ff'),('right','#ffcf79')]:
  x,y=m[f-1]['legs'][side]['evaluated_ankle'];x=360*i+x*360/1254;y=35+y*360/1254;d.ellipse((x-3,y-3,x+3,y+3),fill=col)
 crop=im.crop((510,800,815,1210));crop.thumbnail((100,135));sheet.paste(crop,(360*i+125,400),crop)
 d.text((360*i+8,405),'L = cyan\nR = gold',fill='white')
sheet.save(p/'review/eight_gait_phases.png')
# World travel proof: fixed camera, three continuous cycles on a neutral canvas.
frames=[]
for cycle in range(3):
 for j in range(24):
  im=Image.open(p/'frames'/f'walk_{j+1:03d}.png');im=im.resize((376,376),Image.Resampling.LANCZOS);c=Image.new('RGB',(850,420),'#687582');dd=ImageDraw.Draw(c)
  dd.text((10,10),'Fixed camera - root travel, 3 cycles',fill='white');dd.line((0,379,850,379),fill='#8998a5')
  for x in range(0,850,30):dd.line((x,379,x,386),fill='#8998a5')
  c.paste(im,(round(30+(cycle*280+j*(280/24))*.3),25),im);frames.append(c)
frames[0].save(p/'review/world_travel_preview.gif',save_all=True,append_images=frames[1:],duration=[60,60,60,70]*18,loop=0)
