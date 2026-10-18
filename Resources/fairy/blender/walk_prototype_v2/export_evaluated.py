"""Open the prototype .blend, then run this to export edited poses without rebuild.
Example: blender --background fairy_v2_walk_prototype.blend --python export_evaluated.py
Mesh topology must remain unchanged; bone/keyframe edits are supported.
"""
from pathlib import Path
import bpy,json,numpy as np
HERE=Path(__file__).resolve().parent;c=json.loads((HERE/'build_config.json').read_text())
scene=bpy.context.scene;S=c['units_per_pixel'];rx,ry=c['root']
for f in range(c['frames']+2):
    scene.frame_set(f);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();coords={}
    for layer in c['layers']:
        obj=bpy.data.objects[layer['name']];ev=obj.evaluated_get(deps);mesh=ev.to_mesh()
        co=np.array([(obj.matrix_world@v.co)[:] for v in mesh.vertices]);coords[obj.name]=np.column_stack([co[:,0]/S+rx,ry-co[:,1]/S]);ev.to_mesh_clear()
    np.savez_compressed(HERE/'mesh_cache'/f'frame_{f:03d}.npz',**coords)
    print('EXPORTED_EDITED_FRAME',f,flush=True)
