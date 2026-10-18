from pathlib import Path
import json,base64
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parent
m=json.loads((R/'frames.json').read_text())
im=[Image.open(R/f['file']).convert('RGBA') for f in m['frames']]
old=[Image.open(R/'original_anchors'/f'frame_{i+1:02}.png').convert('RGBA') for i in range(32)]
def flat(i,bg='#eeeae5'):return Image.alpha_composite(Image.new('RGBA',i.size,bg),i).convert('RGB')
def data(p):return 'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()

sheet=Image.new('RGB',(8*252,8*277),'#eeeae5');d=ImageDraw.Draw(sheet)
for i,a in enumerate(im):
    x=i%8*252;y=i//8*277;sheet.paste(flat(a).resize((252,252),Image.Resampling.LANCZOS),(x,y+24))
    d.text((x+7,y+6),f'{i+1:02} · '+('repair' if i%2==0 else 'new'),fill='#44344f')
sheet.save(R/'review/contact_sheet_64.png')
for bg,suffix in [('#eeeae5','light'),('#263340','dark')]:
    for half in range(2):
        s=Image.new('RGB',(4*378,8*166),bg);d=ImageDraw.Draw(s)
        for k in range(32):
            i=k+32*half;x=k%4*378;y=k//4*166
            s.paste(flat(im[i],bg).crop((110,288,282,350)).resize((344,124),Image.Resampling.NEAREST),(x+16,y+28))
            d.text((x+10,y+7),f'{i+1:02} · near {m["frames"][i]["near"]["contact"]} / far {m["frames"][i]["far"]["contact"]}',fill='#baa6d2' if suffix=='dark' else '#44344f')
        s.save(R/f'review/shoes_{suffix}_{half+1}.png')
    s=Image.new('RGB',(5*300,3*470),bg);d=ImageDraw.Draw(s)
    for row,ix in enumerate([[12,13,14,15,16],[44,45,46,47,48],[60,61,62,63,0]]):
        for c,i in enumerate(ix):
            x=c*300;y=row*470
            s.paste(flat(im[i],bg).resize((300,300),Image.Resampling.LANCZOS),(x,y+24))
            s.paste(flat(im[i],bg).crop((115,288,275,350)).resize((288,112),Image.Resampling.NEAREST),(x+6,y+340))
            d.text((x+10,y+6),f'Frame {i+1:02} / ref {m["frames"][i]["reference_label"]}',fill='#baa6d2' if suffix=='dark' else '#44344f')
    s.save(R/f'review/transitions_{suffix}.png')

pal_source=Image.new('RGB',(378*8,378*8))
for i,a in enumerate(im):pal_source.paste(flat(a),(i%8*378,i//8*378))
pal=pal_source.quantize(colors=256)
gif=[flat(a).quantize(palette=pal,dither=Image.Dither.NONE) for a in im]
gif[0].save(R/'review/walk_64f.gif',save_all=True,append_images=gif[1:],duration=m['gif_durations_ms'],loop=0,disposal=2,optimize=False)
comparison=[]
for i,a in enumerate(im):
    p=Image.new('RGB',(756,408),'#eeeae5');d=ImageDraw.Draw(p)
    p.paste(flat(old[i//2]),(0,30));p.paste(flat(a),(378,30))
    d.text((12,8),'Original 32 / 1.36 s',fill='#44344f');d.text((390,8),'64 candidate / 1.36 s',fill='#44344f')
    comparison.append(p.quantize(palette=pal,dither=Image.Dither.NONE))
comparison[0].save(R/'review/comparison.gif',save_all=True,append_images=comparison[1:],duration=m['gif_durations_ms'],loop=0,disposal=2,optimize=False)
payload={'frames':[data(R/f['file']) for f in m['frames']],
         'old':[data(R/'original_anchors'/f'frame_{i+1:02}.png') for i in range(32)],
         'motion':m['frames'],'dt':21.25,'duration':1360,'stride':72}
html=r'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PetalPal · 64-frame gait review · FAILED visual gate</title>
<style>*{box-sizing:border-box}body{background:#f6f1eb;color:#382d45;font:15px/1.55 system-ui,sans-serif;margin:0}main{max-width:1050px;margin:28px auto;padding:0 18px}h1{font-size:27px;margin-bottom:5px}.badge{background:#f1d6d3;color:#7b3434;padding:5px 12px;border-radius:16px;font-size:12px}.controls{display:flex;flex-wrap:wrap;align-items:center;gap:9px;margin:18px 0}button,select{padding:7px 11px;font:inherit;background:#fff;border:1px solid #b5a6c0;border-radius:7px;color:#483755;cursor:pointer}.primary{background:#69507d;color:white}input[type=range]{min-width:220px;flex:1}.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}.card{border:1px solid #d1c6db;border-radius:11px;overflow:hidden;background:white}.caption{display:flex;justify-content:space-between;padding:10px 13px}.stage{position:relative;height:378px;overflow:hidden;background:#eeeae5}.dark{background:#263340!important}.checker{background:conic-gradient(#ddd 25%,#f3f3f3 0 50%,#ddd 0 75%,#f3f3f3 0) 0 0/20px 20px}.sprite{position:absolute;top:0;left:50%;margin-left:-189px;width:378px;height:378px;max-width:none}.ground{position:absolute;top:343px;left:0;right:0;height:27px;border-top:1px solid #9aa493;background:repeating-linear-gradient(90deg,transparent 0 35px,#9aa493 35px 36px);opacity:.65}.close{height:145px;overflow:hidden;position:relative;background:#eeeae5}.close img{position:absolute;width:756px;height:756px;left:50%;margin-left:-378px;top:-570px}.info{padding:12px 15px;background:#f3e8ef;border-radius:8px}.note{font-size:13px;color:#756a7a}#contacts{font:13px ui-monospace,monospace;white-space:pre-wrap;margin:14px 0}a{color:#70508a}.travel{background:#eeeae5;overflow:hidden;position:relative;height:378px;border:1px solid #d1c6db;border-radius:10px}.travel img{position:absolute;width:378px;height:378px;top:0}.travel .ground{background:repeating-linear-gradient(90deg,transparent 0 35px,#9aa493 35px 36px)}footer{margin:25px 0}details{margin:16px 0}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style>
<main><span class="badge">FAILED VISUAL GATE · REVIEW ONLY</span><h1>Fairy walk · 64-frame mechanics review</h1>
<p>Both versions loop in <b>1.36 seconds</b>. The candidate has 64 distinct frames with rigid heel/toe mechanics. Original anchors are preserved separately; their faulty foot motion is repaired in the candidate through declared local masks.</p>
<div class="controls"><button id="play" class="primary">Play</button><button id="prev">Previous</button><button id="next">Next</button><label>Speed <select id="speed"><option value="0.25">¼×</option><option value="0.5">½×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label><label>Background <select id="bg"><option value="light">Light</option><option value="dark">Dark</option><option value="checker">Checker</option></select></label><button id="ground">Ground-contact test: on</button></div>
<div class="controls"><input id="seek" type="range" min="0" max="63" step="1" value="0" aria-label="Frame"><b id="label"></b></div>
<div class="pair"><section class="card"><div class="caption"><b>Original 32</b><span id="oldLabel"></span></div><div id="stageA" class="stage"><div id="gridA" class="ground"></div><img id="original" class="sprite" alt="Original Fairy"></div><div id="closeA" class="close"><img id="detailA" alt="Original shoes"></div></section><section class="card"><div class="caption"><b>64-frame candidate</b><span id="newLabel"></span></div><div id="stageB" class="stage"><div id="gridB" class="ground"></div><img id="candidate" class="sprite" alt="Candidate Fairy"></div><div id="closeB" class="close"><img id="detailB" alt="Candidate shoes"></div></section></div>
<p class="note">The contact test follows the character while the ground moves by 72 px per stride. A planted shoe should remain aligned with a ground mark. Turn it off to inspect the in-place PNGs. The fixed root registration alone is not a ground-lock test.</p>
<div id="contacts"></div><div class="controls">Jump to: <button id="contactA">Near contact · 1</button><button id="passingA">Far passing · 19</button><button id="contactB">Far contact · 33</button><button id="passingB">Near passing · 51</button><button id="critical4">Source 4→5 · 13</button><button id="critical12">Source 12→13 · 45</button><button id="seam">Loop seam · 61</button></div>
<p class="info">Not a production approval. Inspect the hem cutout joins, shoe visibility during passing, retained upper-body changes and final-to-first transition. Numerical contact locking does not certify the full painted animation as natural.</p>
<details><summary>World-space travel test</summary><div id="travel" class="travel"><div class="ground"></div><img id="traveler" alt="Fairy travelling through a fixed ground grid"></div><p class="note">Same frame timing and 72 px travel per cycle. The character resets after leaving the review viewport; that reset is not part of the sprite loop.</p></details>
<footer><a href="REPORT.md">Validation report</a> · <a href="review/contact_sheet_64.png">64-frame sheet</a> · <a href="review/transitions_light.png">Transitions</a> · <a href="review/walk_64f.gif">GIF</a> · <a href="frames.json">Metadata</a></footer>
<script>
const DATA=__DATA__,$=id=>document.getElementById(id);
let index=0,elapsed=0,playing=false,last=null,speed=1,showGround=true;
function render(){
 const src=DATA.frames[index],old=DATA.old[Math.floor(index/2)],f=DATA.motion[index];
 $('candidate').src=src;$('detailB').src=src;$('traveler').src=src;$('original').src=old;$('detailA').src=old;
 $('label').textContent=(index+1)+' / 64';$('oldLabel').textContent='Frame '+(Math.floor(index/2)+1)+' / 32';$('newLabel').textContent=f.kind==='new_inbetween'?'New in-between':'Local foot repair';$('seek').value=String(index);
 const root=Math.floor(elapsed/DATA.dt)*DATA.stride/64;
 for(const id of ['gridA','gridB']){$(id).style.backgroundPositionX=(-root)+'px';$(id).style.display=showGround?'block':'none';}
 $('traveler').style.left=((root+200)%1250-378)+'px';
 $('contacts').textContent='Near: '+f.near.contact+' · '+f.near.stage+'\nFar:  '+f.far.contact+' · '+f.far.stage+'\nRoot travel: '+root.toFixed(2)+' px · '+(DATA.stride/1.36).toFixed(2)+' px/s at 1×';
}
function stop(){playing=false;last=null;$('play').textContent='Play';}
function jump(i){stop();index=(i+64)%64;elapsed=index*DATA.dt;render();}
$('play').onclick=()=>{playing=!playing;last=null;$('play').textContent=playing?'Pause':'Play';};
$('prev').onclick=()=>jump(index-1);$('next').onclick=()=>jump(index+1);$('seek').oninput=()=>jump(Number($('seek').value));
$('speed').onchange=()=>{speed=Number($('speed').value);last=null;};
$('bg').onchange=()=>{for(const id of ['stageA','stageB'])$(id).className='stage '+$('bg').value;for(const id of ['closeA','closeB'])$(id).className='close '+$('bg').value;$('travel').className='travel '+$('bg').value;};
$('ground').onclick=()=>{showGround=!showGround;$('ground').textContent='Ground-contact test: '+(showGround?'on':'off');render();};
for(const [id,i] of Object.entries({contactA:0,passingA:18,contactB:32,passingB:50,critical4:12,critical12:44,seam:60}))$(id).onclick=()=>jump(i);
function tick(now){if(playing&&!document.hidden){if(last!==null){elapsed+=(now-last)*speed;index=Math.floor((elapsed+1e-7)/DATA.dt)%64;render();}last=now;}else last=null;requestAnimationFrame(tick);}
document.addEventListener('visibilitychange',()=>{last=null;});render();requestAnimationFrame(tick);
</script></main></html>'''
(R/'index.html').write_text(html.replace('__DATA__',json.dumps(payload,separators=(',',':'))),encoding='utf-8')
print('Exported all review media and self-contained 32/64 comparison player.')
