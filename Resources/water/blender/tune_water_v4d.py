"""Increase V4 contrast after the first V3/V4 normal-scale comparison."""
import bpy, os

scene=bpy.context.scene
root=os.path.dirname(bpy.data.filepath)
review=os.path.join(root,'review_v4')
nodes=bpy.data.objects['Plane'].active_material.node_tree.nodes
links=bpy.data.objects['Plane'].active_material.node_tree.links

shore_map=nodes.new('ShaderNodeMapRange')
shore_map.name='V4 Visible Irregular Shore Response'
shore_map.clamp=True
shore_map.inputs['From Min'].default_value=0.06
shore_map.inputs['From Max'].default_value=0.60
shore_map.inputs['To Min'].default_value=0.0
shore_map.inputs['To Max'].default_value=1.0
shore_map.location=(-410,-1190)
links.new(nodes['V3 Shore Visual Mask Value'].outputs['Red'],shore_map.inputs['Value'])
links.new(shore_map.outputs['Result'],nodes['V4 Shore Strength 1.00'].inputs[0])
nodes['V4 Local Shallow Accent 0.25'].name='V4 Local Shallow Accent 0.45'
nodes['V4 Local Shallow Accent 0.45'].inputs[1].default_value=0.45
nodes['V4 Depth Strength 0.95'].name='V4 Depth Strength 1.00'
nodes['V4 Depth Strength 1.00'].inputs[1].default_value=1.0
nodes['V3 Deep Palette'].inputs['Factor'].default_value=0.45

stroke_gamma=nodes.new('ShaderNodeMath')
stroke_gamma.name='V4 Painterly Stroke Visibility'
stroke_gamma.operation='POWER'
stroke_gamma.inputs[1].default_value=0.58
stroke_gamma.location=(1000,350)
links.new(nodes['V4 Segment Limited Strokes'].outputs[0],stroke_gamma.inputs[0])
links.new(stroke_gamma.outputs[0],nodes['V4 Painterly Stroke Strength 0.95'].inputs[0])

scene.frame_set(96)
scene.render.resolution_x=1200
scene.render.resolution_y=900
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
scene.render.filepath=os.path.join(review,'_test_garden_v4d.png')
bpy.ops.render.render(write_still=True)
for o in bpy.data.collections['V2 Garden Review Overlay'].objects:o.hide_render=True
scene.render.filepath=os.path.join(review,'_test_water_v4d.png')
bpy.ops.render.render(write_still=True)
