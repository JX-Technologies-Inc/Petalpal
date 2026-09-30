"""Material/decorative pass only. Loads the frozen approved structural master."""
import bpy, math, json, hashlib, random
from pathlib import Path
from mathutils import Vector
from array import array
HERE=Path(__file__).resolve().parent
OUT=HERE.parent/'visual_review'
OUT.mkdir(exist_ok=True)
REFERENCE=HERE.parent/'bridge-main.png'
reference_hash=hashlib.sha256(REFERENCE.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(HERE/'bridge_master.approved-structure.blend'))
scene=bpy.context.scene
root=bpy.data.objects['BridgeStructure_SymmetryOrigin']
structural=list(root.children)
def structure_record():
 records=[]
 for o in sorted(structural,key=lambda ob:ob.name):
  mods=[]
  for m in o.modifiers:
   props={}
   for p in m.bl_rna.properties:
    if p.identifier in ('rna_type','name','type') or p.type=='POINTER' or p.type=='COLLECTION':continue
    try:
     v=getattr(m,p.identifier)
     props[p.identifier]=list(v) if p.is_array else v
    except Exception:pass
   mods.append({'name':m.name,'type':m.type,'properties':props})
  records.append({'name':o.name,'matrix':[v for row in o.matrix_local for v in row],
   'vertices':[list(v.co) for v in o.data.vertices],'polygons':[list(p.vertices) for p in o.data.polygons],
   'modifiers':mods})
 return records
before=structure_record()
signature=hashlib.sha256(json.dumps(before,sort_keys=True).encode()).hexdigest()
def rgb(h):
 v=[int(h[i:i+2],16)/255 for i in (0,2,4)]
 return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in v)+(1,)
def painted(name,lo,hi,grain=False,axis='Y'):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=rgb(hi)
 n=m.node_tree.nodes;l=m.node_tree.links;n.clear()
 out=n.new('ShaderNodeOutputMaterial');diff=n.new('ShaderNodeBsdfDiffuse');diff.inputs['Roughness'].default_value=.8
 tex=n.new('ShaderNodeTexCoord');scale=n.new('ShaderNodeVectorMath');scale.operation='MULTIPLY'
 scale.inputs[1].default_value=(18,.6,5) if grain and axis=='Y' else ((9,9,.6) if grain else (5,5,5))
 l.new(tex.outputs['Object'],scale.inputs[0]);noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=1.7;noise.inputs['Detail'].default_value=2.0;noise.inputs['Roughness'].default_value=.58
 l.new(scale.outputs['Vector'],noise.inputs['Vector']);ramp=n.new('ShaderNodeValToRGB')
 ramp.color_ramp.elements[0].position=.23;ramp.color_ramp.elements[0].color=rgb(lo)
 ramp.color_ramp.elements[1].position=.78;ramp.color_ramp.elements[1].color=rgb(hi)
 l.new(noise.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs['Color'],diff.inputs['Color']);l.new(diff.outputs[0],out.inputs['Surface'])
 return m
deck=painted('Painted warm plank tops','A27D59','C5A076',True)
sides=painted('Dark plank seams and sides','624B36','957354',True)
post=painted('Organic medium brown post wood','705035','A58055',True,'Z')
branchmat=painted('Warm woody branch body','856749','B59870',True,'Z')
caps=painted('Muted ochre post caps','89704D','C7AD75',True)
greens=[painted('Foliage olive','3D5422','758D3C'),painted('Foliage light','4F692B','91A84E'),painted('Foliage deep','304B20','667D32')]
vine=painted('Living vines','3B5125','73803C')
purple=painted('PetalPal crocus purple A67EB7','765094','A67EB7')
teal=painted('PetalPal crocus teal 5AA4AB','387882','5AA4AB')
cream=painted('PetalPal crocus cream FBEBCB','CFBC9A','FBEBCB')
center=painted('PetalPal flower center FCE6AC','DAB859','FCE6AC')
hangmats=[painted('Hanging lilac','82559F','B590CD'),painted('Hanging violet','654285','A47AC2'),painted('Hanging pale tips','AF8AC9','D4B8E8')]
stone=painted('Small warm grey transition stones','817B64','BDB49A')
for o in structural:
 o.data.materials.clear()
 if o.name.startswith('Deck plank'):
  o.data.materials.append(deck);o.data.materials.append(sides)
  for p in o.data.polygons:p.material_index=0 if p.center.z>0 and p.normal.z<-.5 else 1
  # Original top face winding points down; identify actual top by vertex height.
  for p in o.data.polygons:
   p.material_index=0 if all(abs(o.data.vertices[i].co.z-1.15*math.cos(math.pi*o.data.vertices[i].co.x/7.2))<.001 for i in p.vertices) else 1
 elif 'cap' in o.name or 'crown' in o.name:o.data.materials.append(caps)
 elif any(w in o.name.lower() for w in ('branch','fork','junction','sweep','sill')):o.data.materials.append(branchmat)
 elif 'landing' in o.name:o.data.materials.append(deck)
 else:o.data.materials.append(post)

decor=bpy.data.collections.new('VISUAL PASS - separate mirrored dressing');scene.collection.children.link(decor)
def mesh(name,verts,faces,materials,indices=None):
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
 ob=bpy.data.objects.new(name,data);decor.objects.link(ob)
 for m in materials:data.materials.append(m)
 for i,p in enumerate(data.polygons):p.use_smooth=True;p.material_index=indices[i] if indices else 0
 mod=ob.modifiers.new('Dressing symmetry across sides and ends','MIRROR');mod.use_axis=(True,True,False);mod.mirror_object=root;mod.use_clip=True
 return ob
class Batch:
 def __init__(self,name,mats):self.name=name;self.mats=mats;self.v=[];self.f=[];self.mi=[]
 def add(self,verts,faces,mat=0):
  offset=len(self.v);self.v.extend([tuple(v) for v in verts]);self.f.extend([tuple(offset+j for j in face) for face in faces]);self.mi.extend([mat]*len(faces))
 def finish(self):return mesh(self.name,self.v,self.f,self.mats,self.mi)
leaves=Batch('Small folded leaves - mirrored growth',greens)
vines=Batch('Slender vines following approved railings',[vine])
flowers=Batch('PetalPal crocus groups',[purple,teal,cream,center])
hangs=Batch('Lightweight hanging floral racemes',hangmats)
rocks=Batch('Small end transition stones',[stone])
def tube(batch,points,radius,mat=0,sides=7):
 vs=[];fs=[]
 for i,co in enumerate(points):
  p=Vector(co);t=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)])).normalized()
  u=t.cross(Vector((0,0,1)))
  if u.length<.01:u=t.cross(Vector((0,1,0)))
  u.normalize();v=t.cross(u).normalized();r=radius[i] if isinstance(radius,list) else radius
  for j in range(sides):vs.append(p+r*(math.cos(j*math.tau/sides)*u+math.sin(j*math.tau/sides)*v))
 for i in range(len(points)-1):
  for j in range(sides):fs.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
 batch.add(vs,fs,mat)
def leaf(base,direction,length,width,mat=0):
 p=Vector(base);d=Vector(direction).normalized();u=d.cross(Vector((0,0,1)))
 if u.length<.01:u=Vector((1,0,0))
 u.normalize();n=u.cross(d).normalized();vs=[]
 for i in range(7):
  t=i/6;w=width*math.sin(math.pi*t)**.85
  centerline=p+d*length*t+n*.045*math.sin(math.pi*t)
  vs.extend([centerline-u*w,centerline+n*.015*math.sin(math.pi*t),centerline+u*w])
 fs=[]
 for i in range(6):
  for j in range(2):a=i*3+j;fs.append((a,a+1,a+4,a+3))
 leaves.add(vs,fs,mat)
rng=random.Random(821)
def leafspray(base,count=9,size=.24):
 for i in range(count):
  a=i*2.399;leaf(base,(math.cos(a),math.sin(a),.35+.6*rng.random()),size*(.7+.6*rng.random()),size*.24,i%3)
def zdeck(x):return 1.15*math.cos(math.pi*x/7.2)
def zrail(x):return 1.27+1.14*math.cos(math.pi*x/7.2)
py=1.40
# Fine green spirals dress the main branch without replacing its shape.
for strand in range(2):
 points=[]
 for i in range(161):
  x=.015+3.41*i/160;a=math.tau*(x/1.1)+strand*math.pi
  points.append((x,py+.13*math.cos(a),zrail(x)+.13*math.sin(a)))
 tube(vines,points,.025)
 for i in range(22):
  x=.08+i*3.25/22;a=math.tau*x/1.1+strand*math.pi
  base=(x,py+.13*math.cos(a),zrail(x)+.13*math.sin(a))
  leaf(base,(.45*(-1)**i,.8,.35*(-1)**(i+1)),.18+.035*(i%3),.06,i%3)
for x in [.28,.80,1.36,1.96,2.52,3.12]:
 leafspray((x,py+.055,zrail(x)+.06),10,.22)
 leafspray((x,py+.13,zdeck(x)+.19),8,.20)
# Post climbing vines, outside the walking corridor.
for side in range(2):
 ps=[]
 for i in range(65):
  t=i/64;a=t*math.tau*1.7+side*math.pi
  ps.append((3.43+.19*math.cos(a),py+.19*math.sin(a),.17+1.54*t))
 tube(vines,ps,.024)
 for i in range(10):
  p=ps[3+i*6];leaf(p,((-.4 if side else .5),.8,.35),.22,.075,i%3)
leafspray((3.43,py,1.76),14,.23)

# Crocus: six curved spoon petals around a cream/yellow center, no texture cards.
def crocus(base,size,color,lean=(0,.15,1)):
 b=Vector(base);axis=Vector(lean).normalized();u=axis.cross(Vector((0,1,0))).normalized();v=axis.cross(u).normalized()
 tube(vines,[b,b+axis*size*.70],.016)
 centerpoint=b+axis*size*.55
 for petal in range(6):
  a=petal*math.tau/6;radial=u*math.cos(a)+v*math.sin(a);tangent=axis.cross(radial);vs=[]
  for i in range(9):
   t=i/8;spread=size*(.07+.40*t**1.7);height=size*(.05+.60*t)
   mid=centerpoint+radial*spread+axis*height
   for j in range(5):
    w=(j-2)/2;vs.append(mid+tangent*(w*size*.21*math.sin(math.pi*t)**.6)-radial*(w*w*size*.055))
  fs=[]
  for i in range(8):
   for j in range(4):k=i*5+j;fs.append((k,k+1,k+6,k+5))
  flowers.add(vs,fs,color)
 for j in range(3):
  a=j*math.tau/3;p=centerpoint+(u*math.cos(a)+v*math.sin(a))*size*.06
  tube(flowers,[p,p+axis*size*.45],[size*.025,size*.045],3,7)
 for j in range(3):a=j*math.tau/3;leaf(b,(math.cos(a)*.5,math.sin(a)*.5,1),size*.85,size*.055,j%3)
for i,x in enumerate([.45,1.38,2.38,3.07]):
 crocus((x,py+.06,zrail(x)+.035),.36 if i%2 else .40,0 if i!=2 else 1)
for i,(x,y,size) in enumerate([(3.62,1.72,.48),(3.22,1.78,.40),(3.90,1.67,.33),(3.53,2.0,.31),(3.09,1.61,.26)]):
 crocus((x,y,-.08),size,[0,1,0,2,0][i])
for i,x in enumerate([.45,1.38,2.33]):crocus((x,1.57,zdeck(x)-.02),.28,0 if i%2 else 1)

# Hanging clusters: tapered scalloped bells, one light mesh; no individual petals.
for cluster,x in enumerate([.42,1.28,2.12,2.93]):
 for strand in range(3):
  start=Vector((x+(strand-1)*.095,1.57+.045*(strand%2),zrail(x)-.035))
  length=[.82,1.02,.69,.79][cluster]*(.80+.14*strand)
  stem=[start+Vector((.025*math.sin(t*4),.09*t,-length*t)) for t in [i/20 for i in range(21)]]
  tube(vines,stem,.008)
  for k in range(12):
   t=k/12;rad=.09*(1-.66*t);p=start+Vector((.025*math.sin(t*4),.09*t,-length*t))
   vs=[];fs=[]
   for ring in range(9):
    q=ring/8;z=-.14*q;r=math.sin(math.pi*q)**.75*(1-.3*q)
    for j in range(10):
     a=j*math.tau/10+k*.63;rr=rad*r*(1+.17*math.cos(a*5));vs.append(p+Vector((rr*math.cos(a),rr*math.sin(a),z*(.65+.35*(1-t)))))
   for i in range(8):
    for j in range(10):fs.append((i*10+j,i*10+(j+1)%10,(i+1)*10+(j+1)%10,(i+1)*10+j))
   hangs.add(vs,fs,(k+strand)%3)

# Restrained end vegetation and small stones; no platform and no central obstruction.
for i in range(20):
 x=3.1+rng.random()*.90;y=1.46+rng.random()*.60
 leafspray((x,y,-.16),5,.19+rng.random()*.12)
for i,(x,y,s) in enumerate([(3.77,1.61,.24),(3.23,1.78,.18),(3.63,1.94,.21),(3.96,1.54,.17),(3.14,1.63,.16)]):
 vs=[];fs=[]
 for ring in range(7):
  phi=math.pi*ring/6
  for j in range(12):
   a=j*math.tau/12;fac=1+.07*math.sin(j*2+ring)
   vs.append((x+s*math.sin(phi)*math.cos(a)*fac,y+s*.8*math.sin(phi)*math.sin(a)*fac,-.15+s*.60*math.cos(phi)))
 for r in range(6):
  for j in range(12):fs.append((r*12+j,r*12+(j+1)%12,(r+1)*12+(j+1)%12,(r+1)*12+j))
 rocks.add(vs,fs)
for batch in (leaves,vines,flowers,hangs,rocks):
 ob=batch.finish()
 if batch in (leaves,flowers,hangs):
  smooth=ob.modifiers.new('Soft botanical surfaces','SUBSURF');smooth.levels=1;smooth.render_levels=2
assert before==structure_record(),'Approved structure changed'
scene['approved_structure_sha256']=signature
scene['visual_pass']='First materials and separate mirrored vegetation pass; structure invariant'
root['structural_approval']='Approved by user; do not edit geometry, transform, or Mirror modifiers'
scene.cycles.samples=64
scene.render.film_transparent=True
scene.render.image_settings.color_mode='RGBA'
cam=scene.camera;target=Vector((0,0,1))
def setview(elev):
 a=math.radians(-48);e=math.radians(elev)
 cam.location=target+Vector((12*math.cos(e)*math.sin(a),-12*math.cos(e)*math.cos(a),12*math.sin(e)))
 cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();bpy.context.view_layer.update()
for name,elev in [('three_quarter',30),('petalpal_55',55)]:
 setview(elev);scene.render.filepath=str(OUT/(name+'.png'))
 bpy.ops.render.render(write_still=True)
 assert before==structure_record()
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'bridge_master.blend'))
assert hashlib.sha256(REFERENCE.read_bytes()).hexdigest()==reference_hash
(OUT/'material_pass_manifest.json').write_text(json.dumps({'structureSha256Before':signature,'structureSha256After':hashlib.sha256(json.dumps(structure_record(),sort_keys=True).encode()).hexdigest(),'referenceSha256':reference_hash,'structuralObjects':len(structural),'decorativeMeshes':5,'views':{'three_quarter':{'azimuth':-48,'elevation':30},'petalpal_55':{'azimuth':-48,'elevation':55}},'cameraOrthoScale':cam.data.ortho_scale,'protected':'Structure mesh/topology/transforms/modifiers unchanged; reference PNG unchanged'},indent=2))
print('VISUAL_PASS_COMPLETE',signature,flush=True)
