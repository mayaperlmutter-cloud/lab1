(() => {
  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d');
  const wrap = document.getElementById('skyWrap');
  const nameInput = document.getElementById('nameInput');
  const STORAGE_KEY = 'quiet-sky-constellations-v1';
  let stars = [], links = [], selection = null, saved = loadSaved(), toastTimer;
  let audioContext = null, lastDustAt = 0;
  let seed = Math.floor(Math.random() * 1e9);
  const $ = id => document.getElementById(id);

  function random(){ seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  function makeStars(){
    seed = Math.floor(Math.random() * 1e9); const box = wrap.getBoundingClientRect(); stars = [];
    const count = Math.max(75, Math.floor(box.width * box.height / 3500));
    for(let i=0;i<count;i++) stars.push({x:.035+random()*.93,y:.035+random()*.93,r:.65+random()*1.35,alpha:.25+random()*.65,phase:random()*6.28,speed:.45+random()*1.25,bright:random()>.94});
    // A loose, inviting cluster gives the first click something to discover.
    const cx=.5,cy=.49;
    for(let i=0;i<9;i++){const a=i/9*Math.PI*2,rad=.12+random()*.14;stars.push({x:cx+Math.cos(a)*rad,y:cy+Math.sin(a)*rad*.7,r:1.2+random(),alpha:.75+random()*.25,phase:random()*6.28,speed:.7+random(),bright:true});}
    stars.sort((a,b)=>a.r-b.r); draw();
  }
  function resize(){const r=wrap.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
  function xy(s){
    // Star positions come only from their stored coordinates; animation never changes x or y.
    return{x:s.x*wrap.clientWidth,y:s.y*wrap.clientHeight};
  }
  function draw(){
    const w=wrap.clientWidth,h=wrap.clientHeight;if(!w||!h)return;ctx.clearRect(0,0,w,h);
    // Faint atmospheric nebula veil.
    const glow=ctx.createRadialGradient(w*.5,h*.48,0,w*.5,h*.48,w*.48);glow.addColorStop(0,'rgba(89,98,169,.07)');glow.addColorStop(1,'rgba(89,98,169,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    links.forEach((l,i)=>{const a=xy(stars[l[0]]),b=xy(stars[l[1]]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle='rgba(244,216,154,.65)';ctx.lineWidth=1;ctx.shadowColor='rgba(244,216,154,.55)';ctx.shadowBlur=8;ctx.stroke();ctx.shadowBlur=0;});
    const now=performance.now();
    stars.forEach((s,i)=>{const p=xy(s),twinkle=(Math.sin(now/650*s.speed+s.phase)+1)/2,alpha=s.alpha*(.3+.7*twinkle),r=s.r;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=`rgba(222,231,255,${alpha})`;ctx.shadowColor=s.bright?'#c9d8ff':'#9caee8';ctx.shadowBlur=(s.bright?14:6)*(.45+.55*twinkle);ctx.fill();ctx.shadowBlur=0;
      if(links.some(l=>l.includes(i))){ctx.beginPath();ctx.arc(p.x,p.y,r+3,0,Math.PI*2);ctx.strokeStyle='rgba(244,216,154,.32)';ctx.lineWidth=.7;ctx.stroke();}
      if(selection===i){ctx.beginPath();ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.strokeStyle='rgba(244,216,154,.85)';ctx.lineWidth=1;ctx.stroke();}
    });
    if(selection!==null){const p=xy(stars[selection]);ctx.beginPath();ctx.arc(p.x,p.y,15,0,Math.PI*2);ctx.strokeStyle='rgba(244,216,154,.12)';ctx.stroke();}
  }
  // The frame loop redraws fixed star coordinates; only alpha and glow vary for twinkling.
  function animate(){draw();requestAnimationFrame(animate);}
  const stardustLayer=$('stardustLayer');
  wrap.addEventListener('pointermove',e=>{
    if(e.pointerType==='touch')return;
    const now=performance.now();if(now-lastDustAt<18)return;lastDustAt=now;
    const rect=wrap.getBoundingClientRect(),colors=[['#f4d89a','rgba(244,216,154,.9)'],['#c9d8ff','rgba(201,216,255,.9)'],['#b7b8ff','rgba(183,184,255,.9)']];
    for(let n=0;n<3;n++){const [color,glow]=colors[Math.floor(Math.random()*colors.length)],p=document.createElement('i');p.className='stardust-particle';p.style.left=`${e.clientX-rect.left+(Math.random()-.5)*8}px`;p.style.top=`${e.clientY-rect.top+(Math.random()-.5)*8}px`;p.style.setProperty('--dust-color',color);p.style.setProperty('--dust-glow',glow);p.style.setProperty('--dust-life',`${650+Math.random()*450}ms`);stardustLayer.append(p);p.addEventListener('animationend',()=>p.remove(),{once:true});}
  });
  function playChime(){
    try{
      const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return;
      if(!audioContext)audioContext=new AudioCtx();
      // Resume directly inside the star-click gesture, then queue notes immediately.
      if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
      const now=audioContext.currentTime,master=audioContext.createGain();master.gain.value=.8;master.connect(audioContext.destination);
      // A clear, bell-like major chord with a gentle release.
      [659.25,830.61,987.77,1318.51].forEach((hz,i)=>{const start=now+i*.055,osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.setValueAtTime(hz,start);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(i===3?.22:.3,start+.025);gain.gain.exponentialRampToValueAtTime(.0001,start+1.8);osc.connect(gain);gain.connect(master);osc.start(start);osc.stop(start+1.85);});
    }catch(_){/* Audio is an enhancement; keep constellation drawing available if unavailable. */}
  }
  function pointer(e){const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;let best=-1,dist=Infinity;stars.forEach((s,i)=>{const p=xy(s),d=Math.hypot(x-p.x,y-p.y);if(d<dist){dist=d;best=i;}});return dist<Math.max(19,Math.min(30,wrap.clientWidth*.035))?best:-1;}
  canvas.addEventListener('pointerdown',()=>{try{const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return;if(!audioContext)audioContext=new AudioCtx();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});}catch(_){}});
  canvas.addEventListener('pointerdown',e=>{const i=pointer(e);if(i<0){selection=null;draw();return;}if(selection===null){selection=i;status('SELECT ANOTHER STAR');}else if(selection===i){selection=null;status('THE SKY IS YOURS');}else{const exists=links.some(l=>(l[0]===selection&&l[1]===i)||(l[0]===i&&l[1]===selection));if(!exists){links.push([selection,i]);updateCount();playChime();}selection=i;status('A NEW THREAD OF LIGHT');if(links.length) $('skyHint').classList.add('hidden');}draw();});
  function updateCount(){$('starCount').textContent=new Set(links.flat()).size;}
  function status(t){$('skyStatus').textContent=t;}
  $('undoBtn').onclick=()=>{if(links.length){links.pop();selection=null;updateCount();if(!links.length)$('skyHint').classList.remove('hidden');status('LAST LINE UNDONE');}else toast('Nothing to undo yet.');};
  $('clearBtn').onclick=()=>{links=[];selection=null;updateCount();$('skyHint').classList.remove('hidden');status('THE SKY IS YOURS');};
  $('sparkleBtn').onclick=()=>{links=[];selection=null;updateCount();$('skyHint').classList.remove('hidden');makeStars();status('A FRESH PATCH OF SKY');};
  const myths=[
    ['Long ago, a lantern keeper left this trail so lost travelers could find their way home.','THE LANTERN KEEPER'],
    ['A silver fox leapt from star to star, carrying the moon’s forgotten wish.','THE FOX AND THE MOON'],
    ['These lights mark the place where the first daydream escaped into the night.','THE FIRST DAYDREAM'],
    ['An ancient cartographer drew this map for a ship that sailed through clouds.','THE SKY CARTOGRAPHER'],
    ['Once, the sea climbed into the heavens to listen to the sleeping world.','THE TIDE ABOVE'],
    ['A tiny constellation stitched a hole in the sky before morning arrived.','THE NIGHT SEAMSTRESS'],
    ['Every hundred years, these stars gather to remember a song with no sound.','THE SILENT CHORUS'],
    ['A wanderer scattered breadcrumbs here, and the universe kept every one.','THE WAYFINDER'],
    ['The stars are the footprints of a giant who tiptoed across the dark.','THE GENTLE GIANT'],
    ['This is where a wish lands when it is too shy to reach the moon.','THE WISHING PLACE']
  ];
  function generateMyth(){const [story,credit]=myths[Math.floor(Math.random()*myths.length)];$('mythText').textContent=story;$('mythCredit').textContent=credit;}
  $('mythBtn').onclick=generateMyth;$('newMythBtn').onclick=generateMyth;
  $('saveBtn').onclick=saveCurrent;
  function saveCurrent(){if(!links.length){toast('Connect a few stars before saving.');return;}const name=nameInput.value.trim()||'Untitled constellation';const entry={id:Date.now(),name,story:$('mythText').textContent,credit:$('mythCredit').textContent,stars:stars.map(s=>({x:s.x,y:s.y,r:s.r,alpha:s.alpha,bright:s.bright})),links:links.map(l=>l.slice()),date:new Date().toLocaleDateString(undefined,{month:'short',day:'numeric'})};saved.unshift(entry);persist();renderSaved();toast(`“${name}” saved to your sky notes.`);}
  function loadSaved(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');}catch{return[];}}
  function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(saved));}catch{toast('Browser storage is full. Export your sky notes.');}}
  function renderSaved(){const list=$('savedList');$('savedCount').textContent=saved.length;if(!saved.length){list.innerHTML='<div class="empty-state"><span>☾</span><p>Your saved skies will<br>find a home here.</p></div>';return;}list.innerHTML='';saved.forEach(item=>{const row=document.createElement('div');row.className='saved-item';const thumb=document.createElement('div');thumb.className='saved-thumb';const c=document.createElement('canvas');thumb.append(c);const meta=document.createElement('div');meta.className='saved-meta';const title=document.createElement('strong');title.textContent=item.name;const sub=document.createElement('small');sub.textContent=`${item.links.length} lines · ${item.date||'saved'}`;meta.append(title,sub);const actions=document.createElement('div');actions.className='saved-actions';const view=document.createElement('button');view.textContent='↗';view.title='Open constellation';view.setAttribute('aria-label','Open '+item.name);view.onclick=()=>{stars=item.stars.map(s=>({...s,phase:Math.random()*6,speed:1}));links=item.links.map(l=>l.slice());selection=null;nameInput.value=item.name;$('mythText').textContent=item.story;$('mythCredit').textContent=item.credit;updateCount();$('skyHint').classList.toggle('hidden',links.length>0);resize();window.scrollTo({top:0,behavior:'smooth'});};const del=document.createElement('button');del.textContent='×';del.title='Delete constellation';del.setAttribute('aria-label','Delete '+item.name);del.onclick=()=>{saved=saved.filter(x=>x.id!==item.id);persist();renderSaved();};actions.append(view,del);row.append(thumb,meta,actions);list.append(row);drawThumb(c,item);});}
  function drawThumb(c,item){const d=devicePixelRatio||1;c.width=92*d;c.height=80*d;const x=c.getContext('2d');x.scale(d,d);x.fillStyle='#10162d';x.fillRect(0,0,92,80);item.links.forEach(l=>{const a=item.stars[l[0]],b=item.stars[l[1]];if(!a||!b)return;x.beginPath();x.moveTo(a.x*92,a.y*80);x.lineTo(b.x*92,b.y*80);x.strokeStyle='rgba(244,216,154,.75)';x.lineWidth=1;x.stroke();});item.stars.forEach(s=>{x.beginPath();x.arc(s.x*92,s.y*80,Math.max(.7,s.r),0,7);x.fillStyle=s.bright?'#f4e4b7':'#cbd4f2';x.fill();});}
  $('exportBtn').onclick=()=>{if(!saved.length){toast('Save a constellation first.');return;}const blob=new Blob([JSON.stringify(saved,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='quiet-sky-constellations.json';a.click();URL.revokeObjectURL(url);toast('Your sky notes are on their way.');};
  function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2400);}
  new ResizeObserver(resize).observe(wrap);makeStars();renderSaved();animate();
})();
