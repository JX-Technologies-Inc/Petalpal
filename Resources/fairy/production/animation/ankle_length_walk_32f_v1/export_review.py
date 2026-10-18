"""Export timing-matched, self-contained review media from the fixed PNGs."""
from pathlib import Path
import json, base64
from PIL import Image,ImageDraw

OUT=Path(__file__).resolve().parent
META=json.loads((OUT/'frames.json').read_text())
def rgb(im,bg='#eeeae5'):
    return Image.alpha_composite(Image.new('RGBA',im.size,bg),im.convert('RGBA')).convert('RGB')
def data(p):return 'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()
images=[Image.open(OUT/f['file']).convert('RGBA') for f in META['frames']]
for background,suffix in [('#eeeae5','light'),('#263340','dark')]:
    sheet=Image.new('RGB',(4*378,8*168),background);d=ImageDraw.Draw(sheet)
    for i,im in enumerate(images):
        x=i%4*378;y=i//4*168
        sheet.paste(rgb(im,background).crop((105,284,283,347)).resize((356,126),Image.Resampling.NEAREST),(x+10,y+27))
        d.text((x+10,y+6),META['frames'][i]['label'],fill='#bca9d6' if suffix=='dark' else '#32283e')
    sheet.save(OUT/f'review/shoe_detail_{suffix}.png')

# A shared palette avoids palette pumping between frames. GIF is deliberately
# a neutral-background review, since GIF cannot encode the PNGs' soft alpha.
mosaic=Image.new('RGB',(378*4,378*8))
for i,im in enumerate(images):mosaic.paste(rgb(im),(i%4*378,i//4*378))
palette=mosaic.quantize(colors=256)
gif=[rgb(im).quantize(palette=palette,dither=Image.Dither.NONE) for im in images]
gif[0].save(OUT/'review/walk_32f.gif',save_all=True,append_images=gif[1:],duration=META['gif_durations_ms'],loop=0,disposal=2,optimize=False)
pair=[]
for i,im in enumerate(images):
    panel=Image.new('RGB',(756,408),'#eeeae5');d=ImageDraw.Draw(panel)
    panel.paste(rgb(images[(i//2)*2]),(0,30));panel.paste(rgb(im),(378,30))
    d.text((12,8),'16 anchors / 1.36 s',fill='#32283e');d.text((390,8),'32 candidate / 1.36 s',fill='#32283e')
    pair.append(panel)
pal=pair[0].quantize(colors=256)
pair=[im.quantize(palette=pal,dither=Image.Dither.NONE) for im in pair]
pair[0].save(OUT/'review/comparison.gif',save_all=True,append_images=pair[1:],duration=META['gif_durations_ms'],loop=0,disposal=2,optimize=False)

payload={'duration':1360,'dt':42.5,'frames':[data(OUT/f['file']) for f in META['frames']],
         'labels':[f['label'] for f in META['frames']]}
html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PetalPal · Ankle-length walk 32-frame candidate</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f6f2ed;color:#312d3d;font:15px/1.55 system-ui,sans-serif}main{max-width:1040px;margin:32px auto;padding:0 22px}h1{font-size:27px;margin-bottom:6px}p{max-width:880px}small,.muted{color:#726a7b}.badge{display:inline-block;background:#eadff1;border-radius:20px;padding:4px 12px;font-size:12px}.controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:18px 0}button,select{font:inherit;border:1px solid #b5a7c3;border-radius:7px;background:#fff;padding:7px 12px;color:#40334f;cursor:pointer}button.primary{background:#645078;color:white}input[type=range]{flex:1;min-width:190px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}.card{border:1px solid #d2c7da;border-radius:12px;overflow:hidden;background:white}.caption{padding:10px 16px;display:flex;justify-content:space-between}.stage{position:relative;height:378px;background:#eeeae5;overflow:hidden}.stage.dark{background:#263340}.stage.checker{background:conic-gradient(#dde0e3 25%,#f1f2f3 0 50%,#dde0e3 0 75%,#f1f2f3 0) 0 0/20px 20px}.sprite{position:absolute;width:378px;height:378px;left:50%;top:0;transform:translateX(-50%);max-width:none}.baseline{position:absolute;top:342px;left:0;right:0;border-top:1px dashed #849888;display:none}.guide .baseline{display:block}.detail{height:158px;position:relative;overflow:hidden;background:#eeeae5}.detail.dark{background:#263340}.detail.checker{background:#ddd}.detail img{position:absolute;width:756px;height:756px;max-width:none;left:calc(50% - 378px);top:-568px}.note{background:#eee6f2;padding:12px 16px;border-radius:8px}details{margin:18px 0}a{color:#664880}footer{margin:28px 0;font-size:13px}.runtime{display:flex;align-items:flex-end;justify-content:center;gap:30px;height:150px}.runtime img{display:block;object-fit:contain}@media(max-width:650px){.pair{grid-template-columns:1fr}main{padding:0 12px}.stage{height:378px}}
</style><main>
<span class="badge">MANUAL VISUAL REVIEW · NO APP INTEGRATION</span>
<h1>Ankle-length Fairy walk</h1>
<p>16 fixed anchors compared with a 32-frame cutout in-between candidate. Both use the same <b>1.36-second loop</b>, canvas and registration. No crossfades, frame blending or ping-pong playback.</p>
<div class="controls"><button id="play" class="primary">Play</button><button id="prev">Previous</button><button id="next">Next</button><label>Speed <select id="speed"><option value="0.25">¼×</option><option value="0.5">½×</option><option value="1" selected>1× · original duration</option><option value="2">2×</option></select></label><label>Background <select id="bg"><option value="light">Light</option><option value="dark">Dark</option><option value="checker">Checker</option></select></label><button id="guide">Baseline guide</button></div>
<div class="controls"><input id="seek" type="range" min="0" max="31" step="1" value="0" aria-label="Candidate frame"><b id="position"></b></div>
<div class="pair"><section class="card"><div class="caption"><b>Approved 16-frame anchors</b><span id="originalLabel"></span></div><div id="stageA" class="stage"><img id="original" class="sprite" alt="Original anchor frame"><div class="baseline"></div></div><div id="detailA" class="detail"><img id="originalDetail" alt="Original hem and shoes"></div></section>
<section class="card"><div class="caption"><b>32-frame candidate</b><span id="candidateLabel"></span></div><div id="stageB" class="stage"><img id="candidate" class="sprite" alt="Candidate frame"><div class="baseline"></div></div><div id="detailB" class="detail"><img id="candidateDetail" alt="Candidate hem and shoes"></div></section></div>
<div class="controls">Inspect: <button id="critical4">4 → 4.5 → 5</button><button id="critical12">12 → 12.5 → 13</button><button id="critical16">16 → 16.5 → 1</button><button id="fullLoop">Full loop</button><span id="mode">Full loop</span></div>
<p class="note">Check the shoe travel, lower-petal overlap, wrist movement and restart. The fixed anchors retain existing gait/contact limitations. Added samples do not certify natural support loading or zero sliding. Compare at 1× before judging improvement.</p>
<details><summary>Runtime-size checks · 96 / 108 / 120 px character height</summary><div class="runtime"><div><img id="r96" width="119" height="119" alt="96 px character"><small>96 px</small></div><div><img id="r108" width="134" height="134" alt="108 px character"><small>108 px</small></div><div><img id="r120" width="149" height="149" alt="120 px character"><small>120 px</small></div></div></details>
<details><summary>How the candidate was made</summary><p>Each new pose reuses one adjacent anchor's painting. Independently translated shoes follow midpoint landmarks at unit scale. Two lower-petal panels overlap as the stance narrows; a local arm mesh and at most 1 px of body rise bridge the endpoints. Faces and accessories are never regenerated. Shoes are not recolored, resized or sheared. Subpixel resampling can soften edges. There is no optical-flow calculation or averaging of two frames. Hidden gait mechanics cannot be reconstructed or certified from these sprites alone.</p></details>
<footer><a href="REPORT.md">Validation report</a> · <a href="review/contact_sheet.png">32-frame sheet</a> · <a href="review/critical_transitions.png">Critical transitions</a> · <a href="review/walk_32f.gif">GIF</a> · <a href="frames.json">Timing metadata</a><p>All player image data is embedded. The page works offline; document links refer to the supplied package.</p></footer>
<script>
const DATA=__DATA__;
const $=id=>document.getElementById(id);
let index=0,phase=0,playing=false,last=null,speed=1,range=null,guide=false;
function render(){
 const a=Math.floor(index/2)*2,src=DATA.frames[index],orig=DATA.frames[a];
 $('candidate').src=src;$('candidateDetail').src=src;
 $('original').src=orig;$('originalDetail').src=orig;
 for(const id of ['r96','r108','r120'])$(id).src=src;
 $('originalLabel').textContent='Frame '+DATA.labels[a]+' / 16';
 $('candidateLabel').textContent=DATA.labels[index]+(index%2?' · new':' · anchor');
 $('position').textContent=(index+1)+' / 32 · '+DATA.labels[index];$('seek').value=String(index);
}
function stop(){playing=false;$('play').textContent='Play';last=null;}
function setIndex(n){index=(n+32)%32;phase=index*DATA.dt;render();}
function step(n){stop();range=null;$('mode').textContent='Full loop';setIndex(index+n);}
$('prev').onclick=()=>step(-1);$('next').onclick=()=>step(1);
$('play').onclick=()=>{playing=!playing;last=null;$('play').textContent=playing?'Pause':'Play';};
$('speed').onchange=()=>{speed=Number($('speed').value);last=null;};
$('seek').oninput=()=>{stop();range=null;setIndex(Number($('seek').value));$('mode').textContent='Full loop';};
$('bg').onchange=()=>{for(const id of ['stageA','stageB'])$(id).className='stage '+$('bg').value+(guide?' guide':'');for(const id of ['detailA','detailB'])$(id).className='detail '+$('bg').value;};
$('guide').onclick=()=>{guide=!guide;$('bg').onchange();};
function critical(k){stop();range=[(k-1)*2,(k-1)*2+1,(k*2)%32];setIndex(range[0]);$('mode').textContent='Transition '+k+' → '+k+'.5 → '+(k===16?1:k+1)+' (local repeat)';}
$('critical4').onclick=()=>critical(4);$('critical12').onclick=()=>critical(12);$('critical16').onclick=()=>critical(16);
$('fullLoop').onclick=()=>{stop();range=null;$('mode').textContent='Full loop';setIndex(0);};
function tick(now){
 if(playing&&!document.hidden){
  if(last!==null){
   const elapsed=(now-last)*speed;
   if(range){const local=range.indexOf(index)*DATA.dt+(phase%DATA.dt);const t=(local+elapsed)%(range.length*DATA.dt);index=range[Math.floor(t/DATA.dt)];phase=index*DATA.dt+t%DATA.dt;}
   else{phase=(phase+elapsed)%DATA.duration;index=Math.floor((phase+1e-7)/DATA.dt)%32;}
   render();
  }
  last=now;
 }else last=null;
 requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange',()=>{last=null;});render();requestAnimationFrame(tick);
</script></main></html>'''
(OUT/'index.html').write_text(html.replace('__DATA__',json.dumps(payload,separators=(',',':'))),encoding='utf-8')
print('Exported GIFs, shoe detail sheets, and self-contained index.html.')
