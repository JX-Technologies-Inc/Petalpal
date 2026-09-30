"""Integrate a transparent painterly source into the Garden-aligned V4 water."""
import bpy, os, numpy as np

root=os.path.dirname(bpy.data.filepath)
resources=os.path.abspath(os.path.join(root,'..'))
overlays=os.path.join(resources,'overlays')
source=os.path.join(overlays,'water_surface_painterly_source.png')
master=os.path.join(overlays,'water_surface_painterly_master.png')
mask_path=os.path.join(resources,'masks','water_area_mask.png')
scene=bpy.context.scene
water=bpy.data.objects['Plane']
nodes=water.active_material.node_tree.nodes
links=water.active_material.node_tree.links

src=bpy.data.images.load(source,check_existing=False)
print('SOURCE',tuple(src.size),src.channels)
src.scale(2400,1800)
s=np.empty(2400*1800*4,dtype=np.float32);src.pixels.foreach_get(s);s=s.reshape(1800,2400,4)
print('SOURCE ALPHA',float(s[:,:,3].min()),float(s[:,:,3].max()),float(s[:,:,3].mean()))
mask=bpy.data.images.load(mask_path,check_existing=False)
assert tuple(mask.size)==(2400,1800)
m=np.empty(2400*1800*4,dtype=np.float32);mask.pixels.foreach_get(m);m=m.reshape(1800,2400,4)
# Smoothly extend the V4 water colors beneath covered Garden land for the
# water-only diagnostic. This image never changes pixels visible in context.
v4_water=os.path.join(root,'review_v4','water_v4_water_only.png')
base_low=bpy.data.images.load(v4_water,check_existing=False);base_low.scale(600,450)
land_low=bpy.data.images.load(mask_path,check_existing=False);land_low.scale(600,450)
base_arr=np.empty(600*450*4,dtype=np.float32);base_low.pixels.foreach_get(base_arr);base_arr=base_arr.reshape(450,600,4)
mask_arr=np.empty(600*450*4,dtype=np.float32);land_low.pixels.foreach_get(mask_arr);mask_arr=mask_arr.reshape(450,600,4)
weights=np.clip(mask_arr[:,:,0],0,1)
fy=np.fft.fftfreq(450)[:,None];fx=np.fft.rfftfreq(600)[None,:]
kernel=np.exp(-2*np.pi*np.pi*32**2*(fy*fy+fx*fx))
def smooth(a):return np.fft.irfft2(np.fft.rfft2(a)*kernel,s=(450,600)).real
den=np.maximum(smooth(weights),0.002)
fill_arr=np.ones((450,600,4),dtype=np.float32)
for channel in range(3):fill_arr[:,:,channel]=np.clip(smooth(base_arr[:,:,channel]*weights)/den,0,1)
fill_img=bpy.data.images.new('V5 Hidden Land Color Continuation',width=600,height=450,alpha=True,float_buffer=False)
fill_img.pixels.foreach_set(fill_arr.ravel());fill_img.scale(2400,1800)
fill_path=os.path.join(overlays,'water_hidden_land_color_continuation.png')
fill_img.filepath_raw=fill_path;fill_img.file_format='PNG';fill_img.save()
# Blender pixel buffers start at the bottom. Both images use the same convention.
paint=np.zeros_like(s)
rng=np.random.default_rng(4502)
used=[]
# Reposition the generated painterly groups, rather than synthesizing new
# procedural wave strokes. The original canvas has many marks over land.
for gy in range(0,1800,360):
 for gx in range(0,2400,400):
  tile=s[gy:gy+360,gx:gx+400,:]
  yy,xx=np.where(tile[:,:,3]>0.035)
  if len(xx)<20:continue
  x0=max(int(xx.min())-8,0);x1=min(int(xx.max())+9,tile.shape[1])
  y0=max(int(yy.min())-8,0);y1=min(int(yy.max())+9,tile.shape[0])
  crop=tile[y0:y1,x0:x1,:]
  ch,cw=crop.shape[:2]
  if cw>380 or ch>340:continue
  for attempt in range(500):
   cx=int(rng.integers(cw//2+15,2400-cw//2-15));cy=int(rng.integers(ch//2+15,1800-ch//2-15))
   if m[cy,cx,0]<0.95 or any((cx-u)**2+(cy-v)**2<140**2 for u,v in used):continue
   px=cx-cw//2;py=cy-ch//2
   water=m[py:py+ch,px:px+cw,0]
   if float(np.mean(water[crop[:,:,3]>0.035]))<0.93:continue
   dest=paint[py:py+ch,px:px+cw,:]
   take=crop[:,:,3]>dest[:,:,3]
   dest[take]=crop[take]
   used.append((cx,cy));break
print('PAINTERLY GROUPS',len(used))
s=paint
alpha=np.clip(s[:,:,3]*m[:,:,0],0,1)
# Keep the generated brush texture but suppress its few overly bright cyan fringes.
col=np.array([0.3372,0.7305,0.7682],dtype=np.float32)  # #9DDEE3 in linear RGB
s[:,:,:3]=col[None,None,:]
s[:,:,3]=np.sqrt(alpha)*0.88
out=bpy.data.images.new('V5 Painterly Master',width=2400,height=1800,alpha=True,float_buffer=False)
out.pixels.foreach_set(s.ravel());out.filepath_raw=master;out.file_format='PNG';out.save()
print('MASTER ALPHA',float(alpha.max()),float(alpha.mean()),int(np.count_nonzero(alpha>0.05)))

uv=nodes['V3 Garden UV Offset'].outputs[0]
drift=nodes.new('ShaderNodeVectorMath');drift.name='V5 Tiny Overlay Drift';drift.operation='ADD';drift.location=(1200,-1600)
links.new(uv,drift.inputs[0])
for frame,xy in ((1,(0,0,0)),(192,(0.004,0.002,0))):
 drift.inputs[1].default_value=xy;drift.inputs[1].keyframe_insert(data_path='default_value',frame=frame)
noise=nodes.new('ShaderNodeTexNoise');noise.name='V5 Slow Distortion Field';noise.noise_dimensions='4D';noise.inputs['Scale'].default_value=3.0;noise.inputs['Detail'].default_value=2.0;noise.location=(1450,-1800)
links.new(drift.outputs['Vector'],noise.inputs['Vector'])
for frame,w in ((1,0.0),(192,0.12)):
 noise.inputs['W'].default_value=w;noise.inputs['W'].keyframe_insert(data_path='default_value',frame=frame)
dist=nodes.new('ShaderNodeVectorMath');dist.name='V5 Subtle UV Distortion';dist.operation='SCALE';dist.inputs[3].default_value=0.0025;dist.location=(1680,-1800)
links.new(noise.outputs['Color'],dist.inputs[0])
coord=nodes.new('ShaderNodeVectorMath');coord.name='V5 Evolving Painterly UV';coord.operation='ADD';coord.location=(1880,-1600)
links.new(drift.outputs['Vector'],coord.inputs[0]);links.new(dist.outputs['Vector'],coord.inputs[1])
tex=nodes.new('ShaderNodeTexImage');tex.name='V5 Painterly Water Overlay';tex.image=out;tex.extension='CLIP';tex.interpolation='Linear';tex.location=(2100,-1600)
links.new(coord.outputs['Vector'],tex.inputs['Vector'])
area=nodes.new('ShaderNodeTexImage');area.name='V5 Static Water Area Clip';area.image=mask;area.image.colorspace_settings.name='Non-Color';area.extension='CLIP';area.location=(1600,-2200)
links.new(uv,area.inputs['Vector'])
fac=nodes.new('ShaderNodeMath');fac.name='V5 Overlay Water Clip';fac.operation='MULTIPLY';fac.location=(2350,-1800)
links.new(tex.outputs['Alpha'],fac.inputs[0]);links.new(area.outputs['Color'],fac.inputs[1])
opacity=nodes.new('ShaderNodeMath');opacity.name='V5 Painterly Opacity';opacity.operation='MULTIPLY';opacity.inputs[1].default_value=0.72;opacity.location=(2550,-1800)
links.new(fac.outputs[0],opacity.inputs[0])
mix=nodes.new('ShaderNodeMix');mix.name='V5 Painterly Surface Composite';mix.data_type='RGBA';mix.blend_type='MIX';mix.location=(2780,-1600)
links.new(nodes['V4 Restrained Shore Accent'].outputs['Result'],mix.inputs['A'])
links.new(tex.outputs['Color'],mix.inputs['B']);links.new(opacity.outputs[0],mix.inputs['Factor'])
fill_tex=nodes.new('ShaderNodeTexImage');fill_tex.name='V5 Hidden Land Color Texture';fill_tex.image=fill_img;fill_tex.extension='CLIP';fill_tex.location=(2500,-2300)
links.new(uv,fill_tex.inputs['Vector'])
fill_gain=nodes.new('ShaderNodeVectorMath');fill_gain.name='V5 Hidden Land Color Linear Gain';fill_gain.operation='MULTIPLY';fill_gain.inputs[1].default_value=(1.65,1.45,1.30);fill_gain.location=(2750,-2300)
links.new(fill_tex.outputs['Color'],fill_gain.inputs[0])
fill=nodes.new('ShaderNodeMix');fill.name='V5 Hidden Land Water Fill';fill.data_type='RGBA';fill.blend_type='MIX';fill.location=(3000,-1600)
links.new(fill_gain.outputs['Vector'],fill.inputs['A'])
links.new(mix.outputs['Result'],fill.inputs['B'])
links.new(area.outputs['Color'],fill.inputs['Factor'])
links.new(fill.outputs['Result'],nodes['Principled BSDF'].inputs['Base Color'])
# The old V4 procedural visible-stroke chain remains in the node tree but no
# longer reaches the production Base Color output.
scene.frame_start=1;scene.frame_end=192;scene.render.fps=24;scene.frame_set(96)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(root,'water_master_test.blend'))
