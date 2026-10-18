"""Rasterize actual Blender-evaluated textured meshes with V2's sRGB alpha rule.
This is the authoritative PNG exporter; no pose generation occurs in this file.
"""
from pathlib import Path
import json,math,hashlib
import numpy as np
from PIL import Image,ImageDraw
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
cfg=json.loads((HERE/'build_config.json').read_text());top=json.loads((HERE/'mesh_cache/topology.json').read_text())
N=cfg['canvas'];names=[l['name'] for l in cfg['layers']]
images={n:Image.open(HERE/'images'/f'{n}.png').convert('RGBA') for n in names}
srcs={}
for n,im in images.items():
    a=np.array(im).astype(np.float32)/255; a[:,:,:3]*=a[:,:,3:4];srcs[n]=a
def raster(n,dest):
    source=np.array(top[n]['source'],float)
    # Identity optimization is permitted only after checking actual evaluated
    # Blender vertices, never by substituting a still for a posed mesh.
    if np.max(np.abs(dest-source))<0.00015:return images[n]
    result=np.zeros((N,N,4),np.float32);tex=srcs[n]
    for q in top[n]['quads']:
        for ids in [(q[0],q[1],q[2]),(q[0],q[2],q[3])]:
            d=dest[list(ids)];s=source[list(ids)]
            xmin=max(0,int(math.floor(d[:,0].min())));xmax=min(N,int(math.ceil(d[:,0].max())))
            ymin=max(0,int(math.floor(d[:,1].min())));ymax=min(N,int(math.ceil(d[:,1].max())))
            if xmin>=xmax or ymin>=ymax:continue
            yy,xx=np.mgrid[ymin:ymax,xmin:xmax];px=xx+.5;py=yy+.5
            det=(d[1,1]-d[2,1])*(d[0,0]-d[2,0])+(d[2,0]-d[1,0])*(d[0,1]-d[2,1])
            if abs(det)<1e-8:continue
            u=((d[1,1]-d[2,1])*(px-d[2,0])+(d[2,0]-d[1,0])*(py-d[2,1]))/det
            v=((d[2,1]-d[0,1])*(px-d[2,0])+(d[0,0]-d[2,0])*(py-d[2,1]))/det
            w=1-u-v;inside=(u>=-1e-7)&(v>=-1e-7)&(w>=-1e-7)
            if not inside.any():continue
            sx=u*s[0,0]+v*s[1,0]+w*s[2,0]-.5;sy=u*s[0,1]+v*s[1,1]+w*s[2,1]-.5
            sx=np.clip(sx,0,N-1);sy=np.clip(sy,0,N-1)
            ix=np.floor(sx).astype(int);iy=np.floor(sy).astype(int);jx=np.minimum(ix+1,N-1);jy=np.minimum(iy+1,N-1)
            fx=(sx-ix)[:,:,None];fy=(sy-iy)[:,:,None]
            sample=(tex[iy,ix]*(1-fx)+tex[iy,jx]*fx)*(1-fy)+(tex[jy,ix]*(1-fx)+tex[jy,jx]*fx)*fy
            result[ymin:ymax,xmin:xmax][inside]=sample[inside]
    a=result[:,:,3:4];rgb=np.divide(result[:,:,:3],a,out=np.zeros_like(result[:,:,:3]),where=a>1e-7)
    return Image.fromarray(np.clip(np.rint(np.concatenate([rgb,a],axis=2)*255),0,255).astype(np.uint8))

stats=[];sequence=[]
for f in range(0,cfg['frames']+2):
    cache=np.load(HERE/'mesh_cache'/f'frame_{f:03d}.npz');out=Image.new('RGBA',(N,N))
    for n in names:
        if f==0:
            assert np.max(np.abs(cache[n]-np.array(top[n]['source'])))<0.00015
            posed=Image.open(HERE/'rest_images'/f'{n}.png').convert('RGBA')
        else:posed=raster(n,cache[n])
        out=Image.alpha_composite(out,posed)
    if f==0:out.save(HERE/'review/resting_recomposition.png')
    elif f<=cfg['frames']:
        out.save(HERE/'frames'/f'walk_{f:03d}.png');sequence.append(out)
    else:out.save(HERE/'review/loop_closure.png')
    print('RENDERED_EVALUATED_MESH',f,flush=True)
master=Image.open(ROOT/'Resources/fairy/production/master/fairy_first_approved.png').convert('RGBA')
rest=Image.open(HERE/'review/resting_recomposition.png');s=np.array(master);r=np.array(rest);vis=s[:,:,3]>0
diff=np.abs(s.astype(int)-r.astype(int))
review=Image.new('RGB',(N*2,N),'#687582');review.paste(master,(0,0),master);review.paste(rest,(N,0),rest);review.save(HERE/'review/source_vs_rest.png')
sheet=Image.new('RGB',(6*314,4*340),'#687582');draw=ImageDraw.Draw(sheet)
for j,im in enumerate(sequence):
    thumb=im.resize((314,314),Image.Resampling.LANCZOS);x=j%6*314;y=j//6*340
    sheet.paste(thumb,(x,y+22),thumb);draw.text((x+7,y+5),f'{j+1:02d}  {j/cfg["fps"]:.3f}s',fill='white')
sheet.save(HERE/'review/walk_contact_sheet.png')
sequence[0].save(HERE/'review/walk_preview.png',save_all=True,append_images=sequence[1:],duration=[62,63]*12,loop=0,disposal=0,blend=0)
gif=[]
for im in sequence:
    canvas=Image.new('RGB',(627,627),'#687582');small=im.resize((627,627),Image.Resampling.LANCZOS);canvas.paste(small,(0,0),small);gif.append(canvas)
gif[0].save(HERE/'review/walk_preview.gif',save_all=True,append_images=gif[1:],duration=[60,60,60,70]*6,loop=0)
# Runtime-scale panel uses the visible character height, not padded canvas size.
visible_box=master.getchannel('A').point(lambda x:255 if x>16 else 0).getbbox();height=visible_box[3]-visible_box[1]
runtime=[]
for im in sequence:
    canvas=Image.new('RGB',(510,170),'#687582');d=ImageDraw.Draw(canvas)
    for j,h in enumerate([96,108,120]):
        scale=h/height;small=im.resize((round(N*scale),round(N*scale)),Image.Resampling.LANCZOS)
        canvas.paste(small,(j*170+(170-small.width)//2,20),small);d.text((j*170+8,4),f'{h}px',fill='white')
    runtime.append(canvas)
runtime[0].save(HERE/'review/runtime_preview.gif',save_all=True,append_images=runtime[1:],duration=[60,60,60,70]*6,loop=0)
engine=np.array(Image.open(HERE/'review/blender_engine_rest.png').convert('RGBA'))
report={'rest_visible_rgba_exact':bool(np.array_equal(r[vis],s[vis])),'rest_alpha_exact':bool(np.array_equal(r[:,:,3],s[:,:,3])),
 'rest_max_visible_delta':diff[vis].max(axis=0).tolist(),'loop_closure_exact':bool(np.array_equal(np.array(sequence[0]),np.array(Image.open(HERE/'review/loop_closure.png')))),
 'frames':len(sequence),'fps':cfg['fps'],'duration_seconds':len(sequence)/cfg['fps'],'canvas':[N,N],
 'exporter':'actual Blender evaluated mesh geometry + premultiplied texture filtering + straight sRGB source-over',
 'native_engine_rest_exact':bool(np.array_equal(engine[vis],s[vis])),'native_engine_rest_mean_visible_rgb_error':float(np.abs(engine[:,:,:3].astype(int)-s[:,:,:3].astype(int))[vis].mean()),
 'sources_unchanged':all(hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==h for p,h in cfg['source_hashes'].items())}
(HERE/'render_validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2),flush=True)
