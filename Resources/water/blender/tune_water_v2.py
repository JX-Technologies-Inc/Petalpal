import bpy, os
scene=bpy.context.scene
root=os.path.dirname(bpy.data.filepath)
review=os.path.join(root,'review_v2')
water=bpy.data.objects['Plane']
nodes=water.active_material.node_tree.nodes
nodes['V2 Subtle Depth Blend'].inputs['Factor'].default_value=0.62
scene.frame_set(96)
scene.render.resolution_x=960
scene.render.resolution_y=720
scene.render.image_settings.file_format='PNG'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
scene.render.filepath=os.path.join(review,'water_review_v2_still.png')
bpy.ops.render.render(write_still=True)
camera=scene.camera
camera.data.ortho_scale=6
scene.render.filepath=os.path.join(review,'water_review_v2_closeup.png')
bpy.ops.render.render(write_still=True)
camera.data.ortho_scale=12
overlay=bpy.data.collections['V2 Garden Review Overlay']
for o in overlay.objects:o.hide_render=True
scene.render.filepath=os.path.join(review,'water_review_v2_water_only.png')
bpy.ops.render.render(write_still=True)
for o in overlay.objects:o.hide_render=False
scene.render.resolution_x=480
scene.render.resolution_y=360
scene.render.filepath=os.path.join(review,'frames','water_')
bpy.ops.render.render(animation=True)
scene.frame_set(96)
scene.render.resolution_x=960
scene.render.resolution_y=720
scene.render.filepath=''
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
