import bpy, json, os

s=bpy.context.scene
def vec(v): return [round(float(x),5) for x in v]
out={'file':bpy.data.filepath,'engine':s.render.engine,'frames':[s.frame_start,s.frame_end,s.render.fps],
 'camera':s.camera.name if s.camera else None,'objects':[],'materials':[],'images':[]}
for o in bpy.data.objects:
 d={'name':o.name,'type':o.type,'location':vec(o.location),'rotation':vec(o.rotation_euler),'scale':vec(o.scale), 'hide_render':o.hide_render}
 if o.type=='EMPTY' and o.data and hasattr(o.data,'filepath'): d['image']=o.data.filepath
 if o.type=='CAMERA': d['camera']={'type':o.data.type,'ortho_scale':o.data.ortho_scale}
 if o.type=='LIGHT': d['light']={'type':o.data.type,'energy':o.data.energy}
 if o.type=='MESH': d['materials']=[m.name for m in o.data.materials if m]
 out['objects'].append(d)
for m in bpy.data.materials:
 if not m.use_nodes: continue
 md={'name':m.name,'nodes':[],'links':[]}
 for n in m.node_tree.nodes:
  nd={'name':n.name,'type':n.bl_idname,'inputs':{},'outputs':{}}
  for socket in n.inputs:
   if hasattr(socket,'default_value'):
    v=socket.default_value
    try: nd['inputs'][socket.name]=vec(v) if hasattr(v,'__iter__') else round(float(v),5)
    except: pass
  if n.type=='VALTORGB': nd['ramp']=[{'position':e.position,'color':vec(e.color)} for e in n.color_ramp.elements]
  if n.type=='TEX_IMAGE' and n.image: nd['image']=n.image.filepath
  md['nodes'].append(nd)
 for l in m.node_tree.links: md['links'].append([l.from_node.name,l.from_socket.name,l.to_node.name,l.to_socket.name])
 out['materials'].append(md)
for im in bpy.data.images:
 out['images'].append({'name':im.name,'filepath':im.filepath,'resolved':bpy.path.abspath(im.filepath),'exists':os.path.exists(bpy.path.abspath(im.filepath)),'size':list(im.size)})
for a in bpy.data.actions:
 print('ACTION',a.name)
 try:
  for fc in a.fcurves: print('FCURVE',fc.data_path,fc.array_index,[(kp.co.x,kp.co.y) for kp in fc.keyframe_points])
 except Exception as e: print('ACTION_ERROR',str(e))
print('AUDIT_JSON',json.dumps(out))
