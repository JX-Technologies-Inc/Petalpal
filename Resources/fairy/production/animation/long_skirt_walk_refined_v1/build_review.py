"""Slice a generated 4x4 sheet without resizing or independently recentering characters.
Preserves original RGBA. Padding only. This is not a gait correction algorithm.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, hashlib, math

ROOT=Path(__file__).resolve().parent
PHASES=['Left Contact','Left Down','Left Support','Right Swing-in','Right Passing','Right Advance','Right Pre-contact','Right Late Swing','Right Contact','Right Down','Right Support','Left Swing-in','Left Passing','Left Advance','Left Pre-contact','Left Late Swing']
def build():
    source=ROOT/'source/candidate_sheet.png'
    im=Image.open(source).convert('RGBA');w,h=im.size
    cw,ch=math.ceil(w/4),math.ceil(h/4)
    pad=32;size=(cw+2*pad,ch+2*pad)
    frames=[];metrics=[]
    for i in range(16):
        x0=round((i%4)*w/4);x1=round((i%4+1)*w/4)
        y0=round((i//4)*h/4);y1=round((i//4+1)*h/4)
        crop=im.crop((x0,y0,x1,y1))
        out=Image.new('RGBA',size);out.paste(crop,(pad,pad))
        path=ROOT/f'frames/frame_{i+1:02}.png';out.save(path)
        a=crop.getchannel('A');solid=a.point(lambda v:255 if v>16 else 0);bbox=solid.getbbox()
        clipped=bool(bbox and (bbox[0]==0 or bbox[1]==0 or bbox[2]==crop.width or bbox[3]==crop.height))
        metrics.append({'frame':i+1,'intended_phase':PHASES[i],'source_rect':[x0,y0,x1,y1],'source_alpha_bbox_gt16':bbox,'source_cell_edge_touched':clipped,'rgba_sha256':hashlib.sha256(out.tobytes()).hexdigest(),'alpha_extrema':out.getchannel('A').getextrema()})
        frames.append(out)
    try:font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)
    except OSError:font=ImageFont.load_default()
    sheet=Image.new('RGB',(size[0]*4,(size[1]+45)*4),'#d7d7d0');d=ImageDraw.Draw(sheet)
    for i,f in enumerate(frames):
        x=(i%4)*size[0];y=(i//4)*(size[1]+45)
        sheet.paste(f,(x,y),f);d.text((x+12,y+size[1]+3),f'{i+1:02} {PHASES[i]}',fill='#392f48',font=font)
        d.text((x+12,y+size[1]+22),'INTENDED PHASE / REVIEW CANDIDATE',fill='#76576c',font=ImageFont.load_default())
    sheet.save(ROOT/'review/contact_sheet.png')
    checks=Image.new('RGB',(size[0]*4,size[1]*2));d=ImageDraw.Draw(checks)
    for row,color in enumerate(['#fafafa','#30323a']):
        for col,i in enumerate([0,4,8,12]):
            x=col*size[0];y=row*size[1];d.rectangle((x,y,x+size[0],y+size[1]),fill=color);checks.paste(frames[i],(x,y),frames[i])
    checks.save(ROOT/'review/alpha_checks.png')
    opaque=[]
    for f in frames:
        bg=Image.new('RGBA',size,'#d7d7d0');bg.alpha_composite(f);opaque.append(bg.convert('RGB'))
    opaque[0].save(ROOT/'review/walk.gif',save_all=True,append_images=opaque[1:],duration=170,loop=0,disposal=2)
    frames[0].save(ROOT/'review/walk.png',save_all=True,append_images=frames[1:],duration=170,loop=0,disposal=0,blend=0)
    data={'status':'VISUAL_REVIEW_CANDIDATE_NOT_APPROVED','frame_count':16,'fps':1000/170,'frame_duration_ms':170,'loop_duration_ms':2720,'canvas':size,'source_sheet_size':[w,h],'registration':'fixed regular grid plus uniform 32px padding; no per-frame resize, shift, or repaint','warning':'Generated cell alignment, anatomy, gait and edges require visual review. Labels are intentions, not validation.','frames':metrics}
    (ROOT/'frames.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
    print(json.dumps({'canvas':size,'unique_rgba_frames':len(set(m['rgba_sha256'] for m in metrics)),'cell_edge_touched':[m['frame'] for m in metrics if m['source_cell_edge_touched']]}))
if __name__=='__main__':build()
