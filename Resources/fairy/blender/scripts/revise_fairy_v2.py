"""Revise the saved V1 Blender model, never recreate it from the V1 builder.

Visual gate only: one neutral SE render; no rig, action or runtime change.
Run using Blender 5.2.2 LTS --background --python-exit-code 1 --python this_file.
"""
from pathlib import Path
import bpy, math, json, hashlib
from mathutils import Matrix, Vector
from bpy_extras.object_utils import world_to_camera_view

BASE=Path(__file__).resolve().parents[2]
source=BASE/'blender/fairy_v1.blend'
source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene
root=bpy.data.objects['Fairy_ROOT_ground_SE']
assert not bpy.data.actions
assert not any(o.type=='ARMATURE' for o in scene.objects)

def affine(center, scale, destination=None):
    center=Vector(center);destination=center if destination is None else Vector(destination)
    return Matrix.Translation(destination)@Matrix.Scale(scale,4)@Matrix.Translation(-center)

def apply_local(o,m):
    # Model objects are root children. Transform in their shared character space.
    # Compose current channels explicitly; matrix_local can still contain cached
    # pre-edit values when another transform was just assigned in the same pass.
    current=Matrix.LocRotScale(o.location,o.rotation_euler.to_quaternion(),o.scale)
    o.matrix_local=m@current

def coordinates(o,fn):
    if o.type=='MESH':
        for v in o.data.vertices:v.co=fn(v.co)
    elif o.type=='CURVE':
        for spline in o.data.splines:
            if spline.type=='BEZIER':
                for p in spline.bezier_points:
                    p.co=fn(p.co);p.handle_left=fn(p.handle_left);p.handle_right=fn(p.handle_right)
            else:
                for p in spline.points:p.co=(*fn(Vector(p.co[:3])),1)

# Restrained narrower eyes before the head-group transform, without changing iris hue.
for o in bpy.data.collections['Face'].objects:
    if o.name.startswith(('Eye white','Iris','Pupil','Eye glint')):
        center=o.location.copy()
        apply_local(o,Matrix.Translation(center)@Matrix.Diagonal((1,1,.82,1))@Matrix.Translation(-center))
    elif o.name.startswith(('Upper eyelid','Lower eyelid')):
        coordinates(o,lambda p:Vector((p.x,p.y,.913+(p.z-.913)*.82)))
    elif o.name.startswith('Quiet brow'):
        coordinates(o,lambda p:Vector((p.x,p.y,.934+(p.z-.934)*.60)))

# Braids now sit above the crown rather than being mostly buried in it.
for o in bpy.data.collections['Hair'].objects:
    if o.name.startswith('Crown braid interwoven'):
        coordinates(o,lambda p:Vector((p.x*1.045,.020+(p.y-.020)*1.035,p.z+.014)))
        o.data.bevel_depth*=1.25
    elif o.name.startswith('Back bun braid'):
        coordinates(o,lambda p:Vector((p.x*1.10,p.y+.006,.905+(p.z-.905)*1.12)))
        o.data.bevel_depth*=1.15
    elif o.name=='Low braided updo core':
        apply_local(o,affine(o.location,1.08,o.location+Vector((0,.004,.003))))

head_center=Vector((0,0,.830));head_transform=affine(head_center,1.10)
head_names={'Head jaw-cheek-cranium editable quad cage'}
for o in list(scene.objects):
    if o.name in head_names or o.users_collection[0].name in {'Face','Hair'}:
        apply_local(o,head_transform)

# Crocus size is +20% relative to V1 (not 1.10*1.20). Its attachment follows the head.
old_flower=Vector((-.065,-.060,.966))
flower=head_transform@old_flower+Vector((-.019,.030,.003))
for o in list(bpy.data.collections['Crocus'].objects):
    apply_local(o,affine(old_flower,1.20,flower))

def material(name,hex_color):
    h=hex_color.lstrip('#')
    def linear(x):return x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4
    rgb=tuple(linear(int(h[i:i+2],16)/255) for i in (0,2,4))
    m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1)
    bs.inputs['Roughness'].default_value=.78;bs.inputs['Specular IOR Level'].default_value=.12
    return m

def add_mesh(name,vs,fs,mat,cat,sub=1):
    d=bpy.data.meshes.new(name);d.from_pydata(vs,[],fs);d.update()
    o=bpy.data.objects.new(name,d);bpy.data.collections[cat].objects.link(o);o.parent=root
    d.materials.append(mat)
    for p in d.polygons:p.use_smooth=True
    if sub:
        s=o.modifiers.new('Soft editable petal surface','SUBSURF');s.levels=sub;s.render_levels=sub
    solid=o.modifiers.new('Thin petal thickness','SOLIDIFY');solid.thickness=.0011;solid.offset=0
    return o

def add_curve(name,pts,radius,mat,cat):
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=4;d.bevel_depth=radius;d.bevel_resolution=1
    s=d.splines.new('BEZIER');s.bezier_points.add(len(pts)-1)
    for p,co in zip(s.bezier_points,pts):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,d);bpy.data.collections[cat].objects.link(o);o.parent=root;d.materials.append(mat)
    return o

lav=bpy.data.materials['Petal lavender #A67EB7'];teal=bpy.data.materials['Petal teal #5AA4AB']
lav_pale=bpy.data.materials['Petal pale lavender'];gold=bpy.data.materials['Restrained pale gold']

def softly_graded(source,name):
    m=source.copy();m.name=name;nodes=m.node_tree.nodes;links=m.node_tree.links
    bs=nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.80;bs.inputs['Specular IOR Level'].default_value=.12
    c=tuple(bs.inputs['Base Color'].default_value)
    tex=nodes.new('ShaderNodeTexCoord');sep=nodes.new('ShaderNodeSeparateXYZ');ramp=nodes.new('ShaderNodeValToRGB')
    # A mild per-petal root-to-tip gradient, with the exact source palette at the midpoint.
    ramp.color_ramp.elements[0].position=0
    ramp.color_ramp.elements[0].color=tuple(min(1,x*.93+.045) for x in c[:3])+(1,)
    ramp.color_ramp.elements[1].position=1
    ramp.color_ramp.elements[1].color=tuple(x*.90 for x in c[:3])+(1,)
    ramp.color_ramp.elements.new(.5).color=c
    links.new(tex.outputs['Generated'],sep.inputs[0]);links.new(sep.outputs['Z'],ramp.inputs[0]);links.new(ramp.outputs['Color'],bs.inputs['Base Color'])
    return m

lav_soft=softly_graded(lav,'V2 lavender petal gentle gradient')
pale_soft=softly_graded(lav_pale,'V2 pale lavender petal gentle gradient')
teal_soft=softly_graded(teal,'V2 teal petal gentle gradient')

# Replace radial pinwheel crocus petals with six cupped, upright pointed petals.
# Preserve the actual V1 accessory objects/material identities as the starting pieces.
tips=[(-.035,-.006,.038),(-.008,-.008,.054),(.025,-.009,.043),
      (.040,-.018,.008),(.002,-.027,.026),(-.043,-.021,.007)]
for i in range(6):
    o=bpy.data.objects[f'Crocus pointed bloom petal {i}']
    b=Vector((0,0,0));t=Vector(tips[i])*1.20;axis=t-b
    across=Vector((axis.z,0,-axis.x)).normalized()
    vs=[];rows=7;cols=5
    for r in range(rows):
        u=r/(rows-1);width=.017*1.20*math.sin(math.pi*u)**.75+.0003
        mid=axis*u+Vector((0,-.009*math.sin(math.pi*u),0))
        for j in range(cols):
            q=2*j/(cols-1)-1
            p=mid+across*width*q+Vector((0,-.004*(1-q*q)*math.sin(math.pi*u),0))
            vs.append(tuple(p))
    fs=[(r*cols+j,r*cols+j+1,(r+1)*cols+j+1,(r+1)*cols+j) for r in range(rows-1) for j in range(cols-1)]
    original_mat=o.data.materials[0]
    d=bpy.data.meshes.new(o.name+' V2 cupped surface');d.from_pydata(vs,[],fs);d.update();d.materials.append(original_mat)
    for p in d.polygons:p.use_smooth=True
    o.data=d;o.matrix_local=Matrix.Translation(flower)
    o['v2_change']='Cupped crocus petal, 1.20 feature size; no pinwheel silhouette'

# Clarify three real saffron filaments at the visible center (keep the gold accent palette).
for i in range(3):
    o=bpy.data.objects[f'Saffron stamen {i}']
    for s in o.data.splines:
        for j,p in enumerate(s.bezier_points):
            target=flower+Vector(((-.010+i*.010)*1.20,-.035,.026+.005*(i%2))) if j else flower
            p.co=target;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    o.matrix_local=Matrix.Identity(4);o.data.bevel_depth=.0016
    anther=bpy.data.objects[f'Saffron anther {i}']
    anther.location=flower+Vector(((-.010+i*.010)*1.20,-.035,.026+.005*(i%2)))

# Same four wings, smaller spans and substantially lighter membrane/linework.
for o in list(bpy.data.collections['Wings'].objects):
    side=-1 if '-1' in o.name else 1
    upper=('Upper' in o.name or '.True' in o.name)
    attach=Vector((side*.036,.037,.745 if upper else .686))
    apply_local(o,affine(attach,.82))
    if o.type=='CURVE':o.data.bevel_depth*=.78
for name,alpha in [('Translucent blue lavender membrane',.28),('Wing readable lavender edge',.48),('Wing pale gold veins',.42)]:
    m=bpy.data.materials[name];m.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=alpha
    rgb=m.diffuse_color[:3];m.diffuse_color=(*rgb,alpha)

# Retain V1 bodice/slip/waist/sashes, replace only the busy skirt-petal rows/midribs.
for o in list(bpy.data.collections['Dress'].objects):
    if o.name.startswith(('Skirt layer','Petal soft gold midrib')):bpy.data.objects.remove(o,do_unlink=True)
for layer,(count,z0,z1,r0,r1,width,mat) in enumerate([
    (8,.593,.355,.052,.149,.059,lav_soft),
    (7,.629,.428,.047,.131,.054,pale_soft),
    (6,.650,.500,.044,.106,.048,lav_soft)]):
    for i in range(count):
        a=2*math.pi*(i/count+.053*layer);radial=Vector((math.cos(a),math.sin(a),0));across=Vector((-math.sin(a),math.cos(a),0))
        b=radial*r0+Vector((0,0,z0));t=radial*r1+Vector((0,0,z1+.007*math.sin(i*2.4)))
        chosen=teal_soft if layer==2 and i==1 else mat
        vs=[];rows=7;cols=5
        for r in range(rows):
            u=r/(rows-1);w=width*math.sin(math.pi*u)**.64+.0003
            mid=b.lerp(t,u)+radial*(.010*math.sin(math.pi*u))
            for j in range(cols):
                q=2*j/(cols-1)-1
                p=mid+across*w*q+radial*(.004*(1-q*q)*math.sin(math.pi*u))
                vs.append(tuple(p))
        fs=[(r*cols+j,r*cols+j+1,(r+1)*cols+j+1,(r+1)*cols+j) for r in range(rows-1) for j in range(cols-1)]
        add_mesh(f'V2 skirt layer {layer+1} broad petal {i+1}',vs,fs,chosen,'Dress')
        if i%3==0:
            mid=b.lerp(t,.50)+radial*.015
            add_curve(f'V2 restrained petal midrib {layer}.{i}',[b,mid,t+radial*.001],.00065,gold,'Dress')
for o in bpy.data.collections['Dress'].objects:
    if o.name.startswith('Neckline upward petal'):
        o.data.materials[0]=teal_soft if int(o.name.rsplit(' ',1)[1])%3 else lav_soft

# Mount the crocus on the near temple with an outward-facing cup, not a forehead pin.
ornament_orientation=Matrix.Translation(flower)@Matrix.Rotation(math.radians(-45),4,'Z')@Matrix.Translation(-flower)
for o in bpy.data.collections['Crocus'].objects:apply_local(o,ornament_orientation)

scene['prototype_status']='V2 SE visual gate; NOT approved; no rig/actions'
scene['v2_source_blend']='fairy_v1.blend'
scene['v2_source_sha256']=source_hash
scene['v2_head_hair_scale']=1.10
scene['v2_crocus_scale']=1.20
scene['v2_wing_extent_scale']=.82
scene['v2_runtime_review_body_heights']=[96,108,120]
scene['standing_body_height']=.830+(.995-.830)*1.10
scene.render.filepath=str(BASE/'review/fairy_v2_SE.png')
bpy.context.view_layer.update()
p=world_to_camera_view(scene,scene.camera,Vector((0,0,0)))
assert abs(p.x-.5)<1e-5 and abs(p.y-.125)<1e-5
assert not bpy.data.actions and not any(o.type=='ARMATURE' for o in scene.objects)
assert scene.render.film_transparent and scene.render.image_settings.color_mode=='RGBA'
assert scene.camera.data.type=='ORTHO'
bpy.ops.wm.save_as_mainfile(filepath=str(BASE/'blender/fairy_v2.blend'))
deps=bpy.context.evaluated_depsgraph_get();triangles=0;polygons=0;categories={};base_polygons=0
for o in scene.objects:
    if o.type not in {'MESH','CURVE'}:continue
    if o.type=='MESH':base_polygons+=len(o.data.polygons)
    ev=o.evaluated_get(deps);m=ev.to_mesh();m.calc_loop_triangles();triangles+=len(m.loop_triangles);polygons+=len(m.polygons);ev.to_mesh_clear()
    cat=o.users_collection[0].name;categories[cat]=categories.get(cat,0)+1
body_top=world_to_camera_view(scene,scene.camera,root.matrix_world@(head_transform@Vector((0,.008,.995))))
report={'blender':bpy.app.version_string,'source_blend':'fairy_v1.blend','source_sha256':source_hash,
        'head_hair_scale':1.10,'crocus_scale':1.20,'wing_extent_scale':.82,'wing_membrane_alpha':.28,
        'skirt_petals_v1':31,'skirt_petals_v2':21,'direction':'SE','camera':'ORTHO','elevation_degrees':30,'ortho_scale':1.75,
        'resolution':[512,512],'pivot':[p.x,1-p.y],'engine':scene.render.engine,'samples':scene.cycles.samples,
        'base_mesh_polygons_excluding_curves':base_polygons,'render_evaluated_triangles':triangles,'render_evaluated_polygons':polygons,
        'object_categories':categories,'rig_created':False,'actions':len(bpy.data.actions),'preview_body_heights_px':[96,108,120],
        'projected_nominal_body_height_512':(body_top.y-p.y)*512}
(BASE/'review/fairy_v2_model_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
bpy.ops.render.render(write_still=True)
assert hashlib.sha256(source.read_bytes()).hexdigest()==source_hash
print('FAIRY_V2_REPORT',json.dumps(report))
