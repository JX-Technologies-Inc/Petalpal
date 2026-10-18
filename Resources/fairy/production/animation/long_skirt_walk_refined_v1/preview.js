(() => {
  const phases=['Left Contact','Left Down','Left Support','Right Swing-in','Right Passing','Right Advance','Right Pre-contact','Right Late Swing','Right Contact','Right Down','Right Support','Left Swing-in','Left Passing','Left Advance','Left Pre-contact','Left Late Swing'];
  const el=id=>document.getElementById(id), still=el('still'), travel=el('travel');
  let playing=true, frame=0, accumulated=0, last=null, x=100, images=[];
  function draw(){
    const bg=el('bg').value; [still,travel].forEach(c=>{const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);});
    const image=images[frame]; if(!image)return;
    still.getContext('2d').drawImage(image,0,0,still.width,still.height);
    const c=travel.getContext('2d'); c.strokeStyle='#73796e';c.lineWidth=1;
    for(let i=0;i<travel.width;i+=50){c.beginPath();c.moveTo(i,245);c.lineTo(i,270);c.stroke();}
    c.beginPath();c.moveTo(0,260);c.lineTo(1100,260);c.stroke();
    // One fixed reference baseline for every frame; do not hide generated registration drift.
    c.drawImage(image,x-125,260-(344/378)*250,250,250);
    el('status').textContent=`${String(frame+1).padStart(2,'0')} / 16 — ${phases[frame]} — ${playing?'Playing':'Paused'}`;el('scrub').value=frame;
  }
  function pause(){playing=false;el('play').textContent='Play';accumulated=0;draw();}
  el('play').onclick=()=>{playing=!playing;el('play').textContent=playing?'Pause':'Play';accumulated=0;draw();};
  el('prev').onclick=()=>{frame=(frame+15)%16;pause();};el('next').onclick=()=>{frame=(frame+1)%16;pause();};
  el('scrub').oninput=()=>{frame=Number(el('scrub').value);pause();};
  el('fps').oninput=()=>{el('fpsValue').textContent=el('fps').value;accumulated=0;};
  el('speed').oninput=()=>el('speedValue').textContent=el('speed').value;el('bg').onchange=draw;
  document.addEventListener('visibilitychange',()=>{last=null;});
  function tick(now){const dt=last===null?0:Math.min(now-last,100);last=now;
    if(playing&&!document.hidden){accumulated+=dt;const period=1000/Number(el('fps').value);while(accumulated>=period){frame=(frame+1)%16;accumulated-=period;}x+=Number(el('speed').value)*dt/1000;if(x>1225)x=-125;draw();}requestAnimationFrame(tick);}
  Promise.all(Array.from({length:16},(_,i)=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=`frames/frame_${String(i+1).padStart(2,'0')}.png`;}))).then(all=>{images=all;draw();requestAnimationFrame(tick);}).catch(()=>{el('status').textContent='Frame load failed. Keep index.html, preview.js and frames/ together.';});
})();
