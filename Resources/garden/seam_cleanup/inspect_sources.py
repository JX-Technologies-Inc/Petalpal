from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
sys.path.insert(0,str(ROOT/'Resources/garden/infrastructure_candidate'))
sys.path.insert(0,str(ROOT/'Resources/garden/bridge_reference_correction'))
from PIL import Image,ImageDraw
import build_candidate as garden
from build_bridge_correction import existing_road_world
OUT=Path(__file__).resolve().parent
road=existing_road_world()
base=Image.new('RGBA',(2400,1800),'#55a8af')
for id in ('central','0405','06','08','09','101112'):base.alpha_composite(garden.transform_land(id))
base.alpha_composite(road)
for name,box in [('entrance',(1500,1380,1750,1620)),('west',(650,650,920,820)),('upper',(1250,340,1460,480)),('lower',(1130,900,1310,1120)),('entrance09',(1310,1370,1530,1545)),('st01central',(1400,760,1590,960)),('st01land08',(1750,960,1920,1120))]:
 crop=base.crop(box).resize(((box[2]-box[0])*3,(box[3]-box[1])*3))
 draw=ImageDraw.Draw(crop)
 for x in range((box[0]//20+1)*20,box[2],20):draw.text(((x-box[0])*3,0),str(x),fill='red')
 for y in range((box[1]//20+1)*20,box[3],20):draw.text((0,(y-box[1])*3),str(y),fill='red')
 crop.save(OUT/(name+'_source.png'))
