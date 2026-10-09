"""Side by side, identical full Garden crop: V4 left and V5 right."""
import bpy,os,numpy as np
root=os.path.dirname(bpy.data.filepath)
paths=[os.path.join(root,'review_v4','water_v4_garden_still.png'),os.path.join(root,'review_v5','water_v5_garden_still.png')]
halves=[]
for p in paths:
 im=bpy.data.images.load(p,check_existing=False);im.scale(1200,900)
 a=np.empty(1200*900*4,dtype=np.float32);im.pixels.foreach_get(a);halves.append(a.reshape(900,1200,4))
o=np.concatenate(halves,axis=1)
out=bpy.data.images.new('V4 vs V5 Garden',width=2400,height=900,alpha=True)
out.pixels.foreach_set(o.ravel());out.filepath_raw=os.path.join(root,'review_v5','water_v4_vs_v5.png');out.file_format='PNG';out.save()
