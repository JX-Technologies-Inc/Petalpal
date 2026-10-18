"""Read-only validation of the saved prototype, run inside Blender."""
from pathlib import Path
import bpy, json
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

base=Path(__file__).resolve().parents[2]
scene=bpy.context.scene
assert bpy.app.version[:3]==(5,2,2),bpy.app.version
assert scene.camera.data.type=='ORTHO'
assert scene.render.engine=='CYCLES'
assert scene.render.film_transparent
assert scene.render.image_settings.color_mode=='RGBA'
assert not bpy.data.actions, 'Animation is outside this gate'
assert not any(o.type=='ARMATURE' for o in scene.objects)
assert scene.render.resolution_x==512 and scene.render.resolution_y==512
p=world_to_camera_view(scene,scene.camera,Vector((0,0,0)))
assert abs(p.x-.5)<1e-5 and abs(p.y-.125)<1e-5
reference=bpy.data.images.get('fairy.png')
assert reference is not None
assert Path(bpy.path.abspath(reference.filepath)).resolve().is_file()
deps=bpy.context.evaluated_depsgraph_get()
triangles=0
for o in scene.objects:
    if o.type not in {'MESH','CURVE'}:continue
    ev=o.evaluated_get(deps);m=ev.to_mesh();m.calc_loop_triangles()
    triangles+=len(m.loop_triangles);ev.to_mesh_clear()
report=json.loads((base/'review/fairy_v1_model_report.json').read_text(encoding='utf-8'))
assert triangles==report['render_evaluated_triangles'],triangles
print('SAVED_BLEND_VERIFIED',json.dumps({'triangles':triangles,'no_actions':True,'no_armature':True,'pivot':[p.x,1-p.y],'reference_link_exists':True}))
