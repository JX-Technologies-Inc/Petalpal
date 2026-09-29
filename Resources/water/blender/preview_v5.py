import bpy,os
r=os.path.join(os.path.dirname(bpy.data.filepath),'review_v5')
for name in ('water_v5_garden_still.png','water_v5_water_only.png'):
 im=bpy.data.images.load(os.path.join(r,name),check_existing=False)
 im.scale(1200,900)
 im.filepath_raw=os.path.join(r,'_preview_'+name);im.file_format='PNG';im.save()
