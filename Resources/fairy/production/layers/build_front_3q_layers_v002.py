"""Deterministic, source-pixel layer separation authorized by the user.

No generated candidate pixels, Blender images, resizing, or pose changes are used.
Minimal hidden seam support propagates adjacent original paint under fully opaque
occluders only. This supports small idle displacement, not arbitrary articulated poses.
"""
from pathlib import Path
import json, hashlib, sys
DEPS=Path(__file__).resolve().parents[4]/'output/fairy-layer-tools/pythonlibs'
sys.path.insert(0,str(DEPS))
from scipy import ndimage
from pymatting import estimate_alpha_cf, estimate_foreground_ml
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

BASE=Path(__file__).resolve().parents[1]
OUT=BASE/'layers/front_3q';OUT.mkdir(parents=True,exist_ok=True)
REVIEW=BASE/'review';SOURCE=BASE/'master/fairy_approved_structure.png'
source=Image.open(SOURCE).convert('RGB');rgb_full=np.asarray(source)
# Computation window only. Delivered layers are never trimmed and never resampled.
BOX=(580,160,780,690);X0,Y0,X1,Y1=BOX;W=X1-X0;H=Y1-Y0
rgb=rgb_full[Y0:Y1,X0:X1].astype(np.float32)
CANVAS=(1024,1024);SOURCE_ROOT=(683,686);ROOT=(512,896)
DX=ROOT[0]-SOURCE_ROOT[0];DY=ROOT[1]-SOURCE_ROOT[1]

# Hand-placed semantic masks in ORIGINAL presentation-sheet pixels.
# Anatomical right is the near/screen-left arm in this approved front_3q pose.
P={
'wing_left': [[(716,298),(724,278),(739,266),(745,262),(748,265),(747,282),(743,298),(735,312),(724,321),(721,313)],[(721,323),(733,320),(743,324),(745,333),(740,344),(730,354),(721,351)]],
'wing_right': [[(621,261),(628,261),(640,270),(650,284),(655,300),(650,315),(643,321),(634,312),(628,299),(623,280)],[(638,320),(629,322),(622,329),(620,337),(625,344),(633,348),(642,343),(648,332)]],
'dress_back_petals': [[(634,337),(625,346),(613,361),(609,371),(613,380),(600,388),(590,397),(588,406),(591,413),(596,415),(591,425),(590,435),(595,447),(610,439),(622,418),(637,397),(649,373)],[(629,445),(616,469),(609,491),(602,508),(600,527),(596,547),(594,566),(595,588),(600,608),(610,628),(620,638),(615,617),(615,594),(622,575),(626,556),(632,541),(644,532),(653,531),(658,521),(658,499),(649,468)],[(716,346),(734,367),(743,384),(754,394),(768,401),(771,409),(767,417),(760,423),(750,412),(740,405),(728,386)],[(730,429),(750,469),(759,488),(770,503),(770,513),(761,524),(751,529),(752,546),(752,559),(755,580),(760,601),(765,619),(765,633),(761,646),(756,623),(749,607),(738,588),(731,576),(726,558),(719,537),(713,509),(708,479)]],
'leg_right': [[(657,463),(671,459),(683,470),(687,491),(684,510),(678,533),(674,553),(669,579),(664,603),(660,621),(660,641),(668,655),(679,665),(684,671),(683,674),(673,675),(655,670),(647,660),(645,648),(643,648),(644,667),(642,668),(640,650),(639,641),(642,631),(647,624),(651,608),(651,586),(654,563),(658,547),(665,528),(669,518),(665,496)]],
'leg_left': [[(679,456),(699,455),(710,470),(710,490),(706,511),(708,524),(705,542),(705,567),(706,590),(708,613),(709,631),(713,647),(720,662),(731,674),(735,681),(733,684),(719,685),(709,680),(703,673),(698,663),(697,675),(696,680),(693,680),(693,662),(689,655),(689,645),(693,636),(695,627),(691,610),(684,590),(680,568),(680,546),(684,529),(683,517),(672,494),(667,477)]],
'body_base': [[(671,253),(689,255),(691,273),(704,280),(711,288),(716,306),(710,323),(694,335),(675,332),(663,318),(647,307),(646,287),(658,281),(669,274)]],
'arm_left_upper': [[(704,283),(711,287),(719,302),(725,324),(731,347),(735,369),(733,385),(724,386),(716,368),(712,345),(707,319)]],
'arm_left_lower': [[(726,365),(735,368),(744,392),(750,412),(758,433),(769,444),(773,454),(773,461),(770,462),(765,452),(767,463),(764,465),(758,455),(754,455),(747,442),(742,425),(735,413),(729,393)]],
'dress_base': [[(663,291),(677,302),(697,308),(709,302),(718,318),(721,339),(716,360),(716,380),(724,406),(730,433),(722,466),(709,482),(699,473),(692,467),(685,475),(676,464),(667,468),(662,460),(654,466),(650,457),(652,437),(658,407),(659,378),(662,349),(656,327)]],
'dress_side_petals': [[(644,312),(650,318),(646,340),(638,366),(628,385),(619,405),(615,425),(603,449),(591,469),(587,478),(592,479),(612,469),(631,454),(643,439),(655,416),(660,387),(658,359)],[(708,349),(722,353),(735,376),(744,400),(751,425),(755,451),(760,471),(770,493),(771,504),(766,513),(755,520),(746,510),(739,491),(732,468),(720,444),(709,418),(704,385)],[(651,420),(645,446),(637,468),(627,489),(619,511),(613,531),(609,555),(609,581),(617,599),(623,593),(627,575),(630,552),(640,532),(654,517),(661,499),(664,476)],[(710,446),(719,467),(730,489),(735,518),(740,544),(747,566),(754,587),(760,616),(760,633),(756,627),(745,607),(733,588),(725,570),(716,549),(709,524),(704,491)]],
'dress_front_petals': [[(664,315),(678,320),(697,324),(710,316),(719,325),(719,342),(713,356),(720,370),(724,387),(734,410),(744,433),(748,451),(748,467),(738,463),(726,453),(713,436),(702,415),(696,389),(692,377),(682,396),(670,411),(660,419),(658,405),(647,424),(635,439),(623,450),(621,439),(629,418),(643,397),(659,377),(660,357)]],
'arm_right_upper': [[(651,281),(661,284),(665,294),(662,310),(654,327),(653,345),(648,366),(645,378),(635,378),(635,365),(639,345),(642,325),(640,313),(641,297),(645,287)]],
'arm_right_lower': [[(638,359),(649,361),(648,376),(642,397),(637,414),(633,431),(631,443),(628,449),(630,443),(626,446),(622,451),(624,459),(622,465),(619,462),(616,454),(615,444),(617,435),(623,425),(627,407),(631,389),(634,374)]],
'hair_back': [[(639,220),(650,223),(664,234),(673,249),(677,263),(672,277),(663,283),(651,279),(640,272),(632,265),(628,256),(627,244)],[(706,210),(716,211),(721,224),(723,237),(721,251),(717,265),(714,283),(708,276),(709,265),(714,251),(713,238)]],
'head_face': [[(673,209),(691,205),(706,211),(713,221),(713,234),(719,239),(713,244),(713,252),(707,259),(701,262),(691,260),(680,256),(671,249),(659,245),(656,237),(660,230)]],
'braided_updo': [[(632,236),(642,233),(655,238),(664,247),(665,257),(660,266),(652,272),(643,270),(636,265),(630,257),(628,247)]],
'hair_front': [[(632,215),(633,200),(638,189),(647,181),(660,174),(674,168),(685,166),(695,170),(705,174),(714,184),(721,195),(723,208),(727,219),(727,234),(723,247),(719,257),(716,249),(719,237),(718,223),(711,209),(707,216),(699,221),(690,225),(681,230),(674,236),(667,240),(661,243),(652,238),(643,234),(633,230)],[(667,238),(674,239),(677,248),(677,260),(673,272),(669,276),(673,259),(670,248)],[(715,244),(719,245),(719,257),(715,272),(715,282),(712,286),(712,275),(714,258)]],
'flower_accessory': [[(627,201),(633,205),(638,211),(643,215),(645,208),(649,209),(651,219),(648,231),(643,240),(635,244),(625,247),(616,249),(615,245),(619,239),(613,237),(619,233),(619,226),(622,225),(621,216),(624,213)]],
}
ORDER=list(P)
assert len(P)==18

def mask(polys):
    scale=4;im=Image.new('L',(W*scale,H*scale));d=ImageDraw.Draw(im)
    for poly in polys:d.polygon([((x-X0)*scale,(y-Y0)*scale) for x,y in poly],fill=255)
    return np.asarray(im.resize((W,H),Image.Resampling.LANCZOS),dtype=np.float32)/255

masks={k:mask(v) for k,v in P.items()}
union=np.maximum.reduce(list(masks.values()))
owner=np.full((H,W),-1,dtype=np.int16)
for i,k in enumerate(ORDER):owner[masks[k]>.08]=i

# V002: continuous trimap-guided matting replaces the former color-key/closing
# discontinuities. Foreground estimation removes the paper contribution, rather
# than limiting it to +/-24 RGB and leaving pale fringes on dark backgrounds.
samples=[(605,190),(612,250),(744,195),(755,225),(605,300),(606,348),(762,345),(776,570),(631,593)]
xy=[];colors=[]
for x,y in samples:
    patch=rgb_full[y-2:y+3,x-2:x+3].astype(float)
    xy.append([1,(x-X0)/W,(y-Y0)/H]);colors.append(np.median(patch.reshape(-1,3),axis=0))
coeff=np.linalg.lstsq(np.array(xy),np.array(colors),rcond=None)[0]
yy,xx=np.mgrid[0:H,0:W];B=np.stack([np.ones_like(xx),xx/W,yy/H],axis=-1)@coeff
B=np.clip(B,210,255).astype(np.float32)
contrast=np.max(np.abs(rgb-B),axis=2)
original_owner=owner.copy()
# Two pixels of unknown boundary recover wisps outside a rough semantic polygon.
original_support=owner>=0
support=ndimage.binary_dilation(original_support,iterations=2)
_,nearest=ndimage.distance_transform_edt(~original_support,return_indices=True)
owner[support&~original_support]=original_owner[nearest[0][support&~original_support],nearest[1][support&~original_support]]
trimap=np.full((H,W),.5,dtype=np.float64)
trimap[~support]=0
solid_parts=['body_base','head_face','arm_left_upper','arm_left_lower','arm_right_upper','arm_right_lower','leg_left','leg_right','dress_base','dress_front_petals']
solid=np.zeros((H,W),bool)
for k in solid_parts:
    inside=ndimage.binary_erosion(masks[k]>.98,iterations=2)
    if k.startswith(('leg_','arm_')):
        deep=ndimage.binary_erosion(masks[k]>.98,iterations=3)
        rim=ndimage.binary_erosion(masks[k]>.98,iterations=1)
        inside=deep|(rim&(contrast>12))
    solid|=inside&(owner==ORDER.index(k))
trimap[solid]=1
# Strong painted hair, ornament and skirt marks provide foreground constraints.
for k in ['hair_back','hair_front','braided_updo','flower_accessory','dress_back_petals','dress_side_petals']:
    inside=ndimage.binary_erosion(masks[k]>.98,iterations=2)
    trimap[inside&(owner==ORDER.index(k))&(contrast>32)]=1
# True empty paper within the broad silhouettes remains background. The eroded
# opaque anatomy constraint has priority so pale skin cannot be color-keyed away.
trimap[(contrast<5)&~solid]=0
image=rgb.astype(np.float64)/255
print('Estimating continuous alpha',flush=True)
alpha=estimate_alpha_cf(image,trimap,laplacian_kwargs={'epsilon':1e-7},cg_kwargs={'maxiter':2000})
alpha=np.clip(alpha,0,1)
# The sheet's very pale continuous membranes are not empty paper. Closed-form
# matting alone can remove them when no opaque paint exists inside a wing.
# Preserve a conservative continuous painted surface inside the authored outline.
for k in ['wing_left','wing_right']:
    selected=owner==ORDER.index(k)
    edge=np.clip(ndimage.distance_transform_edt(masks[k]>.3)/1.5,0,1)
    membrane=edge*np.clip(.50+(contrast-20)/160,.50,.85)
    alpha[selected]=np.maximum(alpha[selected],membrane[selected])
for k in ['dress_back_petals','dress_side_petals']:
    selected=owner==ORDER.index(k)
    core=ndimage.binary_erosion(masks[k]>.98,iterations=2)
    soft_core=ndimage.gaussian_filter(core.astype(float),1.0)
    fabric=soft_core*.76
    alpha[selected]=np.maximum(alpha[selected],fabric[selected])
alpha[~support]=0
alpha[alpha<.025]=0
alpha[alpha>.985]=1
alpha=np.rint(alpha*255)/255
print('Estimating decontaminated foreground',flush=True)
foreground,estimated_background=estimate_foreground_ml(image,alpha,return_background=True)
color=np.clip(np.rint(foreground*255),0,255).astype(np.uint8)
color[alpha>.999]=rgb.astype(np.uint8)[alpha>.999]
color[alpha==0]=0
# Save matting diagnostics apart from runtime layer files.
Image.fromarray(np.rint(trimap*255).astype(np.uint8)).save(REVIEW/'front_3q_trimap_v002.png')
Image.fromarray(np.rint(alpha*255).astype(np.uint8)).save(REVIEW/'front_3q_alpha_v002.png')
matting_reconstruction=foreground*alpha[...,None]+estimated_background*(1-alpha[...,None])
matting_error=np.abs(matting_reconstruction-image)*255
matting_metrics={'method':'closed-form trimap alpha and multi-level foreground estimation',
                 'matting_reconstruction_mean_abs_rgb':float(matting_error[support].mean()),
                 'opaque_visible_pixels':int((alpha>.999).sum()),
                 'partial_alpha_pixels':int(((alpha>0)&(alpha<1)).sum())}

def dilate(m,r=3):return np.asarray(Image.fromarray((m*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(r*2+1)))>0
def propagated_hidden(owned,allowed,steps=4):
    # Extend neighboring SOURCE pixels; no new painted design/anatomy is invented.
    filled=owned.copy();values=rgb.copy();added=np.zeros_like(owned)
    for _ in range(steps):
        total=np.zeros_like(rgb);count=np.zeros((H,W),np.float32)
        for dy,dx in [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)]:
            f=np.roll(filled,(dy,dx),(0,1));v=np.roll(values,(dy,dx),(0,1))
            total+=v*f[...,None];count+=f
        new=(~filled)&allowed&(count>0)
        values[new]=total[new]/count[new,None];filled[new]=True;added|=new
    return values.astype(np.uint8),added

metadata=[];assembled=Image.new('RGBA',CANVAS)
hidden_total=0
for i,k in enumerate(ORDER):
    owned=owner==i
    a=np.where(owned,np.rint(alpha*255),0).astype(np.uint8)
    layer=np.zeros((H,W,4),np.uint8);layer[:,:,:3]=color;layer[:,:,3]=a
    # Add up to four native-pixel seam support ONLY under a later, fully opaque part.
    support=8 if k in ['body_base','head_face','hair_back','arm_left_upper','arm_right_upper'] else 4
    allowed=(owner>i)&(alpha>.999)&dilate(owned,support)&(masks[k]>.1)
    patch,hidden=propagated_hidden(owned&(alpha>.999),allowed,support)
    layer[hidden,:3]=patch[hidden];layer[hidden,3]=255
    layer[layer[:,:,3]==0,:3]=0
    full=Image.new('RGBA',CANVAS);full.paste(Image.fromarray(layer),(X0+DX,Y0+DY))
    full.save(OUT/(k+'.png'))
    assembled=Image.alpha_composite(assembled,full)
    hidden_total+=int(hidden.sum())
    metadata.append({'file':k+'.png','z_index':i,'canvas':[1024,1024],'offset':[0,0],'source_translation':[DX,DY],
                     'visible_source_pixels':int((a>0).sum()),'hidden_seam_pixels':int(hidden.sum()),
                     'alpha_bounds':full.getchannel('A').getbbox(),'hidden_method':f'adjacent original paint extension, <={support} native pixels, behind opaque higher layers only'})
assembled.save(REVIEW/'front_3q_recomposed.png')

# Build the registration reference using precisely the same source-derived alpha.
target=Image.new('RGBA',CANVAS)
target.paste(Image.fromarray(np.dstack([color,np.rint(alpha*255).astype(np.uint8)])),(X0+DX,Y0+DY))
t=np.asarray(target).astype(int);c=np.asarray(assembled).astype(int)
assert np.array_equal(t,c),'Layer reconstruction must equal registered source-derived cutout exactly'

# Layer contact sheet: previews only are resampled, delivered PNGs stay native/aligned.
try:font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',13)
except OSError:font=ImageFont.load_default()
sheet=Image.new('RGB',(3*280,6*290),(230,230,232));d=ImageDraw.Draw(sheet)
for n,k in enumerate(ORDER):
    x=(n%3)*280;y=(n//3)*290
    tile=Image.new('RGBA',(256,256),(245,243,239,255))
    # Common inspection viewport for every thumbnail, never per-part auto-cropping.
    thumb=Image.open(OUT/(k+'.png')).crop((400,350,640,920)).resize((108,256),Image.Resampling.LANCZOS)
    tile.alpha_composite(thumb,(74,0))
    sheet.paste(tile.convert('RGB'),(x+12,y+4));d.text((x+12,y+264),k,font=font,fill='#423849')
sheet.save(REVIEW/'front_3q_layer_contact_sheet.png')

# Native-size source / reconstructed-on-paper / neutral-background review.
review=Image.new('RGB',(W*3+48,H+56),(236,233,229));d=ImageDraw.Draw(review)
comp=np.rint(color*(alpha[...,None]) + B*(1-alpha[...,None])).clip(0,255).astype(np.uint8)
neutral=Image.new('RGBA',(W,H),(225,229,225,255));neutral=Image.alpha_composite(neutral,Image.fromarray(np.dstack([color,np.rint(alpha*255).astype(np.uint8)])))
for j,(im,label) in enumerate([(Image.fromarray(rgb.astype(np.uint8)),'Approved source'),(Image.fromarray(comp),'Restored over estimated paper'),(neutral.convert('RGB'),'Transparent result on neutral')]):
    review.paste(im,(12+j*(W+12),30));d.text((12+j*(W+12),8),label,font=font,fill='#423849')
review.save(REVIEW/'front_3q_source_comparison.png')

board=Image.new('RGB',(756,610),(235,233,230));bd=ImageDraw.Draw(board)
focus=assembled.crop((400,350,640,920))
for j,(bg,label) in enumerate([((245,244,240,255),'Light'),((40,37,48,255),'Dark'),((101,130,110,255),'Garden-like green')]):
    tile=Image.new('RGBA',focus.size,bg);tile=Image.alpha_composite(tile,focus)
    board.paste(tile.convert('RGB'),(6+j*250,30));bd.text((6+j*250,8),label,font=font,fill='#423849')
board.save(REVIEW/'front_3q_alpha_background_checks.png')

opaque=(alpha>.999)&(owner>=0)
assert np.array_equal(color[opaque],rgb.astype(np.uint8)[opaque])
edges=assembled.getchannel('A');bounds=edges.getbbox()
assert bounds[0]>=64 and bounds[1]>=64 and CANVAS[0]-bounds[2]>=64 and CANVAS[1]-bounds[3]>=64
manifest={'status':'DRAFT_LAYER_RECONSTRUCTION_REQUIRES_VISUAL_REVIEW','source':'../../master/fairy_approved_structure.png',
          'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'view':'front_3q','canvas':[1024,1024],
          'root':[512,896],'root_normalized':[.5,.875],'original_source_root':list(SOURCE_ROOT),
          'source_translation':[DX,DY],'source_scale':1,'source_rotation_degrees':0,'layers_back_to_front':metadata,
          'visible_pixels_method':'Original source pixels with semantic trimap matting; opaque RGB exact, continuous foreground/alpha reconstruction at translucent boundaries',
          'revision':'v002_alpha_cleanup','matting_metrics':matting_metrics,
          'hidden_seam_pixels_total':hidden_total,'max_hidden_seam_extension_native_px':8,
          'opaque_color_validation':'Exact source RGB equality for alpha=255 visible pixels',
          'recomposition_validation':'Byte-exact RGBA equality to source-derived registration cutout',
          'limitations':['Flattened source cannot uniquely recover original wing/petal alpha; translucency is estimated',
                         'Seam support is conservative and only suitable for very small movement; no completed hidden anatomy for walk/run',
                         'Semantic cuts and anatomical side assignments require visual approval; no animation or app integration'],
          'animation_frames_created':0}
(OUT/'layers.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps({'layers':len(metadata),'canvas':CANVAS,'bounds':bounds,'hidden_seam_pixels':hidden_total,
                  'source_rgb_exact_opaque_pixels':int(opaque.sum()),'recomposition_equal':True},indent=2))
