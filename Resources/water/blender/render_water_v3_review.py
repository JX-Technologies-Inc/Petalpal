"""Render V3 review frames and temporary mask diagnostics without saving edits."""
import bpy, os

root=os.path.dirname(bpy.data.filepath)
review=os.path.join(root,'review_v3')
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.image_settings.file_format='PNG'
scene.render.resolution_percentage=100
scene.render.resolution_x=1200
scene.render.resolution_y=900
overlay=bpy.data.collections['V2 Garden Review Overlay']
for o in overlay.objects:o.hide_render=False

material=bpy.data.objects['Plane'].active_material
nodes=material.node_tree.nodes
links=material.node_tree.links
nodes['V3 Shore Strength 0.22'].inputs[1].default_value=0.95
nodes['V3 Depth Strength 0.30'].inputs[1].default_value=0.95
emission=nodes.new('ShaderNodeEmission')
emission.name='TEMP V3 Mask Diagnostic Only'
links.new(nodes['V3 Static Shallow Color'].outputs['Result'],emission.inputs['Color'])
links.new(emission.outputs[0],nodes['Material Output'].inputs['Surface'])
for frame in (1,192):
 scene.frame_set(frame)
 scene.render.filepath=os.path.join(review,f'_mask_debug_frame_{frame:03d}.png')
 bpy.ops.render.render(write_still=True)
links.new(nodes['Principled BSDF'].outputs['BSDF'],nodes['Material Output'].inputs['Surface'])
nodes.remove(emission)
nodes['V3 Shore Strength 0.22'].inputs[1].default_value=0.22
nodes['V3 Depth Strength 0.30'].inputs[1].default_value=0.30

scene.render.resolution_x=640
scene.render.resolution_y=480
scene.render.filepath=os.path.join(review,'_frames_garden','water_')
os.makedirs(os.path.dirname(scene.render.filepath),exist_ok=True)
bpy.ops.render.render(animation=True)
for o in overlay.objects:o.hide_render=True
scene.render.filepath=os.path.join(review,'_frames_water','water_')
os.makedirs(os.path.dirname(scene.render.filepath),exist_ok=True)
bpy.ops.render.render(animation=True)
