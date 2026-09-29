"""Limit remaining long V4 highlight groups without dimming short marks."""
import bpy, os

scene=bpy.context.scene
root=os.path.dirname(bpy.data.filepath)
review=os.path.join(root,'review_v4')
nodes=bpy.data.objects['Plane'].active_material.node_tree.nodes
nodes['V4 Short Segment Mask'].color_ramp.elements[0].position=0.50
nodes['V4 Short Segment Mask'].color_ramp.elements[1].position=0.64
nodes['Noise Texture.003'].inputs['Scale'].default_value=3.2
nodes['V4 Cross Group Noise'].inputs['Scale'].default_value=2.9
scene.frame_set(96)
scene.render.resolution_x=1200
scene.render.resolution_y=900
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
scene.render.filepath=os.path.join(review,'_test_garden_v4e.png')
bpy.ops.render.render(write_still=True)
