"""Standalone stair derivative. Never writes bridge sources or runtime assets."""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector
OUT=Path(__file__).resolve().parent
SOURCE=OUT.parents[1]/'bridge/blender/bridge_master.blend'
source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene=bpy.context.scene
# Bake existing symmetry before giving the two ends different elevations.
deps=bpy.context.evaluated_depsgraph_get()
retained=[]
for ob in list(scene.objects):
 if ob.type!='MESH': continue
 if ob.name.startswith('Deck plank') or ob.name=='Short level wooden landing lips':
  bpy.data.objects.remove(ob,do_unlink=True);continue
 evaluated=ob.evaluated_get(deps)
 data=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=deps)
 ob.modifiers.clear();ob.data=data
 # The approved arch becomes a continuous descending floral side structure.
 # All original flowers, leaves, vine meshes, wood materials and topology survive.
 for v in data.vertices:
  x=v.co.x
  arch=1.15*math.cos(math.pi*x/7.2)
  line=(x+3.6)*.30
  v.co.z+=line-arch
 retained.append(ob.name)

def rgb(h):
 a=[int(h[i:i+2],16)/255 for i in (0,2,4)]
 return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in a)+(1,)
stone=bpy.data.materials.new('ST01 warm Garden sandstone');stone.use_nodes=True
n=stone.node_tree.nodes;l=stone.node_tree.links;n.clear()
out=n.new('ShaderNodeOutputMaterial');diff=n.new('ShaderNodeBsdfDiffuse');diff.inputs['Roughness'].default_value=.8
coord=n.new('ShaderNodeTexCoord');noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=8;noise.inputs['Detail'].default_value=2
l.new(coord.outputs['Object'],noise.inputs['Vector'])
ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=rgb('918575');ramp.color_ramp.elements[0].position=.15;ramp.color_ramp.elements[1].color=rgb('C5B89F');ramp.color_ramp.elements[1].position=.85
l.new(noise.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs[0],diff.inputs['Color']);l.new(diff.outputs[0],out.inputs[0])
riser=stone.copy();riser.name='ST01 warm recessed risers'
rr=next(n for n in riser.node_tree.nodes if n.type=='VALTORGB')
rr.color_ramp.elements[0].color=rgb('70614F');rr.color_ramp.elements[1].color=rgb('A1927B')
for i in range(12):
 x=-3.6+(i+.5)*.6;z=(i+.5)*.18
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,0,z-.13))
 ob=bpy.context.object;ob.name='ST01 stone tread %02d'%(i+1);ob.dimensions=(.606,2.65,.26)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 ob.data.materials.append(stone)
 ob.data.materials.append(riser)
 for face in ob.data.polygons:
  face.material_index=0 if face.normal.z>.5 else 1
 bevel=ob.modifiers.new('Soft worn stone nosing','BEVEL');bevel.width=.035;bevel.segments=3
 ob.modifiers.new('Weighted stone normals','WEIGHTED_NORMAL')
cam=scene.camera;target=Vector((0,0,1.25));a=math.radians(322)
cam.location=target+Vector((12*math.sin(a),-12*math.cos(a),12*math.tan(math.radians(55))))
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO';cam.data.ortho_scale=10.5
scene.render.resolution_x=2200;scene.render.resolution_y=2200;scene.render.resolution_percentage=100
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.filepath=str(OUT/'ST01_master.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'ST01_master.blend'))
bpy.ops.render.render(write_still=True)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash
(OUT/'design_manifest.json').write_text(json.dumps({'source':str(SOURCE),'sourceSha256':source_hash,'retainedSourceMeshes':retained,'treads':12,'width':2.65,'risePerTread':.18,'runPerTread':.6,'cameraAzimuth':322,'cameraElevation':55,'runtimeModified':False},indent=2))
