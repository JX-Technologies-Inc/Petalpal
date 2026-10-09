import bpy
from mathutils import Vector
s=bpy.context.scene
w=bpy.data.objects['Plane']
print('PLANE',w.location[:],w.scale[:],[(v.co.x,v.co.y) for v in w.data.vertices])
print('UV',[(tuple(l.uv)) for l in w.data.uv_layers.active.data])
print('CAMERA',s.camera.name,s.camera.location[:],s.camera.rotation_euler[:],s.camera.data.type,s.camera.data.ortho_scale)
print('RES',s.render.resolution_x,s.render.resolution_y,'FRAMES',s.frame_start,s.frame_end,s.render.fps)
print('OVERLAY',len(bpy.data.collections['V2 Garden Review Overlay'].objects),[(o.name,tuple(round(float(v),3) for v in o.location),tuple(round(float(v),3) for v in o.scale)) for o in bpy.data.collections['V2 Garden Review Overlay'].objects])
for name in ['V2 Subtle Depth Blend','Noise Texture.003','Color Ramp.002','Mapping','V2 Slow Mask Drift']:
 n=w.active_material.node_tree.nodes[name]
 print('NODE',name,[(x.name,tuple(x.default_value) if hasattr(x.default_value,'__iter__') else x.default_value) for x in n.inputs if hasattr(x,'default_value')][:8])
