"""Reference-specific editable Fairy V1 study. Run with Blender 5.2.2 --background --python.

Only creates source/review outputs under Resources/fairy; no animation or app import.
The geometry below is explicitly authored for the approved design, not a random generator.
"""
from pathlib import Path
import bpy, math, json
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

BASE = Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
root = bpy.data.objects.new('Fairy_ROOT_ground_SE', None)
scene.collection.objects.link(root)
root.rotation_euler.z = math.radians(45)
root['heading'] = 'SE; bind facing -Y, rotate +45 degrees about Z'
root['ground_pivot'] = '0,0,0; fixed, no root motion'

collections = {}
for name in ['Body', 'Face', 'Hair', 'Crocus', 'Dress', 'Wings', 'Footwear', 'Review_Setup']:
    c=bpy.data.collections.new(name); scene.collection.children.link(c); collections[name]=c

def attach(o, category):
    for c in list(o.users_collection): c.objects.unlink(o)
    collections[category].objects.link(o)
    if category != 'Review_Setup': o.parent=root
    return o

def linear(v): return v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4
def material(name, color, rough=.72, alpha=1):
    h=color.lstrip('#'); rgb=[linear(int(h[i:i+2],16)/255) for i in (0,2,4)]
    m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,alpha);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*rgb,1)
    bs.inputs['Roughness'].default_value=rough
    bs.inputs['Specular IOR Level'].default_value=.18
    bs.inputs['Alpha'].default_value=alpha
    return m

skin=material('Ivory skin - soft warm porcelain', '#EBCDBE',.8)
hair=material('Purple-black hair', '#302338',.63)
hair_mid=material('Purple braid planes', '#443149',.69)
hair_light=material('Restrained lavender hair reflections', '#66506D',.75)
lav=material('Petal lavender #A67EB7', '#A67EB7')
lav_pale=material('Petal pale lavender', '#C3AAD1')
lav_deep=material('Petal muted violet', '#83638F')
teal=material('Petal teal #5AA4AB', '#5AA4AB')
teal_light=material('Soft teal highlights', '#8DBFC1')
gold=material('Restrained pale gold', '#C8AD78',.63)
ivory=material('Ivory petal tips', '#E4D8DB')
wing_mat=material('Translucent blue lavender membrane', '#B4BDD9',.8,.43)
wing_edge=material('Wing readable lavender edge', '#A08EB8',.8,.70)
wing_vein=material('Wing pale gold veins', '#D8CBAD',.85,.62)
eye_white=material('Warm eye whites', '#DCD5D3')
iris=material('Muted plum iris', '#71516C',.65)
pupil=material('Deep plum pupils', '#2C2231')
lip=material('Restrained rose lips', '#B98585')

def mesh(name, verts, faces, mat, category, sub=0):
    d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update()
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);attach(o,category)
    if mat: d.materials.append(mat)
    for p in d.polygons:p.use_smooth=True
    if sub:
        s=o.modifiers.new('Editable soft surface','SUBSURF');s.levels=sub;s.render_levels=sub
    return o

def ellipsoid(name, pos, scale, mat, cat, segments=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=pos)
    o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    return attach(o,cat)

def curve(name, points, radius, mat, cat, smooth=True):
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=4;d.bevel_depth=radius;d.bevel_resolution=1
    if smooth:
        s=d.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
        for b,p in zip(s.bezier_points,points):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
    else:
        s=d.splines.new('POLY');s.points.add(len(points)-1)
        for b,p in zip(s.points,points):b.co=(*p,1)
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);d.materials.append(mat);return attach(o,cat)

def loft(name, rings, mat, cat, n=20, sub=1):
    # Horizontal quad rings, semantic body / garment cross-sections.
    verts=[]
    for z,x,y,rx,ry in rings:
        verts.extend([(x+rx*math.cos(2*math.pi*j/n),y+ry*math.sin(2*math.pi*j/n),z) for j in range(n)])
    faces=[tuple(reversed(range(n)))]
    for i in range(len(rings)-1):
        for j in range(n):faces.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
    faces.append(tuple((len(rings)-1)*n+j for j in range(n)))
    return mesh(name,verts,faces,mat,cat,sub)

# Proportions: about 5.8 bare heads, slim shoulders and elongated limbs.
loft('Torso shoulder-waist-hip quad cage',[(.485,0,0,.043,.034),(.51,0,0,.067,.042),(.55,0,0,.064,.040),(.61,0,0,.043,.029),(.665,0,-.002,.054,.034),(.72,0,0,.069,.038),(.767,0,0,.091,.029),(.785,0,0,.075,.026),(.801,0,0,.035,.022)],skin,'Body',24,1)
loft('Neck',[(.79,0,0,.029,.021),(.805,0,0,.024,.020),(.849,0,0,.023,.020),(.858,0,0,.029,.022)],skin,'Body',20,1)
head=loft('Head jaw-cheek-cranium editable quad cage',[(.826,0,-.012,.017,.022),(.838,0,-.010,.036,.038),(.868,0,-.004,.058,.052),(.893,0,0,.069,.062),(.920,0,.003,.069,.063),(.950,0,.006,.065,.060),(.977,0,.007,.050,.045),(.991,0,.008,.025,.025),(.995,0,.008,.005,.005)],skin,'Body',24,1)
for side in [-1,1]:
    sx=side
    # Slightly offset knees, near-balanced standing stance; no extreme contrapposto.
    loft(f'Leg {side} thigh-knee-calf-ankle cage',[(.051,.040*sx,-.004,.014,.017),(.083,.040*sx,.003,.016,.018),(.145,.042*sx,.013,.024,.023),(.228,.044*sx,.009,.027,.024),(.283,.045*sx,.003,.021,.023),(.315,.045*sx,0,.024,.025),(.385,.042*sx,0,.031,.029),(.46,.037*sx,0,.035,.032),(.505,.036*sx,0,.033,.029)],skin,'Body',20,1)
    loft(f'Arm {side} relaxed shoulder-elbow-wrist cage',[(.515,.134*sx,-.022,.012,.013),(.535,.136*sx,-.015,.014,.014),(.585,.127*sx,-.010,.017,.018),(.632,.117*sx,-.003,.019,.020),(.674,.112*sx,0,.020,.022),(.729,.099*sx,.001,.025,.024),(.771,.082*sx,0,.026,.024)],skin,'Body',16,1)
    ellipsoid(f'Hand palm {side}',(.138*sx,-.023,.495),(.016,.011,.027),skin,'Body',16,12)
    for finger in range(4):
        x=sx*(.127+finger*.006)
        curve(f'Finger {side}.{finger}',[(x,-.026,.486),(x+sx*.004,-.029,.467),(x+sx*.005,-.026,.461+abs(finger-1.5)*.003)],.0027,skin,'Body')
    curve(f'Thumb {side}',[(sx*.127,-.030,.506),(sx*.120,-.037,.490),(sx*.121,-.035,.482)],.0035,skin,'Body')
    ellipsoid(f'Ear {side}',(sx*.068,.001,.888),(.012,.010,.019),skin,'Face',16,12)

# Small restrained almond eyes, lids, nose and mouth: no oversized anime eyes.
for side in [-1,1]:
    x=side*.029
    ellipsoid(f'Eye white {side}',(x,-.0565,.913),(.018,.004,.008),eye_white,'Face')
    ellipsoid(f'Iris {side}',(x,-.0600,.913),(.007,.0018,.0070),iris,'Face',20,12)
    ellipsoid(f'Pupil {side}',(x,-.0615,.913),(.003,.001,.005),pupil,'Face',16,12)
    ellipsoid(f'Eye glint {side}',(x-.002,-.0625,.916),(.0012,.0007,.0012),ivory,'Face',12,8)
    curve(f'Upper eyelid {side}',[(x-.018,-.056,.913),(x-.008,-.061,.920),(x+.007,-.061,.920),(x+.018,-.054,.915)],.0015,hair_mid,'Face')
    curve(f'Lower eyelid {side}',[(x-.017,-.055,.912),(x,-.061,.907),(x+.017,-.055,.914)],.0008,lip,'Face')
    curve(f'Quiet brow {side}',[(x-.017,-.055,.933),(x,-.060,.936),(x+.014,-.055,.932)],.0019,hair_mid,'Face')
ellipsoid('Nose bridge',(0,-.061,.895),(.006,.005,.013),skin,'Face',16,12)
ellipsoid('Nose soft tip',(0,-.066,.886),(.008,.006,.005),skin,'Face',16,12)
curve('Calm closed upper lip',[(-.012,-.056,.868),(-.004,-.060,.869),(0,-.061,.868),(.004,-.060,.869),(.012,-.056,.868)],.0015,lip,'Face')
curve('Lower lip subtle volume',[(-.010,-.056,.867),(0,-.060,.864),(.010,-.056,.867)],.0014,lip,'Face')

# Hair shell: open at face and neck; crown has side/back volume, not a helmet sphere.
verts=[];faces=[];N=40;R=14
for i in range(R+1):
    u=(i+.025)/(R+.025)
    for j in range(N):
        a=2*math.pi*j/N
        front=max(0,-math.sin(a))
        end=2.10-.90*front
        t=u*end
        verts.append((.073*math.sin(t)*math.cos(a),.006+.067*math.sin(t)*math.sin(a),.918+.090*math.cos(t)))
for i in range(R):
    for j in range(N):faces.append((i*N+j,i*N+(j+1)%N,(i+1)*N+(j+1)%N,(i+1)*N+j))
mesh('Hair fitted crown shell',verts,faces,hair,'Hair',1)
ellipsoid('Low braided updo core',(0,.068,.906),(.063,.037,.043),hair_mid,'Hair')
# Interwoven crown braid follows authored oval arc; restrained alternating lobes.
for k in range(3):
    pts=[]
    for i in range(65):
        a=2*math.pi*i/64
        pulse=6*a+k*2*math.pi/3
        rr=.005*math.cos(pulse)
        pts.append(((.068+rr)*math.cos(a),.020+(.052+rr)*math.sin(a),.954+.024*math.sin(a)+.005*math.sin(pulse)))
    curve(f'Crown braid interwoven strand {k}',pts,.006,[hair_mid,hair,hair_mid][k],'Hair',False)
for k in range(3):
    pts=[]
    for i in range(65):
        a=2*math.pi*i/64;p=7*a+k*2*math.pi/3
        pts.append(((.046+.004*math.cos(p))*math.cos(a),.089+.004*math.sin(p),.905+(.029+.004*math.cos(p))*math.sin(a)))
    curve(f'Back bun braid {k}',pts,.006,hair_mid,'Hair',False)

def ribbon(name, points, widths, mat, cat, bulge=.002):
    # Width across local X for explicitly authored swept fringe/petal strips.
    vs=[]
    for i,(p,w) in enumerate(zip(points,widths)):
        for q in [-1,-.5,0,.5,1]:vs.append((p[0]+q*w,p[1]-bulge*(1-q*q),p[2]))
    fs=[]
    for i in range(len(points)-1):
        for j in range(4):fs.append((i*5+j,i*5+j+1,(i+1)*5+j+1,(i+1)*5+j))
    return mesh(name,vs,fs,mat,cat,1)

for i in range(7):
    x=-.056+i*.017
    pts=[(x*.65,-.019,.996),(x*.95,-.054,.979),(x,-.065,.954),(x-.009,-.064,.934),(x-.015,-.062,.925 if i in [2,3,4] else .907)]
    ribbon(f'Swept parted fringe lock {i}',pts,[.010,.015,.014,.009,.001],[hair,hair_mid,hair,hair_mid,hair,hair_mid,hair][i],'Hair')
    curve(f'Soft fringe plane highlight {i}',[(p[0]-.003,p[1]-.003,p[2]) for p in pts[:-1]],.00075,hair_light,'Hair')
for side in [-1,1]:
    ribbon(f'Temple tendril {side}',[(side*.061,-.023,.950),(side*.073,-.030,.922),(side*.074,-.035,.887),(side*.065,-.035,.853),(side*.075,-.030,.837)],[.010,.011,.007,.004,.0006],hair,'Hair')

# Real overlapping petal surfaces; pointed tips, curved central ridge and thin edges.
def petal(name, base, tip, width, mat, cat, bend=.012, across=None):
    b=Vector(base);t=Vector(tip);axis=t-b
    if across is None:
        across=Vector((-axis.y,axis.x,0))
        if across.length < .01: across=Vector((1,0,0))
    across=Vector(across).normalized()
    normal=across.cross(axis.normalized()).normalized()
    vs=[];rows=7;cols=5
    for i in range(rows):
        u=i/(rows-1);w=width*(math.sin(math.pi*u)**.75)*(.90+.10*u)+.0003
        center=b+axis*u+normal*(bend*math.sin(math.pi*u))
        for j in range(cols):
            v=2*j/(cols-1)-1
            p=center+across*w*v+normal*(width*.18*(1-v*v)*math.sin(math.pi*u))
            vs.append(tuple(p))
    fs=[]
    for i in range(rows-1):
        for j in range(cols-1):fs.append((i*cols+j,i*cols+j+1,(i+1)*cols+j+1,(i+1)*cols+j))
    o=mesh(name,vs,fs,mat,cat,1)
    sol=o.modifiers.new('Thin petal thickness','SOLIDIFY');sol.thickness=.0011;sol.offset=0
    return o

loft('Dress fitted teal bodice',[(.603,0,0,.045,.031),(.645,0,-.001,.048,.032),(.700,0,0,.066,.039),(.740,0,0,.068,.037),(.757,0,0,.057,.030)],teal,'Dress',24,1)
loft('Skirt soft underlying slip',[(.37,0,.004,.073,.049),(.405,0,0,.115,.074),(.50,0,0,.096,.063),(.585,0,0,.062,.041),(.62,0,0,.046,.032)],lav_deep,'Dress',24,1)
for layer,(count,z0,z1,r0,r1,w) in enumerate([(12,.59,.365,.051,.150,.041),(10,.625,.425,.046,.131,.045),(9,.646,.486,.044,.102,.039)]):
    for i in range(count):
        a=2*math.pi*(i/count+.045*layer)
        c=math.cos(a);s=math.sin(a)
        mat=[lav,lav_pale,lav,teal,lav_pale,lav_deep][(i+2*layer)%6]
        tip=(r1*c,r1*s,z1+.012*math.sin(i*2.4))
        petal(f'Skirt layer {layer+1} petal {i+1}',(r0*c,r0*s,z0),tip,w,mat,'Dress',.008,(-s,c,0))
        if i%3==0:
            curve(f'Petal soft gold midrib {layer}.{i}',[(r0*c,r0*s,z0),((r0+r1)*.51*c,(r0+r1)*.51*s,(z0+tip[2])*.52),(tip[0]*.985,tip[1]*.985,tip[2]+.008)],.00065,gold,'Dress')
# Scalloped flower-like neckline and waist rosette rather than armor panels.
for i in range(7):
    x=(i-3)*.016
    petal(f'Neckline upward petal {i}',(x*.7,-.035,.700),(x,-.038,.773-abs(i-3)*.004),.013,[lav,teal_light,lav_pale][i%3],'Dress',.004,(1,0,0))
for i in range(6):
    a=2*math.pi*i/6
    petal(f'Waist flower petal {i}',(0,-.041,.634),(.029*math.cos(a),-.047,.634+.027*math.sin(a)),.010,lav_pale,'Dress',.003,(math.sin(a),0,-math.cos(a)))
ellipsoid('Waist flower pale gold center',(0,-.052,.634),(.007,.004,.007),gold,'Dress',16,10)
for side in [-1,1]:
    ribbon(f'Teal floating sash {side}',[(side*.041,.012,.635),(side*.112,.017,.562),(side*.161,.029,.451),(side*.183,.013,.329),(side*.164,-.007,.295)],[.008,.010,.009,.006,.002],teal,'Dress',.002)
    ellipsoid(f'Sash gold end {side}',(side*.164,-.007,.295),(.004,.003,.010),gold,'Dress',12,8)

# Crocus accessory on the near temple: six pointed petals, gold saffron stamens.
flower=Vector((-.065,-.060,.966))
for i in range(6):
    a=2*math.pi*i/6
    tip=flower+Vector((.043*math.cos(a),-.013,.043*math.sin(a)))
    petal(f'Crocus pointed bloom petal {i}',flower,tip,.015,[lav,lav_pale,lav_deep][i%3],'Crocus',.007,(math.sin(a),0,-math.cos(a)))
for i in range(3):
    end=flower+Vector((-.010+i*.010,-.025,.018+.004*(i%2)))
    curve(f'Saffron stamen {i}',[tuple(flower),tuple(end)],.0013,gold,'Crocus')
    ellipsoid(f'Saffron anther {i}',end,(.002,.002,.004),gold,'Crocus',12,8)
for side in [-1,1]:
    pts=[tuple(flower),(-.082,-.061,.974),(-.095,-.060,1.019 if side==1 else .937)]
    curve(f'Gold botanical ornament stem {side}',pts,.0009,gold,'Crocus')
    for i in range(4):
        z=.951+i*.012
        petal(f'Gold accessory leaf {side}.{i}',(-.085,-.060,z),(-.098-side*.006,-.062,z+.010),.003,gold,'Crocus',.001,(0,0,1))

# Two forewings + two lower wings. Mesh membrane, raised outline, fine veins.
for side in [-1,1]:
    for upper in [True,False]:
        origin=Vector((side*.036,.037,.745 if upper else .686))
        if upper:
            outline=[(0,0),(.10,.10),(.24,.205),(.37,.245),(.335,.133),(.260,.040),(.145,-.005)]
        else:
            outline=[(0,0),(.09,.005),(.225,-.020),(.290,-.075),(.205,-.119),(.105,-.080)]
        # Rounded membrane boundary with explicit shape control, not a polygonal shard.
        smooth_outline=[]
        for i in range(len(outline)):
            p0=Vector(outline[(i-1)%len(outline)]);p1=Vector(outline[i])
            p2=Vector(outline[(i+1)%len(outline)]);p3=Vector(outline[(i+2)%len(outline)])
            for k in range(4):
                t=k/4
                q=.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)
                smooth_outline.append(tuple(q))
        perimeter=[origin+Vector((side*x,.025+x*.18,z)) for x,z in smooth_outline]
        center=sum(perimeter,Vector())/len(perimeter);vs=[tuple(center)]+[tuple(p) for p in perimeter]
        fs=[(0,1+i,1+(i+1)%len(perimeter)) for i in range(len(perimeter))]
        # A filled membrane must reach the same perimeter as its outline.
        # A subdivided triangle fan shrank away from that border, producing a hollow loop.
        o=mesh(f'{"Upper" if upper else "Lower"} wing membrane {side}',vs,fs,wing_mat,'Wings',0)
        solid=o.modifiers.new('Thin membrane','SOLIDIFY');solid.thickness=.0006
        curve(f'Wing edge {side}.{upper}',[tuple(p) for p in perimeter]+[tuple(perimeter[0])],.0010,wing_edge,'Wings',False)
        for i in range(8,len(perimeter)-4,4):
            p=perimeter[i]
            midpoint=origin.lerp(p,.50)+Vector((0,-.001,.013))
            curve(f'Wing main vein {side}.{upper}.{i}',[tuple(origin),tuple(midpoint),tuple(p)],.00065,wing_vein,'Wings')
            for t in [.46,.72]:
                q=origin.lerp(p,t)
                target=q.lerp(perimeter[min(i+4,len(perimeter)-1)],.32)
                curve(f'Wing branch {side}.{upper}.{i}.{t}',[tuple(q),tuple(target)],.00045,wing_vein,'Wings')

# Delicate strapped lavender shoes with petal ankle flowers and low tapered heels.
for side in [-1,1]:
    x=side*.040
    ellipsoid(f'Shoe {side} tapered toe',(x,-.018,.025),(.017,.038,.025),lav,'Footwear',20,12)
    loft(f'Shoe {side} small heel',[(0,x,.016,.006,.008),(.026,x,.016,.009,.011)],gold,'Footwear',12,0)
    curve(f'Shoe {side} instep strap',[(x-.016,-.025,.039),(x,-.030,.054),(x+.016,-.025,.039)],.0025,gold,'Footwear')
    curve(f'Ankle ribbon {side}',[(x-.016,0,.068),(x,-.014,.072),(x+.016,0,.068),(x,.018,.065),(x-.016,0,.068)],.0022,lav_deep,'Footwear')
    for i in range(5):
        a=2*math.pi*i/5
        petal(f'Ankle crocus {side}.{i}',(x,-.019,.070),(x+.012*math.cos(a),-.023,.070+.012*math.sin(a)),.0045,lav_pale,'Footwear',.001,(math.sin(a),0,-math.cos(a)))
    ellipsoid(f'Ankle ornament gold {side}',(x,-.026,.070),(.003,.002,.003),gold,'Footwear',12,8)

# Review setup: only one SE camera, no floor or contact shadow.
bpy.ops.object.camera_add(location=(0,-8,4.618802))
camera=bpy.context.object;camera.name='PetalPal_fixed_30deg_ortho';attach(camera,'Review_Setup')
camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=1.75;scene.camera=camera
scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100
bpy.context.view_layer.update()
p=world_to_camera_view(scene,camera,Vector((0,0,0)))
camera.data.shift_y=p.y-.125
bpy.context.view_layer.update()
p=world_to_camera_view(scene,camera,Vector((0,0,0)))
assert abs(p.x-.5)<1e-5 and abs(p.y-.125)<1e-5,(p.x,p.y)

def area(name,position,energy,size,color):
    bpy.ops.object.light_add(type='AREA',location=position)
    o=bpy.context.object;o.name=name;attach(o,'Review_Setup');o.data.energy=energy;o.data.shape='DISK';o.data.size=size;o.data.color=color
    o.rotation_euler=(Vector((0,0,.60))-o.location).to_track_quat('-Z','Y').to_euler()
area('Soft key',(-2,-3,4),170,4,(1,.94,.89))
area('Neutral soft fill',(2,-1,2),90,3,(.90,.94,1))
area('Gentle overhead',(0,2,3),100,3,(1,1,1))
scene.world.color=(.18,.18,.18)
scene.render.engine='CYCLES';scene.cycles.samples=128;scene.cycles.seed=11;scene.cycles.use_denoising=True
scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8'
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
scene.render.fps=48
scene['prototype_status']='V1 SE standing study; NOT visually approved; no clips/armature'
scene['reference']='Resources/icon/fairy.png; untouched authoritative design sheet'
scene['standing_body_height']=.995
scene['foot_anchor_normalized']=[.5,.875]
# Link the complete unchanged sheet for modeler review; never render/crop it.
reference=bpy.data.images.load(str(BASE.parent/'icon'/'fairy.png'),check_existing=True)
reference.filepath='//../../icon/fairy.png'
reference.use_fake_user=True
scene['authoritative_reference_image']=reference.name
base_triangles=0;base_polygons=0
for o in scene.objects:
    if o.type=='MESH':
        o.data.calc_loop_triangles();base_triangles+=len(o.data.loop_triangles);base_polygons+=len(o.data.polygons)
# Preserve root selection and an immediately useful camera view when opened.
bpy.ops.object.select_all(action='DESELECT');root.select_set(True);bpy.context.view_layer.objects.active=root
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':
            a.spaces.active.region_3d.view_perspective='CAMERA'

output=BASE/'review'/'fairy_v1_SE.png';scene.render.filepath=str(output)
bpy.ops.wm.save_as_mainfile(filepath=str(BASE/'blender'/'fairy_v1.blend'))
deps=bpy.context.evaluated_depsgraph_get();triangles=0;polygons=0;categories={}
for o in scene.objects:
    if o.type not in {'MESH','CURVE'}:continue
    ev=o.evaluated_get(deps);m=ev.to_mesh();m.calc_loop_triangles()
    triangles+=len(m.loop_triangles);polygons+=len(m.polygons)
    ev.to_mesh_clear()
    cat=o.users_collection[0].name;categories[cat]=categories.get(cat,0)+1
report={'blender':bpy.app.version_string,'engine':scene.render.engine,'samples':128,'direction':'SE','heading_degrees':45,'camera':'ORTHO','elevation_degrees':30,'ortho_scale':1.75,'resolution':[512,512],'pivot':[p.x,1-p.y],'base_mesh_triangles_excluding_curves':base_triangles,'base_mesh_polygons_excluding_curves':base_polygons,'render_evaluated_triangles':triangles,'render_evaluated_polygons':polygons,'object_categories':categories,'rig_created':False,'bare_sole_to_crown_units':.995,'head_height_units':.169}
(BASE/'review'/'fairy_v1_model_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
bpy.ops.render.render(write_still=True)
print('FAIRY_V1_REPORT',json.dumps(report))
