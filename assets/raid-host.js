/* 全班共戰大螢幕（lessons/u2-game-raid.html）的程式。2026-11-24 從頁面裡移出來，方便維護；說明寫在頁面最上面的註解。
   頁面先載入題庫（data/u2-game-questions.js 或 u3）、qrcode.js、avatar.js、boss3d.js、raid3d.js，最後才載入這個檔。 */
var PK=window.GAME_PACK||{};
var DM=PK.monsters||[];
var Q=window.GAME_QUESTIONS||[];
var SET={mode:'sync',rounds:12,secs:20,lv:2,mins:20,teams:2,counter:false,revenge:false,pv:-1,htts:1,ghost:false,sfx:true};
var TN=['全班','紅隊','藍隊','綠隊','橘隊'];
var SYNC_K=[0.8,1.0,1.25], FREE_K=[11,15,19]; /* 2026-11-18 依實際上課調整：20 人困難（舊 8）只花約 8 分鐘就打倒，平均每人每分鐘打約 20 點 */
try{var _s=JSON.parse(localStorage.getItem('raidSet')||'null');if(_s)SET=Object.assign(SET,_s)}catch(e){}
var G=null; /* {room, rounds, list:[問題], stats:[], seats:[], lastSeats, poll} */
function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function shuf(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a}
function show(id){['scrLogin','scrSetup','scrLobby','scrBattle','scrFree','scrEnd'].forEach(function(k){$(k).hidden=(k!==id)});window.scrollTo(0,0)}
function api(path,body,method){
  return window.CLS.api(path,{method:method||'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)})
    .then(function(r){if(!r.ok)return r.text().then(function(t){throw new Error(t||('HTTP '+r.status))});return r.text().then(function(t){return t?JSON.parse(t):null})});
}
function rpc(fn,args){return api('rest/v1/rpc/'+fn,args)}
var LABEL=['A','B','C','D','E'];

/* ---------- 音效（WebAudio 合成，不用音檔；右上角可關） ---------- */
var SFX=(function(){
  var ctx=null,on=SET.sfx!==false,lastHit=0;
  function ac(){if(!ctx){try{ctx=new(window.AudioContext||window.webkitAudioContext)()}catch(e){return null}}if(ctx.state==='suspended')ctx.resume();return ctx}
  function tone(f,t0,d,type,vol,f2){var c=on&&ac();if(!c)return;var t=c.currentTime+t0,o=c.createOscillator(),g=c.createGain();
    o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+d);
    g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol||0.2,t+0.02);g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+d+0.05)}
  function noise(t0,d,vol,freq){var c=on&&ac();if(!c)return;var t=c.currentTime+t0,n=Math.max(1,Math.floor(c.sampleRate*d)),b=c.createBuffer(1,n,c.sampleRate),a=b.getChannelData(0);
    for(var i=0;i<n;i++)a[i]=(Math.random()*2-1)*(1-i/n);var s=c.createBufferSource();s.buffer=b;var f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=freq||1200;
    var g=c.createGain();g.gain.value=vol||0.3;s.connect(f);f.connect(g);g.connect(c.destination);s.start(t)}
  function notes(list,type,vol,step){list.forEach(function(f,i){if(f)tone(f,i*(step||0.12),0.22,type||'triangle',vol||0.18)})}
  return {
    on:function(){return on},set:function(v){on=!!v;if(on)ac()},unlock:function(){if(on)ac()},
    tick:function(){tone(1000,0,0.07,'square',0.06)},
    show:function(){notes([523,659,784],'triangle',0.16,0.07)},
    right:function(){notes([659,880,1175],'triangle',0.16,0.09)},
    hit:function(){var n=Date.now();if(n-lastHit<300)return;lastHit=n;noise(0,0.12,0.18,900);tone(200,0,0.14,'square',0.07,110)},
    crit:function(){noise(0,0.3,0.35,600);notes([523,784,1047,1568],'sawtooth',0.12,0.06)},
    alarm:function(){for(var i=0;i<3;i++){tone(880,i*0.5,0.24,'sawtooth',0.12);tone(620,i*0.5+0.25,0.24,'sawtooth',0.12)}},
    block:function(){notes([784,1047,1568],'sine',0.2,0.08)},
    heal:function(){tone(300,0,0.6,'sine',0.18,900);tone(450,0.15,0.6,'sine',0.12,1200)},
    revenge:function(){notes([196,233,262,311,0,392],'sawtooth',0.12,0.16)},
    win:function(){notes([523,659,784,1047,0,784,1047],'triangle',0.2,0.13)},
    lose:function(){notes([392,349,311,262],'triangle',0.16,0.22)},
    drum:function(sec){for(var t=0;t<sec;t+=0.06)noise(t,0.05,0.12+0.15*t/sec,300)},
    cymbal:function(){noise(0,0.9,0.35,5000);tone(130,0,0.4,'sine',0.25,60)}
  };
})();
function paintSfx(){var b=$('bSfx');b.setAttribute('aria-pressed',String(SFX.on()));b.textContent=SFX.on()?'🔊 音效：開':'🔇 音效：關'}
$('bSfx').addEventListener('click',function(){SET.sfx=!SFX.on();SFX.set(SET.sfx);saveSet();paintSfx();if(SET.sfx)SFX.show()});
document.addEventListener('pointerdown',function(){SFX.unlock()},{once:true});
paintSfx();
/* 大螢幕唸題目（Web Speech API） */
var HTTS=(function(){var ok=('speechSynthesis' in window)&&('SpeechSynthesisUtterance' in window),voice=null;
  function pick(){try{var vs=speechSynthesis.getVoices();voice=vs.filter(function(v){return /zh[-_]TW/i.test(v.lang)})[0]||vs.filter(function(v){return /^(zh|cmn)/i.test(v.lang)})[0]||null}catch(e){}}
  if(ok){pick();try{speechSynthesis.addEventListener('voiceschanged',pick)}catch(e){}}
  return {say:function(t){if(!ok||!t)return;try{speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(String(t).replace(/[_＿]{2,}|（\s*）/g,'，什麼，'));u.lang=voice?voice.lang:'zh-TW';if(voice)u.voice=voice;u.rate=0.9;speechSynthesis.speak(u)}catch(e){}},
    stop:function(){if(ok)try{speechSynthesis.cancel()}catch(e){}}};
})();
/* 挑戰上一次的自己：上一場在這個時間點（秒）已經打掉的百分比 */
function ghostAt(sec){var c=G&&G.ghost&&G.ghost.curve;if(!c||!c.length)return null;
  if(sec<30)return c[0]*Math.max(0,sec)/30;var k=Math.floor(sec/30)-1,f=(sec%30)/30;
  if(k>=c.length-1)return c[c.length-1];return c[k]+(c[k+1]-c[k])*f}
function setGm(id,pct){var m=$(id);if(pct==null){m.hidden=true;return}m.hidden=false;m.style.left=Math.max(0,Math.min(100,100-pct))+'%';m.title='上一次這時候'}
function fmtSec(t){t=Math.round(t);return Math.floor(t/60)+' 分 '+(t%60)+' 秒'}
function ghostLine(g){
  if(!g)return '';if(g.none)return '👻 這是這個班第一次用這個模式玩這個單元，下次就能挑戰這一次的成績！';
  var d=new Date(g.at),dt=(d.getMonth()+1)+'/'+d.getDate();
  var r=g.mode==='sync'?(g.rounds+' 題打掉魔王 '+g.end_pct+'%'):(g.result==='win'&&g.win_sec?('用 '+fmtSec(g.win_sec)+' 打倒魔王'):(g.mins+' 分鐘打掉魔王 '+g.end_pct+'%'));
  return '👻 要挑戰的是 '+dt+' 那一場（'+g.players+' 人）：'+r+'，一次答對率 '+(g.acc==null?'—':g.acc+'%')+'。';
}
function confetti(){var box=document.createElement('div');box.className='confetti';var em=['🎉','⭐','✨','🎊','💫'];
  for(var i=0;i<46;i++){var e=document.createElement('i');e.textContent=em[i%em.length];e.style.left=(Math.random()*100)+'%';e.style.animationDuration=(2.6+Math.random()*2.4)+'s';e.style.animationDelay=(Math.random()*1.2)+'s';box.appendChild(e)}
  document.body.appendChild(box);setTimeout(function(){box.remove()},6500)}
function podium(list){ /* list：最多 3 個 {who,sub}，依名次 */
  if(!list.length)return '';var cls=['p1','p2','p3'],num=['1','2','3'],order=[1,0,2];
  var h='<div class="podium" aria-label="頒獎台">'+order.map(function(i){var x=list[i];if(!x)return '<div></div>';
    return '<div class="pd '+cls[i]+'"><div class="who">'+(i===0?'👑 ':'')+x.who+'</div><div class="sub">'+x.sub+'</div><div class="blk">'+num[i]+'</div></div>'}).join('')+'</div>';
  SFX.drum(3.1);setTimeout(function(){if(list[2])SFX.cymbal()},700);setTimeout(function(){if(list[1])SFX.cymbal()},1900);setTimeout(function(){SFX.cymbal();SFX.win();confetti()},3200);
  return h;
}
var DNAME={};DM.forEach(function(d){DNAME[d.k]=d.n});

/* 依單元換標題與說明（?u=3 是第三單元） */
(function(){
  if(PK.code!=='u3')return;
  var t='全班共戰：打倒'+PK.boss;document.title=t;document.querySelector('.top h1').textContent='⚔️ '+t;
  [].forEach.call(document.querySelectorAll('[data-pk=boss]'),function(el){el.textContent=PK.boss});
  $('setIntro').textContent='燙燙壺怪、火焰怪、濃煙怪合體成火災大魔王！全班用平板一起作答，把魔王的血打到 0 就獲勝。';
  var cnt={};Q.forEach(function(q){cnt[q.d]=(cnt[q.d]||0)+1});
  $('tUnit').innerHTML='第三單元〈熱與火的危機〉統整遊戲的全班合作版（課本 p.54–81）。題庫 '+Q.length+' 題：'+DM.map(function(d){return d.n+' '+(cnt[d.k]||0)}).join('、')+'（對應第 1～3 課），和「兩隊對戰：趕走火災三怪」共用。';
  $('tBank').innerHTML='題庫共 '+Q.length+' 題，選項順序每次隨機。想新增或修改題目，跟 Claude 說要改哪一題就好（題庫在 lessons/data/u3-game-questions.js，各自搶攻模式另外存在資料庫，Claude 會一起更新）。';
  $('tCount').textContent='題庫 '+Q.length+' 題';
})();
/* 合體大魔王：三隻怪物疊在一起，戴著王冠 */
(function(){
  var art=function(i){var d=DM[i];return d?d.art(d.c):''};
  $('bossArt').innerHTML=$('fBossArt').innerHTML='<g transform="translate(10 40) scale(1.25)">'+art(0)+'</g><g transform="translate(165 40) scale(1.25)">'+art(2)+'</g>'+
    '<g transform="translate(80 18) scale(1.45)">'+art(1)+'</g>'+
    '<path d="M110 22 h80 l-10 -22 l-15 12 l-15 -18 l-15 18 l-15 -12 z" fill="#FFD54F" stroke="#C79100" stroke-width="3"/>';
})();

/* 設定按鈕 */
function saveSet(){try{localStorage.setItem('raidSet',JSON.stringify(SET))}catch(x){}}
function paintEst(){var k=FREE_K[SET.lv-1],hp=25*SET.mins*k;
  if(SET.mode==='team'){var per=Math.ceil(25/SET.teams);
    $('freeEst').innerHTML='以全班 25 人分 '+SET.teams+' 隊估算：每隊約 '+per+' 人，每隊的魔王約 <b>'+(per*SET.mins*k).toLocaleString()+'</b> 點血。平均每人每分鐘要打 '+k+' 點（大約 '+Math.ceil(k/2)+' 題一次就答對）。實際血量依各隊加入的人數計算，人少的隊伍魔王血也少。';return}
  $('freeEst').innerHTML='以全班 25 人估算：魔王約 <b>'+hp.toLocaleString()+'</b> 點血。全班要在 '+SET.mins+' 分鐘內打完，平均每人每分鐘要打 '+k+' 點（大約 '+Math.ceil(k/2)+' 題一次就答對）。實際血量依加入的人數計算。'}
function paintOpts(){[].forEach.call(document.querySelectorAll('.opt[data-o]'),function(b){b.setAttribute('aria-pressed',String(!!SET[b.dataset.o]))})}
[].forEach.call(document.querySelectorAll('.opt[data-o]'),function(b){b.addEventListener('click',function(){SET[b.dataset.o]=!SET[b.dataset.o];saveSet();paintOpts()})});
$('storyLink').href='fc-game-story.html?g='+(PK.code==='u3'?'u3':'u2');
function paintSegs(){paintEst();[].forEach.call(document.querySelectorAll('.seg[data-k]'),function(seg){var k=seg.dataset.k;[].forEach.call(seg.children,function(b){b.setAttribute('aria-pressed',String(+b.dataset.v===SET[k]))})})}
/* 只處理設定用的 .seg[data-k]；班級列 #clsSeg 有自己的點擊處理 */
[].forEach.call(document.querySelectorAll('.seg[data-k]'),function(seg){
  seg.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;SET[seg.dataset.k]=+b.dataset.v;saveSet();paintSegs()});
});
function paintMode(){
  if(['free','team'].indexOf(SET.mode)<0)SET.mode='sync';paintEst();
  [].forEach.call(document.querySelectorAll('.mode[data-mode]'),function(b){b.setAttribute('aria-checked',String(b.dataset.mode===SET.mode))});
  [].forEach.call(document.querySelectorAll('.setgrid[data-for]'),function(g){g.hidden=g.dataset.for.split(' ').indexOf(SET.mode)<0});
}
[].forEach.call(document.querySelectorAll('.mode[data-mode]'),function(b){b.addEventListener('click',function(){SET.mode=b.dataset.mode;saveSet();paintMode()})});
if([1,2,3].indexOf(SET.lv)<0)SET.lv=2;
if([10,15,20].indexOf(SET.mins)<0)SET.mins=20;
if([2,3,4].indexOf(SET.teams)<0)SET.teams=2;
if([-1,0,3,5,8].indexOf(SET.pv)<0)SET.pv=-1;
if([0,1].indexOf(SET.htts)<0)SET.htts=1;
paintSegs();paintOpts();paintMode();

/* 等 sync.js 載入、確認老師帳號 */
var authTries=0;
function checkAuth(){
  if(G)return;
  if(window.CLS&&window.CLS.isTeacher){show('scrSetup');loadCls();return}
  if(window.CLS&&authTries>12){show('scrLogin');return}
  authTries++;setTimeout(checkAuth,400);
}
window.addEventListener('cls-status',function(){if(!G)checkAuth()});
checkAuth();

/* 班級：和書櫃 QR 視窗共用 clsClass */
var CLASS=(function(){try{return JSON.parse(localStorage.getItem('clsClass')||'""')}catch(e){return ''}})();
function loadCls(){
  window.CLS.api('rest/v1/class_list?select=name&order=sort.asc,name.asc').then(function(r){return r.json()}).then(function(list){
    list=list||[];if(CLASS&&!list.some(function(c){return c.name===CLASS}))CLASS='';
    var box=$('clsSeg');box.innerHTML='';
    [{name:''}].concat(list).forEach(function(c){var b=document.createElement('button');b.type='button';b.textContent=c.name||'不指定';b.setAttribute('aria-pressed',String(c.name===CLASS));
      b.addEventListener('click',function(){CLASS=c.name;try{localStorage.setItem('clsClass',JSON.stringify(CLASS))}catch(e){}[].forEach.call(box.children,function(x){x.setAttribute('aria-pressed',String(x===b))})});box.appendChild(b)});
  }).catch(function(){$('clsSeg').innerHTML='<span class="note">班級讀取失敗，會記成「不指定」。</span>'});
}

/* 選題：三隻惡魔平均出題 */
function pick(n){
  var keys=DM.map(function(d){return d.k}),by={},out=[],i=0;
  keys.forEach(function(k){by[k]=shuf(Q.filter(function(q){return q.d===k}))});
  function left(){return keys.some(function(k){return by[k].length})}
  while(out.length<n&&left()){var k=keys[i%keys.length];if(by[k].length)out.push(by[k].shift());i++}
  return out;
}

$('bCreate').addEventListener('click',function(){
  var b=this;b.disabled=true;$('setMsg').textContent='建立中…';
  var m=SET.mode,free=m==='free'||m==='team';
  var body={game:PK.code||'u2',rounds:free?40:SET.rounds,mode:m,class_name:CLASS||null,
    teams:m==='team'?SET.teams:0,opt_counter:free&&!!SET.counter,opt_revenge:free&&!!SET.revenge};
  api('rest/v1/raid_rooms',body).then(function(d){
    var room=d[0];
    G={room:room.id,mode:m,rounds:SET.rounds,secs:SET.secs,mins:SET.mins,lv:SET.lv,list:m==='sync'?pick(SET.rounds):[],stats:[],seats:[],tseats:[],cur:null,phase:'lobby',hp:0,max:0,lastId:0,
      teams:body.teams,optC:body.opt_counter,optR:body.opt_revenge,cFired:0,pv:SET.pv,htts:!!SET.htts,ghost:null,wantGhost:!!SET.ghost};
    $('lobbyNote').textContent=m==='team'?'依座號輪流分成 '+G.teams+' 隊（座號旁的顏色就是隊伍）。每隊魔王的血量依該隊加入的人數決定。開始後才加入的同學會自動分到自己的隊伍。'
      :'魔王血量會依加入人數決定。開始後還沒加入的同學也可以掃描加入，馬上開始作答。';
    $('lobbyNote').textContent+=CLASS?' 學生第一次加入時會先做自己的角色，戰鬥時用自己的角色攻擊魔王。':' （沒有選班級：學生的角色會存在「不指定班級」裡，和班級課堂做的角色不同。建議先選班級。）';
    reset3d();if(window.AVATAR){AVATAR.lib().catch(function(){});AV.t=0}
    $('fTeams').innerHTML='';$('fTeams').hidden=true;$('fBoss').hidden=false;$('fModeTag').textContent='⚡ 各自搶攻';$('fRev').hidden=true;hideCounter();$('gCard').hidden=true;$('gmF').hidden=true;$('gmB').hidden=true;
    var url=new URL('../raid.html?r='+room.id,location.href).href;
    $('roomCode').textContent=room.id;$('roomUrl').textContent=url;
    try{var q=qrcode(0,'M');q.addData(url);q.make();$('qr').innerHTML=$('fQr').innerHTML=q.createSvgTag({cellSize:8,margin:2,scalable:true})}catch(e){$('qr').textContent='QR Code 產生失敗，請學生輸入網址。'}
    $('fRoom').textContent=room.id;
    /* 課堂房間：學生平板自動進這個房間 */
    if(window.CLS_LIVE&&window.CLS_LIVE.push&&window.CLS_LIVE.id)window.CLS_LIVE.push('raid.html?r='+room.id,document.title);
    $('qrHint').textContent='還沒加入的同學：打開 raid.html，輸入房號 '+room.id;
    show('scrLobby');startPoll();SFX.show();
    if(G.wantGhost){var gr=G.room;rpc('raid_ghost',{p_room:gr}).then(function(g){if(!G||G.room!==gr||!g)return;G.ghost=g.none?null:g;
      $('lobbyNote').textContent+=' '+ghostLine(g)+(CLASS?'':'（沒有選班級，會和「不指定班級」的上一場比。）')}).catch(function(){})}
  }).catch(function(){b.disabled=false;$('setMsg').textContent='建立失敗，請確認網路與老師帳號後再試一次。'});
});
$('bCancel').addEventListener('click',function(){
  if(G)rpc('raid_finish',{p_room:G.room,p_result:'cancel'}).catch(function(){});
  stopPoll();reset3d();G=null;$('bCreate').disabled=false;$('setMsg').textContent='';show('scrSetup');
});

/* 輪詢 */
function startPoll(){stopPoll();G.poll=setInterval(tick,1000);tick()}
function stopPoll(){if(G&&G.poll){clearInterval(G.poll);G.poll=null}}
var busy=false;
function tick(){
  if(!G||busy)return;
  rpc('raid_host',{p_room:G.room}).then(function(h){
    if(!G||!h)return;
    G.seats=h.seats||[];G.tseats=h.tseats||[];loadAv();sync3d();
    if(G.phase==='lobby')drawLobby();
    else if(G.phase==='free')drawFree(h);
    else if(G.phase==='question'){
      drawLive(h.answered,h.left);
      var all=G.seats.length>0&&h.answered>=G.seats.length;
      var timeUp=G.secs>0&&h.left===0;
      if(all||timeUp)reveal();
    }
  }).catch(function(){});
}
function drawLobby(){
  var n=G.seats.length;
  $('joined').textContent=n?('已加入 '+n+' 位同學'):'等待同學加入…';
  var g=$('seatGrid'),had=G.lastSeats||[];
  var max=Math.max(30,G.seats.length?G.seats[G.seats.length-1]:0);
  var h='';for(var i=1;i<=max;i++){var on=G.seats.indexOf(i)>=0;h+='<span class="'+(on?'in':'')+(G.teams>1?' tc'+(((i-1)%G.teams)+1):'')+'"'+(on&&had.indexOf(i)>=0?' style="animation:none"':'')+'>'+i+'</span>'}
  g.innerHTML=h;G.lastSeats=G.seats.slice();
  var lt=$('lobbyTeams');lt.hidden=!(G.teams>1);
  if(G.teams>1){var cnt={};(G.tseats||[]).forEach(function(x){cnt[x.team]=(cnt[x.team]||0)+1});
    var t2='';for(var t=1;t<=G.teams;t++)t2+='<span class="tc'+t+'"><span class="tdot">'+t+'</span>'+TN[t]+' '+(cnt[t]||0)+' 人</span>';lt.innerHTML=t2}
  $('bStart').disabled=!n;
}

/* 開始／下一題 */
$('bStart').addEventListener('click',function(){if(G.mode==='free'||G.mode==='team')startFree();else nextQ()});
$('bNext').addEventListener('click',function(){
  if(G.hp<=0)return finish('win');
  if(G.stats.length>=G.rounds)return finish('lose');
  nextQ();
});
function nextQ(){
  var q=G.list[G.stats.length];if(!q){return finish(G.hp<=0?'win':'lose')}
  var payload,ans,opts;
  if(q.ox){payload={q:q.q,ox:1,d:q.d};ans=q.a?0:1;opts=['O','X'];} /* O 在第 0 格、X 在第 1 格 */
  else if(q.ord){ /* 排序題：ans＝依正確順序排的「畫面上的選項編號」 */
    var od=shuf(q.o.map(function(t,i){return i}));if(od.every(function(v,i){return v===i}))od.reverse();
    opts=od.map(function(i){return q.o[i]});ans=q.o.map(function(t,k){return od.indexOf(k)});payload={q:q.q,o:opts,ord:1,d:q.d};
  }
  else{
    var order=shuf(q.o.map(function(t,i){return i}));
    opts=order.map(function(i){return q.o[i]});ans=order.indexOf(q.a);payload={q:q.q,o:opts,d:q.d};
  }
  var pv=G.pv===-1?Math.max(3,Math.min(10,Math.ceil(q.q.length/4)+1+(q.ord?2:0))):(G.pv||0);
  if(pv>0)payload.pv=pv;
  G.cur={q:q,opts:opts,ans:ans,ox:!!q.ox,ord:!!q.ord,pv:pv,showAt:0};
  busy=true;$('bStart').disabled=true;$('bNext').disabled=true;
  rpc('raid_next',{p_room:G.room,p_question:payload,p_answer:{a:ans,e:q.e},p_seconds:G.secs>0?G.secs+pv:0,p_hp_per:Math.max(1,Math.round(G.rounds*SYNC_K[G.lv-1]))}).then(function(h){
    busy=false;$('bNext').disabled=false;
    if(!h)throw new Error('next failed');
    G.phase='question';G.hp=h.hp;G.max=h.max_hp;G.seats=h.seats||G.seats;
    drawQuestion();drawHp(false);drawLive(0,h.left);show('scrBattle');start3d();
  }).catch(function(){busy=false;$('bStart').disabled=false;$('bNext').disabled=false;alertMsg('出題失敗，請確認網路連線後再按一次。')});
}
function alertMsg(t){var r=$('resText');$('revealBox').hidden=false;r.className='res';r.textContent=t}
function drawQuestion(){
  var c=G.cur;
  $('qTag').textContent='第 '+(G.stats.length+1)+' / '+G.rounds+' 題・'+DNAME[c.q.d];
  $('qType').textContent=c.ox?'是非題：對的選 O，錯的選 X':c.ord?'排序題：在平板上依照正確的順序點選':'選擇題';
  $('qText').textContent=c.q.q;
  var o=$('opts');o.className='opts'+(c.ox?' ox':'')+(c.ord?' ordq':'');
  o.innerHTML=c.opts.map(function(t,i){return '<div class="o c'+i+'">'+(c.ox?'':'<b>'+LABEL[i]+'</b>')+'<span>'+esc(t)+'</span><span class="k"></span><span class="n"></span><span class="bar" style="width:0"></span></div>'}).join('');
  $('liveBox').hidden=false;$('revealBox').hidden=true;
  clearInterval(G.pvTimer);
  if(G.htts)HTTS.say(c.q.q);
  if(c.pv>0){
    c.showAt=Date.now()+c.pv*1000;o.hidden=true;$('pvBox').hidden=false;
    var bar=$('pvBar');bar.style.animation='none';void bar.offsetWidth;bar.style.animation='';bar.style.animationDuration=c.pv+'s';
    var pvTick=function(){var L=Math.ceil((c.showAt-Date.now())/1000);
      if(L<=0||G.cur!==c){clearInterval(G.pvTimer);if(G.cur===c)showOpts();return}
      $('pvN').textContent='選項 '+L+' 秒後出現'+(c.ord?'（這一題要排順序）':'');SFX.tick()};
    pvTick();G.pvTimer=setInterval(pvTick,250);
  }else showOpts();
  $('roundText').textContent='第 '+(G.stats.length+1)+' / '+G.rounds+' 題';
}
function showOpts(){var o=$('opts');$('pvBox').hidden=true;o.hidden=false;o.classList.remove('pop');void o.offsetWidth;o.classList.add('pop');SFX.show()}
function drawHp(anim){
  var p=G.max?Math.max(0,G.hp)/G.max*100:100;
  $('hpFill').style.width=p+'%';$('hpText').textContent='血量 '+Math.max(0,G.hp)+' / '+G.max;
  $('hpBar').setAttribute('aria-valuemax',G.max);$('hpBar').setAttribute('aria-valuenow',Math.max(0,G.hp));
}
function drawLive(n,left){
  var tot=G.seats.length;
  $('ansCount').innerHTML=n+' / '+tot+' <small>位已作答</small>';
  var c=$('clock');
  if(G.cur&&G.cur.showAt>Date.now()){c.style.display='none';return}
  if(G.secs>0&&left!=null&&left<=5&&left>0&&G.lastTick!==left){G.lastTick=left;SFX.tick()}
  if(G.secs>0&&left!=null){
    var f=Math.max(0,Math.min(1,left/G.secs)),r=42,L=2*Math.PI*r;
    c.innerHTML='<circle cx="50" cy="50" r="'+r+'" fill="#F1EDF6"/><circle cx="50" cy="50" r="'+r+'" fill="none" stroke="'+(left<=5?'#C8414B':'#7A2E8E')+'" stroke-width="10" stroke-dasharray="'+(L*f)+' '+L+'" transform="rotate(-90 50 50)" stroke-linecap="round"/><text x="50" y="62" text-anchor="middle" font-size="34" fill="#1F2A27">'+left+'</text>';
    c.style.display='';
  }else c.style.display='none';
}
$('bStop').addEventListener('click',function(){reveal()});
function reveal(){
  if(!G||G.phase!=='question'||busy)return;
  busy=true;G.phase='revealing';
  rpc('raid_reveal',{p_room:G.room}).then(function(r){
    busy=false;if(!r){G.phase='question';return}
    G.phase='reveal';
    var c=G.cur,dmg=r.damage;G.hp=r.hp;
    if(G.r3d==='on'){R3D.volley(r.okseats||shuf(G.seats).slice(0,r.ok||0),dmg,r.crit,0);R3D.hp(0,G.max?Math.max(0,G.hp)/G.max:1)}
    var dist=r.dist||{};
    clearInterval(G.pvTimer);$('pvBox').hidden=true;var o=$('opts');o.hidden=false;o.classList.add('reveal');
    var right=c.ord?c.ans.map(function(i,k){return (k+1)+'. '+c.opts[i]}).join(' → '):c.opts[c.ans];
    [].forEach.call(o.children,function(el,i){
      if(c.ord){el.querySelector('.k').textContent='第 '+(c.ans.indexOf(i)+1)+' 步';return}
      var key=String(i),cnt=dist[key]||0;
      if(i===c.ans)el.classList.add('right');
      el.querySelector('.n').textContent=cnt+' 人';
      el.querySelector('.bar').style.width=(r.answered?cnt/r.answered*100:0)+'%';
    });
    if(c.ord){var ord2=[].slice.call(o.children);c.ans.forEach(function(i){o.appendChild(ord2[i])})}
    G.stats.push({q:c.q.q,a:right,e:c.q.e,ok:r.ok,n:r.answered,pl:r.players});
    SFX.right();setTimeout(function(){if(dmg>0){if(r.crit)SFX.crit();else SFX.hit()}},350);
    var boss=$('boss');boss.classList.remove('hit','crit');void boss.offsetWidth;
    if(dmg>0){boss.classList.add('hit');if(r.crit)boss.classList.add('crit');
      var d=document.createElement('div');d.className='dmg';d.textContent=(r.crit?'暴擊！':'')+'-'+dmg;boss.appendChild(d);setTimeout(function(){d.remove()},1700)}
    drawHp(true);
    $('liveBox').hidden=true;$('revealBox').hidden=false;
    var res=$('resText');res.className='res'+(r.crit?' crit':'');
    res.innerHTML=(r.crit?'<b>🔥 全班 8 成以上答對，暴擊！</b><br>':'')+
      '<b>'+r.ok+' / '+r.players+' 人'+(c.ord?'排對':'答對')+'</b>，打掉魔王 <b>'+dmg+'</b> 點血！'+
      '<br>✓ '+(c.ord?'正確順序':'正確答案')+'：<b>'+esc(right)+'</b>　'+esc(c.q.e);
    if(G.ghost&&G.ghost.curve){var gk=G.ghost.curve[Math.min(G.stats.length,G.ghost.curve.length)-1],now=G.max?(G.max-Math.max(0,G.hp))/G.max*100:0;
      if(G.stats.length>G.ghost.curve.length)gk=G.ghost.curve[G.ghost.curve.length-1];
      setGm('gmB',gk);res.innerHTML+='<br>👻 上一次到第 '+G.stats.length+' 題時打掉 '+Math.round(gk)+'%，這一次 <b>'+Math.round(now)+'%</b> '+(now>=gk?'⬆ 領先上一次！':'⬇ 還落後一點，加油！')}
    var nb=$('bNext');
    if(G.hp<=0)nb.textContent='🎉 打倒魔王了！看結果';
    else if(G.stats.length>=G.rounds)nb.textContent='看結果';
    else nb.textContent='下一題 →';
  }).catch(function(){busy=false;G.phase='question'});
}
/* 結束時和上一次比 */
function ghostEnd(win,winSec,acc){
  var g=G.ghost;if(!G.wantGhost)return '';if(!g)return '<div class="gend">👻 這一次的成績記下來了，下次就能挑戰這一次的自己！</div>';
  var now=G.max?Math.round((G.max-Math.max(0,G.hp))/G.max*100):0,gw=g.result==='win',beat;
  if(G.mode==='sync')beat=now>g.end_pct||(now===g.end_pct&&acc>(g.acc||0));
  else if(win&&gw&&winSec&&g.win_sec)beat=winSec<g.win_sec;
  else beat=(win&&!gw)||(!win&&!gw&&now>g.end_pct)||(win===gw&&now===g.end_pct&&acc>(g.acc||0));
  var a=g.acc==null?'':'一次答對率 '+g.acc+'% → <b>'+acc+'%</b>（'+(acc-g.acc>=0?'+':'')+(acc-g.acc)+'）';
  var t=G.mode==='sync'?'打掉魔王 '+g.end_pct+'% → <b>'+now+'%</b>'
       :(win&&gw&&winSec&&g.win_sec)?'打倒魔王的時間 '+fmtSec(g.win_sec)+' → <b>'+fmtSec(winSec)+'</b>'
       :(gw?'上一次打倒了魔王':'上一次打掉 '+g.end_pct+'%')+' → 這一次'+(win?'<b>打倒魔王</b>':'打掉 <b>'+now+'%</b>');
  return '<div class="gend'+(beat?' win':'')+'">'+(beat?'<b>🏅 打敗上一次的自己了！</b>':'<b>👻 差一點點就超越上一次了！</b>')+'<br>'+t+'<br>'+a+'</div>';
}
function finish(result){
  stopPoll();
  rpc('raid_finish',{p_room:G.room,p_result:result}).catch(function(){});
  var tot=G.stats.reduce(function(s,x){return s+x.n},0),ok=G.stats.reduce(function(s,x){return s+x.ok},0);
  var pct=tot?Math.round(ok/tot*100):0;
  var hard=G.stats.map(function(s,i){return {i:i,p:s.n?s.ok/s.n:1,s:s}}).filter(function(x){return x.p<0.7}).sort(function(a,b){return a.p-b.p}).slice(0,5);
  var win=result==='win';
  var h=(win?'<h2>🎉 全班合力打倒'+esc(PK.boss||'大魔王')+'！</h2><p class="note" style="font-size:1.2rem">'+esc(PK.winLine||'')+'</p>'
          :'<h2>魔王逃走了……</h2><p class="note" style="font-size:1.2rem">魔王還剩 '+G.hp+' 點血。複習下面的題目，下次一定打得倒！</p>')+
    '<svg viewBox="0 0 300 200" style="width:min(100%,320px);margin:0 auto;'+(win?'filter:grayscale(1);opacity:.55':'')+'" aria-hidden="true">'+$('bossArt').innerHTML+'</svg>'+
    '<div class="stat"><div><b>'+G.stats.length+'</b>題</div><div><b>'+pct+'%</b>全班答對率</div><div><b>'+(G.max-Math.max(0,G.hp))+'</b>總傷害</div><div><b>'+G.seats.length+'</b>位勇者</div></div>'+
    ghostEnd(win,null,pct);
  if(win){SFX.win();confetti()}else SFX.lose();
  if(hard.length)h+='<h3 style="margin:0;text-align:left;color:#7A2E8E">📖 大家比較需要複習的題目</h3><div class="review">'+hard.map(function(x){return '<div class="it"><span class="p">'+Math.round(x.p*100)+'% 答對</span>'+esc(x.s.q)+'<br><b style="color:#1E8A5A">答案：'+esc(x.s.a)+'</b>　'+esc(x.s.e)+'</div>'}).join('')+'</div>';
  else h+='<p class="note" style="font-size:1.2rem">每一題都有 7 成以上的同學答對，太厲害了！</p>';
  h+='<div class="row" style="justify-content:center"><button type="button" class="bigbtn" id="bAgain">再開一場</button></div>';
  endShow(h,result,function(){
  $('bAgain').addEventListener('click',function(){setH1();G=null;$('bCreate').disabled=false;$('setMsg').textContent='';show('scrSetup')});});
}

/* ---------- 3D 戰場（assets/raid3d.js、assets/avatar.js） ---------- */
var AV={map:{},t:0};
function loadAv(){if(!window.AVATAR||!G)return;var now=Date.now();if(now-AV.t<5000)return;AV.t=now;
  AVATAR.list(CLASS||'').then(function(m){AV.map=m||{};sync3d()}).catch(function(){})}
function sync3d(){if(!G||G.r3d!=='on')return;R3D.players(G.mode==='team'?(G.tseats||[]):(G.seats||[]).map(function(s){return {seat:s}}),AV.map)}
function placeCards(){if(!window.R3D)return;var rs=R3D.rects(G.teams);for(var t=1;t<=G.teams;t++){var c=$('tb'+t),r=rs[t-1];if(!c||!r)continue;
  c.style.left=(r[0]*100)+'%';c.style.top=(r[1]*100)+'%';c.style.width=(r[2]*100)+'%';c.style.height=(r[3]*100)+'%'}}
function start3d(){
  if(!G||G.r3d||!window.R3D)return;
  var team=G.mode==='team',box=team?$('fTeams'):G.mode==='free'?$('fBoss'):$('boss'),holder=box;
  if(team&&!$('tb1'))return;
  G.r3d='loading';box.classList.add('has3d');
  if(!team){holder=document.createElement('div');holder.className='b3d';box.insertBefore(holder,box.firstChild)}
  var wrap=G.mode==='sync'?document.querySelector('.battle'):document.querySelector('.free');if(wrap)wrap.classList.add('has3d');
  if(team)placeCards();
  var room=G.room;
  R3D.init(holder,{teams:team?G.teams:0,unit:PK.code||'u2'}).then(function(){
    if(!G||G.room!==room||G.r3d!=='loading'){R3D.destroy();return}
    G.r3d='on';AV.t=0;loadAv();sync3d();
    if(G.mode!=='team'&&G.max)R3D.hp(0,Math.max(0,G.hp)/G.max);
  }).catch(function(){if(G&&G.room===room){G.r3d='off';reset3d()}});
}
function reset3d(){
  if(window.R3D)R3D.destroy();
  [].forEach.call(document.querySelectorAll('.has3d'),function(e){e.classList.remove('has3d')});
  [].forEach.call(document.querySelectorAll('.b3d'),function(e){e.remove()});
  [].forEach.call(document.querySelectorAll('#fTeams .tb'),function(e){e.removeAttribute('style')});
}
/* 結束：3D 戰場先播勝利／失敗動畫，3.5 秒後才換到結算畫面 */
function endShow(h,result,cb){
  var go=function(){reset3d();var e=$('scrEnd');e.innerHTML=h;show('scrEnd');cb()};
  if(G&&G.r3d==='on'){G.r3d='ended';R3D.end(result==='time'?'win':result,G.lastH&&G.lastH.winner);setTimeout(go,3500)}else go();
}

/* ---------- 各自搶攻 ---------- */
function startFree(){
  busy=true;$('bStart').disabled=true;
  rpc('raid_free_start',{p_room:G.room,p_minutes:G.mins,p_hp_per_min:FREE_K[G.lv-1]}).then(function(h){
    busy=false;if(!h||h.status!=='play')throw new Error('start failed');
    G.phase='free';G.hp=h.hp;G.max=h.max_hp;G.lastId=h.last_id||0;G.secsTotal=G.mins*60;
    show('scrFree');drawFree(h);start3d();
  }).catch(function(){busy=false;$('bStart').disabled=false;$('joined').textContent='開始失敗，請確認網路連線後再按一次。'});
}
function drawFree(h){
  if(!G||G.phase!=='free')return;
  G.seats=h.seats||G.seats;G.tseats=h.tseats||G.tseats;G.lastH=h;
  var hit=0,thit={},on3=G.r3d==='on';(h.recent||[]).forEach(function(x){if(x.id>G.lastId){hit+=x.dmg;if(x.team)thit[x.team]=(thit[x.team]||0)+x.dmg;if(on3)R3D.attack(x.seat||0,x.dmg,x.team)}});
  if(h.last_id)G.lastId=Math.max(G.lastId,h.last_id);
  G.hp=h.hp;G.max=h.max_hp;
  var p=G.max?Math.max(0,G.hp)/G.max*100:100;
  if(on3&&G.mode!=='team')R3D.hp(0,p/100);
  $('fHpFill').style.width=p+'%';$('fHpText').textContent='血量 '+Math.max(0,G.hp)+' / '+G.max;
  $('fHpBar').setAttribute('aria-valuemax',G.max);$('fHpBar').setAttribute('aria-valuenow',Math.max(0,G.hp));
  var L=h.left==null?0:h.left,m=Math.floor(L/60),sec=L%60;G.lastLeft=L;
  if(G.ghost&&G.ghost.curve){var el=G.secsTotal-L,gp=ghostAt(el),nowp=G.max?(G.max-Math.max(0,h.hp))/G.max*100:0;
    if(G.mode!=='team')setGm('gmF',gp);var gc=$('gCard');gc.hidden=false;
    gc.innerHTML='<b>👻 挑戰上一次的自己</b><span>上一次這時候打掉 '+Math.round(gp)+'%，這一次 <span class="'+(nowp>=gp?'up':'down')+'">'+Math.round(nowp)+'% '+(nowp>=gp?'⬆ 領先':'⬇ 落後')+'</span></span>'}
  if(h.rev&&!G.revOn){G.revOn=true;SFX.revenge()}
  var c=$('fClock');c.textContent=m+':'+(sec<10?'0':'')+sec;c.className='bigclock'+(L<=30?' hot':'');
  $('fAns').textContent=h.answered;$('fPct').textContent=(h.answered?Math.round(h.correct/h.answered*100):0)+'%';$('fPl').textContent=G.seats.length;
  drawRank(h.board||[]);drawAcc(h.acc||[]);
  $('fRev').hidden=!h.rev;
  if(hit>0)SFX.hit();
  if(G.mode==='team')drawTeams(h,thit);
  else if(hit>0){var b=$('fBoss');b.classList.remove('hit');void b.offsetWidth;b.classList.add('hit');
    var d=document.createElement('div');d.className='dmg';d.textContent='-'+hit;d.style.left=(Math.random()*30-15)+'%';b.appendChild(d);setTimeout(function(){d.remove()},1700)}
  drawCounter(h);
  if(h.status==='end'&&h.result==='win')return finishFree('win');
  if(h.status==='play'&&L<=0)return finishFree(G.mode==='team'?'time':(G.hp<=0?'win':'lose'));
  maybeCounter(h,L);
}
/* ---------- 分隊競賽：每隊一隻魔王 ---------- */
function buildTeams(){
  var art=$('fBossArt').innerHTML,h='';
  for(var t=1;t<=G.teams;t++)h+='<div class="tb tc'+t+'" id="tb'+t+'"><svg class="bs" viewBox="0 0 300 200" aria-hidden="true">'+art+'</svg><h3><i>'+TN[t]+'</i><span id="tbn'+t+'"></span></h3>'+
    '<div class="pc" id="tbp'+t+'"></div><div class="hp" role="progressbar" aria-label="'+TN[t]+'的魔王血量" aria-valuemin="0" id="tbb'+t+'"><i id="tbf'+t+'"></i></div><div class="hpn"><span id="tbh'+t+'"></span><span id="tba'+t+'"></span></div></div>';
  var box=$('fTeams');box.innerHTML=h;box.hidden=false;$('fBoss').hidden=true;
  $('fModeTag').textContent='👥 分隊競賽';
}
function teamRows(h){
  var hp=h.team_hp||[],mx=h.team_max||[],ts=h.tstat||[],out=[];
  for(var t=1;t<=G.teams;t++){var s=ts[t-1]||{},m=mx[t-1]||1,v=Math.min(m,Math.max(0,hp[t-1]==null?m:hp[t-1]));
    out.push({t:t,hp:v,max:m,left:v/m,n:s.n||0,first:s.first||0,ok:s.ok||0})}
  return out;
}
function drawTeams(h,thit){
  if(!$('tb1'))buildTeams();
  var rows=teamRows(h),best=rows.slice().sort(function(a,b){return a.left-b.left})[0];
  rows.forEach(function(x){var t=x.t,card=$('tb'+t);
    $('tbn'+t).textContent=x.n+' 人';
    $('tbp'+t).textContent=x.hp<=0?'打倒了！':'還剩 '+Math.ceil(x.left*100)+'%';
    $('tbf'+t).style.width=(x.left*100)+'%';if(G.r3d==='on')R3D.hp(t,x.hp<=0?0:x.left);$('tbb'+t).setAttribute('aria-valuemax',x.max);$('tbb'+t).setAttribute('aria-valuenow',x.hp);
    $('tbh'+t).textContent='血量 '+x.hp+' / '+x.max;
    $('tba'+t).textContent='一次答對 '+(x.first?Math.round(x.ok/x.first*100):0)+'%';
    card.classList.toggle('lead',best&&best.t===t&&best.left<1);card.classList.toggle('dead',x.hp<=0);
    if(thit[t]){card.classList.remove('hit');void card.offsetWidth;card.classList.add('hit');
      var d=document.createElement('div');d.className='dmg';d.textContent='-'+thit[t];card.appendChild(d);setTimeout(function(){d.remove()},1700)}
  });
}
/* ---------- 魔王反擊：每 3 分鐘一題全班題 ---------- */
function maybeCounter(h,L){
  if(!G.optC||G.cBusy||G.phase!=='free')return;
  var c=h.counter;if(c&&!c.done)return;
  var el=G.secsTotal-L,pts=[];for(var m=3;m<G.mins;m+=3)pts.push(m*60);
  if(G.cFired<pts.length&&el>=pts[G.cFired]&&L>25){G.cFired++;startCounter()}
}
function startCounter(){
  var CQ=Q.filter(function(x){return !x.ord});if(!CQ.length)return;
  var q=CQ[Math.floor(Math.random()*CQ.length)],payload,ans;
  if(q.ox){payload={q:q.q,o:['O','X'],ox:true,d:q.d};ans=q.a?0:1}
  else{var ord=shuf(q.o.map(function(t,i){return i}));payload={q:q.q,o:ord.map(function(i){return q.o[i]}),ox:false,d:q.d};ans=ord.indexOf(q.a)}
  G.cBusy=true;
  rpc('raid_counter_start',{p_room:G.room,p_q:payload,p_key:{a:ans,e:q.e},p_secs:30}).then(function(h){G.cBusy=false;if(h)drawCounter(h)}).catch(function(){G.cBusy=false});
}
function endCounter(){
  if(G.cEnding)return;G.cEnding=true;
  rpc('raid_counter_end',{p_room:G.room}).then(function(c){G.cEnding=false;if(c&&G)drawCounter({counter:c})}).catch(function(){G.cEnding=false});
}
$('cStop').addEventListener('click',endCounter);
function hideCounter(){$('cOv').hidden=true}
function drawCounter(h){
  var c=h.counter,ov=$('cOv');
  if(!c||!G){hideCounter();return}
  if(!c.done){
    if(G.cN!==c.n){G.cN=c.n;SFX.alarm();if(G.r3d==='on')R3D.counter(0);
      $('cT').textContent='⚠️ 魔王反擊！';
      $('cNote').textContent=G.mode==='team'?'每一隊分開算：隊上 9 成以上的人答對，才能擋下反擊！答錯太多，自己隊的魔王會回血。':'全班一起在平板上作答：9 成以上的人答對，才能擋下反擊！答錯太多，魔王會回血。';
      $('cQ').textContent=c.q;
      var o=$('cOpts');o.className='opts'+(c.ox?' ox':'');
      o.innerHTML=(c.o||[]).map(function(t,i){return '<div class="o c'+i+'">'+(c.ox?'':'<b>'+LABEL[i]+'</b>')+'<span>'+esc(t)+'</span><span class="n"></span><span class="bar" style="width:0"></span></div>'}).join('');
      $('cRes').hidden=true;$('cStop').hidden=false;ov.hidden=false;
    }
    var L=c.left==null?0:c.left;$('cClk').textContent=L+' 秒';
    $('cAns').innerHTML=(c.answered||0)+' / '+G.seats.length+' <small>位已作答</small>';
    if(c.left!=null&&(L<=0||(G.seats.length&&c.answered>=G.seats.length)))endCounter();
    return;
  }
  if(G.cRes!==c.n){G.cRes=c.n;G.cN=c.n;G.cHide=Date.now()+9000;
    if(ov.hidden){$('cQ').textContent=c.q;var o2=$('cOpts');o2.className='opts'+(c.ox?' ox':'');
      o2.innerHTML=(c.o||[]).map(function(t,i){return '<div class="o c'+i+'">'+(c.ox?'':'<b>'+LABEL[i]+'</b>')+'<span>'+esc(t)+'</span><span class="n"></span><span class="bar" style="width:0"></span></div>'}).join('')}
    var dist=c.dist||{},tot=0,k;for(k in dist)tot+=dist[k];
    var o=$('cOpts');o.classList.add('reveal');
    [].forEach.call(o.children,function(el,i){var n=dist[String(i)]||0;if(i===c.a)el.classList.add('right');el.querySelector('.n').textContent=n+' 人';el.querySelector('.bar').style.width=(tot?n/tot*100:0)+'%'});
    var blocked=(c.res||[]).every(function(r){return !r.heal});if(blocked)SFX.block();else SFX.heal();
    if(G.r3d==='on')(c.res||[]).forEach(function(r){if(r.heal)R3D.heal(r.t||0)});
    $('cT').textContent=blocked?'🛡️ 反擊擋下來了！':'💥 魔王回血了！';
    $('cClk').textContent='';$('cStop').hidden=true;$('cAns').innerHTML='';
    $('cRes').innerHTML=(c.res||[]).map(function(r){
      var p=r.n?Math.round(r.ok/r.n*100):0,cls=!r.heal?'':(r.ok*2>=r.n?' mid':' bad');
      return '<div class="cr'+cls+'">'+(r.t?'<span class="tc'+r.t+'"><span class="tdot">'+r.t+'</span></span><b>'+TN[r.t]+'</b>：':'<b>全班</b>：')+r.ok+' / '+r.n+' 人答對（'+p+'%）→ '+(r.heal?'魔王回血 <b>+'+r.heal+'</b>':'<b>擋下反擊！</b>')+'</div>'}).join('')+
      (c.e?'<div class="cr" style="background:#F1EDF6;color:#4A2B5E">✓ 答案：<b>'+esc((c.o||[])[c.a])+'</b>　'+esc(c.e)+'</div>':'');
    $('cRes').hidden=false;ov.hidden=false;
    return;
  }
  if(G.cHide&&Date.now()>G.cHide)hideCounter();
}
function seatLabel(seat){
  if(!G||G.mode!=='team')return seat+' 號';
  var t=0;(G.tseats||[]).forEach(function(x){if(x.seat===seat)t=x.team});
  return t?'<span class="tc'+t+'"><span class="tdot" title="'+TN[t]+'">'+t+'</span></span>'+seat+' 號':seat+' 號';
}
function rankRows(list,n,prev){
  var medal=['🥇','🥈','🥉'],rk=0,last=null;
  return list.slice(0,n).map(function(x,i){
    var key=x.ok+'|'+x.dmg;if(key!==last){rk=i+1;last=key}
    var up=prev&&prev[x.seat]!=null&&prev[x.seat]<x.ok;
    return '<li class="'+(rk<=3?'top':'')+(up?' up':'')+'"><span class="r">'+(medal[rk-1]||rk)+'</span><span class="s">'+seatLabel(x.seat)+'</span><span class="ok">答對 '+x.ok+' 題<small class="dm">⚔ '+x.dmg+'</small></span></li>'}).join('');
}
/* 正確率排行榜：第 1 次作答就答對的比率，作答滿 10 題才上榜（raid_host.acc） */
function accRows(list,n){
  var medal=['🥇','🥈','🥉'],rk=0,last=null;
  return list.slice(0,n).map(function(x,i){
    if(x.pct!==last){rk=i+1;last=x.pct}
    return '<li class="'+(rk<=3?'top':'')+'"><span class="r">'+(medal[rk-1]||rk)+'</span><span class="s">'+seatLabel(x.seat)+'</span><span class="pc">'+x.pct+'%<small>'+x.ok+'／'+x.n+' 題</small></span></li>'}).join('');
}
function drawAcc(list){
  G.acc=list;var sig=list.slice(0,5).map(function(x){return x.seat+':'+x.ok+':'+x.n}).join(',');
  if(sig!==G.accSig){G.accSig=sig;$('fAcc').innerHTML=list.length?accRows(list,5):'<li style="display:block;background:none"><p class="empty">作答滿 10 題的同學會出現在這裡！</p></li>'}
}
function drawRank(board){
  G.board=board;var prev=G.rankPrev||{},now={};
  board.forEach(function(x){now[x.seat]=x.ok});
  var sig=board.slice(0,5).map(function(x){return x.seat+':'+x.ok+':'+x.dmg}).join(',');
  if(sig!==G.rankSig){G.rankSig=sig;$('fRank').innerHTML=board.length?rankRows(board,5,prev):'<li style="display:block;background:none"><p class="empty">答對第一題的同學會出現在這裡！</p></li>'}
  G.rankPrev=now;
}
$('fStop').addEventListener('click',function(){finishFree(G.mode==='team'?'time':(G.hp<=0?'win':'lose'))});
function teamHead(result){
  var rows=teamRows(G.lastH||{}),w=(G.lastH&&G.lastH.winner)||null;
  rows.sort(function(a,b){return a.left-b.left||a.t-b.t});
  if(!w&&rows.length)w=rows[0].t;
  var medal=['🥇','🥈','🥉','4'];
  return '<h2>🏆 <span class="tc'+w+'"><span class="tdot">'+w+'</span></span>'+TN[w]+'獲勝！</h2><p class="note" style="font-size:1.2rem">'+
    (result==='win'?TN[w]+'最先打倒了自己的魔王！':'時間到！'+TN[w]+'的魔王剩下的血最少。')+'每一隊都很努力，下次再拚一場！</p>'+
    '<div class="sum" style="max-width:820px;margin:0 auto;width:100%">'+rows.map(function(x,i){
      return '<div class="it tc'+x.t+'"><span class="p">'+(x.hp<=0?'打倒魔王！':'魔王還剩 '+Math.ceil(x.left*100)+'%')+'</span>'+medal[i]+' <span class="tdot">'+x.t+'</span><b>'+TN[x.t]+'</b>（'+x.n+' 人）　一次答對率 '+(x.first?Math.round(x.ok/x.first*100):0)+'%</div>'}).join('')+'</div>';
}
function finishFree(result){
  if(!G||G.phase==='done')return;
  G.phase='done';stopPoll();hideCounter();
  rpc('raid_finish',{p_room:G.room,p_result:result}).catch(function(){});
  var ans=+$('fAns').textContent||0,pct=$('fPct').textContent;
  rpc('raid_free_summary',{p_room:G.room}).catch(function(){return []}).then(function(list){
    list=list||[];
    var hard=list.filter(function(x){return x.n>=2&&x.ok/x.n<0.7}).slice(0,6);
    var win=result==='win';
    var pod=[];
    if(G.mode==='team'){teamRows(G.lastH||{}).sort(function(a,b){return a.left-b.left||a.t-b.t}).slice(0,3).forEach(function(x){pod.push({who:'<span class="tc'+x.t+'"><span class="tdot">'+x.t+'</span></span>'+TN[x.t],sub:x.hp<=0?'打倒魔王！':'魔王剩 '+Math.ceil(x.left*100)+'%'})})}
    else (G.board||[]).slice(0,3).forEach(function(x){pod.push({who:x.seat+' 號',sub:'答對 '+x.ok+' 題・⚔ '+x.dmg})});
    var winSec=win&&G.secsTotal?G.secsTotal-(G.lastLeft||0):null;
    if(!pod.length){if(win){SFX.win();confetti()}else SFX.lose()}
    var h=podium(pod)+(G.mode==='team'?teamHead(result):(win?'<h2>🎉 全班合力打倒'+esc(PK.boss||'大魔王')+'！</h2><p class="note" style="font-size:1.2rem">'+esc(PK.winLine||'')+'</p>'
            :'<h2>時間到，魔王逃走了……</h2><p class="note" style="font-size:1.2rem">魔王還剩 '+G.hp+' 點血。複習下面的題目，下次一定打得倒！</p>')+
      '<svg viewBox="0 0 300 200" style="width:min(100%,320px);margin:0 auto;'+(win?'filter:grayscale(1);opacity:.55':'')+'" aria-hidden="true">'+$('bossArt').innerHTML+'</svg>')+
      ghostEnd(win,winSec,parseInt(pct,10)||0)+
      '<div class="stat"><div><b>'+ans+'</b>全班作答題數</div><div><b>'+pct+'</b>一次答對率</div><div><b>'+(G.max-Math.max(0,G.hp))+'</b>總傷害</div><div><b>'+G.seats.length+'</b>位勇者</div></div>'+
      (((G.board||[]).length||(G.acc||[]).length)?'<div class="ranks" style="max-width:980px;margin:0 auto;width:100%">'+
        ((G.board||[]).length?'<div class="card rank"><h3>🏆 戰力排行榜 前 5 名</h3><ol>'+rankRows(G.board,5)+'</ol></div>':'')+
        ((G.acc||[]).length?'<div class="card rank acc"><h3>🎯 正確率排行榜 前 5 名</h3><ol>'+accRows(G.acc,5)+'</ol></div>':'')+'</div>':'');
    if(hard.length)h+='<h3 style="margin:0;text-align:left;color:#7A2E8E">📖 大家比較需要複習的題目</h3><div class="review">'+hard.map(function(x){return '<div class="it"><span class="p">'+Math.round(x.ok/x.n*100)+'% 答對（'+x.n+' 人次）</span>'+esc(x.q)+'<br><b style="color:#1E8A5A">答案：'+esc(x.answer)+'</b>　'+esc(x.e)+'</div>'}).join('')+'</div>';
    else h+='<p class="note" style="font-size:1.2rem">每一題的答對率都在 7 成以上，太厲害了！</p>';
    h+='<div class="row" style="justify-content:center"><button type="button" class="bigbtn" id="bAgain">再開一場</button></div>';
    endShow(h,result,function(){
    $('bAgain').addEventListener('click',function(){setH1();G=null;$('bCreate').disabled=false;$('setMsg').textContent='';show('scrSetup')});});
  });
}

/* 標題（結束畫面「再開一場」時還原） */
var H1=null;function setH1(t){var h=document.querySelector('.top h1');if(H1==null)H1=h.textContent;h.textContent=t==null?H1:t}

/* 全螢幕、老師說明 */
$('bFs').addEventListener('click',function(){var d=document.documentElement;if(document.fullscreenElement)document.exitFullscreen();else if(d.requestFullscreen)d.requestFullscreen()});
(function(){var d=$('tDlg'),last;function open(){last=document.activeElement;d.hidden=false;d.querySelector('.close').focus()}function close(){d.hidden=true;if(last)last.focus()}
$('bTeach').addEventListener('click',open);d.querySelector('.close').addEventListener('click',close);
d.addEventListener('click',function(e){if(e.target===d)close()});document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!d.hidden)close()})})();
