import bpy,os
s=bpy.context.scene;m=bpy.data.objects['Plane'].active_material;n=m.node_tree.nodes
print('SCENE',s.camera.name,s.camera.data.type,s.camera.data.ortho_scale,s.render.resolution_x,s.render.resolution_y,s.frame_start,s.frame_end,s.render.fps)
print('STRENGTH',n['V4 Shore Strength 1.00'].inputs[1].default_value,n['V4 Depth Strength 1.00'].inputs[1].default_value,n['V4 Local Shallow Accent 0.45'].inputs[1].default_value)
print('MASKS',[(n[k].image.name,n[k].image.colorspace_settings.name,os.path.exists(bpy.path.abspath(n[k].image.filepath))) for k in ('V3 Shore Visual Mask','V3 Open Depth Visual Mask')])
print('UV',tuple(n['V3 Garden UV Scale'].inputs[1].default_value),tuple(n['V3 Garden UV Offset'].inputs[1].default_value))
for f in (1,96,192):
 s.frame_set(f);print('FRAME',f,tuple(n['Mapping'].inputs['Location'].default_value),tuple(n['V2 Slow Mask Drift'].inputs['Location'].default_value),n['Wave Texture'].inputs['Phase Offset'].default_value,n['V4 Cross Stroke Wave'].inputs['Phase Offset'].default_value)
