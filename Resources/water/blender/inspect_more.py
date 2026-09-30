import bpy
from mathutils import Vector
s=bpy.context.scene
for o in bpy.data.objects:
 print('OBJ',o.name,'bounds',[(o.matrix_world @ Vector(c))[:] for c in o.bound_box] if o.type=='MESH' else '')
for f in [1,96,192]:
 s.frame_set(f)
 n=bpy.data.materials['Material.001'].node_tree.nodes['Mapping']
 print('FRAME',f,'mapping',tuple(n.inputs['Location'].default_value),'phase',bpy.data.materials['Material.001'].node_tree.nodes['Wave Texture'].inputs['Phase Offset'].default_value)
for a in bpy.data.actions:
 print('ACTION',a.name,'slots',[(x.identifier,x.target_id_type) for x in a.slots])
 for layer in a.layers:
  for strip in layer.strips:
   for slot in a.slots:
    bag=strip.channelbag(slot)
    if bag:
     for fc in bag.fcurves: print('CURVE',fc.data_path,fc.array_index,[(tuple(k.co)) for k in fc.keyframe_points])
