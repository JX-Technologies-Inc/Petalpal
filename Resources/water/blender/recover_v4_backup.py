import bpy,os
root=os.path.dirname(bpy.data.filepath)
tree=bpy.data.objects['Plane'].active_material.node_tree
n=tree.nodes;l=tree.links
l.new(n['V4 Tiny Foam Palette Peaks'].outputs['Result'],n['Principled BSDF'].inputs['Base Color'])
for node in list(n):
 if node.name.startswith('V5 '):n.remove(node)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(root,'water_master_test.before-v5.blend'))
