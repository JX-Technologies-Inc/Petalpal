import bpy,os
from mathutils import Vector
f=bpy.data.filepath;s=bpy.context.scene;n=bpy.data.objects['Plane'].active_material.node_tree.nodes
source=n['Principled BSDF'].inputs['Base Color'].links[0].from_node.name
assert source=='V5 Hidden Land Water Fill',source
assert len([x for x in n if x.name.startswith('V4 ')])>10
assert s.frame_start==1 and s.frame_end==192 and s.render.fps==24
for name in ('V5 Painterly Water Overlay','V5 Static Water Area Clip'):
 im=n[name].image;assert tuple(im.size)==(2400,1800)
 assert os.path.exists(bpy.path.abspath(im.filepath))
print('V5_BLEND',os.path.basename(f),'FRAME_RANGE',s.frame_start,s.frame_end,'FPS',s.render.fps,'COLOR_SOURCE',source)
print('V5_IMAGE_PATH',n['V5 Painterly Water Overlay'].image.filepath)
print('V5_DRIFT',tuple(n['V5 Tiny Overlay Drift'].inputs[1].default_value),'NOISE_W',n['V5 Slow Distortion Field'].inputs['W'].default_value)
