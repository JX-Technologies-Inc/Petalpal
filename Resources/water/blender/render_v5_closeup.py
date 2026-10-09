import bpy,os
from mathutils import Vector
s=bpy.context.scene;w=bpy.data.objects['Plane'];cam=s.camera
for o in bpy.data.collections['V2 Garden Review Overlay'].objects:o.hide_render=False
s.frame_set(96);s.render.engine='BLENDER_EEVEE';s.render.image_settings.file_format='PNG'
s.render.resolution_percentage=100;s.render.resolution_x=1600;s.render.resolution_y=1200
cam.data.type='ORTHO';cam.data.ortho_scale=5.0
cam.location=w.location+Vector(((600-1200)/150,(900-1450)/150,25))
cam.rotation_euler=(0,0,0)
s.render.filepath=os.path.join(os.path.dirname(bpy.data.filepath),'review_v5','water_v5_closeup.png')
bpy.ops.render.render(write_still=True)
