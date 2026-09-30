from pathlib import Path
import sys,json
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'Resources/road/.tools'))
from PIL import Image,ImageDraw,ImageChops
world=(2400,1800)
runtime=ROOT/'mobile/assets/garden/infrastructure/entrance-connections';runtime.mkdir(exist_ok=True)
def layer(name,size,origin,polygons):
    im=Image.open(OUT/f'source/{name}_generated.png').convert('RGBA').resize((size[0]*4,size[1]*4),Image.Resampling.LANCZOS)
    mask=Image.new('L',im.size);d=ImageDraw.Draw(mask)
    for poly in polygons:d.polygon([(round(x*4),round(y*4)) for x,y in poly],fill=255)
    im.putalpha(mask);im=im.resize(size,Image.Resampling.LANCZOS)
    result=Image.new('RGBA',world);result.alpha_composite(im,origin)
    return result
land=layer('land09',(220,190),(1320,1365),[
 [(40,61),(62,47),(78,47),(94,56),(112,69),(129,87),(139,105),(150,115),(155,124),(166,136),(174,144),(166,158),(151,158),(138,148),(120,143),(99,133),(79,123),(65,108),(48,100),(39,88),(29,78)],
 [(88,34),(98,37),(108,48),(113,59),(104,68),(97,63),(91,52)],
 [(65,119),(76,120),(84,127),(98,137),(93,145),(83,144),(76,133),(68,132)]
])
b01=layer('b01',(160,170),(1555,1370),[
 [(42,48),(50,41),(62,63),(110,100),(111,116),(102,128),(96,138),(80,130),(68,118),(49,112),(34,106),(28,96),(23,85),(26,69),(34,59)]
])
# Preserve every original bridge pixel. New landing is occluded by the existing bridge.
bridge=Image.open(ROOT/'mobile/assets/garden/infrastructure/final/B01_bridge.png').convert('RGBA')
b01.putalpha(ImageChops.multiply(b01.getchannel('A'),ImageChops.invert(bridge.getchannel('A'))))
for name,im in [('land09-transition',land),('b01-foot-landing',b01)]:
    im.save(OUT/f'source/{name}.png');im.save(runtime/f'{name}.png')
# Construction preview, never used as live runtime evidence.
context=Image.open(ROOT/'Resources/garden/main_entrance_v2/source/context_v2.png').convert('RGBA')
for im in (land,b01):context.alpha_composite(im.crop((1260,1300,1940,1800)),(0,0))
# Render unchanged landmark over local construction artwork.
arch=Image.open(ROOT/'mobile/assets/garden/landmarks/garden-arch.png').convert('RGBA').resize((394,360),Image.Resampling.LANCZOS).rotate(6,Image.Resampling.BICUBIC,expand=True)
context.alpha_composite(arch,(1380-(arch.width-394)//2-1260,1450-(arch.height-360)//2-1300))
context.crop((20,40,470,280)).resize((1350,720)).save(OUT/'source/construction-preview.png')
print('Built two local transparent overlays.')
