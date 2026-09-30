import bpy, math, json
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x = 1536
scene.render.resolution_y = 1280
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True
scene.world.color = (0.45, 0.45, 0.45)
scene.view_settings.view_transform = 'AgX'

def material(name, color):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=0.8
    return m
wood=material('Proxy warm wood',(0.43,0.245,0.11))
planks=[material('Plank tone '+str(i),(0.49+i*.025,0.30+i*.018,0.15+i*.012)) for i in range(4)]
rail=material('Simple wooden rail',(0.28,0.15,0.065))
root=bpy.data.objects.new('Bridge_World_Yaw',None); scene.collection.objects.link(root)
root.rotation_euler.z=math.radians(54)
root['purpose']='Camera/geometry proxy only. No final decoration or texture approval.'
root['reference']='../bridge-main.png (unchanged external design reference)'
L=6.0; W=1.85; RISE=0.72

def height(x): return RISE*(1-(x/(L/2))**2)
def mesh(name, verts, faces, mat):
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    ob=bpy.data.objects.new(name,me); scene.collection.objects.link(ob); ob.parent=root
    ob.data.materials.append(mat); return ob

def box(name,loc,size,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    ob=bpy.context.object; ob.name=name; ob.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    ob.parent=root; ob.data.materials.append(mat)
    bevel=ob.modifiers.new('Soft proxy edges','BEVEL'); bevel.width=.018; bevel.segments=2
    ob.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); return ob

# Individually sloped plank prisms form an actual continuous 3D arch.
N=32
for i in range(N):
    a=-L/2+i*L/N; b=a+L/N-.012
    za=height(a); zb=height(b)
    verts=[(a,-W/2,za),(b,-W/2,zb),(b,W/2,zb),(a,W/2,za),
           (a,-W/2,za-.14),(b,-W/2,zb-.14),(b,W/2,zb-.14),(a,W/2,za-.14)]
    ob=mesh('Deck_Plank_%02d'%i,verts,[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],planks[i%4])
    bevel=ob.modifiers.new('Plank edge softness','BEVEL'); bevel.width=.01; bevel.segments=2
    ob.modifiers.new('Weighted normals','WEIGHTED_NORMAL')

def curve(name,points,radius,mat=None):
    cu=bpy.data.curves.new(name,'CURVE'); cu.dimensions='3D'; cu.resolution_u=16
    sp=cu.splines.new('POLY'); sp.points.add(len(points)-1)
    for p,v in zip(sp.points,points): p.co=(*v,1)
    cu.bevel_depth=radius; cu.bevel_resolution=3
    ob=bpy.data.objects.new(name,cu); scene.collection.objects.link(ob); ob.parent=root
    if mat: cu.materials.append(mat)
    return ob

for side in [-1,1]:
    y=side*(W/2+.045)
    for level in [.38,.80]:
        curve('SideRail_%s_%s'%(side,level),[(x,y,height(x)+level) for x in [-3+i*6/64 for i in range(65)]],.055,rail)
    curve('Arch_support_'+str(side),[(x,side*(W/2-.1),height(x)-.20) for x in [-3+i*6/64 for i in range(65)]],.10,wood)
    for j in range(7):
        x=-3+j
        box('Rail_post_%s_%s'%(side,j),(x,y,height(x)+.43),(.12,.12,.92),wood)

walk=[(x,0,height(x)+.018) for x in [-3+i*6/32 for i in range(33)]]
path=curve('FairyWalkPath',walk,0)
path.hide_render=True; path.show_in_front=True
path['purpose']='Deck centerline only; no fairy movement. Clear corridor between side rails.'
for name,x in [('EntryA',-3),('Crest',0),('EntryB',3)]:
    ob=bpy.data.objects.new(name,None); scene.collection.objects.link(ob); ob.parent=root
    ob.location=(x,0,height(x)+.018); ob.empty_display_type='SPHERE'; ob.empty_display_size=.12
anchor=bpy.data.objects.new('BridgeGroundAnchor',None); scene.collection.objects.link(anchor); anchor.parent=root
anchor.empty_display_type='PLAIN_AXES'

# Fixed camera: elevation 55 degrees, looking north. Only Bridge_World_Yaw rotates.
target=Vector((0,0,.40))
bpy.ops.object.camera_add(location=target+Vector((0,-12,12*math.tan(math.radians(55)))))
cam=bpy.context.object; cam.name='PetalPal_Garden_Camera'
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO'; cam.data.ortho_scale=7.8; cam.data.lens=50
scene.camera=cam
for name,loc,power,size in [('Soft_key',(-3,-4,8),1000,7),('Soft_fill',(4,2,6),650,6)]:
    bpy.ops.object.light_add(type='AREA',location=loc)
    light=bpy.context.object; light.name=name; light.data.energy=power; light.data.shape='DISK'; light.data.size=size
    light.rotation_euler=(Vector((0,0,0))-light.location).to_track_quat('-Z','Y').to_euler()

bpy.context.view_layer.update()
def project(local):
    p=world_to_camera_view(scene,cam,root.matrix_world@Vector(local))
    return {'x':p.x*1536,'y':(1-p.y)*1280}
def delta(p,a): return {'x':p['x']-a['x'],'y':p['y']-a['y']}
a=project((0,0,0))
metadata={'angle':54,'canvas':{'width':1536,'height':1280},'anchor':a,
 'projection':{'along':delta(project((3,0,0)),a),'across':delta(project((0,1,0)),a),'elevation':delta(project((0,0,RISE)),a)},
 'camera':{'type':'ORTHO','elevationDegrees':55,'orthoScale':7.8,'location':list(cam.location),'target':list(target)},
 'geometry':{'span':L,'deckWidth':W,'archRise':RISE,'railHeight':.8},
 'path':[{'x':x/3,'y':0,'elevation':(height(x)+.018)/RISE} for x,_,_ in walk]}
(ROOT/'rendered'/'bridge_test_angle.json').write_text(json.dumps(metadata,indent=2))
scene.render.filepath=str(ROOT/'rendered'/'bridge_test_angle.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender'/'bridge_master.blend'))
bpy.ops.render.render(write_still=True)
print('BRIDGE_PROXY_COMPLETE',json.dumps(metadata['camera']))

