import bpy,os
from mathutils import Vector
s=bpy.context.scene;w=bpy.data.objects['Plane'];cam=s.camera
for o in bpy.data.collections['V2 Garden Review Overlay'].objects:o.hide_render=True
s.frame_set(96);s.render.engine='BLENDER_EEVEE';s.render.image_settings.file_format='PNG'
s.render.resolution_percentage=100;s.render.resolution_x=1200;s.render.resolution_y=900
cam.data.type='ORTHO';cam.data.ortho_scale=12.0;cam.location=w.location+Vector((0,0,25));cam.rotation_euler=(0,0,0)
s.render.filepath=os.path.join(os.path.dirname(bpy.data.filepath),'review_v5','_test_water_only.png')
bpy.ops.render.render(write_still=True)
