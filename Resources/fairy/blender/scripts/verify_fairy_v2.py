"""Read-only saved V2 gate checks; launch Blender with fairy_v2.blend open."""
from pathlib import Path
import bpy, json, hashlib, math
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

BASE=Path(__file__).resolve().parents[2]
scene=bpy.context.scene
report=json.loads((BASE/'review/fairy_v2_model_report.json').read_text(encoding='utf-8'))
assert bpy.app.version[:3]==(5,2,2)
assert Path(bpy.data.filepath).name=='fairy_v2.blend'
assert hashlib.sha256((BASE/'blender/fairy_v1.blend').read_bytes()).hexdigest()==report['source_sha256']
assert scene['v2_source_sha256']==report['source_sha256']
assert scene.camera.data.type=='ORTHO' and scene.camera.data.ortho_scale==1.75
assert scene.render.engine=='CYCLES' and scene.cycles.samples==128
assert scene.render.film_transparent and scene.render.image_settings.color_mode=='RGBA'
assert scene.render.resolution_x==512 and scene.render.resolution_y==512
assert not bpy.data.actions and not any(o.type=='ARMATURE' for o in scene.objects)
root=bpy.data.objects['Fairy_ROOT_ground_SE']
assert root.location.length<1e-7 and abs(root.rotation_euler.z-math.pi/4)<1e-6
p=world_to_camera_view(scene,scene.camera,Vector((0,0,0)))
assert abs(p.x-.5)<1e-5 and abs(p.y-.125)<1e-5
reference=bpy.data.images.get('fairy.png')
assert reference is not None and Path(bpy.path.abspath(reference.filepath)).resolve().is_file()
assert sum(o.name.startswith('V2 skirt layer') for o in scene.objects)==21
deps=bpy.context.evaluated_depsgraph_get();triangles=0
for o in scene.objects:
    if o.type not in {'MESH','CURVE'}:continue
    ev=o.evaluated_get(deps);m=ev.to_mesh();m.calc_loop_triangles();triangles+=len(m.loop_triangles)
    if o.users_collection[0].name=='Crocus':
        assert all((ev.matrix_world@v.co).z>.85 for v in m.vertices),o.name
    ev.to_mesh_clear()
assert triangles==report['render_evaluated_triangles']
for name,color in [('Petal teal #5AA4AB','#5AA4AB'),('Petal lavender #A67EB7','#A67EB7')]:
    mat=bpy.data.materials[name]
    def linear(x):return x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4
    expect=[linear(int(color[1+i:3+i],16)/255) for i in (0,2,4)]
    actual=mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value[:3]
    assert all(abs(a-b)<1e-6 for a,b in zip(actual,expect))
print('SAVED_V2_VERIFIED',json.dumps({'triangles':triangles,'source_v1_preserved':True,'palette_preserved':True,'no_rig_or_actions':True,'crocus_at_head':True,'pivot':[p.x,1-p.y]}))
