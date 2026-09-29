raise SystemExit("Retired: camera 55 is approved and locked. Use render_bridge.py --angle instead.")
"""Edit the existing master in place; never rebuild or delete its objects."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT = Path(__file__).resolve().parents[1]
scene=bpy.context.scene
root=bpy.data.objects['Bridge_World_Yaw']
old_width=float(root.get('deck_width',1.85)); old_rise=float(root.get('deck_rise',.72))
width=1.85*1.35; rise=.42; length=6.0
h=lambda x,r:r*(1-(x/3)**2)
# Existing object materials/modifiers stay intact. Change geometry, not bitmap scale.
for ob in list(root.children):
    if ob.name.startswith('Deck_Plank_'):
        for v in ob.data.vertices:
            x=v.co.x; original=h(x,old_rise)
            if ob.name=='Deck_Plank_31' and x>2.95: v.co.x=3.0
            v.co.y*=width/old_width
            v.co.z+=h(v.co.x,rise)-original
        ob.data.update()
    elif ob.name.startswith(('SideRail_','Arch_support_')):
        for spline in ob.data.splines:
            for p in spline.points:
                p.co.z+=h(p.co.x,rise)-h(p.co.x,old_rise)
                offset=.045 if ob.name.startswith('SideRail_') else -.1
                p.co.y=math.copysign(width/2+offset,p.co.y)
    elif ob.name.startswith('Rail_post_'):
        ob.location.z+=h(ob.location.x,rise)-h(ob.location.x,old_rise)
        ob.location.y=math.copysign(width/2+.045,ob.location.y)
walk=bpy.data.objects['FairyWalkPath']
for p in walk.data.splines[0].points:
    p.co.y=0; p.co.z=h(p.co.x,rise)
for name,x in [('EntryA',-3),('Crest',0),('EntryB',3)]:
    bpy.data.objects[name].location=(x,0,h(x,rise))
root['deck_width']=width; root['deck_rise']=rise
root['calibration']='35 percent wider; gentle .42 deck rise; endpoints at ground; camera comparison only'
# Surveyed existing circulation: lower road landing, inner edge of Land08 path.
A=(1644.0,1420.0); B=(1840.0,1264.0)
dx=B[0]-A[0]; dy=B[1]-A[1]
yaw=math.atan2(-dy,dx*math.sin(math.radians(60)))
root.rotation_euler.z=yaw
pixels_per_unit=1536/7.8
app_scale=dx/(6*math.cos(yaw)*pixels_per_unit)
placement={'x':(A[0]+B[0])/2,'y':(A[1]+B[1])/2,'scale':app_scale}
target=Vector((0,0,.4))
scene.render.resolution_x=1536; scene.render.resolution_y=1280
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
scene.render.film_transparent=True
scene.render.engine='CYCLES'; scene.cycles.samples=32
scene.render.use_file_extension=True
records={}
for elevation in (55,60,65):
    if elevation==55:
        cam=bpy.data.objects['PetalPal_Garden_Camera']
    else:
        name='PetalPal_Garden_Camera_'+str(elevation)
        cam=bpy.data.objects.get(name)
        if cam is None:
            cam=bpy.data.objects['PetalPal_Garden_Camera'].copy()
            cam.data=cam.data.copy(); cam.name=name; scene.collection.objects.link(cam)
    cam.location=target+Vector((0,-12,12*math.tan(math.radians(elevation))))
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO'; cam.data.ortho_scale=7.8
    scene.camera=cam
    bpy.context.view_layer.update()
    def project(local):
        p=world_to_camera_view(scene,cam,root.matrix_world@Vector(local))
        return {'x':p.x*1536,'y':(1-p.y)*1280}
    def delta(p,a):return {'x':p['x']-a['x'],'y':p['y']-a['y']}
    anchor=project((0,0,0))
    def world(local):
        p=delta(project(local),anchor)
        return {'x':placement['x']+app_scale*p['x'],'y':placement['y']+app_scale*p['y']}
    metadata={'angle':math.degrees(yaw),'canvas':{'width':1536,'height':1280},'anchor':anchor,
      'projection':{'along':delta(project((3,0,0)),anchor),'across':delta(project((0,1,0)),anchor),'elevation':delta(project((0,0,rise)),anchor)},
      'camera':{'type':'ORTHO','elevationDegrees':elevation,'orthoScale':7.8,'location':list(cam.location),'target':list(target)},
      'geometry':{'span':length,'deckWidth':width,'archRise':rise,'railHeight':.8},
      'placement':placement,'alignment':{'entryA':world((-3,0,0)),'entryB':world((3,0,0))},
      'path':[{'x':round(p.co.x/3,8),'y':0,'elevation':round(h(p.co.x,rise)/rise,8)} for p in walk.data.splines[0].points]}
    records[str(elevation)]=metadata
    (ROOT/'rendered'/('bridge_camera_%s.json'%elevation)).write_text(json.dumps(metadata,indent=2))
    scene.render.filepath=str(ROOT/'rendered'/('bridge_camera_%s.png'%elevation))
    bpy.ops.render.render(write_still=True)
scene.camera=bpy.data.objects['PetalPal_Garden_Camera_60']
scene['camera_comparison']='55/60/65; same geometry, yaw, lights, 7.8 ortho framing, 1536x1280 canvas'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender'/'bridge_master.blend'))
print('CALIBRATION_COMPLETE',json.dumps({'yaw':math.degrees(yaw),'placement':placement,'alignment':{k:v['alignment'] for k,v in records.items()}}))

