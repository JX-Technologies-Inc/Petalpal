"""Shorten V4 highlight strokes and improve readable shoreline separation."""
import bpy, os

scene=bpy.context.scene
root=os.path.dirname(bpy.data.filepath)
review=os.path.join(root,'review_v4')
nodes=bpy.data.objects['Plane'].active_material.node_tree.nodes
links=bpy.data.objects['Plane'].active_material.node_tree.links
nodes['V4 Shore Strength 0.55'].name='V4 Shore Strength 0.78'
nodes['V4 Shore Strength 0.78'].inputs[1].default_value=0.78
nodes['V4 Local Shallow Accent 0.12'].name='V4 Local Shallow Accent 0.18'
nodes['V4 Local Shallow Accent 0.18'].inputs[1].default_value=0.18

noise=nodes.new('ShaderNodeTexNoise')
noise.name='V4 Short Segment Noise'
noise.inputs['Scale'].default_value=30.0
noise.inputs['Detail'].default_value=2.0
noise.inputs['Roughness'].default_value=0.36
noise.location=(-800,-300)
links.new(nodes['V2 Slow Mask Drift'].outputs['Vector'],noise.inputs['Vector'])
ramp=nodes.new('ShaderNodeValToRGB')
ramp.name='V4 Short Segment Mask'
ramp.color_ramp.elements[0].position=0.53
ramp.color_ramp.elements[1].position=0.67
ramp.location=(-580,-300)
links.new(noise.outputs['Fac'],ramp.inputs['Fac'])
short=nodes.new('ShaderNodeMath')
short.name='V4 Segment Limited Strokes'
short.operation='MULTIPLY'
short.location=(800,330)
links.new(nodes['V4 Broken Short Strokes'].outputs[0],short.inputs[0])
links.new(ramp.outputs['Color'],short.inputs[1])
links.new(short.outputs[0],nodes['V4 Painterly Stroke Strength 0.78'].inputs[0])
peak=nodes.new('ShaderNodeMath')
peak.name='V4 Segment Limited Peaks'
peak.operation='MULTIPLY'
peak.location=(820,-360)
links.new(nodes['V4 Tiny Peaks Broken'].outputs[0],peak.inputs[0])
links.new(ramp.outputs['Color'],peak.inputs[1])
links.new(peak.outputs[0],nodes['V4 Tiny Peak Strength 0.09'].inputs[0])

scene.frame_set(96)
scene.render.resolution_x=1200
scene.render.resolution_y=900
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
scene.render.filepath=os.path.join(review,'_test_garden_v4b.png')
bpy.ops.render.render(write_still=True)
for o in bpy.data.collections['V2 Garden Review Overlay'].objects:o.hide_render=True
scene.render.filepath=os.path.join(review,'_test_water_v4b.png')
bpy.ops.render.render(write_still=True)
