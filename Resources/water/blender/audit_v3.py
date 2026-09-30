import bpy,os
s=bpy.context.scene; m=bpy.data.objects['Plane'].active_material; n=m.node_tree.nodes
print('SCENE',s.camera.name,s.camera.data.type,s.camera.data.ortho_scale,s.render.resolution_x,s.render.resolution_y,s.frame_start,s.frame_end,s.render.fps)
for k in ['V3 Shore Visual Mask','V3 Open Depth Visual Mask']:
 x=n[k]; print('MASK',k,x.image.filepath,x.image.colorspace_settings.name,os.path.exists(bpy.path.abspath(x.image.filepath)),x.extension)
for k in ['V3 Depth Strength 0.30','V3 Shore Strength 0.22']:
 print('STRENGTH',k,n[k].inputs[1].default_value)
print('UV',tuple(n['V3 Garden UV Scale'].inputs[1].default_value),tuple(n['V3 Garden UV Offset'].inputs[1].default_value))
print('HIGHLIGHT',n['Noise Texture.003'].inputs['Scale'].default_value,[(e.position,tuple(e.color)) for e in n['Color Ramp.002'].color_ramp.elements])
for f in (1,192):
 s.frame_set(f); print('FRAME',f,tuple(n['Mapping'].inputs['Location'].default_value),tuple(n['V2 Slow Mask Drift'].inputs['Location'].default_value))
print('TEMP_DEBUG_NODE_SAVED',bool(n.get('TEMP V3 Mask Diagnostic Only')))
