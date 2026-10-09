"""Final V4 visibility adjustment after Garden-scale visual inspection."""
import bpy, os

scene=bpy.context.scene
root=os.path.dirname(bpy.data.filepath)
review=os.path.join(root,'review_v4')
nodes=bpy.data.objects['Plane'].active_material.node_tree.nodes
nodes['V4 Shore Strength 0.78'].name='V4 Shore Strength 1.00'
nodes['V4 Shore Strength 1.00'].inputs[1].default_value=1.0
nodes['V4 Local Shallow Accent 0.18'].name='V4 Local Shallow Accent 0.25'
nodes['V4 Local Shallow Accent 0.25'].inputs[1].default_value=0.25
nodes['V4 Depth Strength 0.82'].name='V4 Depth Strength 0.95'
nodes['V4 Depth Strength 0.95'].inputs[1].default_value=0.95
nodes['V3 Deep Palette'].inputs['Factor'].default_value=0.36
nodes['V4 Short Segment Mask'].color_ramp.elements[0].position=0.43
nodes['V4 Short Segment Mask'].color_ramp.elements[1].position=0.60
nodes['V4 Painterly Stroke Strength 0.78'].name='V4 Painterly Stroke Strength 0.95'
nodes['V4 Painterly Stroke Strength 0.95'].inputs[1].default_value=0.95

scene.frame_set(96)
scene.render.resolution_x=1200
scene.render.resolution_y=900
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
scene.render.filepath=os.path.join(review,'_test_garden_v4c.png')
bpy.ops.render.render(write_still=True)
for o in bpy.data.collections['V2 Garden Review Overlay'].objects:o.hide_render=True
scene.render.filepath=os.path.join(review,'_test_water_v4c.png')
bpy.ops.render.render(write_still=True)
