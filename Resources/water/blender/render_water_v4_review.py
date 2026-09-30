"""Render the final full-world V4 stills and both 192-frame previews."""
import bpy, os
from mathutils import Vector

root=os.path.dirname(bpy.data.filepath)
review=os.path.join(root,'review_v4')
os.makedirs(review,exist_ok=True)
scene=bpy.context.scene
water=bpy.data.objects['Plane']
camera=scene.camera
overlay=bpy.data.collections['V2 Garden Review Overlay']
scene.render.engine='BLENDER_EEVEE'
scene.render.image_settings.file_format='PNG'
scene.render.resolution_percentage=100
scene.render.resolution_x=2400
scene.render.resolution_y=1800
scene.frame_start=1
scene.frame_end=192
scene.render.fps=24
scene.frame_set(96)
camera.data.type='ORTHO'
camera.data.ortho_scale=12.0
camera.location=water.location+Vector((0,0,25))
camera.rotation_euler=(0,0,0)
for o in overlay.objects:o.hide_render=False
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)

scene.render.filepath=os.path.join(review,'water_v4_garden_still.png')
bpy.ops.render.render(write_still=True)
for o in overlay.objects:o.hide_render=True
scene.render.filepath=os.path.join(review,'water_v4_water_only.png')
bpy.ops.render.render(write_still=True)
for o in overlay.objects:o.hide_render=False

# Close crop: same world axes, focusing on the left/central shoreline and
# adjacent open water where the stroke groups are visible.
camera.data.ortho_scale=5.0
camera.location=water.location+Vector(((750-1200)/150,(900-1125)/150,25))
scene.render.resolution_x=1600
scene.render.resolution_y=1200
scene.render.filepath=os.path.join(review,'water_v4_closeup.png')
bpy.ops.render.render(write_still=True)

camera.data.ortho_scale=12.0
camera.location=water.location+Vector((0,0,25))
scene.render.resolution_x=960
scene.render.resolution_y=720
scene.render.filepath=os.path.join(review,'_frames_garden','water_')
os.makedirs(os.path.dirname(scene.render.filepath),exist_ok=True)
bpy.ops.render.render(animation=True)
for o in overlay.objects:o.hide_render=True
scene.render.filepath=os.path.join(review,'_frames_water','water_')
os.makedirs(os.path.dirname(scene.render.filepath),exist_ok=True)
bpy.ops.render.render(animation=True)

for o in overlay.objects:o.hide_render=False
scene.frame_set(96)
scene.render.resolution_x=2400
scene.render.resolution_y=1800
scene.render.filepath=''
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
