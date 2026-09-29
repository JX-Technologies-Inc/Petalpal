import bpy, math, os
from mathutils import Vector

root=os.path.dirname(bpy.data.filepath)
review=os.path.join(root,'review')
os.makedirs(review,exist_ok=True)
scene=bpy.context.scene
water=bpy.data.objects['Plane']
mat=water.active_material
center=water.location.copy()

# Keep the original plane, graph, and keyed Mapping coordinates intact.
camera=bpy.data.objects.get('WaterReviewCamera') or bpy.data.objects['Camera']
camera.name='WaterReviewCamera'
camera.data.type='ORTHO'
camera.data.ortho_scale=23.5
camera.location=center+Vector((0,-18,25.7))
direction=center-camera.location
camera.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
scene.camera=camera
light=bpy.data.objects['Light']
light.location=center+Vector((-4,-5,10))
light.data.type='AREA'
light.data.energy=2200
light.data.shape='DISK'
light.data.size=12
light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()

# The Garden image is a review reference, separate from the water shader.
garden=os.path.abspath(os.path.join(root,'../../..','output','garden-bridges','scene-local.png'))
img=bpy.data.images.load(garden,check_existing=True)
img.filepath=bpy.path.relpath(garden)
empty=bpy.data.objects.get('Garden_Reference')
if empty is None:
 empty=bpy.data.objects.new('Garden_Reference',None)
 bpy.context.collection.objects.link(empty)
empty.empty_display_type='IMAGE'
empty.data=img
empty.empty_display_size=8
empty.location=center+Vector((19,0,0))
empty.hide_render=True
empty['purpose']='Visual reference only. Not part of the water material or render.'

scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=640
scene.render.resolution_y=640
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(0.75,0.85,0.9,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=0.8
scene.view_settings.view_transform='AgX'
scene.frame_set(96)
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)

scene.render.filepath=os.path.join(review,'water_review_still.png')
bpy.ops.render.render(write_still=True)

camera.data.ortho_scale=9.5
scene.render.filepath=os.path.join(review,'water_review_closeup.png')
bpy.ops.render.render(write_still=True)
camera.data.ortho_scale=23.5

scene.render.resolution_x=384
scene.render.resolution_y=384
scene.render.image_settings.file_format='PNG'
scene.render.filepath=os.path.join(review,'frames','water_')
os.makedirs(os.path.dirname(scene.render.filepath),exist_ok=True)
bpy.ops.render.render(animation=True)

# Restore editable review settings without overwriting the initial backup.
scene.frame_set(96)
scene.render.resolution_x=640
scene.render.resolution_y=640
scene.render.image_settings.file_format='PNG'
scene.render.filepath=''
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
