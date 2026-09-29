"""One-time refinement of the existing master and approved camera lock."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
scene=bpy.context.scene
root=bpy.data.objects.get('BridgeRoot') or bpy.data.objects['Bridge_World_Yaw']
root.name='BridgeRoot'
assert root.parent is None
assert not root.get('authoring_refined',False), 'Refinement already applied; do not apply twice.'
old_half=3.0; half=2.8; width=2.4975; rise=.42
height=lambda x:rise*(1-(x/half)**2)
old_height=lambda x:rise*(1-(x/old_half)**2)
# Keep a broad mid-deck, a subtle neck, and gently flared landings.
def half_width(x):
    u=abs(x)/half
    flare=max(0,(u-.68)/.32)
    flare=flare*flare*(3-2*flare)
    neck=math.sin(math.pi*u)**2
    return width/2*(1-.015*neck+.12*flare)
def end_round(x,y):
    # Curved end edge: corners stop 0.11 units before the central landing lip.
    u=abs(x)/half
    w=max(0,(u-.9)/.1)
    return x-math.copysign(.11*(abs(y)/half_width(x))**2*w,x) if x else x
for ob in list(root.children):
    if ob.name.startswith('Deck_Plank_'):
        oldverts=[v.co.copy() for v in ob.data.vertices]
        a=min(v.x for v in oldverts); b=max(v.x for v in oldverts)
        a=a/3*half; b=b/3*half
        # More edge vertices let the landing edge curve without narrowing its center.
        verts=[]
        for bottom in (False,True):
            for x in (a,b):
                for f in (-1,-.5,0,.5,1):
                    y=f*half_width(x); xx=end_round(x,y)
                    verts.append((xx,y,max(0,height(xx))-(.14 if bottom else 0)))
        faces=[]
        for j in range(4):
            faces.extend([(j,j+5,j+6,j+1),(10+j,11+j,16+j,15+j),
                          (j,j+1,11+j,10+j),(5+j,15+j,16+j,6+j)])
        faces.extend([(0,10,15,5),(4,9,19,14)])
        ob.data.clear_geometry(); ob.data.from_pydata(verts,[],faces); ob.data.update()
    elif ob.name.startswith(('SideRail_','Arch_support_')):
        for spline in ob.data.splines:
            for p in spline.points:
                oldx=p.co.x; x=oldx/3*half
                offset=.045 if ob.name.startswith('SideRail_') else -.1
                y=math.copysign(half_width(x)+offset,p.co.y)
                xx=end_round(x,y)
                # Extra modest rail arch creates silhouette without steepening the deck.
                extra=.12*(1-(xx/half)**2) if ob.name.startswith('SideRail_') else 0
                p.co=(xx,y,p.co.z-old_height(oldx)+height(xx)+extra,1)
    elif ob.name.startswith('Rail_post_'):
        oldx=ob.location.x; x=oldx/3*half
        y=math.copysign(half_width(x)+.045,ob.location.y); xx=end_round(x,y)
        extra=.12*(1-(xx/half)**2)
        ob.location=(xx,y,ob.location.z-old_height(oldx)+height(xx)+extra/2)
        # Upper rail remains supported as its arch subtly rises over the deck.
        for v in ob.data.vertices: v.co.z*=1+extra/.92
walk=bpy.data.objects['FairyWalkPath']
for p in walk.data.splines[0].points:
    x=p.co.x/3*half; p.co=(x,0,height(x),1)
for name,x in [('EntryA',-half),('Crest',0),('EntryB',half)]:
    ob=bpy.data.objects[name]; assert ob.parent==root; ob.location=(x,0,height(x))
assert walk.parent==root
root['span']=2*half; root['deck_width']=width; root['deck_rise']=rise
root['landing_width']=width*1.12; root['authoring_refined']=True
root.rotation_euler.z=math.radians(42.584)
cam=bpy.data.objects['PetalPal_Garden_Camera']; cam.name='PETALPAL_ASSET_CAMERA_V1'
# Approved 55-degree camera is reused without adjusting its transform/projection.
cam.lock_location=(True,True,True); cam.lock_rotation=(True,True,True); cam.lock_scale=(True,True,True)
for name in ('PetalPal_Garden_Camera_60','PetalPal_Garden_Camera_65'):
    other=bpy.data.objects.get(name)
    if other: bpy.data.objects.remove(other,do_unlink=True)
scene.camera=cam
cam['approved_elevation_degrees']=55; cam['locked_preset']='PETALPAL_ASSET_CAMERA_V1'
scene['camera_comparison']='RETIRED. Approved camera 55 degrees only.'
bpy.context.view_layer.update()
preset={'name':cam.name,'elevationDegrees':55,'type':cam.data.type,
 'matrixWorld':[v for row in cam.matrix_world for v in row],
 'orthoScale':cam.data.ortho_scale,'shiftX':cam.data.shift_x,'shiftY':cam.data.shift_y,
 'clipStart':cam.data.clip_start,'clipEnd':cam.data.clip_end,
 'resolutionX':scene.render.resolution_x,'resolutionY':scene.render.resolution_y,
 'resolutionPercentage':scene.render.resolution_percentage,
 'location':list(cam.location),'rotationEuler':list(cam.rotation_euler),
 'placement':{'x':1742,'y':1342,'scale':.22530195907882586}}
(ROOT/'petalpal_asset_camera_v1.json').write_text(json.dumps(preset,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'bridge_master.blend'))
print('CAMERA_LOCKED_AND_GEOMETRY_REFINED',json.dumps(preset))
