"""Render Garden context, diagnostic stills, and 192-frame V5 review passes."""
import bpy,os
from mathutils import Vector
root=os.path.dirname(bpy.data.filepath);review=os.path.join(root,'review_v5');os.makedirs(review,exist_ok=True)
s=bpy.context.scene;w=bpy.data.objects['Plane'];cam=s.camera;garden=bpy.data.collections['V2 Garden Review Overlay']
s.render.engine='BLENDER_EEVEE';s.render.image_settings.file_format='PNG';s.render.resolution_percentage=100
s.frame_start=1;s.frame_end=192;s.render.fps=24;s.frame_set(96)
cam.data.type='ORTHO';cam.data.ortho_scale=12.0;cam.location=w.location+Vector((0,0,25));cam.rotation_euler=(0,0,0)
def show(v):
 for obj in garden.objects:obj.hide_render=not v
def still(name,sw,sh):
 s.render.resolution_x=sw;s.render.resolution_y=sh;s.render.filepath=os.path.join(review,name);bpy.ops.render.render(write_still=True)
show(True);still('water_v5_garden_still.png',2400,1800)
show(False);still('water_v5_water_only.png',2400,1800)
show(True);cam.data.ortho_scale=5.0;cam.location=w.location+Vector(((600-1200)/150,(900-1450)/150,25))
still('water_v5_closeup.png',1600,1200)
cam.data.ortho_scale=12.0;cam.location=w.location+Vector((0,0,25))
s.render.resolution_x=960;s.render.resolution_y=720
for garden_visible,folder in ((True,'_frames_garden'),(False,'_frames_water')):
 show(garden_visible);target=os.path.join(review,folder);os.makedirs(target,exist_ok=True)
 s.render.filepath=os.path.join(target,'water_');bpy.ops.render.render(animation=True)
show(True);s.frame_set(96);s.render.resolution_x=2400;s.render.resolution_y=1800;s.render.filepath=''
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
