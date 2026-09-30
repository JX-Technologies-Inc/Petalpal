"""Replace only the wisteria mesh. Reuse existing materials, stems and symmetry."""
import bpy, math, random, json, hashlib
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).resolve().parent
OUT=HERE.parent/'wisteria_review';OUT.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(HERE/'bridge_master.before-wisteria-fix.blend'))
scene=bpy.context.scene;cam=scene.camera
old=bpy.data.objects['Lightweight hanging floral racemes']
root=bpy.data.objects['BridgeStructure_SymmetryOrigin']
materials=list(old.data.materials);collection=old.users_collection[0]
def digest():
 records=[]
 for ob in sorted(bpy.data.objects,key=lambda o:o.name):
  if ob==old or ob.type=='CAMERA' or ob.get('wisteria_replacement'):continue
  r={'name':ob.name,'matrix':[v for row in ob.matrix_local for v in row]}
  if ob.type=='MESH':
   r['vertices']=[list(v.co) for v in ob.data.vertices];r['faces']=[list(p.vertices) for p in ob.data.polygons]
   r['materials']=[m.name for m in ob.data.materials];r['assignments']=[p.material_index for p in ob.data.polygons]
  r['modifiers']=[(m.name,m.type,tuple(m.use_axis) if m.type=='MIRROR' else None) for m in ob.modifiers]
  records.append(r)
 return hashlib.sha256(json.dumps(records,sort_keys=True).encode()).hexdigest()
protected=digest()
camera_matrix=cam.matrix_world.copy();original_path=scene.render.filepath
verts=[];faces=[];indices=[]
def petal(base,direction,width,length,twist,material):
 # A gently folded spoon/wing surface, not a closed round volume.
 d=Vector(direction).normalized();u=d.cross(Vector((0,1,0))).normalized()
 if u.length<.01:u=Vector((1,0,0))
 v=d.cross(u).normalized();u2=u*math.cos(twist)+v*math.sin(twist);v2=d.cross(u2)
 offset=len(verts)
 for i in range(6):
  t=i/5;spread=width*math.sin(math.pi*t)**.7
  for j in range(3):
   s=j-1;p=base+d*length*t+u2*spread*s+v2*(length*.20*math.sin(math.pi*t)-abs(s)*width*.18)
   verts.append(tuple(p))
 for i in range(5):
  for j in range(2):k=offset+i*3+j;faces.append((k,k+1,k+4,k+3));indices.append(material)
def blossom(p,size,angle,rng):
 # Three open petal-like wings with varied directions and unequal lengths.
 for j in range(3):
  a=angle+j*math.tau/3
  direction=(.55*math.cos(a),.42*math.sin(a),-.82 if j else -.5)
  petal(p,direction,size*(.42 if j else .55),size*(1+.18*rng.random()),a*.35,(j+rng.randrange(3))%3)

counts=[]
for cluster,x in enumerate([.42,1.28,2.12,2.93]):
 for strand in range(3):
  rng=random.Random(1431+cluster*31+strand*107)
  anchor=Vector((x+(strand-1)*.095,1.57+.045*(strand%2),1.27+1.14*math.cos(math.pi*x/7.2)-.035))
  length=[.82,1.02,.69,.79][cluster]*(.80+.14*strand)
  # These are the existing thin curved stems: do not replace vine geometry.
  def stem(t):return anchor+Vector((.025*math.sin(t*4),.09*t,-length*t))
  variant=(cluster+strand)%3
  levels=[.02,.10,.19,.29,.39,.50,.60,.72,.85,.97]
  count=0
  for k,t in enumerate(levels):
   t=max(0,min(1,t+rng.uniform(-.025,.025)))
   # Below 70%: isolated flowers with larger visible gaps, never a bulb.
   n=(3 if k<3 else 2 if k<6 else 1)
   if variant==0 and k==6:continue
   for j in range(n):
    a=j*math.tau/max(1,n)+k*2.1+rng.uniform(-.65,.65)
    radial=(.06*(1-t)+.009)*( .70+.6*rng.random())
    p=stem(t)+Vector((math.cos(a)*radial,math.sin(a)*radial,rng.uniform(-.022,.022)))
    size=(.105*(1-.52*t))*(.72+.50*rng.random())
    if k==9:size*=.55
    blossom(p,size,a,rng);count+=1
  counts.append(count)
data=bpy.data.meshes.new('Wisteria open petal surfaces');data.from_pydata(verts,[],faces);data.update()
ob=bpy.data.objects.new('Wisteria airy racemes - short medium long',data);collection.objects.link(ob)
ob['wisteria_replacement']=True
ob['variants']='Short / medium / long; sparse lower third; three open wings per blossom'
for m in materials:data.materials.append(m)
for i,p in enumerate(data.polygons):p.material_index=indices[i];p.use_smooth=True
mirror=ob.modifiers.new('Dressing symmetry across sides and ends','MIRROR');mirror.use_axis=(True,True,False);mirror.mirror_object=root;mirror.use_clip=True
# Remove only the obsolete flower cluster object; its old datablock is retained
# as an unused recoverable datablock until Blender purges it on a later save.
bpy.data.objects.remove(old,do_unlink=True)
old=None
assert digest()==protected,'Non-wisteria content changed'
target=Vector((0,0,1))
for name,az,elev in [('side',0,0),('three_quarter',-48,30),('petalpal_55',-48,55)]:
 a=math.radians(az);e=math.radians(elev)
 cam.location=target+Vector((12*math.cos(e)*math.sin(a),-12*math.cos(e)*math.cos(a),12*math.sin(e)))
 cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();bpy.context.view_layer.update()
 scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
 assert digest()==protected
cam.matrix_world=camera_matrix;scene.render.filepath=original_path;bpy.context.view_layer.update()
assert all(abs(a-b)<1e-6 for rowa,rowb in zip(cam.matrix_world,camera_matrix) for a,b in zip(rowa,rowb))
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'bridge_master.blend'))
(OUT/'verification.json').write_text(json.dumps({'nonWisteriaBefore':protected,'nonWisteriaAfter':digest(),'cameraRestored':True,'existingMaterialsReused':[m.name for m in materials],'quarterBlossomCounts':counts,'baseFaces':len(faces),'representation':'Open three-wing petal surfaces; no spheres or closed beads; no subdivision modifier'},indent=2))
print('WISTERIA_ONLY_COMPLETE',protected,flush=True)
