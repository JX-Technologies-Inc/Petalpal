"""V4 visual proof pass on the existing Garden-aligned Water POC."""
import bpy, math, os
from mathutils import Vector

root=os.path.dirname(bpy.data.filepath)
review=os.path.join(root,'review_v4')
os.makedirs(review,exist_ok=True)
scene=bpy.context.scene
water=bpy.data.objects['Plane']
material=water.active_material
nodes=material.node_tree.nodes
links=material.node_tree.links

def lin(code):
 def c(i):
  x=int(code[i:i+2],16)/255
  return x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4
 return (c(1),c(3),c(5),1)

def math_node(name, operation, x=0, y=0):
 n=nodes.new('ShaderNodeMath')
 n.name=name
 n.operation=operation
 n.location=(x,y)
 return n

def ramp(name,low,high,x,y):
 n=nodes.new('ShaderNodeValToRGB')
 n.name=name
 n.color_ramp.elements[0].position=low
 n.color_ramp.elements[1].position=high
 n.location=(x,y)
 return n

# Strong visual mask test while keeping the approved static Garden UV mapping.
nodes['V3 Shore Strength 0.22'].name='V4 Shore Strength 1.00'
nodes['V4 Shore Strength 1.00'].inputs[1].default_value=1.00
nodes['V3 Depth Strength 0.30'].name='V4 Depth Strength 1.00'
nodes['V4 Depth Strength 1.00'].inputs[1].default_value=1.00
nodes['V3 Deep Palette'].inputs['Factor'].default_value=0.45
shore_response=nodes.new('ShaderNodeMapRange')
shore_response.name='V4 Visible Irregular Shore Response'
shore_response.clamp=True
shore_response.inputs['From Min'].default_value=0.06
shore_response.inputs['From Max'].default_value=0.60
shore_response.inputs['To Min'].default_value=0.0
shore_response.inputs['To Max'].default_value=1.0
shore_response.location=(-410,-1190)
links.new(nodes['V3 Shore Visual Mask Value'].outputs['Red'],shore_response.inputs['Value'])
links.new(shore_response.outputs['Result'],nodes['V4 Shore Strength 1.00'].inputs[0])

# Only the strongest parts of the approved irregular shore mask gain a small
# lighter glint; the broader shallow field still targets transition turquoise.
shore_peak=ramp('V4 Local Shallow Accent Threshold',0.52,0.71,-200,-700)
links.new(nodes['V3 Shore Visual Mask Value'].outputs['Red'],shore_peak.inputs['Fac'])
shore_peak_strength=math_node('V4 Local Shallow Accent 0.45','MULTIPLY',20,-700)
shore_peak_strength.inputs[1].default_value=0.45
links.new(shore_peak.outputs['Color'],shore_peak_strength.inputs[0])
shore_accent=nodes.new('ShaderNodeMix')
shore_accent.name='V4 Restrained Shore Accent'
shore_accent.data_type='RGBA'
shore_accent.blend_type='MIX'
shore_accent.inputs['B'].default_value=lin('#9DDEE3')
shore_accent.location=(620,-770)
links.new(nodes['V3 Static Shallow Color'].outputs['Result'],shore_accent.inputs['A'])
links.new(shore_peak_strength.outputs[0],shore_accent.inputs['Factor'])
links.new(shore_accent.outputs['Result'],nodes['Mix.001'].inputs['A'])

# Two sparse families of short ripple strokes, with different orientation.
# Wave A retains the approved slow Mapping drift; phase moves gently as well.
wave_a=nodes['Wave Texture']
wave_a.inputs['Scale'].default_value=11.5
wave_a.inputs['Distortion'].default_value=3.1
wave_a.inputs['Detail'].default_value=2.0
wave_a.inputs['Detail Scale'].default_value=1.2
stroke_a=ramp('V4 Thin Stroke A',0.80,0.95,-90,30)
links.new(wave_a.outputs['Fac'],stroke_a.inputs['Fac'])

mapping_b=nodes.new('ShaderNodeMapping')
mapping_b.name='V4 Cross Stroke Mapping'
mapping_b.inputs['Rotation'].default_value[2]=math.radians(52)
mapping_b.location=(-840,330)
links.new(nodes['Texture Coordinate'].outputs['Generated'],mapping_b.inputs['Vector'])
wave_b=nodes.new('ShaderNodeTexWave')
wave_b.name='V4 Cross Stroke Wave'
wave_b.wave_type='BANDS'
wave_b.bands_direction='X'
wave_b.inputs['Scale'].default_value=13.0
wave_b.inputs['Distortion'].default_value=3.7
wave_b.inputs['Detail'].default_value=2.0
wave_b.inputs['Detail Scale'].default_value=1.1
wave_b.location=(-610,330)
links.new(mapping_b.outputs['Vector'],wave_b.inputs['Vector'])
stroke_b=ramp('V4 Thin Stroke B',0.82,0.96,-360,330)
links.new(wave_b.outputs['Fac'],stroke_b.inputs['Fac'])

# Broad group masks keep large calm gaps. Separate slow evolution prevents
# both directions from behaving as one sliding texture sheet.
group_a=nodes['Noise Texture.003']
group_a.inputs['Scale'].default_value=3.2
group_a.inputs['Detail'].default_value=2.0
nodes['Color Ramp.002'].color_ramp.elements[0].position=0.55
nodes['Color Ramp.002'].color_ramp.elements[1].position=0.69
group_b_noise=nodes.new('ShaderNodeTexNoise')
group_b_noise.name='V4 Cross Group Noise'
group_b_noise.inputs['Scale'].default_value=2.9
group_b_noise.inputs['Detail'].default_value=2.0
group_b_noise.inputs['Roughness'].default_value=0.34
group_b_noise.location=(-810,650)
links.new(mapping_b.outputs['Vector'],group_b_noise.inputs['Vector'])
group_b=ramp('V4 Cross Group Mask',0.56,0.70,-570,650)
links.new(group_b_noise.outputs['Fac'],group_b.inputs['Fac'])

# Fine soft breakup clips strokes into short irregular marks, not speckles.
break_noise=nodes.new('ShaderNodeTexNoise')
break_noise.name='V4 Stroke Breakup Noise'
break_noise.inputs['Scale'].default_value=12.0
break_noise.inputs['Detail'].default_value=2.0
break_noise.inputs['Roughness'].default_value=0.35
break_noise.location=(-820,-40)
links.new(nodes['V2 Slow Mask Drift'].outputs['Vector'],break_noise.inputs['Vector'])
break_ramp=ramp('V4 Soft Stroke Breakup',0.42,0.62,-580,-40)
links.new(break_noise.outputs['Fac'],break_ramp.inputs['Fac'])

def multiply(name,left,right,x,y):
 n=math_node(name,'MULTIPLY',x,y)
 links.new(left,n.inputs[0]); links.new(right,n.inputs[1])
 return n.outputs[0]

a=multiply('V4 Grouped Stroke A',stroke_a.outputs['Color'],nodes['Color Ramp.002'].outputs['Color'],160,100)
b=multiply('V4 Grouped Stroke B',stroke_b.outputs['Color'],group_b.outputs['Color'],160,390)
both=math_node('V4 Two Orientation Strokes','MAXIMUM',380,220)
links.new(a,both.inputs[0]);links.new(b,both.inputs[1])
broken=multiply('V4 Broken Short Strokes',both.outputs[0],break_ramp.outputs['Color'],600,190)
segment_noise=nodes.new('ShaderNodeTexNoise')
segment_noise.name='V4 Short Segment Noise'
segment_noise.inputs['Scale'].default_value=30.0
segment_noise.inputs['Detail'].default_value=2.0
segment_noise.inputs['Roughness'].default_value=0.36
segment_noise.location=(-800,-300)
links.new(nodes['V2 Slow Mask Drift'].outputs['Vector'],segment_noise.inputs['Vector'])
segment_ramp=ramp('V4 Short Segment Mask',0.50,0.64,-580,-300)
links.new(segment_noise.outputs['Fac'],segment_ramp.inputs['Fac'])
short=multiply('V4 Segment Limited Strokes',broken,segment_ramp.outputs['Color'],800,330)
stroke_strength=math_node('V4 Painterly Stroke Strength 0.95','MULTIPLY',810,190)
stroke_strength.inputs[1].default_value=0.95
stroke_visibility=math_node('V4 Painterly Stroke Visibility','POWER',1000,350)
stroke_visibility.inputs[1].default_value=0.58
links.new(short,stroke_visibility.inputs[0])
links.new(stroke_visibility.outputs[0],stroke_strength.inputs[0])
links.new(stroke_strength.outputs[0],nodes['Mix.001'].inputs['Factor'])

# Tiny nearly-white peaks exist only at the narrowest stroke crests.
peak_ramp=ramp('V4 Tiny Peak Threshold',0.965,0.995,170,-150)
links.new(wave_a.outputs['Fac'],peak_ramp.inputs['Fac'])
peak_group=multiply('V4 Tiny Peaks Grouped',peak_ramp.outputs['Color'],nodes['Color Ramp.002'].outputs['Color'],390,-170)
peak_broken=multiply('V4 Tiny Peaks Broken',peak_group,break_ramp.outputs['Color'],610,-170)
peak_short=multiply('V4 Segment Limited Peaks',peak_broken,segment_ramp.outputs['Color'],820,-360)
peak_strength=math_node('V4 Tiny Peak Strength 0.09','MULTIPLY',820,-170)
peak_strength.inputs[1].default_value=0.09
links.new(peak_short,peak_strength.inputs[0])
peak_mix=nodes.new('ShaderNodeMix')
peak_mix.name='V4 Tiny Foam Palette Peaks'
peak_mix.data_type='RGBA'
peak_mix.blend_type='MIX'
peak_mix.inputs['B'].default_value=lin('#F2FBFB')
peak_mix.location=(1030,-120)
links.new(peak_strength.outputs[0],peak_mix.inputs['Factor'])
links.new(nodes['Mix.001'].outputs['Result'],peak_mix.inputs['A'])
links.new(peak_mix.outputs['Result'],nodes['Principled BSDF'].inputs['Base Color'])

# The approved directional drift stays at Y=0.35 over 192 frames. Secondary
# motion is slower and changes visibility/shape rather than moving the plane.
for frame,xy in ((1,(0.0,0.0)),(192,(-0.06,0.17))):
 for index,value in enumerate(xy):
  nodes['V2 Slow Mask Drift'].inputs['Location'].default_value[index]=value
  nodes['V2 Slow Mask Drift'].inputs['Location'].keyframe_insert('default_value',frame=frame,index=index)
for frame,phase in ((1,0.0),(192,0.30)):
 wave_a.inputs['Phase Offset'].default_value=phase
 wave_a.inputs['Phase Offset'].keyframe_insert('default_value',frame=frame)
for frame,xy,phase in ((1,(0.0,0.0),0.0),(192,(0.13,-0.05),-0.24)):
 for index,value in enumerate(xy):
  mapping_b.inputs['Location'].default_value[index]=value
  mapping_b.inputs['Location'].keyframe_insert('default_value',frame=frame,index=index)
 wave_b.inputs['Phase Offset'].default_value=phase
 wave_b.inputs['Phase Offset'].keyframe_insert('default_value',frame=frame)

scene.frame_start=1
scene.frame_end=192
scene.render.fps=24
scene.frame_set(96)
scene.render.resolution_x=1200
scene.render.resolution_y=900
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
scene.render.filepath=os.path.join(review,'_test_garden.png')
bpy.ops.render.render(write_still=True)
for o in bpy.data.collections['V2 Garden Review Overlay'].objects:o.hide_render=True
scene.render.filepath=os.path.join(review,'_test_water.png')
bpy.ops.render.render(write_still=True)
