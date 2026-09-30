"""Structural reference reconstruction. No runtime export or garden integration."""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector

HERE=Path(__file__).resolve().parent
REFERENCE=HERE.parent/'bridge-main.png'
reference_hash=hashlib.sha256(REFERENCE.read_bytes()).hexdigest()
OUT=HERE.parent/'structural_review'
OUT.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
root=bpy.data.objects.new('BridgeStructure_SymmetryOrigin',None)
scene.collection.objects.link(root)
root['authority']='bridge-main.png; structural reconstruction for visual approval'
root['symmetry']='X: both ends; Y: both sides. Live mirror modifiers retained.'
HALF=3.6
WIDTH=2.65
RISE=1.15
def deck(x): return RISE*math.cos(math.pi*x/(2*HALF))
def top(x): return 1.27+1.14*math.cos(math.pi*x/(2*HALF))
def material(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.76
 return m
wood=material('Neutral clay - plank and post',(.47,.44,.39))
branch=material('Neutral clay - branch structure',(.34,.33,.30))
trim=material('Neutral clay - cap and frame',(.40,.38,.34))
def mesh(name,verts,faces,mat,axes=(True,True,False),bevel=0):
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
 ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.parent=root;ob.data.materials.append(mat)
 if any(axes):
  mod=ob.modifiers.new('Structural symmetry: ends X / sides Y','MIRROR');mod.use_axis=axes;mod.use_clip=True;mod.use_mirror_merge=True;mod.merge_threshold=.0001;mod.mirror_object=root
 if bevel:
  mod=ob.modifiers.new('Soft timber edges','BEVEL');mod.width=bevel;mod.segments=3
  mod=ob.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
 return ob
def block(name,x0,x1,y0,y1,z0,z1,mat=wood,axes=(True,True,False),bevel=.025):
 return mesh(name,[(x,y,z) for z in (z0,z1) for y in (y0,y1) for x in (x0,x1)],[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)],mat,axes,bevel)
# Each half-board is a curved solid, mirrored across the deck and the span.
# Fine longitudinal subdivisions keep the walking surface on the same arch.
for i in range(12):
 a=i*HALF/12+.008;b=(i+1)*HALF/12-.008
 verts=[]
 for layer in (0,1):
  for j in range(5):
   x=a+(b-a)*j/4
   for y in (0,WIDTH/2):verts.append((x,y,deck(x)-(.15 if layer==0 else 0)))
 faces=[]
 for j in range(4):
  k=j*2;faces.extend([(k,k+2,k+3,k+1),(10+k,11+k,13+k,12+k),(k,10+k,12+k,k+2),(k+1,k+3,k+13,k+11)])
 faces.extend([(0,1,11,10),(8,18,19,9)])
 mesh('Deck plank mirrored pair %02d'%i,verts,faces,wood,bevel=.014)

def tube(name,points,radii,mat=branch,sides=12):
 verts=[];faces=[]
 for i,point in enumerate(points):
  p=Vector(point);t=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
  t.normalize();u=t.cross(Vector((0,0,1)))
  if u.length<.01:u=t.cross(Vector((0,1,0)))
  u.normalize();v=t.cross(u).normalized()
  for j in range(sides):
   angle=2*math.pi*j/sides;pos=p+radii[i]*(math.cos(angle)*u+math.sin(angle)*v);verts.append(tuple(pos))
 for i in range(len(points)-1):
  for j in range(sides):a=i*sides+j;b=i*sides+(j+1)%sides;faces.append((a,b,b+sides,a+sides))
 faces.extend([tuple(reversed(range(sides))),tuple((len(points)-1)*sides+j for j in range(sides))])
 ob=mesh(name,verts,faces,mat)
 for p in ob.data.polygons:p.use_smooth=True
 return ob

# Substantial curved deck fascia/stringers visible beneath the boards.
verts=[]
for i in range(65):
 x=HALF*i/64
 for y,z in [(WIDTH/2-.08,deck(x)-.06),(WIDTH/2+.10,deck(x)-.06),(WIDTH/2+.10,deck(x)-.34),(WIDTH/2-.08,deck(x)-.34)]:verts.append((x,y,z))
faces=[]
for i in range(64):
 for j in range(4):faces.append((4*i+j,4*i+(j+1)%4,4*(i+1)+(j+1)%4,4*(i+1)+j))
faces.append(tuple(256+j for j in range(4)))
mesh('Continuous arched timber side body',verts,faces,trim,bevel=.018)

# ONE authoritative end post, mirrored to exactly four corner posts.
px=3.43;py=WIDTH/2+.075;base=deck(px)-.05
block('Four main square timber posts',px-.15,px+.15,py-.15,py+.15,base,base+1.53)
block('Post square foot collars',px-.19,px+.19,py-.19,py+.19,base-.04,base+.13,trim)
block('Post cap lower plate',px-.23,px+.23,py-.23,py+.23,base+1.50,base+1.57,trim)
block('Post cap upper plate',px-.19,px+.19,py-.19,py+.19,base+1.57,base+1.65,trim)
# Turned post crown, structural cap silhouette visible in the reference.
profile=[(0,.13),(.04,.14),(.09,.105),(.15,.075),(.18,.068),(.22,.086),(.27,.045),(.30,0)]
verts=[];faces=[]
for z,r in profile:
 for j in range(24):a=j*math.tau/24;verts.append((px+r*math.cos(a),py+r*math.sin(a),base+1.65+z))
for i in range(len(profile)-1):
 for j in range(24):faces.append((i*24+j,i*24+(j+1)%24,(i+1)*24+(j+1)%24,(i+1)*24+j))
crown=mesh('Four turned post crowns',verts,faces,trim)
for p in crown.data.polygons:p.use_smooth=True

# Main woody handrail: intertwined irregular branch bodies, no leaves/flowers.
for strand in range(2):
 points=[];radii=[]
 for i in range(97):
  t=i/96;x=px*t;phase=3.2*math.pi*(1-math.cos(math.pi*t))/2+strand*math.pi
  amplitude=.085*math.sin(math.pi*t)**2
  points.append((x,py+amplitude*math.cos(phase),top(x)+amplitude*math.sin(phase)))
  radii.append((.10 if strand==0 else .078)*(1-.16*t)+.008*math.cos(phase)**2)
 tube('Intertwined upper branch %d'%strand,points,radii)
# Curved bottom woody rail and organic lattice struts, mirrored identically.
points=[(px*i/64,py,deck(px*i/64)+.17) for i in range(65)]
tube('Lower branch sill',points,[.09]*65)
def bezier(name,controls,r0,r1):
 ps=[];rs=[]
 for i in range(41):
  t=i/40;s=1-t
  p=sum((Vector(c)*w for c,w in zip(controls,[s**3,3*s*s*t,3*s*t*t,t**3])),Vector())
  ps.append(tuple(p));rs.append(r0+(r1-r0)*t)
 tube(name,ps,rs)
bezier('Central fork rising into crown',[(0,py,deck(0)+.17),(.32,py-.035,1.82),(.88,py+.025,2.40),(1.22,py,top(1.22))],.095,.072)
bezier('Crossing branch sweep',[(0,py+.06,top(0)-.01),(.68,py+.095,2.02),(1.42,py+.09,.96),(1.76,py,deck(1.76)+.18)],.080,.093)
bezier('Outer fork ascending',[(1.55,py,deck(1.55)+.17),(1.85,py-.06,1.29),(2.07,py-.045,1.95),(2.38,py,top(2.38))],.09,.07)
bezier('End diagonal branch',[(1.74,py+.045,top(1.74)-.06),(2.20,py+.09,1.45),(2.86,py+.09,.43),(3.35,py,deck(3.35)+.17)],.078,.092)
bezier('Post to rail organic junction',[(2.75,py,deck(2.75)+.17),(2.86,py-.03,.80),(3.08,py-.015,1.07),(3.40,py,1.25)],.075,.07)
# End bearing timbers and short landing lips: same at both ends, no landscape.
block('End bearing cross beams',3.30,3.60,0,WIDTH/2+.23,-.30,-.12,trim)
block('Short level wooden landing lips',3.60,3.86,0,WIDTH/2+.08,-.15,0,wood)
block('End structural bearing shoes',3.26,3.62,WIDTH/2-.22,WIDTH/2+.23,-.48,-.27,trim)

# Reference remains external and unchanged; embed a copy for convenient inspection.
ref=bpy.data.images.load(str(REFERENCE),check_existing=True);ref.pack()
scene['design_reference']='bridge-main.png FINAL DESIGN; structure only; symmetry constrained'
scene['review_dimensions']=json.dumps({'deckSpan':7.2,'clearDeckWidth':2.65,'deckRise':1.15,'mainPosts':4})
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=1600;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
scene.world.color=(.28,.28,.28)
def light(name,location,power,size):
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
 ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=location;ob.rotation_euler=(Vector((0,0,1))-ob.location).to_track_quat('-Z','Y').to_euler()
light('Softbox key',(-3,-5,9),1250,7)
light('Softbox fill',(4,4,6),950,6)
light('Front fill',(-7,2,3),450,5)
camdata=bpy.data.cameras.new('Structural review orthographic');cam=bpy.data.objects.new('Structural review camera',camdata);scene.collection.objects.link(cam);scene.camera=cam;camdata.type='ORTHO';camdata.ortho_scale=11.6
target=Vector((0,0,1.0))
def setview(az,elev):
 a=math.radians(az);e=math.radians(elev)
 cam.location=target+Vector((12*math.cos(e)*math.sin(a),-12*math.cos(e)*math.cos(a),12*math.sin(e)))
 cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();bpy.context.view_layer.update()
def signature():
 return hashlib.sha256(json.dumps([(o.name,[v for row in o.matrix_local for v in row],[list(v.co) for v in o.data.vertices]) for o in sorted(root.children,key=lambda o:o.name)],sort_keys=True).encode()).hexdigest()
fixed=signature()
views=[('front',90,8),('three_quarter',-48,30),('side',0,0),('petalpal_55',-48,55)]
setview(-48,55)
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'bridge_master.blend'))
for name,az,elev in views:
 setview(az,elev);assert signature()==fixed
 scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
 assert signature()==fixed
setview(-48,55)
scene.render.filepath=str(OUT/'petalpal_55.png')
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'bridge_master.blend'))
assert hashlib.sha256(REFERENCE.read_bytes()).hexdigest()==reference_hash
(OUT/'review_manifest.json').write_text(json.dumps({'referenceSha256':reference_hash,'structureSha256':fixed,'views':[{'name':n,'azimuth':a,'elevation':e} for n,a,e in views],'symmetry':'Live X/Y mirrors; four corner posts; no independent hidden-side model','dimensions':json.loads(scene['review_dimensions'])},indent=2))
print('STRUCTURAL_REVIEW_COMPLETE',fixed,flush=True)
