/* 情境挑戰（lessons/fc-game-story.html）的程式；說明寫在頁面最上面的註解。頁面先載入 data/ 的劇本與 qrcode.js，最後才載入這個檔。 2026-11-24 從頁面裡移出來，方便維護。 */
(function(){
var ALL=window.FC_STORY||{}, L=['A','B','C','D'];
var KIND={good:'🌈 好結局',ok:'🌤️ 還可以的結局',bad:'🌧️ 再想想的結局'};
function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function load(k,d){try{var v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(e){return d}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
var got=load('fcStoryGot',{}), SET=Object.assign({secs:30,tts:1,story:{}},load('fcStorySet',{}));
if([20,30,45,0].indexOf(SET.secs)<0)SET.secs=30;if([0,1].indexOf(SET.tts)<0)SET.tts=1;
var gq=(location.search.match(/[?&]g=(ge-low|ge-mid|ge-high|low|mid|high|u2|u3)(?:&|$)/)||[])[1];
/* 劇本家族：友善校園（low／mid／high）與性別平等（ge-low／ge-mid／ge-high）各有低中高年級切換；第二、三單元（u2／u3）沒有切換 */
var FAM=gq&&/^ge-/.test(gq)?'ge-':'', GKEY=FAM?'geStoryG':'fcStoryG', GR=gq||load(GKEY,FAM+'low');if(!ALL[GR])GR=FAM+'low';if(!ALL[GR])GR='low';
var UNIT=/^u\d/.test(GR); /* 第二、三單元：不顯示年級切換 */
var D=ALL[GR], G=null, busy=false;
function NAME(){return D.name||'友善校園情境挑戰'}
function api(path,body){return window.CLS.api(path,{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(body)})
  .then(function(r){if(!r.ok)return r.text().then(function(t){throw new Error(t||('HTTP '+r.status))});return r.text().then(function(t){return t?JSON.parse(t):null})})}
function rpc(fn,a){return api('rest/v1/rpc/'+fn,a)}
function show(id){['scrSetup','scrLobby','scrPlay','scrEnd'].forEach(function(k){$(k).hidden=k!==id});window.scrollTo(0,0)}
var SAY=(function(){var ok=('speechSynthesis' in window),voice=null;
  function pick(){try{var vs=speechSynthesis.getVoices();voice=vs.filter(function(v){return /zh[-_]TW/i.test(v.lang)})[0]||vs.filter(function(v){return /^(zh|cmn)/i.test(v.lang)})[0]||null}catch(e){}}
  if(ok){pick();try{speechSynthesis.addEventListener('voiceschanged',pick)}catch(e){}}
  return function(t){if(!ok)return;try{speechSynthesis.cancel();if(!t)return;var u=new SpeechSynthesisUtterance(t);u.lang=voice?voice.lang:'zh-TW';if(voice)u.voice=voice;u.rate=.9;speechSynthesis.speak(u)}catch(e){}}})();
function nodeText(nd){return nd.s+'。'+nd.q+'。'+nd.o.map(function(t,i){return L[i]+'，'+t}).join('。')}

/* ---------- 選故事、設定 ---------- */
function storyOf(){var id=SET.story[GR],l=D.list;for(var i=0;i<l.length;i++)if(l[i].id===id)return l[i];return l[0]}
function dots(sp){var ks=Object.keys(sp.ends),g=got[sp.id]||[];
  return '<span>結局收集：</span>'+ks.map(function(k){return g.indexOf(k)>=0?'<i title="'+esc(sp.ends[k].title)+'">'+sp.ends[k].icon+'</i>':'<i>？</i>'}).join('')+'<span>'+g.length+' / '+ks.length+'</span>'}
function paintSetup(){
  D=ALL[GR];if(!UNIT)save(GKEY,GR);$('gtabs').hidden=UNIT;
  [].forEach.call($('gtabs').children,function(b){b.setAttribute('aria-pressed',String(FAM+b.dataset.g===GR))});
  $('pickH').textContent='選一個故事・'+D.label;
  var cur=storyOf();
  $('picks').innerHTML=D.list.map(function(sp){return '<button type="button" class="pick" data-id="'+sp.id+'" aria-pressed="'+(sp===cur)+'"><span class="ic" aria-hidden="true">'+sp.icon+'</span><b>'+esc(sp.title)+'</b><small>'+esc(sp.intro)+'</small><small>'+(UNIT?'重點：':'對應教材：')+esc(sp.from)+'</small><span class="dots">'+dots(sp)+'</span></button>'}).join('');
  [].forEach.call(document.querySelectorAll('.seg[data-k]'),function(seg){[].forEach.call(seg.children,function(b){b.setAttribute('aria-pressed',String(+b.dataset.v===SET[seg.dataset.k]))})});
  $('h1').textContent='🧭 '+NAME()+(UNIT?'：'+D.short:'');document.title=NAME()+(UNIT?'：'+D.short:'');
}
$('gtabs').addEventListener('click',function(e){var b=e.target.closest('[data-g]');if(!b||!ALL[FAM+b.dataset.g])return;GR=FAM+b.dataset.g;paintSetup()});
$('picks').addEventListener('click',function(e){var b=e.target.closest('.pick');if(!b)return;SET.story[GR]=b.dataset.id;save('fcStorySet',SET);paintSetup()});
[].forEach.call(document.querySelectorAll('.seg[data-k]'),function(seg){seg.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;SET[seg.dataset.k]=+b.dataset.v;save('fcStorySet',SET);paintSetup()})});
paintSetup();

/* 班級（和書櫃共用 clsClass） */
/* 班級：班級名單＋最近用過的「其他班級」（到別班宣導時臨時輸入，記在 fcTmpCls，不會加進班級名單） */
var CLASS=load('clsClass',''), TMP=load('fcTmpCls',[]), CLIST=[];
if(!Array.isArray(TMP))TMP=[];
function drawCls(){
  var box=$('clsSeg');box.innerHTML='';
  var names=[''].concat(CLIST,TMP.filter(function(n){return CLIST.indexOf(n)<0}));
  if(CLASS&&names.indexOf(CLASS)<0)CLASS='';
  names.forEach(function(n){var b=document.createElement('button');b.type='button';b.textContent=n||'不指定';b.setAttribute('aria-pressed',String(n===CLASS));
    if(n&&CLIST.indexOf(n)<0)b.title='其他班級';
    b.addEventListener('click',function(){CLASS=n;if(CLIST.indexOf(n)>=0||!n)save('clsClass',n);$('tmpRow').hidden=true;drawCls()});box.appendChild(b)});
  var o=document.createElement('button');o.type='button';o.textContent='＋ 其他班級';o.setAttribute('aria-pressed','false');
  o.addEventListener('click',function(){$('tmpRow').hidden=false;$('tmpCls').focus()});box.appendChild(o);
}
function useTmp(){var n=$('tmpCls').value.trim().slice(0,20);if(!n)return;
  TMP=[n].concat(TMP.filter(function(x){return x!==n})).slice(0,6);save('fcTmpCls',TMP);CLASS=n;$('tmpCls').value='';$('tmpRow').hidden=true;drawCls()}
$('tmpOk').addEventListener('click',useTmp);
$('tmpCls').addEventListener('keydown',function(e){if(e.key==='Enter')useTmp()});
function loadCls(){
  window.CLS.api('rest/v1/class_list?select=name&order=sort.asc,name.asc').then(function(r){return r.json()}).then(function(list){
    CLIST=(list||[]).map(function(c){return c.name});drawCls();
  }).catch(function(){drawCls()});
}
var authN=0;(function chk(){if(window.CLS&&window.CLS.isTeacher){loadCls();return}if(authN++<20)setTimeout(chk,500)})();
$('noRec').addEventListener('change',function(){$('setMsg').textContent=this.checked?'這場不會記錄作答與結局。':''});
window.addEventListener('cls-status',function(){if(window.CLS&&window.CLS.isTeacher)loadCls()});

/* ---------- 開房間（平板投票） ---------- */
$('bCreate').addEventListener('click',function(){
  if(!(window.CLS&&window.CLS.isTeacher)){$('setMsg').textContent='平板投票要老師帳號：請先到書櫃首頁按「老師登入」。也可以用「舉手計票」。';return}
  var b=this,sp=storyOf();b.disabled=true;$('setMsg').textContent='建立中…';
  api('rest/v1/raid_rooms',{game:D.game||('fc-'+GR),rounds:40,mode:'story',class_name:CLASS||null,teams:0,opt_counter:false,opt_revenge:false,story:sp.id}).then(function(d){
    var room=d[0];b.disabled=false;$('setMsg').textContent='';
    G={room:room.id,sp:sp,path:[],node:sp.start,seats:[],phase:'lobby',norec:$('noRec').checked,cls:CLASS};
    var url=new URL('../raid.html?r='+room.id,location.href).href;
    $('roomCode').textContent=room.id;$('roomUrl').textContent=url;
    try{var q=qrcode(0,'M');q.addData(url);q.make();$('qr').innerHTML=q.createSvgTag({cellSize:8,margin:2,scalable:true})}catch(e){$('qr').textContent='QR Code 產生失敗，請學生輸入網址。'}
    $('lobbyT').textContent=sp.icon+' '+sp.title;
    $('lobbyNote').textContent=D.label+'・'+(UNIT?'重點：':'對應教材：')+sp.from+'。'+(G.norec?'這場不記錄作答。':'作答會記在「'+(CLASS||'不指定班級')+'」。')+'開始後還沒加入的同學也可以掃描加入，從目前這一關開始投票。';
    if(window.CLS_LIVE&&window.CLS_LIVE.push&&window.CLS_LIVE.id)window.CLS_LIVE.push('raid.html?r='+room.id,document.title);
    show('scrLobby');startPoll();
  }).catch(function(){b.disabled=false;$('setMsg').textContent='建立失敗，請確認網路與老師帳號後再試一次。'});
});
$('bCancel').addEventListener('click',function(){if(G&&G.room)rpc('raid_finish',{p_room:G.room,p_result:'cancel'}).catch(function(){});stopPoll();G=null;paintSetup();show('scrSetup')});
function startPoll(){stopPoll();G.poll=setInterval(tick,1000);tick()}
function stopPoll(){if(G&&G.poll){clearInterval(G.poll);G.poll=null}}
function tick(){
  if(!G||!G.room||busy)return;
  rpc('raid_host',{p_room:G.room}).then(function(h){
    if(!G||!h)return;G.seats=h.seats||[];
    if(G.phase==='lobby')drawLobby();
    else if(G.phase==='question'){
      drawLive(h.answered,h.left);
      if((G.seats.length>0&&h.answered>=G.seats.length)||(SET.secs>0&&h.left===0))reveal();
    }
  }).catch(function(){});
}
function drawLobby(){
  var n=G.seats.length,max=Math.max(25,n?G.seats[n-1]:0),h='';
  $('joined').textContent=n?('已加入 '+n+' 位同學'):'等待同學加入…';
  for(var i=1;i<=max;i++)h+='<span class="'+(G.seats.indexOf(i)>=0?'in':'')+'">'+i+'</span>';
  $('seatGrid').innerHTML=h;$('bStart').disabled=!n;
}
$('bStart').addEventListener('click',function(){enter()});

/* ---------- 舉手計票 ---------- */
$('bLocal').addEventListener('click',function(){var sp=storyOf();G={room:null,sp:sp,path:[],node:sp.start,norec:$('noRec').checked,cls:CLASS};enter()});

/* ---------- 每一關 ---------- */
function enter(){
  var sp=G.sp,nd=sp.nodes[G.node],k=G.path.length+1;
  G.votes=nd.o.map(function(){return 0});G.rev=false;
  $('h1').textContent=sp.icon+' '+sp.title;
  $('pTag').textContent='第 '+k+' 次選擇';$('pTitle').textContent=NAME()+'・'+D.label+(G.room?'・房號 '+G.room:'・舉手計票');
  $('pText').innerHTML=(k===1?'<span class="ico" aria-hidden="true">'+sp.icon+'</span><span class="intro">'+esc(sp.intro)+'</span>':'')+esc(nd.s);
  $('pRoute').innerHTML=G.path.map(function(p,i){return '<span>第 '+(i+1)+' 次：'+L[p.pick]+'</span>'}).join('');
  $('pQ').textContent=nd.q;
  $('pOpts').className='opts'+(G.room?' live':'');
  $('pOpts').innerHTML=nd.o.map(function(t,i){return '<div class="o c'+i+'" data-i="'+i+'"><span class="bar"></span><span class="l">'+L[i]+'</span><span class="t">'+esc(t)+'</span><span class="tally"><button type="button" data-d="-1" aria-label="'+L[i]+' 減一票">−</button><span class="n">0</span><button type="button" data-d="1" aria-label="'+L[i]+' 加一票">＋</button></span><span class="badge"></span><span class="fb">'+esc(nd.f[i])+'</span></div>'}).join('');
  $('pRes').hidden=true;$('bBack').disabled=!G.path.length;
  $('pLive').hidden=!G.room;$('pCtl').hidden=!!G.room;$('pCtl2').hidden=!!G.room;
  paintVotes();show('scrPlay');
  if(SET.tts)SAY(nodeText(nd));
  if(G.room){
    busy=true;G.phase='sending';$('pAns').textContent='出題中…';$('pClk').textContent='';
    var payload={q:nd.q,o:nd.o,s:nd.s,t:sp.title,icon:sp.icon,i:k,br:1,intro:k===1?sp.intro:''};
    rpc('raid_next',{p_room:G.room,p_question:payload,p_answer:{a:nd.best,e:nd.f[nd.best],f:nd.f},p_seconds:SET.secs,p_hp_per:1}).then(function(h){
      busy=false;if(!h)throw new Error('next');G.phase='question';G.seats=h.seats||G.seats;drawLive(0,h.left);
    }).catch(function(){busy=false;G.phase='err';$('pAns').innerHTML='出題失敗，請確認網路。';$('pRes').className='res';$('pRes').hidden=false;$('pRes').innerHTML='<button type="button" class="bigbtn" id="bRetry">再試一次</button>'});
  }
}
function drawLive(n,left){
  var tot=G.seats.length;$('pAns').textContent='已作答 '+(n||0)+' / '+tot+' 人';
  $('pClk').textContent=SET.secs>0&&left!=null?'⏱ '+left+' 秒':'';
}
function paintVotes(){
  var tot=G.votes.reduce(function(a,b){return a+b},0);
  [].forEach.call($('pOpts').children,function(el,i){el.querySelector('.n').textContent=G.votes[i]+(G.room&&G.rev?' 人':'');el.querySelector('.bar').style.width=(G.rev&&tot?G.votes[i]/tot*100:0)+'%'});
  $('pCount').textContent='共 '+tot+' 票';
}
$('pOpts').addEventListener('click',function(e){var b=e.target.closest('button[data-d]');if(!b||G.rev||G.room)return;
  var i=+b.closest('.o').dataset.i;G.votes[i]=Math.max(0,G.votes[i]+(+b.dataset.d));paintVotes()});
$('bClr').addEventListener('click',function(){G.votes=G.votes.map(function(){return 0});paintVotes()});
function sayNow(){if(G)SAY(nodeText(G.sp.nodes[G.node]))}
$('bSay').addEventListener('click',sayNow);$('bSay2').addEventListener('click',sayNow);
$('bStop').addEventListener('click',function(){reveal()});
$('bReveal').addEventListener('click',function(){showResult()});
function reveal(){
  if(!G||G.phase!=='question'||busy)return;busy=true;G.phase='revealing';
  rpc('raid_reveal',{p_room:G.room}).then(function(r){busy=false;if(!r){G.phase='question';return}
    var dist=r.dist||{};G.votes=G.votes.map(function(_,i){return dist[String(i)]||0});G.phase='reveal';showResult();
  }).catch(function(){busy=false;G.phase='question'});
}
function showResult(){
  var nd=G.sp.nodes[G.node],tot=G.votes.reduce(function(a,b){return a+b},0);
  G.rev=true;$('pOpts').classList.add('rev');$('pLive').hidden=true;$('pCtl').hidden=true;$('pCtl2').hidden=true;paintVotes();
  var mx=Math.max.apply(null,G.votes),top=[];G.votes.forEach(function(v,i){if(v===mx)top.push(i)});
  [].forEach.call($('pOpts').children,function(el,i){var b=[];if(i===nd.best){el.classList.add('best');b.push('🌟 最好的做法')}
    if(tot&&top.length===1&&i===top[0]){el.classList.add('win');b.push('👑 票數最多，故事往這裡走')}
    el.querySelector('.badge').textContent=b.join('　')});
  var h,choices=tot?top:nd.o.map(function(_,i){return i});
  if(!tot)h='<b>沒有人投票。</b>請老師決定這一次要走哪一條路：';
  else if(top.length>1)h='<b>平手！</b>'+top.map(function(i){return L[i]}).join('、')+' 都是 '+mx+' 票。可以請選這幾個做法的同學說說理由，再由老師決定走哪一條路：';
  else{var w=top[0];h='<b>'+L[w]+' 得到最多票（'+mx+' / '+tot+' 票）。</b>'+(w===nd.best?'全班選到了最好的做法！請一位同學說說看：為什麼這樣做比較好？':'不過最好的做法是 '+L[nd.best]+'。請選 '+L[w]+' 的同學說說看為什麼這樣選，再看看故事會怎麼發展。')}
  h+=choices.length>1?'<div class="tie">'+choices.map(function(i){return '<button type="button" class="sec" data-go="'+i+'">走 '+L[i]+' →</button>'}).join('')+'</div><div class="row"><button type="button" class="sec" id="bRe">重新投票</button></div>'
    :'<div class="row"><button type="button" class="bigbtn" data-go="'+choices[0]+'">照多數票走 →</button><button type="button" class="sec" id="bRe">重新投票</button></div>';
  $('pRes').className='res';$('pRes').innerHTML=h;$('pRes').hidden=false;
}
$('pRes').addEventListener('click',function(e){
  if(busy)return;
  if(e.target.id==='bRe'||e.target.id==='bRetry')return enter();
  var b=e.target.closest('[data-go]');if(!b)return;
  var nd=G.sp.nodes[G.node],i=+b.dataset.go;
  G.path.push({node:G.node,pick:i,votes:G.votes.slice(),tot:G.votes.reduce(function(a,c){return a+c},0)});
  var nx=nd.go[i];if(G.sp.nodes[nx]){G.node=nx;enter()}else finish(nx);
});
$('bBack').addEventListener('click',function(){if(!G.path.length)return;G.node=G.path.pop().node;enter()});

/* ---------- 結局 ---------- */
function finish(eid){
  var sp=G.sp,e=sp.ends[eid];SAY('');
  var g=got[sp.id]||(got[sp.id]=[]);if(g.indexOf(eid)<0){g.push(eid);save('fcStoryGot',got)}
  var ending={id:eid,sid:sp.id,st:sp.title,type:e.type,icon:e.icon,title:e.title,path:G.path.map(function(p){var nd=sp.nodes[p.node];return {q:nd.q,pick:L[p.pick],ok:p.pick===nd.best,n:p.votes[p.pick],tot:p.tot}})};
  var rec='';
  if(G.room){stopPoll();G.phase='end';var rm=G.room;
    (G.norec?Promise.resolve():rpc('raid_story_end',{p_room:rm,p_end:ending}).catch(function(){}))
      .then(function(){return rpc('raid_finish',{p_room:rm,p_result:G.norec?'norec':'win'})}).catch(function(){});
    rec=G.norec?'這場不記錄作答。':'每位同學的作答和全班走到的結局，已經記到老師後台的「🎮 遊戲作答統計」。';
  }else if(!G.norec&&window.CLS&&window.CLS.isTeacher){
    var ok=ending.path.filter(function(x){return x.ok}).length;
    window.CLS.api('rest/v1/game_results',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({game:(D.game||('fc-'+GR))+'-story',title:NAME()+'（舉手計票）',class_name:G.cls||null,seat:null,session:'hand:'+Date.now(),
      data:{mode:'hand',story:sp.id,ending:ending,right:ok,total:ending.path.length,items:ending.path.map(function(x){return {q:x.q,ok:x.ok}})}})}).catch(function(){});
    rec='全班走到的結局已經記到老師後台的「結局紀錄」（舉手計票不記錄個人作答）。';
  }
  var left=Object.keys(sp.ends).length-g.length,hasGood=g.some(function(k){return sp.ends[k].type==='good'});
  $('h1').textContent=sp.icon+' '+sp.title+'・結局';
  $('scrEnd').innerHTML='<div class="big" aria-hidden="true">'+e.icon+'</div><span class="kind k-'+e.type+'">'+KIND[e.type]+'</span><h2>'+esc(e.title)+'</h2><p class="txt">'+esc(e.text)+'</p><div class="tip">💡 '+esc(e.tip)+'</div>'+
    '<div class="dots">'+dots(sp)+'</div><p class="note">'+(left?'還有 '+left+' 個結局沒看過'+(hasGood?'。':'，再試一次，看能不能走到 🌈 好結局！'):'這個故事的結局全部看過了！')+'</p>'+
    '<h3 style="margin:.4rem 0 0;color:var(--pur)">📖 這次全班走的路</h3><div class="sum">'+G.path.map(function(p,k){var nd=sp.nodes[p.node],ok=p.pick===nd.best;
      return '<div class="it"><b>第 '+(k+1)+' 次</b>　'+esc(nd.q)+'（'+p.votes[p.pick]+' / '+p.tot+' 票）<br>全班選：'+(ok?'<span class="g">🌟 ':'<em>')+L[p.pick]+'. '+esc(nd.o[p.pick])+(ok?'</span>':'</em>')+(ok?'':'<br><span class="g">🌟 最好的做法：'+L[nd.best]+'. '+esc(nd.o[nd.best])+'</span>')+'</div>'}).join('')+'</div>'+
    (rec?'<p class="note">'+rec+'</p>':'')+
    '<div class="row" style="justify-content:center">'+(G.room?'':'<button type="button" class="sec" id="eBack">↩ 回到最後一次選擇</button>')+'<button type="button" class="bigbtn" id="eAgain">'+(G.room?'再開一場':'從頭再玩一次')+'</button><button type="button" class="sec" id="eHome">換一個故事</button></div>';
  show('scrEnd');SAY(e.title+'。'+e.text);
  if($('eBack'))$('eBack').onclick=function(){G.node=G.path.pop().node;enter()};
  $('eAgain').onclick=function(){if(G.room){G=null;paintSetup();show('scrSetup');$('bCreate').click()}else{G={room:null,sp:sp,path:[],node:sp.start,norec:G.norec,cls:G.cls};enter()}};
  $('eHome').onclick=function(){G=null;paintSetup();show('scrSetup')};
}

/* ---------- 視窗 ---------- */
function paintMap(){
  $('mT').textContent='📋 完整劇本・'+D.label;
  $('mapBody').innerHTML=D.list.map(function(sp){
    var ids=Object.keys(sp.nodes),name=function(id){return sp.nodes[id]?'第 '+(ids.indexOf(id)+1)+' 頁':sp.ends[id].icon+' '+sp.ends[id].title};
    return '<h3>'+sp.icon+' '+esc(sp.title)+'（'+(UNIT?'重點：':'對應：')+esc(sp.from)+'）</h3><p class="note" style="margin:0">'+esc(sp.intro)+'</p>'+
      ids.map(function(id,k){var nd=sp.nodes[id];return '<div class="nd"><p><b>第 '+(k+1)+' 頁</b>　'+esc(nd.s)+'</p><p><b>'+esc(nd.q)+'</b></p><ol type="A">'+nd.o.map(function(t,i){return '<li>'+(i===nd.best?'<span class="star">🌟 '+esc(t)+'</span>':esc(t))+'　<span class="go">→ '+esc(name(nd.go[i]))+'</span><br><small style="color:#4A5550">'+esc(nd.f[i])+'</small></li>'}).join('')+'</ol></div>'}).join('')+
      '<p style="margin:.4rem 0">'+Object.keys(sp.ends).map(function(k){var e=sp.ends[k];return '<span class="ed k-'+e.type+'">'+e.icon+' '+esc(e.title)+'</span>'}).join('')+'</p>'}).join('');
}
function dialog(btn,id,before){var d=$(id),last=null;
  function close(){d.hidden=true;if(last)last.focus()}
  $(btn).addEventListener('click',function(){last=document.activeElement;if(before)before();d.hidden=false;d.querySelector('.close').focus()});
  d.querySelector('.close').addEventListener('click',close);d.addEventListener('click',function(e){if(e.target===d)close()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!d.hidden)close()})}
dialog('bMap','dMap',paintMap);dialog('bTeach','dTeach');
$('bFs').addEventListener('click',function(){try{var d=document.documentElement;if(document.fullscreenElement)document.exitFullscreen();else d.requestFullscreen()}catch(e){}});
})();
