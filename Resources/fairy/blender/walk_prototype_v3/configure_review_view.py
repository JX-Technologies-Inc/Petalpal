"""Set a convenient camera view and embed the review notes in the saved blend."""
from pathlib import Path
import bpy
HERE=Path(__file__).resolve().parent
text=bpy.data.texts.get('PROTOTYPE_REVIEW_README') or bpy.data.texts.new('PROTOTYPE_REVIEW_README')
text.clear();text.write((HERE/'README.md').read_text())
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            space=area.spaces.active;space.shading.type='MATERIAL';space.overlay.show_overlays=False
            if space.region_3d:space.region_3d.view_perspective='CAMERA'
bpy.context.scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'fairy_v3_walk_prototype.blend'))
