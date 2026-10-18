"""Run with Blender --background --factory-startup --python this_file.
Build actual mesh/armature modifiers, keyframe the walk, export evaluated meshes.
"""
from pathlib import Path
import bpy,json,math
import numpy as np
from mathutils import Vector
HERE=Path(__file__).resolve().parent;cfg=json.loads((HERE/'build_config.json').read_text())
N=cfg['canvas'];S=cfg['units_per_pixel'];RX,RY=cfg['root'];F=cfg['frames']
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=N;scene.render.resolution_y=N;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8'
scene.render.film_transparent=True;scene.render.fps=cfg['fps'];scene.frame_start=1;scene.frame_end=F
scene.view_settings.view_transform='Raw';scene.view_settings.exposure=0;scene.view_settings.gamma=1
scene.world.color=(0,0,0)
def coord(x,y,z=0):return ((x-RX)*S,(RY-y)*S,z)
camdata=bpy.data.cameras.new('Fixed_1254_Orthographic');cam=bpy.data.objects.new('Review_Camera',camdata);scene.collection.objects.link(cam)
cam.location=coord(N/2,N/2,30);cam.rotation_euler=(0,0,0);camdata.type='ORTHO';camdata.ortho_scale=N*S;scene.camera=cam
armdata=bpy.data.armatures.new('Fairy_V2_Armature');arm=bpy.data.objects.new('Fairy_V2_Rig',armdata);scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active=arm;arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
bp={b['name']:np.array([b['source_x'],b['source_y']],float) for b in cfg['bones']}
for b in cfg['bones']:
    eb=armdata.edit_bones.new(b['name']);eb.head=coord(*bp[b['name']]);eb.tail=eb.head+Vector((0,0.15,0))
    if b['parent']:eb.parent=armdata.edit_bones[b['parent']]
    eb.use_connect=False
bpy.ops.object.mode_set(mode='OBJECT');arm.show_in_front=True;arm.display_type='WIRE'
for b in arm.pose.bones:b.rotation_mode='XYZ'
def smooth(v):v=max(0,min(1,v));return v*v*(3-2*v)
def weights(n,x,y,bone):
    for side in ['left','right']:
        if n in ['thigh_'+side,'calf_'+side,'foot_'+side]:
            k=bp['calf_'+side][1];a=bp['foot_'+side][1]
            wk=smooth((y-k+45)/90);wa=smooth((y-a+18)/36)
            return {'thigh_'+side:1-wk,'calf_'+side:wk*(1-wa),'foot_'+side:wk*wa}
        if n in ['upper_arm_'+side,'forearm_'+side,'hand_'+side]:
            e=bp['forearm_'+side][1];w=bp['hand_'+side][1]
            we=smooth((y-e+45)/90);ww=smooth((y-w+15)/30)
            return {'upper_arm_'+side:1-we,'forearm_'+side:we*(1-ww),'hand_'+side:we*ww}
    if n.startswith('wing_'):
        w=smooth(np.linalg.norm(np.array([x,y])-bp[bone])/70)
        return {'chest':1-w,bone:w}
    if n.startswith('petals_'):
        w=smooth((y-480)/260);return {'skirt_base':1-w,bone:w}
    return {bone:1}
meshes=[];topology={}
for order,l in enumerate(cfg['layers']):
    n=l['name'];points=[];lookup={};faces=[]
    for x,y,x1,y1 in l['cells']:
        ids=[]
        for p in [(x,y),(x1,y),(x1,y1),(x,y1)]:
            if p not in lookup:lookup[p]=len(points);points.append(p)
            ids.append(lookup[p])
        faces.append(ids)
    mesh=bpy.data.meshes.new(n+'_grid');mesh.from_pydata([coord(x,y,order*.002) for x,y in points],[],faces);mesh.update()
    obj=bpy.data.objects.new(n,mesh);scene.collection.objects.link(obj)
    uv=mesh.uv_layers.new(name='Original_canvas_UV')
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            x,y=points[mesh.loops[li].vertex_index];uv.data[li].uv=(x/N,1-y/N)
    img=bpy.data.images.load(str(HERE/'images'/f'{n}.png'),check_existing=True);img.colorspace_settings.name='Non-Color';img.alpha_mode='STRAIGHT';img.pack()
    mat=bpy.data.materials.new(n+'_unlit');mat.use_nodes=True;mat.surface_render_method='BLENDED'
    nd=mat.node_tree.nodes;nd.clear();out=nd.new('ShaderNodeOutputMaterial');mix=nd.new('ShaderNodeMixShader');em=nd.new('ShaderNodeEmission');tr=nd.new('ShaderNodeBsdfTransparent');tex=nd.new('ShaderNodeTexImage');tex.image=img;tex.interpolation='Linear';tex.extension='CLIP'
    links=mat.node_tree.links;links.new(tex.outputs['Color'],em.inputs['Color']);links.new(tex.outputs['Alpha'],mix.inputs[0]);links.new(tr.outputs[0],mix.inputs[1]);links.new(em.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],out.inputs['Surface'])
    obj.data.materials.append(mat)
    for i,(x,y) in enumerate(points):
        for bone,w in weights(n,x,y,l['bone']).items():
            if w>1e-8:
                vg=obj.vertex_groups.get(bone) or obj.vertex_groups.new(name=bone);vg.add([i],float(w),'REPLACE')
    mod=obj.modifiers.new('Shared_joint_weights','ARMATURE');mod.object=arm;mod.use_deform_preserve_volume=False
    obj['source_layer']=str(HERE/'images'/f'{n}.png');obj['registration']='1254x1254, original canvas, source pixels'
    meshes.append(obj);topology[n]={'source':points,'quads':faces}

def angle(v):return math.atan2(v[1],v[0])
def ik(side,target,body):
    h0=bp['thigh_'+side];k0=bp['calf_'+side];a0=bp['foot_'+side];h=h0+body
    l1=np.linalg.norm(k0-h0);l2=np.linalg.norm(a0-k0);d=target-h;dist=np.linalg.norm(d)
    dist=min(dist,l1+l2-0.001);u=d/np.linalg.norm(d)
    along=(l1*l1-l2*l2+dist*dist)/(2*dist);perp=math.sqrt(max(0,l1*l1-along*along))
    candidates=[h+along*u+sgn*perp*np.array([-u[1],u[0]]) for sgn in [-1,1]]
    # Maintain the original anatomical bend side.
    cross=np.cross(k0-h0,a0-k0)
    k=next((k for k in candidates if np.cross(k-h,target-k)*cross>=0),candidates[0])
    hip=angle(k-h)-angle(k0-h0);knee=angle(target-k)-angle(a0-k0)-hip
    hip=(hip+math.pi)%(2*math.pi)-math.pi;knee=(knee+math.pi)%(2*math.pi)-math.pi
    return hip,knee
def setz(name,a,frame):
    p=arm.pose.bones[name];p.rotation_euler.z=-a;p.keyframe_insert('rotation_euler',frame=frame,group=name)
samples=[]
# Frame 0 is a literal unposed bind/rest check. The loop is frames 1..24;
# frame 25 repeats frame 1 for seamless interpolation and is not exported.
for p in arm.pose.bones:
    p.location=(0,0,0);p.rotation_euler=(0,0,0);p.keyframe_insert('location',frame=0);p.keyframe_insert('rotation_euler',frame=0)
for f in range(1,F+2):
    t=(f-1)/F
    # Keep the support leg close to V2's repaired bend range. Derive the small
    # pelvis height shift from its support geometry instead of crouching both
    # legs to accommodate an arbitrary body bob.
    support='left' if t%1<.5 else 'right';sp=(t+(0 if support=='left' else .5))%1
    bodyx=.25*math.sin(2*math.pi*t);h0=bp['thigh_'+support];k0=bp['calf_'+support];a0=bp['foot_'+support]
    l1=np.linalg.norm(k0-h0);l2=np.linalg.norm(a0-k0)
    bend=abs((angle(a0-k0)-angle(k0-h0)+math.pi)%(2*math.pi)-math.pi)+math.radians(1.5)
    distance2=l1*l1+l2*l2+2*l1*l2*math.cos(bend)
    dx=a0[0]+cfg['stride_pixels_per_loop']*(.25-sp)-h0[0]-bodyx
    bodyy=a0[1]-h0[1]-math.sqrt(max(0,distance2-dx*dx))
    body=np.array([bodyx,bodyy])
    p=arm.pose.bones['pelvis'];p.location=(body[0]*S,-body[1]*S,0);p.keyframe_insert('location',frame=f,group='pelvis')
    row={'frame':f,'body_source_delta':body.tolist(),'legs':{}}
    for side,offset in [('left',0),('right',.5)]:
        phase=(t+offset)%1;stride=cfg['stride_pixels_per_loop'];base=bp['foot_'+side].copy()
        if phase<.5:
            dx=stride*(.25-phase);lift=0;roll=math.radians(-.3*math.cos(phase*2*math.pi));state='stance'
        else:
            q=(phase-.5)*2;dx=-stride*.25+stride*.5*smooth(q);lift=cfg['swing_lift_pixels']*math.sin(math.pi*q)**2;roll=math.radians(.3*math.cos(math.pi*q));state='swing'
        target=base+np.array([dx,-lift]);h,k=ik(side,target,body)
        setz('thigh_'+side,h,f);setz('calf_'+side,k,f);setz('foot_'+side,-h-k+roll,f)
        arm_swing=math.radians(1.1*math.sin(2*math.pi*(t+offset)))
        setz('upper_arm_'+side,0,f);setz('forearm_'+side,-arm_swing,f);setz('hand_'+side,0,f)
        row['legs'][side]={'phase':phase,'state':state,'target_ankle':target.tolist(),'hip_degrees':math.degrees(h),'knee_degrees':math.degrees(k),'foot_roll_degrees':math.degrees(roll)}
    for n,amp,phase in [('wing_left',.25,.1),('wing_right',-.25,.1),('petals_front',.15,.15),('petals_side',.25,.2),('petals_back',-.25,.2)]:
        setz(n,math.radians(amp*math.sin(2*math.pi*(t-phase))),f)
    samples.append(row)
scene.frame_set(0);bpy.context.view_layer.update()
(HERE/'mesh_cache/topology.json').write_text(json.dumps(topology))
eval_stats=[]
for f in range(0,F+2):
    scene.frame_set(f);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();coords={}
    for obj in meshes:
        ev=obj.evaluated_get(deps);me=ev.to_mesh();co=np.array([(obj.matrix_world@v.co)[:] for v in me.vertices])
        coords[obj.name]=np.column_stack([co[:,0]/S+RX,RY-co[:,1]/S]);ev.to_mesh_clear()
    np.savez_compressed(HERE/'mesh_cache'/f'frame_{f:03d}.npz',**coords)
    # Actual evaluated bone ankle positions, not only requested IK targets.
    if 1<=f<=F:
        for side in ['left','right']:
            v=arm.matrix_world@arm.pose.bones['foot_'+side].head
            samples[f-1]['legs'][side]['evaluated_ankle']=[v.x/S+RX,RY-v.y/S]
    print('EXPORTED_EVALUATED_FRAME',f,flush=True)
scene.frame_set(1)
scene['prototype_scope']='V2 isolated restrained walk; no Garden integration'
scene['authoritative_review_export']='render_review.py: evaluated meshes with straight-sRGB alpha compositor'
scene['rest_pose_frame']=0;scene['unique_loop_frames']='1..24; closing key frame 25'
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'fairy_v2_walk_prototype.blend'))
(HERE/'motion_samples.json').write_text(json.dumps(samples,indent=2))
(HERE/'rig_report.json').write_text(json.dumps({'blender':bpy.app.version_string,'bones':len(armdata.bones),'layers':len(meshes),'vertices':sum(len(o.data.vertices) for o in meshes),'triangles':sum(len(o.data.polygons)*2 for o in meshes),'fps':cfg['fps'],'unique_frames':F,'seconds':F/cfg['fps'],'rig_created':True},indent=2))
# Blender-native engine check remains separate from the color-preserving review
# export, so any renderer-specific deviations cannot masquerade as exact match.
scene.frame_set(0);scene.render.filepath=str(HERE/'review/blender_engine_rest.png')
bpy.ops.render.render(write_still=True)
print('BLENDER_BUILD_COMPLETE',flush=True)
