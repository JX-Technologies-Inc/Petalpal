import bpy, math, os, shutil
from mathutils import Vector

root=os.path.dirname(bpy.data.filepath)
project=os.path.abspath(os.path.join(root,'../../..'))
review=os.path.join(root,'review_v2')
os.makedirs(review,exist_ok=True)
scene=bpy.context.scene
water=bpy.data.objects['Plane']
base=water.active_material
nodes=base.node_tree.nodes
links=base.node_tree.links

# Preserve the original water graph and existing 0 -> 0.35 Mapping animation.
depth_noise=nodes.new('ShaderNodeTexNoise')
depth_noise.name='V2 Broad Depth Noise'
depth_noise.inputs['Scale'].default_value=0.55
depth_noise.inputs['Detail'].default_value=1.0
depth_noise.inputs['Roughness'].default_value=0.25
depth_noise.location=(-760,-610)
depth_ramp=nodes.new('ShaderNodeValToRGB')
depth_ramp.name='V2 Broad Depth Palette'
depth_ramp.location=(-500,-610)
depth_ramp.color_ramp.elements[0].position=0.28
depth_ramp.color_ramp.elements[1].position=0.72
def srgb_to_linear(v):
 v=v/255
 return v/12.92 if v<=0.04045 else ((v+0.055)/1.055)**2.4
def col(code):
 return tuple(srgb_to_linear(int(code[i:i+2],16)) for i in (1,3,5))+(1,)
depth_ramp.color_ramp.elements[0].color=col('#3E8792')
mid=depth_ramp.color_ramp.elements.new(0.48)
mid.color=col('#4FA7B2')
depth_ramp.color_ramp.elements[1].color=col('#84D1D8')
depth_mix=nodes.new('ShaderNodeMix')
depth_mix.name='V2 Subtle Depth Blend'
depth_mix.data_type='RGBA'
depth_mix.blend_type='MIX'
depth_mix.inputs['Factor'].default_value=0.36
depth_mix.location=(-190,-340)
links.new(depth_noise.outputs['Fac'],depth_ramp.inputs['Fac'])
links.new(nodes['Color Ramp'].outputs['Color'],depth_mix.inputs['A'])
links.new(depth_ramp.outputs['Color'],depth_mix.inputs['B'])
links.new(depth_mix.outputs['Result'],nodes['Mix.001'].inputs['A'])

# Only the sparse-highlight visibility mask receives secondary drift.
mask_mapping=nodes.new('ShaderNodeMapping')
mask_mapping.name='V2 Slow Mask Drift'
mask_mapping.location=(-790,-930)
links.new(nodes['Texture Coordinate'].outputs['Generated'],mask_mapping.inputs['Vector'])
links.new(mask_mapping.outputs['Vector'],nodes['Noise Texture.003'].inputs['Vector'])
for frame,xy in ((1,(0.0,0.0)),(192,(-0.025,0.075))):
 for index,value in enumerate(xy):
  mask_mapping.inputs['Location'].default_value[index]=value
  mask_mapping.inputs['Location'].keyframe_insert('default_value',frame=frame,index=index)
for action in bpy.data.actions:
 for layer in action.layers:
  for strip in layer.strips:
   for slot in action.slots:
    bag=strip.channelbag(slot)
    if bag:
     for fc in bag.fcurves:
      for k in fc.keyframe_points: k.interpolation='LINEAR'

# Native GardenScene uses 2400 x 1800, with top-left-origin image canvases.
# One Blender unit is 150 Garden pixels; the existing 16-unit plane spans 2400 px.
lands=[
 ('central','central-land.png',768,297,831,0),
 ('0405','land-0405.png',1135,-60,597,1.5),
 ('06','land-06.png',1638,230,598,-1.33),
 ('07','land-07.png',1737,407,689,7.24),
 ('08','land-08.png',1667,924,673,16.9),
 ('09','land-09.png',936,1000,597,8.28),
 ('101112','land-101112.png',-27,373,1008,0),
]
overlay=bpy.data.collections.get('V2 Garden Review Overlay')
if overlay is None:
 overlay=bpy.data.collections.new('V2 Garden Review Overlay')
 scene.collection.children.link(overlay)
for name,file,x,y,width,rotation in lands:
 path=os.path.join(project,'mobile','assets','garden','land',file)
 image=bpy.data.images.load(path,check_existing=True)
 image.filepath=bpy.path.relpath(path)
 height=width*image.size[1]/image.size[0]
 bpy.ops.mesh.primitive_plane_add(size=2)
 obj=bpy.context.object
 obj.name='Review_Land_'+name
 for c in list(obj.users_collection): c.objects.unlink(obj)
 overlay.objects.link(obj)
 obj.location=water.location+Vector(((x+width/2-1200)/150,(900-y-height/2)/150,0.06))
 obj.scale=(width/300,height/300,1)
 obj.rotation_euler.z=-math.radians(rotation)
 material=bpy.data.materials.new('Review_Artwork_'+name)
 material.use_nodes=True
 ns=material.node_tree.nodes
 ns.clear()
 tex=ns.new('ShaderNodeTexImage'); tex.image=image
 emission=ns.new('ShaderNodeEmission')
 trans=ns.new('ShaderNodeBsdfTransparent')
 mix=ns.new('ShaderNodeMixShader')
 output=ns.new('ShaderNodeOutputMaterial')
 lk=material.node_tree.links
 lk.new(tex.outputs['Color'],emission.inputs['Color'])
 lk.new(tex.outputs['Alpha'],mix.inputs[0])
 lk.new(trans.outputs[0],mix.inputs[1])
 lk.new(emission.outputs[0],mix.inputs[2])
 lk.new(mix.outputs[0],output.inputs['Surface'])
 material.surface_render_method='BLENDED'
 obj.data.materials.append(material)
 obj['review_only']='Existing Garden image at native layout coordinates'

camera=bpy.data.objects['WaterReviewCamera']
camera.name='GardenContextReviewCamera'
camera.data.type='ORTHO'
camera.data.ortho_scale=12
camera.location=water.location+Vector((0,0,25))
camera.rotation_euler=(0,0,0)
scene.camera=camera
scene.render.engine='BLENDER_EEVEE'
scene.render.film_transparent=False
scene.render.resolution_x=960
scene.render.resolution_y=720
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='Standard'
scene.frame_start=1
scene.frame_end=192
scene.render.fps=24
scene.frame_set(96)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)

scene.render.filepath=os.path.join(review,'water_review_v2_still.png')
bpy.ops.render.render(write_still=True)
camera.data.ortho_scale=6
scene.render.filepath=os.path.join(review,'water_review_v2_closeup.png')
bpy.ops.render.render(write_still=True)
camera.data.ortho_scale=12
for o in overlay.objects: o.hide_render=True
scene.render.filepath=os.path.join(review,'water_review_v2_water_only.png')
bpy.ops.render.render(write_still=True)
for o in overlay.objects: o.hide_render=False

scene.render.resolution_x=480
scene.render.resolution_y=360
scene.render.filepath=os.path.join(review,'frames','water_')
os.makedirs(os.path.dirname(scene.render.filepath),exist_ok=True)
bpy.ops.render.render(animation=True)
scene.frame_set(96)
scene.render.resolution_x=960
scene.render.resolution_y=720
scene.render.filepath=''
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
