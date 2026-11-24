/* 動畫簡報（lessons/smoke-devil.html、tobacco-types.html）共用的播放程式：幕與字幕同步播放、上一幕／下一幕、全螢幕、方向鍵，以及「資料來源」視窗。
   每一幕的秒數由頁面在載入這個檔之前設定 window.DECK_DURS＝[秒數…]（順序同 .scene）。2026-11-24 從兩個頁面裡抽出來。 */

(function(){
  const scenes=[...document.querySelectorAll('.scene')];
  const caps=[...document.querySelectorAll('.cap')];
  const durs=window.DECK_DURS||[];  /* 每一幕的秒數，寫在各頁面 */
  const stage=document.getElementById('stage');
  const player=document.getElementById('player');
  const playBtn=document.getElementById('play');
  const fsBtn=document.getElementById('fs');
  const dotsEl=document.getElementById('dots');
  const countEl=document.getElementById('count');
  const sceneNo=document.getElementById('sceneNo');
  const caption=document.getElementById('caption');
  let i=0, elapsed=0, playing=false, started=false, last=performance.now();

  document.querySelectorAll('[data-smoke]').forEach(g=>{
    const [x,y,n,spread,drift,rise,r,dur,col]=g.dataset.smoke.split(' ');
    const N=+n;
    for(let k=0;k<N;k++){
      const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
      c.setAttribute('cx',x);c.setAttribute('cy',y);
      c.setAttribute('r',(+r*(0.6+Math.random()*0.7)).toFixed(1));
      c.setAttribute('fill',col);c.setAttribute('class','puff');
      const D=+dur*(0.8+Math.random()*0.4);
      c.style.setProperty('--d',D.toFixed(2)+'s');
      c.style.setProperty('--dl',(-(k/N)*D).toFixed(2)+'s');
      c.style.setProperty('--dx',(+drift+(Math.random()-.5)*+spread*2).toFixed(0)+'px');
      c.style.setProperty('--dy',(-(+rise)*(0.7+Math.random()*0.5)).toFixed(0)+'px');
      c.style.setProperty('--o',(0.4+Math.random()*0.3).toFixed(2));
      g.appendChild(c);
    }
  });
  const td=document.getElementById('tarDots');
  if(td) td.dataset.dots.split(',').forEach((p,k)=>{
    const [x,y]=p.trim().split(' ');
    const g=document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('class','fall');
    g.style.setProperty('--t',(0.6+k*0.09).toFixed(2)+'s');
    g.style.setProperty('--fy',(-(+y)-20)+'px');
    g.style.setProperty('--fx',((Math.random()-.5)*60).toFixed(0)+'px');
    const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
    c.setAttribute('cx',x);c.setAttribute('cy',y);c.setAttribute('r',(5+Math.random()*2).toFixed(1));
    c.setAttribute('fill','#e5c247');c.setAttribute('class','twinkle');
    c.style.setProperty('--tw',Math.random().toFixed(2)+'s');
    g.appendChild(c);td.appendChild(g);
  });

  const dots=durs.map((_,k)=>{
    const b=document.createElement('button');b.type='button';
    b.setAttribute('aria-label','第 '+(k+1)+' 幕');
    b.appendChild(document.createElement('i'));
    b.addEventListener('click',()=>go(k));
    dotsEl.appendChild(b);return b;
  });

  function show(k){
    scenes.forEach((s,j)=>{ if(j!==k) s.classList.remove('on'); });
    caps.forEach(c=>c.classList.remove('on'));
    void stage.offsetWidth;
    scenes[k].classList.add('on'); caps[k].classList.add('on');
    dots.forEach((d,j)=>{d.classList.toggle('done',j<k);d.classList.toggle('cur',j===k);d.firstChild.style.width=j<k?'100%':'0';});
    countEl.textContent=(k+1)+' / '+scenes.length;
    sceneNo.textContent='第 '+(k+1)+' 幕／共 '+scenes.length+' 幕';
    caption.scrollTop=0;
  }
  function go(k){ i=Math.max(0,Math.min(scenes.length-1,k)); elapsed=0; show(i); }
  function ended(){ return i===scenes.length-1 && elapsed>=durs[i]; }
  function setPlaying(p){
    playing=p; last=performance.now();
    playBtn.textContent=p?'❚❚ 暫停':(ended()?'↻ 重播':'▶ 播放');
    player.classList.toggle('frozen',!p && started && !ended());
  }
  function toggle(){
    if(!playing && ended()) go(0);
    started=true; setPlaying(!playing);
  }
  function tick(now){
    const dt=Math.min(.25,(now-last)/1000); last=now;
    if(playing){
      elapsed+=dt;
      dots[i].firstChild.style.width=Math.min(100,elapsed/durs[i]*100)+'%';
      if(elapsed>=durs[i]){
        if(i<scenes.length-1) go(i+1);
        else { elapsed=durs[i]; setPlaying(false); }
      }
    }
    requestAnimationFrame(tick);
  }
  playBtn.addEventListener('click',toggle);
  document.getElementById('prev').addEventListener('click',()=>go(i-1));
  document.getElementById('next').addEventListener('click',()=>go(i+1));

  // touch board: tap the picture to play/pause, swipe left/right to change scene
  let sx=null, sy=0;
  stage.addEventListener('pointerdown',e=>{sx=e.clientX;sy=e.clientY;});
  stage.addEventListener('pointerup',e=>{
    if(sx===null) return;
    const dx=e.clientX-sx, dy=e.clientY-sy; sx=null;
    if(Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)) go(dx<0?i+1:i-1);
    else if(Math.abs(dx)<12 && Math.abs(dy)<12) toggle();
  });
  stage.addEventListener('pointercancel',()=>{sx=null;});

  function fsLabel(){ fsBtn.textContent=document.fullscreenElement?'離開全螢幕':'全螢幕'; }
  fsBtn.addEventListener('click',()=>{
    try{
      if(document.fullscreenElement) document.exitFullscreen().catch(()=>{});
      else if(player.requestFullscreen) player.requestFullscreen().catch(()=>{});
    }catch(e){}
  });
  document.addEventListener('fullscreenchange',fsLabel);

  document.addEventListener('keydown',e=>{
    if(e.target.tagName==='BUTTON' && (e.key===' '||e.key==='Enter')) return;
    if(e.key===' '){e.preventDefault();toggle();}
    else if(e.key==='ArrowRight') go(i+1);
    else if(e.key==='ArrowLeft') go(i-1);
  });
  go(0); requestAnimationFrame(t=>{last=t;tick(t);});
})();


(function(){var b=document.getElementById('srcBtn'),d=document.getElementById('srcDlg');
function open(){d.hidden=false;d.querySelector('.close').focus()}function close(){d.hidden=true;b.focus()}
b.addEventListener('click',open);d.querySelector('.close').addEventListener('click',close);
d.addEventListener('click',function(e){if(e.target===d)close()});
d.addEventListener('keydown',function(e){e.stopPropagation();if(e.key==='Escape')close()});})();
