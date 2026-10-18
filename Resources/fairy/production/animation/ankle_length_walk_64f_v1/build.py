"""Isolated 64-sample gait candidate, with explicit rigid shoe contact mechanics.
Approved source packages are never written. Foot repairs are separately audited.
"""
from pathlib import Path
import json,shutil,hashlib,math
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
import articulation as art
cv2=art.cv2
R=Path(__file__).resolve().parent
S32=R.parent/'ankle_length_walk_32f_v1'
S16=R.parent/'ankle_length_walk_16f_v1'
W=378
STRIDE=72.
GROUND=342.
HEEL_X=185.
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def writejson(p,obj):p.write_text(json.dumps(obj,indent=2)+'\n',encoding='utf-8')
def smooth(t):return t*t*(3-2*t)

# Top edge of the visible rear shoe, in original 378px source coordinates.
# The remaining polygon goes outside the canvas silhouette below the shoe.
REAR_TOP=[
 [(134,325),(140,314),(147,316),(155,329),(164,333),(179,339)],
 [(130,322),(138,309),(145,311),(150,326),(165,334),(174,339)],
 [(130,314),(138,300),(146,304),(146,317),(159,329),(167,335)],
 [(132,316),(140,303),(148,306),(150,319),(163,328),(170,335)],
 [(155,330),(161,318),(170,322),(179,331),(193,337),(198,343)],
 [(131,320),(140,302),(147,305),(148,320),(158,329),(166,335)],
 [(129,318),(138,300),(146,304),(148,321),(156,329),(164,336)],
 [(135,321),(144,302),(152,307),(155,323),(170,333),(180,340)],
 [(118,326),(128,311),(138,314),(139,327),(154,335),(164,342)],
 [(117,322),(126,300),(136,306),(135,324),(146,331),(156,338)],
 [(119,316),(127,296),(139,302),(136,318),(148,328),(156,336)],
 [(123,310),(131,292),(141,297),(138,313),(149,324),(158,331)],
 [(156,330),(165,319),(174,324),(181,333),(194,337),(199,344)],
 [(130,323),(140,307),(148,309),(149,322),(161,329),(172,338)],
 [(127,325),(137,308),(147,311),(150,325),(165,332),(175,341)],
 [(136,329),(145,317),(153,321),(160,332),(174,337),(184,345)],
]
FRONT_HEEL=[226,229,224,213,189,203,202,203,226,217,211,210,190,232,229,226]
FRONT_TOP=[]
for i,h in enumerate(FRONT_HEEL):
    tip=art.RIGHT[i][0]
    FRONT_TOP.append([(h-8,334),(h-2,320),(h+6,322),(tip-17,331),(tip-6,334),(tip+5,339)])

def polygon_mask(top):
    im=Image.new('L',(W,W));p=top+[(top[-1][0]+2,353),(top[0][0]-2,353)]
    ImageDraw.Draw(im).polygon(p,fill=255)
    return np.array(im,dtype=np.float32)/255

def remap_mask(m,donor,dl,dr):
    yy,xx=np.mgrid[:W,:W]
    boxes=art.SHOES[donor];join=(boxes[0][2]+boxes[1][0])/2;end=min(boxes[0][1],boxes[1][1])-3
    split=195+(join-195)*art.smooth((yy-235)/(end-235))
    out=np.zeros((W,W),np.float32)
    for side,d in enumerate([dl,dr]):
        sy=yy.astype(np.float32)
        for _ in range(12):sy=yy-d[1]*art.smooth((sy-235)/(end-235))
        amount=art.smooth((sy-235)/(end-235));sx=xx-d[0]*amount
        part=m*((xx<=split) if side==0 else (xx>split))
        out=np.maximum(out,cv2.remap(part,sx.astype(np.float32),sy.astype(np.float32),cv2.INTER_LINEAR))
    return out

def make_templates():
    original=np.array(Image.open(S16/'frames/frame_01.png').convert('RGBA'))
    templates=[]
    for name,top,heel,toe in [
        ('near',FRONT_TOP[0],[227.,341.],[247.,341.]),
        ('far',REAR_TOP[0],[143.,336.],[171.,342.])]:
        m=polygon_mask(top)
        layer=original.copy();layer[:,:,3]=np.rint(layer[:,:,3]*m).astype(np.uint8);layer[layer[:,:,3]==0]=0
        Image.fromarray(layer).save(R/f'parts/shoe_{name}.png')
        delta=np.array(toe)-heel
        templates.append({'name':name,'image':layer,'heel':np.array(heel),'toe':np.array(toe),
                          'sole_length':float(np.linalg.norm(delta)),'neutral_angle':-math.atan2(delta[1],delta[0])})
    return templates

def gait(phase,L):
    # One complete leg cycle. The opposite shoe uses phase+0.5.
    p=phase%1;theta=0.;contact='flat';pivot='heel'
    heel=np.array([HEEL_X+STRIDE*(.31-p),GROUND])
    if p<.12:
        theta=math.radians(-6*(1-smooth(p/.12)));contact='heel'
        stage='heel contact / loading response / foot settling'
    elif p<.5:
        stage='early / mid / late support';contact='flat'
    elif p<.62:
        theta=math.radians(20*smooth((p-.5)/.12));contact='toe';pivot='toe'
        heel+=np.array([L*(1-math.cos(theta)),-L*math.sin(theta)])
        stage='heel rise / toe loading / toe-off'
    else:
        t=(p-.62)/.38;contact='air';stage='swing / passing / late swing / pre-contact'
        angle0=math.radians(20)
        x0=HEEL_X+STRIDE*(.31-.62)+L*(1-math.cos(angle0));x1=HEEL_X+STRIDE*.31
        tangent=-STRIDE*.38
        x=(2*t**3-3*t*t+1)*x0+(t**3-2*t*t+t)*tangent+(-2*t**3+3*t*t)*x1+(t**3-t*t)*tangent
        y=GROUND-L*math.sin(angle0)*(1-smooth(t))-12*math.sin(math.pi*t)**2
        heel=np.array([x,y]);theta=math.radians(20-26*smooth(t))
    toe=heel+L*np.array([math.cos(theta),math.sin(theta)])
    return {'phase':p,'heel':heel.tolist(),'toe':toe.tolist(),'angle_degrees':math.degrees(theta),
            'contact':contact,'pivot':pivot,'stage':stage}

def shoe_layer(template,state):
    theta=template['neutral_angle']+math.radians(state['angle_degrees'])
    c,s=math.cos(theta),math.sin(theta);rot=np.array([[c,-s],[s,c]],np.float32)
    offset=np.array(state['heel'])-rot@template['heel']
    mat=np.column_stack([rot,offset]).astype(np.float32)
    a=template['image'].astype(np.float32)/255;a[:,:,:3]*=a[:,:,3:4]
    return cv2.warpAffine(a,mat,(W,W),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)

def over(a,b):return a+b*(1-a[:,:,3:4])
def unpm(a):
    a=a.copy();a[:,:,:3]=np.divide(a[:,:,:3],a[:,:,3:4],out=np.zeros_like(a[:,:,:3]),where=a[:,:,3:4]>1e-6)
    q=np.rint(np.clip(a,0,1)*255).astype(np.uint8);q[q[:,:,3]==0]=0;return q

def drape(template_body,states,templates):
    """Retarget existing lower-petal panels to the two covered ankle roots.
    No skin reconstruction. One common approved petal donor avoids random
    per-frame hem topology changes. Panel roots remain pinned at the waist.
    """
    yy,xx=np.mgrid[:W,:W];out=[]
    # Template is far on screen-left and near on screen-right.
    split=195+4*art.smooth((yy-245)/70)
    for side,(s,t) in enumerate([(states[1],templates[1]),(states[0],templates[0])]):
        d=np.array(s['heel'])-t['heel']
        sy=yy.astype(np.float32)
        for _ in range(14):sy=yy-d[1]*art.smooth((sy-245)/67)
        amount=art.smooth((sy-245)/67)
        sx=xx-d[0]*amount
        mask=(xx<=split) if side==0 else (xx>split)
        part=template_body*mask[:,:,None]
        out.append(cv2.remap(part,sx.astype(np.float32),sy.astype(np.float32),cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT))
    return over(out[1],out[0])

def build():
    for d in ['frames','original_anchors','original_16_anchors','inbetweens','repaired_anchors','parts','masks','review','work']:(R/d).mkdir(exist_ok=True)
    templates=make_templates();rows=[];repairs=[]
    for i in range(16):shutil.copy2(S16/'frames'/f'frame_{i+1:02}.png',R/'original_16_anchors'/f'frame_{i+1:02}.png')
    for i in range(32):shutil.copy2(S32/'frames'/f'frame_{i+1:02}.png',R/'original_anchors'/f'frame_{i+1:02}.png')
    for n in range(64):
        i=n//4;t=(n%4)/4;phase=n/64
        if n%2==0:
            base=np.array(Image.open(S32/'frames'/f'frame_{n//2+1:02}.png').convert('RGBA'))
            if t==0:donor=i;dl=np.array([0.,0.]);dr=dl.copy()
            else:
                m=json.loads((S32/'motion_controls.json').read_text())['inbetweens'][i]
                donor=m['donor_anchor']-1;dl=np.array(m['rear_shoe_translation']);dr=np.array(m['front_shoe_translation'])
        else:
            im,m=art.art_pose(i,t);base=np.array(im);donor=m['donor_anchor']-1
            dl=np.array(m['rear_shoe_translation']);dr=np.array(m['front_shoe_translation'])
        oldmask=np.maximum(polygon_mask(REAR_TOP[donor]),polygon_mask(FRONT_TOP[donor]))
        if np.any(dl) or np.any(dr):oldmask=remap_mask(oldmask,donor,dl,dr)
        states=[gait(phase,templates[0]['sole_length']),gait(phase+.5,templates[1]['sole_length'])]
        # Keep the approved petal silhouette. Do not drag or cross large skirt
        # panels to follow the feet: that trial distorted the hem and was rejected.
        # A subpixel mask edge softens the extraction join, not the animation.
        oldmask=cv2.GaussianBlur(oldmask,(3,3),.45)
        body=base.astype(np.float32)/255;body[:,:,3]*=1-oldmask;body[:,:,:3]*=body[:,:,3:4]
        near=shoe_layer(templates[0],states[0]);far=shoe_layer(templates[1],states[1])
        comp=over(body,over(near,far))
        out=unpm(comp)
        fname=f'frame_{n+1:02}.png';Image.fromarray(out).save(R/'frames'/fname)
        dest='repaired_anchors' if n%2==0 else 'inbetweens';shutil.copy2(R/'frames'/fname,R/dest/fname)
        changed=np.any(out!=base,axis=2)
        edit=(oldmask>0)|(near[:,:,3]>0)|(far[:,:,3]>0)
        # Include compositing's one-LSB float rounding support, not hidden edits.
        out[~edit]=base[~edit]
        Image.fromarray(out).save(R/'frames'/fname);shutil.copy2(R/'frames'/fname,R/dest/fname)
        Image.fromarray((edit*255).astype(np.uint8)).save(R/'masks'/fname)
        row={'index':n+1,'reference_label':str(i+1+t),'file':f'frames/{fname}','duration_ms':21.25,
             'kind':'repaired_anchor' if n%2==0 else 'new_inbetween','reference_frame_32':n//2+1 if n%2==0 else None,
             'donor_original_16':donor+1,'root_travel_x':STRIDE*phase,'body_registration':[187,342],
             'near':states[0],'far':states[1],
             'visible_near_shoe_pixels':int(((near[:,:,3]*(1-body[:,:,3]))>.25).sum()),
             'visible_far_shoe_pixels':int(((far[:,:,3]*(1-near[:,:,3])*(1-body[:,:,3]))>.25).sum()),
             'sha256':sha(R/'frames'/fname)}
        rows.append(row)
        if n%2==0:repairs.append({'frame_64':n+1,'source_32':n//2+1,'reason':'whole-cycle planted-shoe sliding and absent clear foot-role exchange; only shoe/opening pixels repaired','mask':f'masks/{fname}','outside_mask_rgba_unchanged':bool(np.array_equal(out[~edit],base[~edit]))})
    writejson(R/'frames.json',{'status':'CANDIDATE_VISUAL_VALIDATION_PENDING','frame_count':64,'canvas':[378,378],
        'frame_duration_ms':21.25,'loop_duration_ms':1360,'loop':True,'gif_durations_ms':([20]*7+[30])*8,
        'root_motion':{'stride_px':STRIDE,'direction':'screen-right','duration_ms':1360,'meaning':'in-place PNGs need this root travel to demonstrate world-space stance locking'},
        'original_32_hashes':{p.name:sha(p) for p in (S32/'frames').glob('*.png')},
        'anchor_repair_scope':'Foot mechanics repaired in 32 anchor copies using local shoe/opening masks, including a 1-pixel feather margin. All pixels outside declared masks unchanged; originals separately preserved.',
        'frames':rows})
    writejson(R/'anchor_repairs.json',repairs)
    writejson(R/'parts/manifest.json',{'source':'../original_16_anchors/frame_01.png','source_sha256':sha(S16/'frames/frame_01.png'),
        'near_top_polygon':FRONT_TOP[0],'far_top_polygon':REAR_TOP[0],
        'parts':[{'name':x['name'],'heel':x['heel'].tolist(),'toe':x['toe'].tolist(),'sole_length':x['sole_length'],'neutral_angle_degrees':math.degrees(x['neutral_angle'])} for x in templates],
        'shoe_scaling':False,'repainting':False,'near_far_images_distinct':True})
    ims=[Image.open(R/f['file']).convert('RGBA') for f in rows]
    for bg,suffix in [('#eeeae5','light'),('#263340','dark')]:
        sheet=Image.new('RGB',(4*378,4*410),bg);d=ImageDraw.Draw(sheet)
        for k,n in enumerate(range(0,64,4)):
            im=Image.alpha_composite(Image.new('RGBA',(W,W),bg),ims[n]).convert('RGB')
            x=k%4*378;y=k//4*410;sheet.paste(im,(x,y+25));d.text((x+10,y+6),f'{n+1:02} | near {rows[n]["near"]["contact"]} / far {rows[n]["far"]["contact"]}',fill='#ac91c1' if suffix=='dark' else '#32283e')
        sheet.save(R/f'work/gait_keys_{suffix}.png')
    print('Created 64-sample isolated gait prototype; visual inspection pending.')

if __name__=='__main__':build()
