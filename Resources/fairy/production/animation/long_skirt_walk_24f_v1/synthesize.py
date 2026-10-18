"""Bidirectional motion-compensated midpoint synthesis; never rewrites anchors."""
from pathlib import Path
import sys,json,hashlib,shutil,base64
R=Path(__file__).resolve().parent;sys.path.insert(0,str(R/'_tool_deps'))
import cv2
import numpy as np
from PIL import Image,ImageDraw,ImageFont
S=R.parent/'long_skirt_walk_shoes_v2'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
Y,X=np.mgrid[:378,:378].astype('float32');GRID=np.stack((X,Y),axis=2)
def remap(a,xy):return cv2.remap(a,xy[:,:,0],xy[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
def feature(a):
 rgb=a[:,:,:3]*a[:,:,3:4]+.5*(1-a[:,:,3:4]);return np.rint(cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY)*255).astype('uint8')
def tps_map(target,source):
 target=np.array(target,dtype=float);source=np.array(source,dtype=float);n=len(target)
 def radial(v):
  d=(v*v).sum(axis=-1);return d*np.log(d+1e-8)
 k=radial(target[:,None,:]-target[None,:,:]);p=np.column_stack((np.ones(n),target));mat=np.block([[k+np.eye(n)*1e-4,p],[p.T,np.zeros((3,3))]])
 coef=np.linalg.solve(mat,np.vstack((source,np.zeros((3,2)))))
 grid=GRID.reshape(-1,2);out=radial(grid[:,None,:]-target[None,:,:])@coef[:n]+np.column_stack((np.ones(len(grid)),grid))@coef[n:]
 return out.reshape(378,378,2).astype('float32')
LANDMARKS={
5: {'a':[[170,306],[162,320],[163,333],[181,335],[195,337],[193,310],[187,324],[188,336],[211,337],[222,337]],'b':[[147,292],[143,305],[137,309],[147,327],[154,335],[201,310],[194,324],[198,338],[218,338],[225,338]]},
13:{'a':[[174,306],[166,320],[167,333],[183,337],[192,338],[193,310],[187,324],[189,337],[211,338],[219,338]],'b':[[147,298],[142,311],[135,315],[148,332],[159,338],[233,311],[225,325],[229,339],[250,339],[264,339]]}}
def midpoint(ia,ib,n):
 a=np.array(ia).astype('float32')/255;b=np.array(ib).astype('float32')/255
 dis=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM);dis.setFinestScale(0)
 f=dis.calc(feature(a),feature(b),None);g=dis.calc(feature(b),feature(a),None)
 f=cv2.GaussianBlur(f,(0,0),1.5);g=cv2.GaussianBlur(g,(0,0),1.5)
 # Solve x_mid = x_source + 0.5*flow(x_source), without global recenter/scale.
 ca=GRID.copy();cb=GRID.copy()
 for _ in range(20):ca=.5*ca+.5*(GRID-.5*remap(f,ca));cb=.5*cb+.5*(GRID-.5*remap(g,cb))
 pa=a.copy();pb=b.copy();pa[:,:,:3]*=pa[:,:,3:4];pb[:,:,:3]*=pb[:,:,3:4]
 wa=remap(pa,ca);wb=remap(pb,cb)
 ea=np.linalg.norm(f+remap(g,GRID+f),axis=2);eb=np.linalg.norm(g+remap(f,GRID+g),axis=2)
 qa=remap(1/(1+ea*ea),ca);qb=remap(1/(1+eb*eb),cb)
 # Confidence weighting happens AFTER motion alignment, not an unwarped dissolve.
 weight=np.clip(qa/(qa+qb+1e-6),.2,.8)[:,:,None]
 # Keep one painted surface after warping, avoiding doubled translucent edges
 # from disagreement between two independently painted anchor silhouettes.
 p=wb
 if n in LANDMARKS:
  lm=LANDMARKS[n];fixed=[[0,0],[377,0],[0,377],[377,377],[60,270],[120,270],[180,270],[240,270],[300,270],[60,350],[310,350],[180,375]]
  target=fixed+((np.array(lm['a'])+np.array(lm['b']))/2).tolist();source=fixed+lm['b']
  mapped=remap(pb,tps_map(target,source));blend=np.clip((Y-273)/17,0,1);blend=blend*blend*(3-2*blend);p=p*(1-blend[:,:,None])+mapped*blend[:,:,None]
 out=np.zeros_like(p);out[:,:,3]=p[:,:,3]
 np.divide(p[:,:,:3],p[:,:,3:4],out=out[:,:,:3],where=p[:,:,3:4]>1e-7)
 out=np.rint(np.clip(out,0,1)*255).astype('uint8');out[out[:,:,3]==0,:3]=0
 fg=(a[:,:,3]>.1)|(b[:,:,3]>.1)
 return Image.fromarray(out),{'flow_magnitude_p95_px':float(np.percentile(np.linalg.norm(f,axis=2)[fg],95)),'forward_backward_error_p95_px':float(np.percentile(ea[fg],95)),'method':'DIS reverse-flow midpoint warp of destination painting; TPS foot landmarks for occlusion pairs' if n in LANDMARKS else 'DIS reverse-flow midpoint warp of destination painting','landmarks':LANDMARKS.get(n)}
def main():
 original_hashes={str(p.relative_to(S)):sha(p) for p in S.rglob('*') if p.is_file()}
 anchors=[];sequence=[];entries=[];metrics=[]
 for n in range(1,17):
  src=S/f'frames/frame_{n:02}.png';shutil.copy2(src,R/'anchors'/src.name);anchors.append(Image.open(src).convert('RGBA'))
 for n,a in enumerate(anchors,1):
  target=R/f'frames/frame_{len(sequence)+1:02}.png';shutil.copy2(R/f'anchors/frame_{n:02}.png',target);sequence.append(a)
  entries.append({'index':len(sequence),'label':str(n),'kind':'anchor','anchor':n,'sha256':sha(target)})
  if n%2:
   im,m=midpoint(a,anchors[n],n);p=R/f'inbetweens/frame_{n:02}_5.png';im.save(p);target=R/f'frames/frame_{len(sequence)+1:02}.png';shutil.copy2(p,target);sequence.append(im)
   entries.append({'index':len(sequence),'label':f'{n}.5','kind':'midpoint','between':[n,n+1],'sha256':sha(target)});metrics.append({'between':[n,n+1],**m})
 font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)
 sheet=Image.new('RGB',(378*6,405*4),'#e5e5df');d=ImageDraw.Draw(sheet)
 for i,(im,e) in enumerate(zip(sequence,entries)):
  x=i%6*378;y=i//6*405;sheet.paste(im,(x,y+25),im);d.text((x+8,y+3),f"{i+1:02} | {e['label']} | {e['kind']}",font=font,fill='black')
 sheet.save(R/'review/contact_sheet.png')
 for kind,bg in [('triplets','#eeeeea'),('feet_light','#eeeeea'),('feet_dark','#30323a')]:
  isfeet=kind!='triplets';w,h=(510,220) if isfeet else (378,405);sheet=Image.new('RGB',(w*3,h*8),bg);d=ImageDraw.Draw(sheet)
  for row,n in enumerate(range(1,17,2)):
   for col,(im,label) in enumerate([(anchors[n-1],str(n)),(Image.open(R/f'inbetweens/frame_{n:02}_5.png'),f'{n}.5'),(anchors[n],str(n+1))]):
    view=im.crop((115,280,285,345)).resize((510,195),Image.Resampling.NEAREST) if isfeet else im;x=col*w;y=row*h;sheet.paste(view,(x,y+25),view);d.text((x+8,y+3),label,font=font,fill='white' if kind=='feet_dark' else 'black')
  sheet.save(R/f'review/{kind}.png')
 delays=[round((i+1)*136/24)*10-round(i*136/24)*10 for i in range(24)]
 opaque=[]
 for im in sequence:
  bg=Image.new('RGB',(378,378),'#e5e5df');bg.paste(im,(0,0),im);opaque.append(bg)
 opaque[0].save(R/'review/walk_24.gif',save_all=True,append_images=opaque[1:],duration=delays,loop=0,disposal=2)
 metadata={'status':'SYNTHESIZED_MIDPOINTS_AWAITING_VISUAL_REVIEW','canvas':[378,378],'frame_count':24,'anchor_count':16,'new_frame_count':8,'loop_duration_ms':1360,'frame_duration_ms':1360/24,'gif_durations_ms':delays,'original_frame_duration_ms':85,'frames':entries,'synthesis':metrics,'timing_note':'Uniform 24-frame spacing follows the requested target; nonuniform insertion necessarily redistributes anchor timestamps within the unchanged total loop.'}
 (R/'frames.json').write_text(json.dumps(metadata,indent=2))
 payload={'original':[base64.b64encode((R/f'anchors/frame_{n:02}.png').read_bytes()).decode() for n in range(1,17)],'refined':[base64.b64encode((R/f'frames/frame_{n:02}.png').read_bytes()).decode() for n in range(1,25)],'labels':[e['label'] for e in entries]}
 (R/'index.html').write_text((R/'player_template.html').read_text(encoding='utf-8').replace('/*ASSETS*/',json.dumps(payload)),encoding='utf-8')
 assert all(sha(S/p)==h for p,h in original_hashes.items())
 (R/'source_hashes.json').write_text(json.dumps(original_hashes,indent=2));print(json.dumps({'frames':24,'new':8,'source_files_unchanged':len(original_hashes),'gif_loop_ms':sum(delays),'flow_checks':metrics}))
if __name__=='__main__':main()
