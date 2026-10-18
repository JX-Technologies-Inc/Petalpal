from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageFilter
import numpy as np,json,hashlib,shutil,importlib.util,base64
R=Path(__file__).resolve().parent;S=R.parent/'long_skirt_walk_refined_v1';A=R.parent/'shoe_proportion_review_v1'
spec=importlib.util.spec_from_file_location('approved',A/'correct_shoes.py');M=importlib.util.module_from_spec(spec);spec.loader.exec_module(M)
def foot(name,x0,y0,x1,y1,pivot,axis,blend):return dict(name=name,poly=[[x0,y0],[x1-12,y0],[x1,y1],[x0,y1]],pivot=pivot,axis=axis,blend=blend)
# New masks only for previously unprocessed frames. All values are source pixels.
# Left refers to SCREEN side, not an unproven anatomical leg identity.
DATA={
2:([135,298,171,346],[141,315],[.86,.51],[300,330],[219,307,273,346],[230,338],[310,332]),
3:([133,290,171,345],[142,304],[.78,.626],[296,327],[218,308,278,346],[227,339],[311,333]),
4:([133,286,170,344],[144,299],[.70,.714],[293,324],[208,307,282,346],[219,338],[310,332]),
6:([130,286,165,345],[143,302],[.65,.76],[293,326],[192,306,237,346],[198,337],[309,332]),
7:([126,284,161,345],[139,300],[.65,.76],[293,326],[185,305,241,346],[192,338],[308,332]),
8:([132,282,170,345],[145,297],[.65,.76],[291,325],[184,303,252,346],[192,338],[307,332]),
10:([116,287,155,345],[130,306],[.80,.60],[295,327],[224,306,277,346],[231,338],[309,332]),
11:([118,281,161,344],[133,297],[.72,.694],[290,323],[222,304,275,345],[230,337],[309,332]),
12:([119,279,154,344],[132,294],[.67,.742],[289,322],[225,303,276,346],[233,338],[308,332]),
14:([130,291,165,345],[142,308],[.80,.60],[297,330],[219,309,281,346],[229,339],[312,334]),
15:([125,291,168,345],[140,307],[.82,.572],[297,330],[223,308,282,346],[232,338],[311,333]),
16:([136,299,180,346],[147,320],[1,0],[303,332],[220,308,266,346],[226,339],[311,333])}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 before={str(p):sha(p) for root in [S,A] for p in root.rglob('*') if p.is_file() and '__pycache__' not in str(p)}
 approved_defs=json.loads((A/'masks/definitions.json').read_text())['feet'];defs={};results=[];orig=[];outs=[]
 yy,xx=np.mgrid[:378,:378].astype(float)
 for n in range(1,17):
  src=S/f'frames/frame_{n:02}.png';im=Image.open(src).convert('RGBA');a=np.array(im);orig.append(im);shutil.copy2(src,R/'original'/src.name)
  if n in [1,5,9,13]:
   shutil.copy2(A/f'variants/090/{src.name}',R/'frames'/src.name)
   for p in (A/'masks').glob(f'frame_{n:02}_*.png'):shutil.copy2(p,R/'masks'/p.name)
   specs=approved_defs[str(n)];defs[n]={'origin':'approved unchanged masks and output copied byte-for-byte','feet':specs}
  else:
   l,p,axis,b,r,rp,rb=DATA[n];specs=[foot('screen_left',*l,p,axis,b),foot('screen_right',*r,rp,[1,0],rb)];union=np.zeros((378,378),bool);out=a.copy();f=a.astype(float)/255;prem=f.copy();prem[:,:,:3]*=prem[:,:,3:4]
   for s in specs:
    poly=[(x+(10 if x==max(p[0] for p in s['poly']) else 0),y+(10 if y==max(p[1] for p in s['poly']) else 0)) for x,y in s['poly']];s['declared_polygon']=poly
    hard=M.mask(poly);m=np.array(hard)>0;union|=m;weight=np.array(hard.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(.7)))/255;weight[~m]=0
    hard.save(R/f"masks/frame_{n:02}_{s['name']}.png")
    dx,dy=s['axis'];norm=np.hypot(dx,dy);dx/=norm;dy/=norm;px,py=s['pivot'];lo,hi=s['blend']
    shift=(1/.9-1)*np.maximum(0,(xx-px)*dx+(yy-py)*dy)*M.smooth((yy-lo)/(hi-lo))*weight
    q=M.sample(prem,xx+shift*dx,yy+shift*dy);rgba=np.zeros_like(q);rgba[:,:,3]=q[:,:,3];np.divide(q[:,:,:3],q[:,:,3:4],out=rgba[:,:,:3],where=q[:,:,3:4]>1e-8);v=np.rint(np.clip(rgba,0,1)*255).astype('uint8');sel=m&(shift>1e-5);out[sel]=v[sel]
   Image.fromarray(out).save(R/'frames'/src.name);Image.fromarray((union*255).astype('uint8')).save(R/f'masks/frame_{n:02}_union.png');defs[n]={'origin':'new per-foot masks, same reviewed correction method','feet':specs}
  output=Image.open(R/'frames'/src.name).convert('RGBA');outs.append(output);b=np.array(output);union=np.array(Image.open(R/f'masks/frame_{n:02}_union.png'))>0;diff=np.any(a!=b,axis=2)
  outside=int((diff&~union).sum());assert outside==0
  pivots=[bool(np.array_equal(a[s['pivot'][1],s['pivot'][0]],b[s['pivot'][1],s['pivot'][0]])) for s in specs]
  results.append({'frame':n,'outside_mask_changed_pixels':outside,'changed_pixels':int(diff.sum()),'heel_reference_pixels_unchanged':pivots,'bottom_alpha_gt16_original':int(np.where(a[:,:,3]>16)[0].max()),'bottom_alpha_gt16_corrected':int(np.where(b[:,:,3]>16)[0].max()),'source_sha256':sha(src),'output_sha256':sha(R/'frames'/src.name),'reviewed_result_retained':n in [1,5,9,13]})
 font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)
 for kind in ['full_body','shoe_detail','alpha_dark','alpha_light']:
  feet=kind!='full_body';cw,ch=(378,405) if not feet else (510,215);bg='#30323a' if kind=='alpha_dark' else '#eeeeea';sheet=Image.new('RGB',(cw*4,ch*4),bg);d=ImageDraw.Draw(sheet)
  for i,im in enumerate(outs):
   x=i%4*cw;y=i//4*ch;display=im if not feet else im.crop((115,285,285,350)).resize((510,195),Image.Resampling.NEAREST);sheet.paste(display,(x,y+20),display);d.text((x+6,y+2),f'{i+1:02} / corrected 90%',font=font,fill='white' if kind=='alpha_dark' else '#332b3c')
  sheet.save(R/f'review/{kind}_contact_sheet.png')
 comparisons=[]
 for a,b in zip(orig,outs):
  c=Image.new('RGB',(756,405),'#e5e5df');c.paste(a,(0,25),a);c.paste(b,(378,25),b);d=ImageDraw.Draw(c);d.text((10,4),'Original',font=font,fill='black');d.text((388,4),'Corrected 90%',font=font,fill='black');comparisons.append(c)
 comparisons[0].save(R/'review/before_after.gif',save_all=True,append_images=comparisons[1:],duration=[80,90]*8,loop=0,disposal=2)
 neutral=[]
 for im in outs:
  c=Image.new('RGB',(378,378),'#e5e5df');c.paste(im,(0,0),im);neutral.append(c)
 neutral[0].save(R/'review/walk.gif',save_all=True,append_images=neutral[1:],duration=[80,90]*8,loop=0,disposal=2)
 # Explicit ordered transition pairs, with original and corrected on each row.
 sheet=Image.new('RGB',(1020,4*430),'#e5e5df');d=ImageDraw.Draw(sheet)
 for row,(f,t) in enumerate([(4,5),(8,9),(12,13),(16,1)]):
  for half,seq in enumerate([orig,outs]):
   for col,n in enumerate([f,t]):
    x=col*510;y=row*430+half*215;c=seq[n-1].crop((115,285,285,350)).resize((510,195));sheet.paste(c,(x,y+20),c);d.text((x+5,y+2),f'{"Original" if half==0 else "Corrected"} {n:02}',font=font,fill='black')
 sheet.save(R/'review/transitions.png')
 meta=json.loads((S/'frames.json').read_text());meta.update(fps=1000/85,frame_duration_ms=85,loop_duration_ms=1360,gif_frame_durations_ms=[80,90]*8,status='SHOE_90_PERCENT_FULL_CYCLE_AWAITING_VISUAL_REVIEW',source='../long_skirt_walk_refined_v1',correction='local heel-referenced forefoot compression; no gait correction',frames=results);(R/'frames.json').write_text(json.dumps(meta,indent=2));(R/'masks/definitions.json').write_text(json.dumps(defs,indent=2))
 for path,h in before.items():assert sha(Path(path))==h,path
 (R/'validation.json').write_text(json.dumps({'source_files_checked':len(before),'source_files_unchanged':True,'all_outside_masks_identical':True,'frames':results},indent=2))
 payload={'original':[base64.b64encode((R/f'original/frame_{n:02}.png').read_bytes()).decode() for n in range(1,17)],'corrected':[base64.b64encode((R/f'frames/frame_{n:02}.png').read_bytes()).decode() for n in range(1,17)]}
 template=(R/'player_template.html').read_text(encoding='utf-8');(R/'index.html').write_text(template.replace('/*ASSETS*/',json.dumps(payload)),encoding='utf-8')
 print(json.dumps({'frames':16,'outside_mask_changes':sum(x['outside_mask_changed_pixels'] for x in results),'contact_reference_checks':[x['frame'] for x in results if not all(x['heel_reference_pixels_unchanged'])],'baseline_changes':[x['frame'] for x in results if x['bottom_alpha_gt16_original']!=x['bottom_alpha_gt16_corrected']]}))
if __name__=='__main__':main()
