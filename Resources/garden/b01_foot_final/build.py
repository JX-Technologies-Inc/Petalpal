from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image,ImageDraw,ImageChops
# The crop is anchored to the original world, not to a moved bridge or road.
origin=(1550,1360);size=(175,195)
im=Image.open(OUT/'source/generated.png').convert('RGBA').resize((700,780),Image.Resampling.LANCZOS)
# Local masonry plus small irregular edge pockets; no oval or rectangular pad mask.
poly=[(47,54),(55,46),(75,64),(106,94),(120,112),(114,124),(109,130),(107,138),(98,145),(87,141),(75,136),(61,132),(47,125),(39,114),(33,104),(31,96),(29,90),(34,82),(33,75),(40,68)]
mask=Image.new('L',im.size);ImageDraw.Draw(mask).polygon([(x*4,y*4) for x,y in poly],fill=255)
im.putalpha(mask);im=im.resize(size,Image.Resampling.LANCZOS)
world=Image.new('RGBA',(2400,1800));world.alpha_composite(im,origin)
world.save(OUT/'source/paving-underlap.png')
# The original bridge's alpha acts as foreground occlusion. All opaque deck,
# posts and bridge flower pixels remain untouched; paving continues behind them.
bridge=Image.open(ROOT/'mobile/assets/garden/infrastructure/final/B01_bridge.png').convert('RGBA')
world.putalpha(ImageChops.multiply(world.getchannel('A'),ImageChops.invert(bridge.getchannel('A'))))
world.save(OUT/'source/b01-foot-landing.png')
world.save(ROOT/'mobile/assets/garden/infrastructure/entrance-connections/b01-foot-landing.png')
print('Updated only B01 local landing bitmap.')
