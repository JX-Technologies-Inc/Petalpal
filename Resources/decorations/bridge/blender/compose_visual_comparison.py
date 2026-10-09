"""Make a review layout from existing images; never saves either input image."""
import bpy, hashlib
from pathlib import Path
from array import array
HERE=Path(__file__).resolve().parent
OUT=HERE.parent/'visual_review'
reference=HERE.parent/'bridge-main.png'
before=hashlib.sha256(reference.read_bytes()).hexdigest()
W,H=3200,1200
# Linear-light soft neutral background; left = authority, right = Blender review.
pixels=array('f',[.24,.26,.24,1])*(W*H)
for column,path in enumerate([reference,OUT/'three_quarter.png']):
 image=bpy.data.images.load(str(path),check_existing=False)
 w,h=image.size
 scale=min(1600/w,1200/h)
 w,h=round(w*scale),round(h*scale)
 image.scale(w,h)
 src=array('f',[0])*(w*h*4);image.pixels.foreach_get(src)
 ox=column*1600+(1600-w)//2;oy=(1200-h)//2
 for y in range(h):
  for x in range(w):
   si=(y*w+x)*4;di=((oy+y)*W+ox+x)*4;a=src[si+3]
   for c in range(3):pixels[di+c]=src[si+c]*a+pixels[di+c]*(1-a)
 image.user_clear();bpy.data.images.remove(image)
output=bpy.data.images.new('Reference LEFT - visual pass RIGHT',width=W,height=H,alpha=True,float_buffer=True)
output.pixels.foreach_set(pixels)
scene=bpy.context.scene
scene.view_settings.view_transform='Standard'
scene.view_settings.look='None'
scene.view_settings.exposure=0
scene.view_settings.gamma=1
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
output.save_render(str(OUT/'reference_comparison.png'),scene=scene)
assert hashlib.sha256(reference.read_bytes()).hexdigest()==before
print('COMPARISON_COMPLETE',flush=True)
