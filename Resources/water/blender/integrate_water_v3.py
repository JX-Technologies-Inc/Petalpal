"""Add approved static Garden-space masks to the existing Water POC v2."""
import bpy, os
from mathutils import Vector

root=os.path.dirname(bpy.data.filepath)
project=os.path.abspath(os.path.join(root,'../../..'))
mask_dir=os.path.join(project,'Resources','water','masks')
review=os.path.join(root,'review_v3')
os.makedirs(review,exist_ok=True)
scene=bpy.context.scene
water=bpy.data.objects['Plane']
material=water.active_material
nodes=material.node_tree.nodes
links=material.node_tree.links

def lin(code):
 def channel(i):
  x=int(code[i:i+2],16)/255
  return x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4
 return (channel(1),channel(3),channel(5),1)

# The plane is 16 x 16 units. Its centered 16 x 12 camera crop is the
# authoritative 2400 x 1800 Garden canvas: x/2400 = U and y/1800 = 1-V.
# Existing plane V covers [-8,+8]; Garden image V covers only [-6,+6].
uv=nodes.new('ShaderNodeTexCoord')
uv.name='V3 Static Garden UV'
uv.label='STATIC Garden 2400 x 1800 UV'
uv.location=(-1500,-1650)
scale=nodes.new('ShaderNodeVectorMath')
scale.name='V3 Garden UV Scale'
scale.operation='MULTIPLY'
scale.inputs[1].default_value=(1,4/3,1)
scale.location=(-1270,-1650)
offset=nodes.new('ShaderNodeVectorMath')
offset.name='V3 Garden UV Offset'
offset.operation='ADD'
offset.inputs[1].default_value=(0,-1/6,0)
offset.location=(-1060,-1650)
links.new(uv.outputs['UV'],scale.inputs[0])
links.new(scale.outputs['Vector'],offset.inputs[0])

def mask_texture(name,filename,y):
 path=os.path.join(mask_dir,filename)
 if not os.path.isfile(path): raise FileNotFoundError(path)
 image=bpy.data.images.load(path,check_existing=True)
 image.filepath=bpy.path.relpath(path)
 image.colorspace_settings.name='Non-Color'
 texture=nodes.new('ShaderNodeTexImage')
 texture.name=name
 texture.label=filename+' | Non-Color | STATIC'
 texture.image=image
 texture.extension='CLIP'
 texture.interpolation='Linear'
 texture.location=(-790,y)
 links.new(offset.outputs['Vector'],texture.inputs['Vector'])
 separate=nodes.new('ShaderNodeSeparateColor')
 separate.name=name+' Value'
 separate.mode='RGB'
 separate.location=(-540,y)
 links.new(texture.outputs['Color'],separate.inputs['Color'])
 return separate.outputs['Red']

shore=mask_texture('V3 Shore Visual Mask','shore_shallow_visual_mask.png',-1380)
depth=mask_texture('V3 Open Depth Visual Mask','open_water_depth_visual_mask.png',-1850)

depth_strength=nodes.new('ShaderNodeMath')
depth_strength.name='V3 Depth Strength 0.30'
depth_strength.operation='MULTIPLY'
depth_strength.inputs[1].default_value=0.30
depth_strength.location=(-300,-1850)
links.new(depth,depth_strength.inputs[0])
shore_strength=nodes.new('ShaderNodeMath')
shore_strength.name='V3 Shore Strength 0.22'
shore_strength.operation='MULTIPLY'
shore_strength.inputs[1].default_value=0.22
shore_strength.location=(-300,-1380)
links.new(shore,shore_strength.inputs[0])

deep_color=nodes.new('ShaderNodeMix')
deep_color.name='V3 Deep Palette'
deep_color.data_type='RGBA'
deep_color.blend_type='MIX'
deep_color.inputs['Factor'].default_value=0.08
deep_color.inputs['A'].default_value=lin('#4FA7B2')
deep_color.inputs['B'].default_value=lin('#3E8792')
deep_color.location=(-90,-2000)
depth_mix=nodes.new('ShaderNodeMix')
depth_mix.name='V3 Static Open Depth Color'
depth_mix.data_type='RGBA'
depth_mix.blend_type='MIX'
depth_mix.location=(160,-1050)
links.new(depth_strength.outputs[0],depth_mix.inputs['Factor'])
links.new(nodes['V2 Subtle Depth Blend'].outputs['Result'],depth_mix.inputs['A'])
links.new(deep_color.outputs['Result'],depth_mix.inputs['B'])
shore_mix=nodes.new('ShaderNodeMix')
shore_mix.name='V3 Static Shallow Color'
shore_mix.data_type='RGBA'
shore_mix.blend_type='MIX'
shore_mix.inputs['B'].default_value=lin('#84D1D8')
shore_mix.location=(400,-900)
links.new(shore_strength.outputs[0],shore_mix.inputs['Factor'])
links.new(depth_mix.outputs['Result'],shore_mix.inputs['A'])
links.new(shore_mix.outputs['Result'],nodes['Mix.001'].inputs['A'])

# Spatial masks now supply the main depth structure. Keep the original broad
# procedural layer as restrained breakup and retain the slow Mapping keys.
nodes['V2 Subtle Depth Blend'].inputs['Factor'].default_value=0.25
# Slightly finer, sparser local highlight groups; no intensity or speed change.
nodes['Noise Texture.003'].inputs['Scale'].default_value=3.5
nodes['Color Ramp.002'].color_ramp.elements[0].position=0.64
nodes['Color Ramp.002'].color_ramp.elements[1].position=0.77

camera=bpy.data.objects['GardenContextReviewCamera']
camera.name='GardenWorldReviewCamera'
camera.data.type='ORTHO'
camera.data.ortho_scale=12.0
camera.location=water.location+Vector((0,0,25))
camera.rotation_euler=(0,0,0)
scene.camera=camera
scene.frame_start=1
scene.frame_end=192
scene.render.fps=24
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=2400
scene.render.resolution_y=1800
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.frame_set(96)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)

overlay=bpy.data.collections['V2 Garden Review Overlay']
for o in overlay.objects:o.hide_render=True
scene.render.filepath=os.path.join(review,'water_v3_world_still.png')
bpy.ops.render.render(write_still=True)
for o in overlay.objects:o.hide_render=False
scene.render.filepath=os.path.join(review,'water_v3_garden_still.png')
bpy.ops.render.render(write_still=True)

# Approx. 900 x 675 Garden-pixel crop spanning central-land shore and open water.
camera.data.ortho_scale=4.5
camera.location=water.location+Vector(((1620-1200)/150,(900-800)/150,25))
scene.render.resolution_x=1600
scene.render.resolution_y=1200
scene.render.filepath=os.path.join(review,'water_v3_closeup.png')
bpy.ops.render.render(write_still=True)
camera.data.ortho_scale=12.0
camera.location=water.location+Vector((0,0,25))
scene.render.resolution_x=2400
scene.render.resolution_y=1800
scene.render.filepath=''
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
