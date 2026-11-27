/* 老師後台（teacher.html）的程式：前半是學生作品／作業繳交，後半是遊戲作答統計與班級名單。 2026-11-24 從頁面裡移出來，方便維護。 */
(function(){
var $=function(id){return document.getElementById(id)};
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function J(r){if(!r.ok)return r.text().then(function(t){var e=new Error(t||('HTTP '+r.status));e.status=r.status;throw e});return r.text().then(function(t){return t?JSON.parse(t):null})}
var SITE=location.href.replace(/teacher\.html.*$/,'');
var A=[], counts={}, cur=null, subs=[], cls='', seen={}, timer=null;

/* ---------- 登入 ---------- */
function gate(){
  var ok=CLS.user&&CLS.isTeacher;
  $('login').hidden=!!ok; $('app').hidden=!ok; $('outBtn').hidden=!CLS.user;
  if(CLS.user&&!CLS.isTeacher){$('lgMsg').textContent='這個帳號不是老師帳號。';$('login').hidden=false;}
  if(ok){loadAsg();if(window.GS)GS.init();}
}
$('login').addEventListener('submit',function(e){
  e.preventDefault(); $('lgGo').disabled=true; $('lgMsg').textContent='登入中…';
  CLS.login($('em').value,$('pw').value).then(function(){$('pw').value='';$('lgMsg').textContent='';gate();})
    .catch(function(err){$('lgMsg').textContent=err.message&&!/fetch/i.test(err.message)?err.message:'連不上伺服器，請確認網路';})
    .then(function(){$('lgGo').disabled=false;});
});
$('outBtn').addEventListener('click',function(){CLS.logout();location.reload();});

/* ---------- 作業清單 ---------- */
function loadAsg(){
  return Promise.all([
    CLS.api('rest/v1/assignments?select=*&order=created_at.asc').then(J),
    CLS.api('rest/v1/submissions?select=assignment_id,class_name').then(J)
  ]).then(function(r){
    A=r[0]||[]; counts={};
    (r[1]||[]).forEach(function(s){var c=counts[s.assignment_id]=counts[s.assignment_id]||{all:0};c.all++;c[s.class_name]=(c[s.class_name]||0)+1;});
    drawAsg();
  }).catch(function(e){$('asg').innerHTML='<div class="card msg err">讀取失敗（'+esc(e.status||'')+'），請重新整理或重新登入。</div>';});
}
function patchAsg(a,data){
  data.updated_at=new Date().toISOString();
  return CLS.api('rest/v1/assignments?id=eq.'+encodeURIComponent(a.id),{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(data)}).then(J)
    .then(function(rows){if(rows&&rows[0]){Object.assign(a,rows[0]);} drawAsg();})
    .catch(function(){alertMsg(a,'儲存失敗，請重新登入後再試');});
}
function alertMsg(a,t){var m=document.querySelector('[data-msg="'+a.id+'"]');if(m){m.className='msg err';m.textContent=t;}}
function drawAsg(){
  var box=$('asg'); box.innerHTML='';
  if(!A.length){box.innerHTML='<div class="card empty">還沒有可以繳交的作業。</div>';return;}
  A.forEach(function(a){
    var c=counts[a.id]||{all:0}, url=SITE+a.lesson_url+'?stu=1'+((a.classes||[]).length===1?'&c='+encodeURIComponent(a.classes[0]):'')+'#send';
    var d=document.createElement('div'); d.className='card a-card';
    d.innerHTML='<div><h2></h2><div class="meta"></div>'+
      '<div class="a-row"><label class="sw"><input type="checkbox" class="open"><span class="ot"></span></label></div>'+
      '<div class="a-row"><b>班級：</b><span class="cls"></span><span class="addcls"><input placeholder="例如：四年三班" maxlength="20" aria-label="新增班級"><button class="b sm" type="button">＋ 新增</button></span></div>'+
      '<div class="a-row"><label class="fld" style="display:flex;align-items:center;gap:8px;font-weight:700">座號到<select class="seats" style="width:auto;min-height:40px"></select>號</label></div>'+
      '<div class="a-row"><button class="b pri see" type="button"></button><a class="b sm" target="_blank" rel="noopener">打開教材 ↗</a></div>'+
      '<div class="msg" data-msg="'+esc(a.id)+'"></div></div>'+
      '<div class="qrbox"><div class="qr"></div><b>學生掃這裡</b><small></small></div>';
    d.querySelector('h2').textContent=a.title;
    d.querySelector('.meta').textContent='已收到 '+c.all+' 件作品';
    var op=d.querySelector('.open'); op.checked=a.open; d.querySelector('.ot').textContent=a.open?'開放繳交中（學生現在可以交）':'未開放繳交';
    op.addEventListener('change',function(){
      if(op.checked&&!(a.classes||[]).length){op.checked=false;alertMsg(a,'請先新增班級，再開放繳交。');return;}
      patchAsg(a,{open:op.checked});
    });
    var cs=d.querySelector('.cls');
    (a.classes||[]).forEach(function(k){
      var ch=document.createElement('span');ch.className='chipc';ch.innerHTML='<span></span><button type="button" aria-label="移除班級">×</button>';
      ch.firstChild.textContent=k+'（'+(c[k]||0)+'）';
      ch.lastChild.addEventListener('click',function(){
        if(c[k]){ if(!ch.dataset.armed){ch.dataset.armed=1;ch.firstChild.textContent='再按 × 移除（作品不會刪除）';return;} }
        patchAsg(a,{classes:a.classes.filter(function(x){return x!==k})});
      });
      cs.appendChild(ch);
    });
    var ai=d.querySelector('.addcls input'), ab=d.querySelector('.addcls button');
    function add(){var v=ai.value.trim();if(!v)return;if((a.classes||[]).indexOf(v)>=0){ai.value='';return;}patchAsg(a,{classes:(a.classes||[]).concat([v])});}
    ab.addEventListener('click',add); ai.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();add();}});
    var se=d.querySelector('.seats'); for(var i=10;i<=40;i++){var o=document.createElement('option');o.value=i;o.textContent=i;se.appendChild(o);} se.value=a.seats;
    se.addEventListener('change',function(){patchAsg(a,{seats:+se.value});});
    var see=d.querySelector('.see'); see.textContent='看作品（'+c.all+'）'; see.addEventListener('click',function(){openView(a);});
    var lk=d.querySelector('a.b'); lk.href=a.lesson_url;
    d.querySelector('.qrbox small').textContent=url.replace(/^https?:\/\//,'');
    try{var q=qrcode(0,'M');q.addData(url);q.make();d.querySelector('.qr').innerHTML=q.createSvgTag({cellSize:6,margin:1,scalable:true});}catch(e){}
    box.appendChild(d);
  });
}

/* ---------- 作品 ---------- */
function openView(a){cur=a;cls='';seen={};$('view').hidden=false;$('vTitle').textContent=a.title;loadSubs(true).then(function(){$('view').scrollIntoView({behavior:'smooth'});});poll();}
$('closeView').addEventListener('click',function(){cur=null;$('view').hidden=true;clearTimeout(timer);loadAsg();});
function poll(){clearTimeout(timer);timer=setTimeout(function(){if(cur&&!document.hidden&&$('show').hidden)loadSubs(false).then(poll,poll);else poll();},8000);}
function loadSubs(first){
  return CLS.api('rest/v1/submissions?select=*&assignment_id=eq.'+encodeURIComponent(cur.id)+'&order=class_name.asc,seat.asc').then(J).then(function(rows){
    var fresh={}; rows.forEach(function(r){var k=r.id+'@'+r.updated_at; if(!first&&!seen[k])fresh[r.id]=1; seen[k]=1;});
    subs=rows; drawView(fresh);
  }).catch(function(){});
}
function list(){return subs.filter(function(s){return !cls||s.class_name===cls});}
function svgSrc(svg){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg||'');}
function drawView(fresh){
  var classes=(cur.classes||[]).slice(); subs.forEach(function(s){if(classes.indexOf(s.class_name)<0)classes.push(s.class_name)});
  if(cls&&classes.indexOf(cls)<0)cls='';
  if(!cls&&classes.length===1)cls=classes[0];
  var t=$('tabs'); t.innerHTML='';
  [''].concat(classes).forEach(function(k){var b=document.createElement('button');b.className='b sm';b.type='button';b.textContent=k||'全部班級';b.setAttribute('aria-pressed',k===cls?'true':'false');b.addEventListener('click',function(){cls=k;drawView({});});t.appendChild(b);});
  var L=list(), st=$('stat');
  if(cls){
    var have={}; L.forEach(function(s){have[s.seat]=1}); var miss=[]; for(var i=1;i<=cur.seats;i++)if(!have[i])miss.push(i);
    st.innerHTML='<span class="big">'+L.length+' / '+cur.seats+'</span><span>已交</span><div class="missing"><b>還沒交：</b>'+(miss.length?miss.map(function(n){return '<span>'+n+'</span>'}).join(''):'<b style="color:var(--leaf)">全部都交了！</b>')+'</div>';
  } else st.innerHTML='<span class="big">'+L.length+'</span><span>件作品（選一個班級可以看還沒交的座號）</span>';
  var g=$('grid'); g.innerHTML='';
  if(!L.length){g.innerHTML='<div class="card empty">還沒有作品。打開「開放繳交」，請學生用平板掃 QR Code 繳交。</div>';return;}
  L.forEach(function(s,idx){
    var d=s.data||{}, w=document.createElement('article'); w.className='w'+(s.star?' star':'')+(fresh[s.id]?' new':'');
    w.innerHTML=(d.svg?'<button class="img" type="button" aria-label="放大展示"><img alt=""></button>':'')+
      '<div class="body"><div class="who"></div><ul class="lines"></ul><div class="counts"></div></div>'+
      '<div class="acts"><button class="b sm st" type="button"></button>'+(d.svg?'<a class="b sm dl">下載</a>':'')+'<button class="b sm del" type="button">刪除</button></div>';
    w.querySelector('.who').textContent=(cls?'':s.class_name+' ')+s.seat+' 號'+(s.star?' ⭐':'');
    if(d.svg){w.querySelector('img').src=svgSrc(d.svg);w.querySelector('.img').addEventListener('click',function(){openShow(idx);});
      var dl=w.querySelector('.dl');dl.href=svgSrc(d.svg);dl.setAttribute('download',cur.title+'-'+s.class_name+'-'+s.seat+'號.svg');}
    var ul=w.querySelector('.lines'); (d.lines||[]).forEach(function(l){var li=document.createElement('li');li.textContent=l;ul.appendChild(li);});
    if(d.text){var li=document.createElement('li');li.textContent=d.text;ul.appendChild(li);}
    var t=new Date(s.updated_at), tt=isNaN(t)?'':(t.getMonth()+1)+'/'+t.getDate()+' '+String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0'); w.querySelector('.counts').textContent=tt+(s.times>1?(tt?'・':'')+'交了 '+s.times+' 次':'');
    var sb=w.querySelector('.st'); sb.textContent=s.star?'取消精選':'⭐ 精選';
    sb.addEventListener('click',function(){CLS.api('rest/v1/submissions?id=eq.'+s.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({star:!s.star})}).then(J).then(function(){s.star=!s.star;drawView({});});});
    var del=w.querySelector('.del');
    del.addEventListener('click',function(){
      if(!del.classList.contains('armed')){del.classList.add('armed');del.textContent='再按一次刪除';setTimeout(function(){del.classList.remove('armed');del.textContent='刪除';},4000);return;}
      CLS.api('rest/v1/submissions?id=eq.'+s.id,{method:'DELETE'}).then(J).then(function(){subs=subs.filter(function(x){return x.id!==s.id});drawView({});});
    });
    g.appendChild(w);
  });
}

/* ---------- 全螢幕展示 ---------- */
var si=0;
function showList(){return list().filter(function(s){return s.data&&s.data.svg&&(!$('shStar').checked||s.star)});}
function openShow(idx){var L=list(), target=L[idx]; var S=showList(); si=Math.max(0,target?S.indexOf(target):0); $('show').hidden=false; drawShow();
  try{document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen().catch(function(){});}catch(e){} }
function drawShow(){
  var S=showList();
  if(!S.length){$('shWho').textContent=$('shStar').checked?'還沒有精選作品':'沒有作品';$('shImg').removeAttribute('src');$('shLines').innerHTML='';$('shCnt').textContent='';$('shPrev').disabled=$('shNext').disabled=true;return;}
  si=Math.max(0,Math.min(S.length-1,si)); var s=S[si], d=s.data||{};
  $('shWho').textContent=s.class_name+' '+s.seat+' 號'+(s.star?' ⭐':'');
  $('shImg').src=svgSrc(d.svg); $('shImg').alt=s.class_name+' '+s.seat+' 號的作品';
  var ul=$('shLines'); ul.innerHTML=''; (d.lines||[]).forEach(function(l){var li=document.createElement('li');li.textContent=l;ul.appendChild(li);});
  $('shCnt').textContent=(si+1)+' / '+S.length; $('shPrev').disabled=si<=0; $('shNext').disabled=si>=S.length-1;
}
$('showBtn').addEventListener('click',function(){openShow(0)});
$('shPrev').addEventListener('click',function(){si--;drawShow();});
$('shNext').addEventListener('click',function(){si++;drawShow();});
$('shStar').addEventListener('change',function(){si=0;drawShow();});
function closeShow(){$('show').hidden=true;try{if(document.fullscreenElement)document.exitFullscreen();}catch(e){}}
$('shClose').addEventListener('click',closeShow);
document.addEventListener('keydown',function(e){if($('show').hidden)return;
  if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' '){e.preventDefault();if(!$('shNext').disabled){si++;drawShow();}}
  else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();if(!$('shPrev').disabled){si--;drawShow();}}
  else if(e.key==='Escape')closeShow();});

window.addEventListener('cls-status',function(){if(CLS.status==='off')gate();});
document.addEventListener('visibilitychange',function(){if(!document.hidden&&cur)loadSubs(false);});
gate();
})();

/* ---------- 🎮 遊戲作答統計、🏫 班級名單 ---------- */
(function(){
var $=function(id){return document.getElementById(id)};
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function J(r){if(!r.ok)return r.text().then(function(t){var e=new Error(t||('HTTP '+r.status));e.status=r.status;throw e});return r.text().then(function(t){return t?JSON.parse(t):null})}
var F={cls:'*',game:'',days:7,view:'stu'}, ROWS=[], CL=[], open={}, inited=false;
var GNAME={'u2-solo':'趕走三惡魔：個人挑戰','u2-raid':'全班共戰：打倒大魔王','u2-demons':'趕走三惡魔（兩隊對戰）','u3-pig':'小豬消防隊','u3-raid':'全班共戰：打倒火災大魔王','u3-demons':'趕走火災三怪（兩隊對戰）','u2-team':'全班共戰：分隊競賽（第二單元）','u3-team':'全班共戰：分隊競賽（第三單元）','u2-story':'情境闖關（第二單元）','u3-story':'情境闖關（第三單元）','fc-low-story':'友善校園情境挑戰（低年級）','fc-mid-story':'友善校園情境挑戰（中年級）','fc-high-story':'友善校園情境挑戰（高年級）','ge-low-story':'性別平等情境挑戰（低年級）','ge-mid-story':'性別平等情境挑戰（中年級）','ge-high-story':'性別平等情境挑戰（高年級）'};
function pct(a,b){return b?Math.round(a/b*100):0}
function bar(p){return '<span class="bar'+(p<70?' low':'')+'"><i style="width:'+p+'%"></i></span><span class="'+(p<70?'pct-low':'')+'">'+p+'%</span>'}
function when(t){var d=new Date(t);return (d.getMonth()+1)+'/'+d.getDate()+' '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)}
function gname(r){return GNAME[r.game]||r.title||r.game}

/* 頁面分頁 */
[].forEach.call(document.querySelectorAll('.ptabs [data-p]'),function(b){b.addEventListener('click',function(){
  [].forEach.call(document.querySelectorAll('.ptabs [data-p]'),function(x){x.setAttribute('aria-pressed',String(x===b));$(x.dataset.p).hidden=x!==b});
  if(b.dataset.p==='pGame')load();if(b.dataset.p==='pCls'){loadCls();loadPin();}
})});

/* 換座號密碼（RPC set_seat_pin／seat_pin_status，只存雜湊） */
function loadPin(){
  CLS.api('rest/v1/rpc/seat_pin_status',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(J).then(function(st){
    $('pinState').innerHTML=st&&st.set?'✅ 已經設定密碼（'+esc(when(st.updated_at))+' 設定）'+(st.recent?'・最近 7 天有 '+st.recent+' 次用密碼換座號':''):'<b style="color:#B3261E">⚠ 還沒有設定密碼：學生選錯座號時沒有辦法換，請先設定。</b>';
  }).catch(function(){$('pinState').textContent='讀取失敗';});
}
$('pinSave').addEventListener('click',function(){
  var a=$('pinNew').value.trim(),b=$('pinNew2').value.trim(),m=$('pinMsg');
  if(!/^[0-9]{4,8}$/.test(a)){m.className='msg err';m.textContent='密碼要是 4～8 位數字。';return;}
  if(a!==b){m.className='msg err';m.textContent='兩次輸入的密碼不一樣。';return;}
  CLS.api('rest/v1/rpc/set_seat_pin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_pin:a})}).then(J).then(function(r){
    if(r==='ok'){m.className='msg ok';m.textContent='已儲存新的換座號密碼。';$('pinNew').value='';$('pinNew2').value='';loadPin();}
    else{m.className='msg err';m.textContent=r==='bad_pin'?'密碼要是 4～8 位數字。':'儲存失敗，請確認是老師帳號。';}
  }).catch(function(){m.className='msg err';m.textContent='儲存失敗，請確認網路。';});
});
function loadCls(){
  return CLS.api('rest/v1/class_list?select=*&order=sort.asc,name.asc').then(J).then(function(l){CL=l||[];drawCls();drawFilters();return CL}).catch(function(){$('clsMsg').className='msg err';$('clsMsg').textContent='班級讀取失敗';});
}
function seatSel(v){var h='';for(var i=1;i<=40;i++)h+='<option value="'+i+'"'+(i===v?' selected':'')+'>'+i+' 號</option>';return h}
function drawCls(){
  var box=$('clsList');box.innerHTML=CL.length?'':'<p class="counts">還沒有班級。</p>';
  CL.forEach(function(c){
    var d=document.createElement('div');d.className='cls-row';
    d.innerHTML='<b></b><label>座號到 <select aria-label="座號數">'+seatSel(c.seats)+'</select></label><label class="av'+(c.avatar?' on':'')+'"><input type="checkbox"'+(c.avatar?' checked':'')+'>🧙 建立人物</label><button class="b sm del" type="button">刪除</button>';
    d.querySelector('b').textContent=c.name;
    var avc=d.querySelector('.av input');avc.addEventListener('change',function(){var v=avc.checked;
      CLS.api('rest/v1/class_list?name=eq.'+encodeURIComponent(c.name),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({avatar:v})}).then(J).then(function(){c.avatar=v;avc.parentNode.classList.toggle('on',v);$('clsMsg').className='msg ok';$('clsMsg').textContent=c.name+(v?'：學生選座號時會先建立人物':'：不會出現建立人物')}).catch(function(){avc.checked=!v;$('clsMsg').className='msg err';$('clsMsg').textContent='儲存失敗';});});
    d.querySelector('select').addEventListener('change',function(e){CLS.api('rest/v1/class_list?name=eq.'+encodeURIComponent(c.name),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({seats:+e.target.value})}).then(J).then(function(){c.seats=+e.target.value;$('clsMsg').className='msg ok';$('clsMsg').textContent='已儲存';}).catch(function(){$('clsMsg').className='msg err';$('clsMsg').textContent='儲存失敗';});});
    var del=d.querySelector('.del');del.addEventListener('click',function(){
      if(!del.classList.contains('armed')){del.classList.add('armed');del.textContent='再按一次刪除';setTimeout(function(){del.classList.remove('armed');del.textContent='刪除';},4000);return;}
      CLS.api('rest/v1/class_list?name=eq.'+encodeURIComponent(c.name),{method:'DELETE'}).then(J).then(loadCls);});
    box.appendChild(d);
  });
}
$('clsNewSeats').innerHTML=seatSel(25);
$('clsAdd').addEventListener('click',function(){var n=$('clsNew').value.trim();if(!n)return;
  CLS.api('rest/v1/class_list',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,seats:+$('clsNewSeats').value,sort:CL.length})}).then(J).then(function(){$('clsNew').value='';$('clsMsg').className='msg ok';$('clsMsg').textContent='已新增「'+n+'」';loadCls();})
    .catch(function(e){$('clsMsg').className='msg err';$('clsMsg').textContent=/duplicate|23505/.test(e.message)?'已經有這個班級了':'新增失敗';});});

function drawFilters(){
  var cb=$('gsCls');cb.innerHTML='';
  var extra={};(ROWS||[]).forEach(function(r){if(r.class_name&&!CL.some(function(c){return c.name===r.class_name}))extra[r.class_name]=1});
  [['*','全部班級']].concat(CL.map(function(c){return [c.name,c.name]})).concat(Object.keys(extra).sort().map(function(n){return [n,n+'（其他）']})).concat([['-','未指定班級']]).forEach(function(x){
    var b=document.createElement('button');b.className='b sm';b.type='button';b.textContent=x[1];b.setAttribute('aria-pressed',String(F.cls===x[0]));
    b.addEventListener('click',function(){F.cls=x[0];open={};drawFilters();draw();});cb.appendChild(b);});
  var db=$('gsDays');db.innerHTML='';
  [[1,'今天'],[7,'7 天'],[30,'30 天'],[0,'全部']].forEach(function(x){
    var b=document.createElement('button');b.className='b sm';b.type='button';b.textContent=x[1];b.setAttribute('aria-pressed',String(F.days===x[0]));
    b.addEventListener('click',function(){F.days=x[0];drawFilters();load();});db.appendChild(b);});
}
function load(){
  if(!CL.length)loadCls();
  var q='rest/v1/game_results?select=id,game,title,class_name,seat,session,data,created_at&order=created_at.desc&limit=3000';
  if(F.days){var d=new Date();if(F.days===1)d.setHours(0,0,0,0);else d=new Date(Date.now()-F.days*864e5);q+='&created_at=gte.'+encodeURIComponent(d.toISOString());}
  $('gsBody').innerHTML='<p class="counts">讀取中…</p>';
  return CLS.api(q).then(J).then(function(r){ROWS=r||[];drawFilters();drawGames();draw();}).catch(function(e){$('gsBody').innerHTML='<div class="card msg err">讀取失敗（'+esc(e.status||'')+'），請重新整理或重新登入。</div>';});
}
function drawGames(){
  var seen={},opts=[['','全部遊戲']];ROWS.forEach(function(r){if(!seen[r.game]){seen[r.game]=1;opts.push([r.game,gname(r)])}});
  if(F.game&&!seen[F.game])opts.push([F.game,GNAME[F.game]||F.game]);
  $('gsGame').innerHTML=opts.map(function(o){return '<option value="'+esc(o[0])+'"'+(o[0]===F.game?' selected':'')+'>'+esc(o[1])+'</option>'}).join('');
}
$('gsGame').addEventListener('change',function(e){F.game=e.target.value;open={};draw();});
$('gsReload').addEventListener('click',load);
[].forEach.call(document.querySelectorAll('#gsView [data-v]'),function(b){b.addEventListener('click',function(){F.view=b.dataset.v;[].forEach.call(document.querySelectorAll('#gsView [data-v]'),function(x){x.setAttribute('aria-pressed',String(x===b))});draw();})});
function rows(){return ROWS.filter(function(r){
  if(F.game&&r.game!==F.game)return false;
  if(F.cls==='-')return !r.class_name; if(F.cls!=='*')return r.class_name===F.cls; return true;})}
function who(r){return r.seat?(r.class_name?r.class_name+' ':'')+r.seat+' 號':(r.class_name?r.class_name+' ':'')+'大螢幕'}
function score(r){var d=r.data||{};return (d.right!=null&&d.total!=null)?d.right+' / '+d.total:''}
function extra(r){var d=r.data||{},t=[];if(d.stars!=null)t.push('★'.repeat(d.stars)+'☆'.repeat(Math.max(0,3-d.stars)));
  if(d.win===true)t.push('過關');if(d.win===false)t.push('沒過關');if(d.result==='win')t.push('打倒魔王');if(d.result==='lose')t.push('魔王逃走');if(d.dmg!=null)t.push('傷害 '+d.dmg);
  if(d.score)t.push((d.teams||['紅隊','藍隊'])[0]+' '+d.score[0]+'：'+d.score[1]+' '+(d.teams||['',''])[1]);return t.join('・')}
function draw(){
  var L=rows(),sumR=0,sumT=0,stus={};
  L.forEach(function(r){var d=r.data||{};sumR+=+d.right||0;sumT+=+d.total||0;if(r.seat)stus[(r.class_name||'')+'#'+r.seat]=1;});
  $('gsSum').innerHTML='<div><b>'+L.length+'</b><span>筆紀錄</span></div><div><b>'+Object.keys(stus).length+'</b><span>位學生</span></div><div><b>'+sumT+'</b><span>題作答</span></div><div><b>'+pct(sumR,sumT)+'%</b><span>第一次就答對</span></div>';
  if(!L.length){$('gsBody').innerHTML='<div class="card empty">這個範圍還沒有紀錄。請學生用 QR Code 打開遊戲、選好座號後開始玩。</div>';return;}
  ({stu:drawStu,wrong:drawWrong,q:drawQ,log:drawLog,end:drawEnd})[F.view](L);
}
function wrongList(rs,n){var m={};rs.forEach(function(r){((r.data||{}).items||[]).forEach(function(it){if(it&&it.q&&!it.ok){m[it.q]=(m[it.q]||0)+1}})});
  return Object.keys(m).sort(function(a,b){return m[b]-m[a]}).slice(0,n).map(function(q){return {q:q,n:m[q]}})}
/* 需要幫忙的學生：第一次就答對比率低於門檻、最近一次比平均低 20 個百分點以上、或同一題錯 3 次以上且答對率低於門檻＋15（情境闖關不列入；至少作答 10 題才判斷） */
var HELP_T=(function(){try{var v=+localStorage.getItem('gsHelp');return [50,60,70].indexOf(v)>=0?v:60}catch(e){return 60}})();
function helpList(by){
  var out=[];
  Object.keys(by).forEach(function(k){var g=by[k],rs=g.rs.filter(function(r){return !/-story$/.test(r.game)}),R=0,T=0;
    rs.forEach(function(r){R+=+(r.data||{}).right||0;T+=+(r.data||{}).total||0});
    if(T<10)return;var p=Math.round(R*100/T),why=[];
    if(p<HELP_T)why.push('第一次就答對只有 '+p+'%');
    var last=rs[0],ld=last&&last.data||{};
    if(rs.length>1&&+ld.total>=5){var lp=Math.round((+ld.right||0)*100/ld.total);if(lp<=p-20)why.push('最近一次退步（'+lp+'%）')}
    var w=wrongList(rs,3).filter(function(x){return x.n>=3});if(w.length&&p<HELP_T+15)why.push('同一題錯 3 次以上');
    if(why.length)out.push({k:k,g:g,p:p,why:why,w:wrongList(rs,2)});
  });
  return out.sort(function(a,b){return a.p-b.p});
}
function helpHtml(by){
  var list=helpList(by);
  return '<div class="help"><h3>🆘 需要幫忙的學生<span class="seg2" role="group" aria-label="門檻">第一次就答對低於'+[50,60,70].map(function(v){return '<button type="button" data-help="'+v+'" aria-pressed="'+(v===HELP_T)+'">'+v+'%</button>'}).join('')+'</span></h3>'+
    (list.length?'<ul>'+list.map(function(x){return '<li data-k="'+esc(x.k)+'"><b class="s">'+esc((F.cls==='*'&&x.g.cls?x.g.cls+' ':'')+x.g.seat+' 號')+'</b><span class="why">'+x.why.map(function(t){return '<span>'+esc(t)+'</span>'}).join('')+'</span>'+
      (x.w.length?'<small>常錯：'+x.w.map(function(y){return esc(y.q)}).join('；')+'</small>':'')+'</li>'}).join('')+'</ul><p class="counts" style="margin:6px 0 0">點一位學生，可以在下面的表格看他每一次的錯題。至少作答 10 題才判斷；情境闖關不列入。</p>'
     :'<p class="ok" style="margin:0">目前沒有需要特別注意的學生（作答 10 題以上的學生，第一次就答對都有 '+HELP_T+'% 以上）。</p>')+'</div>';
}
function drawStu(L){
  var by={};L.filter(function(r){return r.seat}).forEach(function(r){var k=(r.class_name||'')+'#'+r.seat;(by[k]=by[k]||{cls:r.class_name,seat:r.seat,rs:[]}).rs.push(r)});
  var keys=Object.keys(by).sort(function(a,b){var x=by[a],y=by[b];return (x.cls||'').localeCompare(y.cls||'')||x.seat-y.seat});
  var h='';
  if(F.cls!=='*'&&F.cls!=='-'){var c=CL.filter(function(x){return x.name===F.cls})[0];if(c){var miss=[];for(var i=1;i<=c.seats;i++)if(!by[F.cls+'#'+i])miss.push(i);
    h+='<div class="stat"><span class="big">'+(c.seats-miss.length)+' / '+c.seats+'</span><span>位有紀錄</span><div class="missing"><b>還沒有紀錄：</b>'+(miss.length?miss.map(function(n){return '<span>'+n+'</span>'}).join(''):'<b style="color:var(--leaf)">全班都有！</b>')+'</div></div>';}}
  h+=helpHtml(by);
  h+='<div class="tblw"><table class="tbl"><thead><tr><th>座號</th><th>玩了幾次</th><th>第一次就答對</th><th>最近一次</th><th>最常錯的題目</th></tr></thead><tbody>';
  keys.forEach(function(k){var g=by[k],R=0,T=0;g.rs.forEach(function(r){R+=+(r.data||{}).right||0;T+=+(r.data||{}).total||0});var last=g.rs[0],w=wrongList(g.rs,2);
    h+='<tr class="click" data-k="'+esc(k)+'"><td><b>'+esc((F.cls==='*'&&g.cls?g.cls+' ':'')+g.seat+' 號')+'</b></td><td class="num">'+g.rs.length+'</td><td class="num">'+bar(pct(R,T))+' <small>('+R+'/'+T+')</small></td><td>'+esc(gname(last))+'<br><small>'+esc(when(last.created_at))+'・'+esc(score(last))+(extra(last)?'・'+esc(extra(last)):'')+'</small></td><td><small>'+w.map(function(x){return esc(x.q)+(x.n>1?'（錯 '+x.n+' 次）':'')}).join('<br>')+'</small></td></tr>';
    if(open[k])h+='<tr class="det"><td colspan="5">'+g.rs.map(recHtml).join('')+'</td></tr>';});
  h+='</tbody></table></div>';
  var bs=L.filter(function(r){return !r.seat});if(bs.length)h+='<p class="counts" style="margin-top:10px">另有 '+bs.length+' 筆大螢幕全班遊戲的紀錄，請看「依題目」或「每一筆紀錄」。</p>';
  $('gsBody').innerHTML=h;
  [].forEach.call($('gsBody').querySelectorAll('tr.click'),function(tr){tr.addEventListener('click',function(){var k=tr.dataset.k;open[k]=!open[k];drawStu(L)})});
  [].forEach.call($('gsBody').querySelectorAll('.help li[data-k]'),function(li){li.addEventListener('click',function(){var k=li.dataset.k;open[k]=true;drawStu(L);
    var tr=[].filter.call($('gsBody').querySelectorAll('tr.click'),function(x){return x.dataset.k===k})[0];if(tr)tr.scrollIntoView({behavior:'smooth',block:'center'})})});
  [].forEach.call($('gsBody').querySelectorAll('[data-help]'),function(b){b.addEventListener('click',function(){HELP_T=+b.dataset.help;try{localStorage.setItem('gsHelp',HELP_T)}catch(e){}drawStu(L)})});
}
/* 逐題的「學生的答案」與「正確答案」：items 的 w（答錯時選的，依序）、r（正確答案）；2026-11-20 以前的紀錄可能沒有 */
function ansText(it){
  var w=(it.w||[]).filter(function(x){return x!=null&&x!==''});
  if(it.skip)return '<span class="no">沒有作答</span>'+(it.r?'<span>正確答案：<b class="yes">'+esc(it.r)+'</b></span>':'');
  return (w.length?'<span>選了：<b class="no">'+w.map(esc).join('</b>、<b class="no">')+'</b></span>':(it.r?'<span class="counts">（沒有記錄選了什麼）</span>':''))+
    (it.r?'<span>正確答案：<b class="yes">'+esc(it.r)+'</b></span>':'')+(it.done&&!it.ok?'<span>（第 '+(it.tries||2)+' 次才答對）</span>':'');
}
function recHtml(r){var d=r.data||{},it=(d.items||[]).filter(function(x){return x&&!x.ok});
  return '<div style="padding:6px 0;border-bottom:1px dashed var(--line)"><b>'+esc(when(r.created_at))+'</b>　'+esc(r.title||gname(r))+'　'+esc(score(r))+(extra(r)?'・'+esc(extra(r)):'')+
    (it.length?'<ul class="wrongs">'+it.map(function(x){var a=ansText(x);return '<li>✗ '+esc(x.q)+(a?'<br><span class="ans">'+a+'</span>':(x.tries>1?'（試了 '+x.tries+' 次）':''))+'</li>'}).join('')+'</ul>':'<div class="counts">全部第一次就答對</div>')+'</div>'}
/* 錯題明細：每一題錯題一列（座號、時間、遊戲、題目、學生的答案、正確答案） */
function drawWrong(L){
  var out=[];
  L.forEach(function(r){((r.data||{}).items||[]).forEach(function(it){if(it&&it.q&&!it.ok)out.push({r:r,it:it})})});
  if(!out.length){$('gsBody').innerHTML='<div class="card empty">這個範圍沒有錯題（或這些紀錄沒有逐題資料）。</div>';return;}
  out.sort(function(a,b){var sa=a.r.seat||999,sb=b.r.seat||999;return (a.r.class_name||'').localeCompare(b.r.class_name||'')||sa-sb||(a.r.created_at<b.r.created_at?1:-1)});
  $('gsBody').innerHTML='<p class="counts" style="margin:0 0 8px">共 '+out.length+' 題次答錯。「學生的答案」是答錯時選的選項（各自搶攻可能試了好幾次，依序列出）；11/20 以前的各自搶攻紀錄沒有記下學生選了什麼。</p>'+
    '<div class="tblw"><table class="tbl"><thead><tr><th>誰</th><th>時間</th><th>遊戲</th><th>題目</th><th>學生的答案</th><th>正確答案</th></tr></thead><tbody>'+
    out.slice(0,1500).map(function(x){var it=x.it,w=(it.w||[]).filter(function(v){return v!=null&&v!==''});
      return '<tr><td style="white-space:nowrap">'+esc(who(x.r))+'</td><td class="num">'+esc(when(x.r.created_at))+'</td><td><small>'+esc(x.r.title||gname(x.r))+'</small></td><td>'+esc(it.q)+
        '</td><td class="wa">'+(it.skip?'（沒有作答）':w.length?w.map(esc).join('<br>'):'<span class="counts">—</span>')+(it.done&&!it.ok?'<br><small class="counts">第 '+(it.tries||2)+' 次才答對</small>':'')+
        '</td><td class="ra">'+esc(it.r||'')+'</td></tr>'}).join('')+'</tbody></table></div>'+(out.length>1500?'<p class="counts">只列出前 1500 列，下載 CSV 可以看全部。</p>':'');
}
function drawQ(L){
  var m={};L.forEach(function(r){((r.data||{}).items||[]).forEach(function(it){if(!it||!it.q||it.skip)return;var k=it.q;var o=m[k]=m[k]||{q:k,n:0,ok:0,games:{},w:{},r:''};o.n++;if(it.ok)o.ok++;o.games[gname(r)]=1;if(it.r)o.r=it.r;(it.w||[]).forEach(function(v){if(v)o.w[v]=(o.w[v]||0)+1});})});
  var list=Object.keys(m).map(function(k){return m[k]}).sort(function(a,b){return a.ok/a.n-b.ok/b.n||b.n-a.n});
  if(!list.length){$('gsBody').innerHTML='<div class="card empty">這些紀錄沒有逐題資料。</div>';return;}
  $('gsBody').innerHTML='<div class="tblw"><table class="tbl"><thead><tr><th>題目</th><th>第一次就答對</th><th>作答次數</th><th>正確答案</th><th>常選的錯誤答案</th><th>遊戲</th></tr></thead><tbody>'+
    list.map(function(o){var ws=Object.keys(o.w).sort(function(a,b){return o.w[b]-o.w[a]}).slice(0,3);
      return '<tr><td>'+esc(o.q)+'</td><td class="num">'+bar(pct(o.ok,o.n))+'</td><td class="num">'+o.n+'</td><td class="ra">'+esc(o.r)+'</td><td><div class="wq">'+ws.map(function(v){return '<span>'+esc(v)+' ×'+o.w[v]+'</span>'}).join('')+'</div></td><td><small>'+esc(Object.keys(o.games).join('、'))+'</small></td></tr>'}).join('')+'</tbody></table></div>';
}
/* 結局紀錄：情境挑戰（分支劇情）每一場全班走到的結局。平板投票每個座號各一筆（data.ending 相同，依 session 合併），舉手計票一筆（seat 空白、data.mode='hand'） */
function drawEnd(L){
  var by={},list=[];
  L.forEach(function(r){var d=r.data||{};if(!d.ending||!d.ending.title)return;var k=r.session||('id'+r.id);
    if(!by[k]){by[k]={r:r,e:d.ending,n:0,hand:d.mode==='hand'};list.push(by[k])}if(r.seat)by[k].n++;});
  if(!list.length){$('gsBody').innerHTML='<div class="card empty">這個範圍還沒有結局紀錄。用「情境闖關」或「友善校園情境挑戰」玩到結局（平板投票，或老師登入時的舉手計票），就會記在這裡。</div>';return;}
  var st={};list.forEach(function(x){var k=(x.e.st||'')+'|'+x.r.game.replace(/-story$/,'');(st[k]=st[k]||{t:x.e.st||'',g:gname(x.r).replace(/（舉手計票）$/,''),xs:[]}).xs.push(x)});
  var NM={good:'🌈 好結局',ok:'🌤️ 還可以',bad:'🌧️ 再想想'};
  var h='<p class="counts" style="margin:0 0 10px">每一列是一場：哪一班、什麼時候、全班走到哪個結局，以及每一次選擇全班選了哪個選項（紅色是沒有選到最好的做法）。可以比較不同班級的選擇，也能看同一班重玩有沒有走到更好的結局。</p>';
  Object.keys(st).sort().forEach(function(k){var o=st[k],cnt={good:0,ok:0,bad:0};o.xs.forEach(function(x){cnt[x.e.type]=(cnt[x.e.type]||0)+1});
    o.xs.sort(function(a,b){return (a.r.class_name||'').localeCompare(b.r.class_name||'')||(a.r.created_at<b.r.created_at?-1:1)});
    h+='<div class="card endst"><h3>'+esc(o.t)+' <small class="counts">'+esc(o.g)+'</small></h3><div class="endsum">'+['good','ok','bad'].map(function(t){return '<span>'+NM[t]+' '+(cnt[t]||0)+' 場</span>'}).join('')+'</div>'+
      '<div class="tblw"><table class="tbl"><thead><tr><th>班級</th><th>時間</th><th>方式</th><th>結局</th><th>全班的選擇</th></tr></thead><tbody>'+
      o.xs.map(function(x){var e=x.e;return '<tr><td style="white-space:nowrap">'+esc(x.r.class_name||'未指定')+'</td><td class="num">'+esc(when(x.r.created_at))+'</td><td style="white-space:nowrap">'+(x.hand?'舉手計票':'平板 '+x.n+' 人')+'</td>'+
        '<td><span class="endk '+esc(e.type)+'">'+esc(e.icon||'')+' '+esc(e.title)+'</span></td><td><div class="route">'+(e.path||[]).map(function(p,i){
          return '<span class="'+(p.ok?'':'x')+'" title="'+esc(p.q)+'">'+(i+1)+'. '+esc(p.pick)+(p.tot?' <small>'+esc(p.n)+'/'+esc(p.tot)+'</small>':'')+'</span>'}).join('')+'</div></td></tr>'}).join('')+'</tbody></table></div></div>';
  });
  $('gsBody').innerHTML=h;
}
function drawLog(L){
  $('gsBody').innerHTML='<div class="tblw"><table class="tbl"><thead><tr><th>時間</th><th>遊戲</th><th>誰</th><th>答對</th><th>結果</th><th></th></tr></thead><tbody>'+
    L.slice(0,500).map(function(r){return '<tr data-id="'+r.id+'"><td class="num">'+esc(when(r.created_at))+'</td><td>'+esc(r.title||gname(r))+'</td><td>'+esc(who(r))+'</td><td class="num">'+esc(score(r))+'</td><td><small>'+esc(extra(r))+'</small></td><td><button class="b sm del" type="button">刪除</button></td></tr>'}).join('')+'</tbody></table></div>'+(L.length>500?'<p class="counts">只列出最近 500 筆，下載 CSV 可以看全部。</p>':'');
  [].forEach.call($('gsBody').querySelectorAll('.del'),function(del){del.addEventListener('click',function(){
    var id=+del.closest('tr').dataset.id;
    if(!del.classList.contains('armed')){del.classList.add('armed');del.textContent='再按一次';setTimeout(function(){del.classList.remove('armed');del.textContent='刪除';},4000);return;}
    CLS.api('rest/v1/game_results?id=eq.'+id,{method:'DELETE'}).then(J).then(function(){ROWS=ROWS.filter(function(r){return r.id!==id});draw();});})});
}
$('gsCsv').addEventListener('click',function(){
  var L=rows(),lines=[['時間','遊戲','班級','座號','答對','作答','結果','答錯的題目']];
  L.forEach(function(r){var d=r.data||{};lines.push([new Date(r.created_at).toLocaleString('zh-TW'),r.title||gname(r),r.class_name||'',r.seat||'大螢幕',d.right!=null?d.right:'',d.total!=null?d.total:'',extra(r),(d.items||[]).filter(function(x){return x&&!x.ok}).map(function(x){var w=(x.w||[]).filter(Boolean);return x.q+(w.length||x.r?'（'+(w.length?'選：'+w.join('、'):x.skip?'沒作答':'')+(x.r?(w.length||x.skip?'；':'')+'正確：'+x.r:'')+'）':'')}).join('｜')])});
  var csv='﻿'+lines.map(function(l){return l.map(function(v){v=String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(',')}).join('\r\n');
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='遊戲作答統計.csv';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500);
});
window.GS={init:function(){if(inited)return;inited=true;loadCls();}};
if(window.CLS&&CLS.user&&CLS.isTeacher)GS.init();
})();
