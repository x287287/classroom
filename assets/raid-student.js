/* 全班共戰學生平板頁（raid.html）的程式：選座號、加入房間、同步作答／各自搶攻／分隊競賽／情境闖關的作答畫面、魔王反擊、語音唸題。 2026-11-24 從頁面裡移出來，方便維護。 */
var DM=[
  {k:'smoke',n:'菸惡魔',c:'#9C8CB9',art:function(c){return '<circle cx="50" cy="55" r="34" fill="'+c+'"/><circle cx="28" cy="40" r="18" fill="'+c+'"/><circle cx="72" cy="40" r="18" fill="'+c+'"/><rect x="20" y="10" width="10" height="26" rx="3" fill="#fff" transform="rotate(-20 25 23)"/><rect x="70" y="10" width="10" height="26" rx="3" fill="#fff" transform="rotate(20 75 23)"/><rect x="18" y="6" width="10" height="6" fill="#FF7043" transform="rotate(-20 23 9)"/><rect x="72" y="6" width="10" height="6" fill="#FF7043" transform="rotate(20 77 9)"/><circle cx="40" cy="52" r="6" fill="#fff"/><circle cx="60" cy="52" r="6" fill="#fff"/><circle cx="41" cy="53" r="3" fill="#222"/><circle cx="61" cy="53" r="3" fill="#222"/><path d="M38 72 q12 -8 24 0" stroke="#222" stroke-width="3" fill="none"/>'}},
  {k:'wine',n:'酒惡魔',c:'#D8708A',art:function(c){return '<rect x="38" y="6" width="24" height="22" rx="4" fill="'+c+'"/><path d="M30 28 h40 q8 10 8 22 v34 q0 8 -8 8 h-40 q-8 0 -8 -8 v-34 q0 -12 8 -22z" fill="'+c+'"/><rect x="30" y="56" width="40" height="18" fill="#fff" opacity=".85"/><path d="M26 32 l-10 -14 M74 32 l10 -14" stroke="'+c+'" stroke-width="6" stroke-linecap="round"/><circle cx="42" cy="44" r="5" fill="#fff"/><circle cx="58" cy="44" r="5" fill="#fff"/><circle cx="43" cy="45" r="2.5" fill="#222"/><circle cx="59" cy="45" r="2.5" fill="#222"/><text x="50" y="70" text-anchor="middle" font-size="11" fill="'+c+'">酒</text>'}},
  {k:'betel',n:'檳榔惡魔',c:'#5DAA68',art:function(c){return '<ellipse cx="50" cy="56" rx="30" ry="38" fill="'+c+'"/><path d="M50 18 v-12" stroke="#6D4C41" stroke-width="6"/><path d="M50 10 q-16 -8 -22 4 M50 10 q16 -8 22 4" stroke="#43A047" stroke-width="5" fill="none"/><path d="M24 40 l-12 -8 M76 40 l12 -8" stroke="'+c+'" stroke-width="6" stroke-linecap="round"/><circle cx="40" cy="50" r="6" fill="#fff"/><circle cx="60" cy="50" r="6" fill="#fff"/><circle cx="41" cy="51" r="3" fill="#222"/><circle cx="61" cy="51" r="3" fill="#222"/><path d="M38 70 q12 8 24 0" stroke="#B71C1C" stroke-width="4" fill="#E57373"/>'}}
];
(function(){
  var SB_URL="https://tsxbphngzuzpdddhadfw.supabase.co", SB_KEY="sb_publishable_EOXrx2SRQbFRHACqHbUUig_4e-EkgkE";
  function $(id){return document.getElementById(id)}
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
  function load(k,d){try{var v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}}
  function save(k,v){try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
  function rpc(fn,a){return fetch(SB_URL+"/rest/v1/rpc/"+fn,{method:"POST",headers:{apikey:SB_KEY,"Content-Type":"application/json"},body:JSON.stringify(a),cache:"no-store"}).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json()})}
  var device=load("fbDevice",null);
  if(!device){device="d"+Math.random().toString(36).slice(2,10)+Date.now().toString(36);save("fbDevice",device)}
  var room=(new URLSearchParams(location.search).get("r")||"").replace(/\D/g,"");
  var seat=0, st=null, sig="", timer=null, sending=false;
  var LABEL=["A","B","C","D","E"];

  /* 第三單元的房間（raid_state.game='u3'）換成第三單元的怪物 */
  var game="u2", bossName="大魔王";
  function setGame(g){
    if(!/^u\d+$/.test(g||"")||g===game)return;game=g;
    var sc=document.createElement("script");sc.src="lessons/data/"+g+"-game-questions.js";
    sc.onload=function(){var pk=window.GAME_PACK;if(!pk||!pk.monsters)return;DM=pk.monsters;drawBoss();
      bossName=pk.boss||bossName;setTitle();};
    document.head.appendChild(sc);
  }
  function setTitle(){
    var m=st&&st.mode;
    var t=m==="story"?(/^fc-/.test(st&&st.game||"")?"🧭 友善校園情境挑戰":/^ge-/.test(st&&st.game||"")?"🧭 性別平等情境挑戰":"🧭 情境闖關"):m==="team"?"👥 分隊競賽：打倒"+bossName:"⚔️ 全班共戰：打倒"+bossName;
    if($("h1").textContent!==t){$("h1").textContent=t;document.title=t.replace(/^\S+\s/,"")}
    var hud=document.querySelector(".hud");if(hud)hud.hidden=m==="story";
  }
  function tname(t){return ["","紅隊","藍隊","綠隊","橘隊"][t]||""}
  function dname(k){var d=DM.filter(function(x){return x.k===k})[0];return d?d.n:""}
  function drawBoss(){
  var art=function(i){var d=DM[i];return d?d.art(d.c):""};
  $("miniBoss").innerHTML='<g transform="translate(10 40) scale(1.25)">'+art(0)+'</g><g transform="translate(165 40) scale(1.25)">'+art(2)+'</g><g transform="translate(80 18) scale(1.45)">'+art(1)+'</g><path d="M110 22 h80 l-10 -22 l-15 12 l-15 -18 l-15 18 l-15 -12 z" fill="#FFD54F" stroke="#C79100" stroke-width="3"/>';
  }
  drawBoss();

  function show(id){["sCode","sSeat","sGame"].forEach(function(k){$(k).hidden=(k!==id)})}

  /* 房號 */
  /* 座號鎖定（assets/seatlock.js）：這台平板今天在這個班選過座號，就直接用那個座號；要換要老師輸入密碼 */
  var RCLS="",RMODE="";
  function SL(){return window.SEATLOCK||{get:function(){return 0},set:function(){},unlock:function(){return Promise.resolve(true)}}}
  function goRoom(code){room=code;history.replaceState(null,"","?r="+code);
    rpc("raid_state",{p_room:room,p_seat:0,p_device:device}).catch(function(){return null}).then(function(d){
      RCLS=d&&d.class_name||"";RMODE=d&&d.mode||"";
      seat=+load("raidSeat:"+room,0)||0;
      var lk=SL().get(RCLS);if(lk&&lk!==seat){seat=lk;save("raidSeat:"+room,seat)}
      /* 從課堂房間跟過來的：沿用已經選好的座號（sessionStorage clsSeat） */
      if(!seat){try{var cs=JSON.parse(sessionStorage.getItem("clsSeat")||"null");if(cs&&cs.seat>=1&&cs.seat<=40&&sessionStorage.getItem("clsSess")){seat=cs.seat;save("raidSeat:"+room,seat)}}catch(e){}}
      if(seat)join(seat);else{show("sSeat")}
    });
    poll();if(!timer)timer=setInterval(function(){if(!document.hidden)poll()},1200);}
  $("codeGo").addEventListener("click",function(){var c=$("codeIn").value.replace(/\D/g,"");if(c.length!==6){$("codeMsg").textContent="請輸入 6 位數字的房號。";return}
    rpc("raid_state",{p_room:c,p_seat:0,p_device:device}).then(function(d){if(!d){$("codeMsg").textContent="找不到這個房間，請再看一次房號。";return}goRoom(c)}).catch(function(){$("codeMsg").textContent="連線失敗，請再試一次。"})});

  /* 座號 */
  for(var i=1;i<=25;i++){var b=document.createElement("button");b.type="button";b.textContent=i;b.dataset.s=i;b.setAttribute("aria-label",i+" 號");$("seats").appendChild(b)}
  $("seats").addEventListener("click",function(e){var b=e.target.closest("button[data-s]");if(!b)return;var s=+b.dataset.s,lk=SL().get(RCLS);
    if(lk&&lk!==s){SL().unlock(RCLS).then(function(ok){if(ok)join(s)});return}join(s)});
  /* 學生角色（assets/avatar.js）：還沒有角色要先做一個；從課堂房間跟過來的已經在 join.html 看過自己的角色，不再顯示 */
  function avGate(s){
    if(!window.AVATAR||RMODE==="story")return Promise.resolve();
    var live=false;try{live=!!sessionStorage.getItem("clsSess")}catch(e){}
    return AVATAR.gate(RCLS,s,{greet:!live}).catch(function(){});
  }
  function join(s){
    $("seatMsg").textContent="加入中…";
    avGate(s).then(function(){return rpc("raid_join",{p_room:room,p_seat:s,p_device:device})}).then(function(r){
      if(r==="ok"){seat=s;save("raidSeat:"+room,s);SL().set(RCLS,s);$("seatMsg").textContent="";sig="";drawMe();show("sGame");poll();return}
      seat=0;save("raidSeat:"+room,null);show("sSeat");
      $("seatMsg").textContent={seat_taken:s+" 號已經有人用別的平板加入了。請確認你的座號，或請老師幫忙。",ended:"這場遊戲已經結束了。",no_room:"找不到這個房間。",full:"人數已滿。"}[r]||"加入失敗，請再試一次。";
    }).catch(function(){$("seatMsg").textContent="連線失敗，請再試一次。"});
  }
  function drawMe(){
    $("me").innerHTML="<span>我是 "+seat+" 號</span>"+(st&&st.team?'<span class="tbadge tc'+st.team+'">'+tname(st.team)+'</span>':"");
    var c=document.createElement("button");c.type="button";c.textContent="選錯座號？請老師幫忙";
    c.addEventListener("click",function(){var go=function(){seat=0;save("raidSeat:"+room,null);$("seatMsg").textContent="";show("sSeat")};
      if(SL().get(RCLS))SL().unlock(RCLS).then(function(ok){if(ok)go()});else go()});
    $("me").appendChild(c);
    if(window.AVATAR&&RMODE!=="story")AVATAR.enabled(RCLS).then(function(on){if(!on||$("me").querySelector(".avchg"))return;var a=document.createElement("button");a.type="button";a.className="avchg";a.textContent="換造型？請老師幫忙";
      a.addEventListener("click",function(){AVATAR.get(RCLS,seat).then(function(cfg){return AVATAR.change(RCLS,seat,cfg)}).catch(function(){})});$("me").appendChild(a)});
  }

  /* ---------- 語音唸題 ---------- */
  var TTS=("speechSynthesis" in window)&&("SpeechSynthesisUtterance" in window), voice=null, auto=!!load("raidTTS",false), spoken="", cur=null;
  function pickVoice(){try{var vs=speechSynthesis.getVoices();voice=vs.filter(function(v){return /zh[-_]TW/i.test(v.lang)})[0]||vs.filter(function(v){return /zh[-_](HK|Hant)/i.test(v.lang)})[0]||vs.filter(function(v){return /^(zh|cmn)/i.test(v.lang)})[0]||null}catch(e){}}
  if(TTS){pickVoice();try{speechSynthesis.addEventListener("voiceschanged",pickVoice)}catch(e){}}
  function stopSay(){if(TTS)try{speechSynthesis.cancel()}catch(e){}}
  function speak(t){if(!TTS||!t)return;stopSay();setTimeout(function(){try{var u=new SpeechSynthesisUtterance(t);u.lang=voice?voice.lang:"zh-TW";if(voice)u.voice=voice;u.rate=0.85;speechSynthesis.speak(u)}catch(e){}},60)}
  function clean(t){return String(t||"").replace(/[_＿]{2,}|（\s*）|\(\s*\)/g,"，什麼，")}
  function readCur(){if(!cur)return;var t=clean(cur.q);if(!/[。？！?!]$/.test(t))t+="。";
    if(cur.ox)t+="對的請選 O，錯的請選 X。";
    else cur.opts.forEach(function(o,i){if(cur.skip.indexOf(i)<0)t+=LABEL[i]+"，"+o+"。"});
    speak(t)}
  function sayBar(){return TTS?'<div class="sayrow"><button type="button" data-say="q">🔊 唸題目和選項</button><button type="button" data-say="auto" aria-pressed="'+auto+'">'+(auto?"自動唸：開":"自動唸：關")+'</button></div>':""}
  function optBtns(){var o=$("opts");return o?[].slice.call(o.querySelectorAll("button[data-i]")):[]}
  function optsHTML(opts,ox,cls,dis,extra){
    return '<div class="opts'+(ox?" ox":"")+(extra||"")+'" id="opts">'+opts.map(function(t,i){
      var b='<button type="button" class="c'+i+(cls(i)||"")+'" data-i="'+i+'"'+(dis(i)?" disabled":"")+'>'+(ox?"":"<b>"+LABEL[i]+"</b>")+esc(t)+'</button>';
      return (ox||!TTS)?b:'<div class="orow">'+b+'<button type="button" class="say" data-say="o'+i+'" aria-label="唸選項 '+LABEL[i]+'">🔊</button></div>'}).join("")+'</div>'}
  $("body").addEventListener("click",function(e){
    var s=e.target.closest("[data-say]");if(!s)return;
    if(F.res)clearTimeout(F.timer);
    var k=s.dataset.say;
    if(k==="auto"){auto=!auto;save("raidTTS",auto);s.setAttribute("aria-pressed",auto);s.textContent=auto?"自動唸：開":"自動唸：關";if(auto)readCur();else stopSay();return}
    if(k==="q")readCur();
    else if(k==="e"){if(cur)speak(cur.e)}
    else if(k.charAt(0)==="o"&&cur){var i=+k.slice(1);speak(LABEL[i]+"，"+cur.opts[i])}
  });

  /* 狀態 */
  function poll(){
    if(!room)return;
    rpc("raid_state",{p_room:room,p_seat:seat||0,p_device:device}).then(function(d){
      if(!d){show("sCode");$("codeMsg").textContent="找不到這個房間，請再看一次房號。";return}
      var hadTeam=st&&st.team;d._at=Date.now();st=d;setGame(d.game);setTitle();
      if(seat&&d.team&&d.team!==hadTeam)drawMe();
      if(seat&&!d.joined&&d.status!=="end"){ join(seat); return; }
      if(!seat){ if(d.status==="end"){show("sGame");$("me").innerHTML="";render()} return; }
      show("sGame");render();
    }).catch(function(){});
  }
  function hp(){
    if(st.mode==="team"&&st.team&&st.team_max){var mx=st.team_max[st.team-1]||1,v=Math.max(0,st.team_hp[st.team-1]);
      $("hpFill").style.width=(v/mx*100)+"%";$("hpText").textContent=tname(st.team)+"的魔王血量 "+v+" / "+mx;return}
    var p=st.max_hp?Math.max(0,st.hp)/st.max_hp*100:100;$("hpFill").style.width=p+"%";
    $("hpText").textContent=st.max_hp&&st.status!=="lobby"?("魔王血量 "+Math.max(0,st.hp)+" / "+st.max_hp):(st.mode==="team"?"每隊各有一隻魔王，開始後依隊伍人數決定血量":"魔王血量：開始後依人數決定")}
  /* 先看題目：還要幾秒才出選項 */
  var PVT=null,PVI=null;
  function pvLeft(){var q=st&&st.question;if(!q||!q.pv||st.status!=="question"||st.answered||st.q_age==null)return 0;
    return q.pv-st.q_age-(Date.now()-(st._at||Date.now()))/1000}
  /* 排序題：依序點選選項 */
  var ORD={key:"",sel:[],items:[],dis:false,send:null};
  function ordInner(){var it=ORD.items,n=it.length,h='<div class="ordsel" aria-label="你排的順序">';
    for(var k=0;k<n;k++){var v=ORD.sel[k];
      h+=v!=null?'<button type="button" class="slot c'+v+'" data-ordrm="'+k+'" aria-label="第 '+(k+1)+' 步，點一下拿掉"><i>'+(k+1)+'</i>'+esc(it[v])+'<span>✕</span></button>'
                 :'<div class="slot"><i>'+(k+1)+'</i>'+(k===ORD.sel.length?"下一步是？點下面的選項":"")+'</div>'}
    h+='</div><div class="ordpool">'+it.map(function(t,i){return ORD.sel.indexOf(i)>=0?"":'<button type="button" class="c'+i+'" data-ordpick="'+i+'"'+(ORD.dis?" disabled":"")+'><b>'+LABEL[i]+'</b>'+esc(t)+'</button>'}).join("")+'</div>'+
      '<div class="ordbar"><button type="button" class="ghost" data-ordreset'+(ORD.sel.length&&!ORD.dis?"":" disabled")+'>↺ 重排</button><button type="button" data-ordsend'+(ORD.sel.length===n&&!ORD.dis?"":" disabled")+'>送出順序 ✓</button></div>';
    return h}
  function ordHTML(items,key,dis,send){if(ORD.key!==key){ORD.key=key;ORD.sel=[]}ORD.items=items;ORD.dis=!!dis;ORD.send=send;return '<div class="ord" id="ordBox">'+ordInner()+'</div>'}
  function ordRedraw(){var x=$("ordBox");if(x)x.innerHTML=ordInner()}
  $("body").addEventListener("click",function(e){
    var t=e.target.closest("[data-ordpick],[data-ordrm],[data-ordreset],[data-ordsend]");if(!t||t.disabled||!$("ordBox"))return;
    if(t.hasAttribute("data-ordpick")){var i=+t.dataset.ordpick;if(ORD.sel.indexOf(i)<0)ORD.sel.push(i)}
    else if(t.hasAttribute("data-ordrm"))ORD.sel.splice(+t.dataset.ordrm,1);
    else if(t.hasAttribute("data-ordreset"))ORD.sel=[];
    else if(t.hasAttribute("data-ordsend")){if(ORD.send&&ORD.sel.length===ORD.items.length){ORD.dis=true;ordRedraw();ORD.send(ORD.sel.slice())}return}
    ordRedraw();
  });
  function render(){
    hp();
    var FR=st.mode==="free"||st.mode==="team";
    var ctr=st.counter;
    if(ctr&&ctr.done){if(C.doneN!==ctr.n){C.doneN=ctr.n;C.doneAt=Date.now()}else if(Date.now()-C.doneAt>7000)ctr=null}
    if(FR&&st.status==="play"&&ctr){ F.on=false;clearTimeout(F.timer);drawCounter(); return; }
    C.sig="";
    if(FR&&st.status==="play"){ freeTick(); return; }
    F.on=false;
    var PVL=pvLeft();
    var key=[st.status,st.round,st.answered,st.my_correct,st.result,st.hp,st.team,st.winner,PVL>0?"pv":""].join("|");
    var b=$("body");
    if(st.status==="question"&&!st.answered){
      var lt=$("leftT");if(lt&&st.left!=null){lt.textContent="⏱ 剩 "+st.left+" 秒";lt.className="left"+(st.left<=5?" hot":"")}
    }
    if(key===sig)return; sig=key;
    if(st.status==="lobby"){b.innerHTML='<div class="big">🛡️</div><div class="wait">加入成功！<br>等老師按「開始戰鬥」</div>'+(FR?'<p class="muted" style="text-align:center">這一場是「'+(st.mode==="team"?"👥 分隊競賽":"⚡ 各自搶攻")+'」：開始後題目會出現在你的平板上，一次就答對打 2 點、第 2 次才答對打 1 點；答錯不會換題，會被定身 3 秒，再選一次。看不懂題目可以按「🔊 唸題目」。</p>':'')+
      (st.mode==="team"&&st.team?'<div class="rv na" style="text-align:center">你是 <span class="tbadge tc'+st.team+'">'+tname(st.team)+'</span>！幫自己的隊伍打倒魔王，最先打倒的隊伍獲勝！</div>':'')+
      (FR&&st.opt_counter?'<p class="muted" style="text-align:center">🛡️ 魔王會反擊：反擊題出現時要趕快作答，'+(st.mode==="team"?"隊上":"全班")+' 9 成以上答對才擋得住！</p>':'')+
      (FR&&st.opt_revenge?'<p class="muted" style="text-align:center">🔁 最後 3 分鐘是錯題復仇戰：出大家常錯的題目，答對傷害 ×2！</p>':'')+
      (st.mode==="story"?'<p class="muted" style="text-align:center">這一場是「🧭 情境闖關」：大螢幕會出一個生活故事，每一關選「你會怎麼做？」。沒有標準的快慢，想清楚再選！</p>':'')+'<p class="muted" style="text-align:center">目前有 '+st.players+' 位勇者</p>';return}
    if(st.status==="end"){
      if(st.mode==="story"){var SE=st.story_end;b.innerHTML='<div class="big">'+(SE&&SE.icon?esc(SE.icon):'🧭')+'</div><div class="wait">'+(st.result==="cancel"?"老師取消了這場闖關":SE&&SE.title?"故事結束了！全班走到的結局：<br><b>"+esc(SE.title)+"</b>":"故事結束了！<br>看大螢幕，全班走到哪一個結局？")+'</div>'+(seat&&st.result!=="cancel"?'<div class="rv na">你在 '+st.my_total+' 次選擇'+'裡，選到最好的做法 <b>'+st.my_right+'</b> '+'次'+'。</div>':'');return}
      if(st.mode==="team"&&st.result!=="cancel"&&st.winner){
        var mine=st.team===st.winner;
        b.innerHTML='<div class="big">'+(mine?"🏆":"💪")+'</div><div class="wait"><span class="tbadge tc'+st.winner+'">'+tname(st.winner)+'</span> 獲勝！'+(mine?"<br>恭喜你的隊伍！":"<br>你的隊伍也很努力，下次再拚！")+'</div>'+
          (seat?'<div class="rv na">你在 2 次內答對 <b>'+st.my_right+'</b> 題，打掉魔王 <b>'+(st.my_dmg||0)+'</b> 點血！</div>':'');return}
      var win=st.result==="win";
      b.innerHTML='<div class="big">'+(win?"🎉":"💪")+'</div><div class="wait">'+(win?"全班合力打倒大魔王！":(st.result==="cancel"?"老師取消了這場遊戲":"魔王逃走了，下次再挑戰！"))+'</div>'+
        (seat?(FR?'<div class="rv na">你在 2 次內答對 <b>'+st.my_right+'</b> 題，打掉魔王 <b>'+(st.my_dmg||0)+'</b> 點血！</div>':'<div class="rv na">你答對了 <b>'+st.my_right+'</b> / '+st.my_total+' 題，打了魔王 '+st.my_right+' 下！</div>'):'');
      return;
    }
    var q=st.question||{};
    var opts=q.ox?["O","X"]:(q.o||[]);
    var SY=st.mode==="story";
    var h='<div class="meta"><span>'+(SY&&q.br?'第 '+(q.i||st.round)+' 次選擇':'第 '+st.round+' / '+st.rounds+(SY?' 關':' 題'))+'</span><span id="leftT" class="left">'+(st.status==="question"&&st.left!=null?"⏱ 剩 "+st.left+" 秒":"")+'</span></div>'+
      (SY&&q.s?'<div class="scene">'+(q.intro?'<span class="intro">'+esc(q.intro)+'</span>':'')+esc(q.s)+'</div>':'')+'<div class="qt">'+esc(q.q)+'</div>';
    var mine=st.my_choice;
    clearTimeout(PVT);clearInterval(PVI);
    if(st.status==="question"&&PVL>0){
      cur={q:(SY&&q.s?q.s+"。":"")+q.q,opts:[],ox:q.ox,skip:[],e:""};
      h+=sayBar().replace("🔊 唸題目和選項","🔊 唸題目")+'<div class="pvwait">👀 先讀題目，想一想……<br>選項 <b id="pvS">'+Math.ceil(PVL)+'</b> 秒後出現'+(q.ord?"<br>（這一題要排順序）":"")+'</div>';
      if(auto&&spoken!=="s"+st.round){spoken="s"+st.round;setTimeout(readCur,300)}
      b.innerHTML=h;
      PVI=setInterval(function(){var z=$("pvS"),L=pvLeft();if(z)z.textContent=Math.max(1,Math.ceil(L))},300);
      PVT=setTimeout(function(){clearInterval(PVI);sig="";render()},PVL*1000+60);
      return;
    }
    if(st.status==="question"){
      cur={q:(SY&&q.s?q.s+"。":"")+q.q,opts:opts,ox:q.ox,skip:[],e:""};
      if(!st.answered)h+=sayBar();
      if(q.ord){
        if(!st.answered)h+=ordHTML(opts,"s"+st.round,sending,function(order){answer(order)});
        else h+='<div class="rv na">你排的順序：<ol class="ordlist">'+(Array.isArray(mine)?mine:[]).map(function(i){return '<li>'+esc(opts[i])+'</li>'}).join("")+'</ol></div>';
      }else
      h+=optsHTML(opts,q.ox,function(i){return st.answered&&mine===i?" pick":""},function(){return st.answered},st.answered?" done":"");
      if(!st.answered&&auto){
        if(spoken!=="s"+st.round){spoken="s"+st.round;setTimeout(readCur,300)}
        else if(q.pv&&spoken!=="o"+st.round){spoken="o"+st.round;setTimeout(function(){speak(opts.map(function(o,i){return (q.ox?"":LABEL[i]+"，")+o}).join("。")+"。")},300)}
      }
      if(q.ord&&!st.answered)h+='<div class="msg" id="ansMsg"></div>';
      else h+=st.answered?'<div class="wait">✓ 已送出！'+(SY?"看大螢幕，等大家都選好":"看大螢幕等老師公布答案")+'</div>':'<div class="msg" id="ansMsg"></div>';
    }else{
      var a=st.answer||{},right=q.ord?(a.a||[]).map(function(i,k){return (k+1)+". "+opts[i]}).join(" → "):opts[a.a];
      if(SY){
        var fb=(a.f||[])[mine];
        if(!st.answered)h+='<div class="rv na">這一關你沒有作答。<br>最好的做法：<b>'+esc(right)+'</b><br>'+esc(a.e)+'</div>';
        else if(st.my_correct)h+='<div class="big">🌟</div><div class="rv ok"><b>你選了最好的做法！</b><br>'+esc(a.e)+'</div>';
        else h+='<div class="rv no"><b>你選的做法會這樣：</b><br>'+esc(fb)+'</div><div class="rv ok"><b>最好的做法：</b>'+esc(right)+'<br>'+esc(a.e)+'</div>';
        cur={q:q.q,opts:opts,ox:false,skip:[],e:(st.answered&&!st.my_correct?"你選的做法會這樣："+fb+"。":"")+"最好的做法是："+right+"。"+(a.e||"")};
        if(TTS)h+='<div class="sayrow"><button type="button" data-say="e">🔊 唸出來</button></div>';
        h+='<p class="muted" style="text-align:center">看大螢幕，聽聽大家的想法</p>';
        b.innerHTML=h;return;
      }
      if(!st.answered)h+='<div class="rv na">這題你沒有作答。<br>正確答案：<b>'+esc(right)+'</b><br>'+esc(a.e)+'</div>';
      else if(st.my_correct)h+='<div class="big">⚔️</div><div class="rv ok"><b>答對了！</b>你打了魔王一下！<br>'+esc(a.e)+'</div>';
      else h+='<div class="rv no"><b>差一點！</b>'+(q.ord?"正確順序是：":"正確答案是")+'「'+esc(right)+'」。<br>'+esc(a.e)+'</div>';
      cur={q:q.q,opts:opts,ox:q.ox,skip:[],e:"正確答案是："+(q.ox?(a.a===0?"O，對":"X，錯"):right)+"。"+(a.e||"")};
      if(TTS)h+='<div class="sayrow"><button type="button" data-say="e">🔊 唸答案和說明</button></div>';
      h+='<p class="muted" style="text-align:center">看大螢幕，等老師出下一題</p>';
    }
    b.innerHTML=h;
    var o=$("opts");
    if(o&&!st.answered)o.addEventListener("click",function(e){var btn=e.target.closest("button[data-i]");if(!btn||sending)return;answer(+btn.dataset.i)});
  }
  function answer(i){
    sending=true;stopSay();
    optBtns().forEach(function(x){x.disabled=true});
    rpc("raid_answer",{p_room:room,p_round:st.round,p_seat:seat,p_device:device,p_choice:i}).then(function(r){
      sending=false;
      if(r==="ok"||r==="already"){st.answered=true;st.my_choice=i;sig="";render();return}
      var m={closed:"這題已經結束了。",late:"時間到了，來不及送出。",not_joined:"請重新選座號。",early:"選項還沒出現，等一下再按。"}[r]||"送出失敗，請再按一次。";
      var am=$("ansMsg");if(am)am.textContent=m;
      if(r==="not_joined"){join(seat)}
      optBtns().forEach(function(x){x.disabled=false});ORD.dis=false;ordRedraw();
      poll();
    }).catch(function(){sending=false;var am=$("ansMsg");if(am)am.textContent="網路不穩，請再按一次。";optBtns().forEach(function(x){x.disabled=false})});
  }

  /* ---------- 各自搶攻 ---------- */
  // 答錯不換題：第 1 次就答對打 2 點、第 2 次答對打 1 點（O／X 題第 2 次只剩一個選項，打 0 點）、再之後 0 點
  var F={on:false,q:null,busy:false,res:null,timer:null,hit:false,frozen:false};
  function fmt(L){L=Math.max(0,L|0);return Math.floor(L/60)+":"+(L%60<10?"0":"")+(L%60)}
  function pot(q){return (q.tries===0?2:(q.tries===1&&!q.ox?1:0))*(q.rev?2:1)}
  function freeHeader(){
    var c=$("fClk");if(c&&st.left!=null){c.textContent="⏱ "+fmt(st.left);c.className="clk"+(st.left<=30?" hot":"")}
    var m=$("fMine");if(m)m.textContent="我答對 "+(st.my_right||0)+" 題・打了 "+(st.my_dmg||0)+" 點";
  }
  function freeTick(){
    if(!F.on){F.on=true;sig="";F.q=null;F.res=null;loadQ();return}
    freeHeader();
  }
  function loadQ(){
    if(F.busy)return;F.busy=true;clearTimeout(F.timer);
    rpc("raid_free_q",{p_room:room,p_seat:seat,p_device:device}).then(function(q){
      F.busy=false;
      if(q.err){ if(q.err==="not_joined"){join(seat)} F.on=false; poll(); return; }
      q.wrong=q.wrong||[];q.tries=q.tries||0;
      F.q=q;F.res=null;F.pos=null;F.hit=q.tries>0;F.frozen=q.wait>0;drawFree();
      if(auto&&spoken!=="f"+q.qid){spoken="f"+q.qid;stopSay();if(!F.frozen)setTimeout(readCur,300)}
      if(F.frozen)freezeThen(q.wait);
    }).catch(function(){F.busy=false;setTimeout(loadQ,1500)});
  }
  function drawFree(){
    var q=F.q,b=$("body");if(!q)return;
    var opts=q.o||[],r=F.res,wrong=q.wrong||[],p=pot(q);
    cur={q:q.q,opts:opts,ox:q.ox,skip:wrong,e:r?((r.dmg>0?"答對了！":"答對了。")+"答案是："+(q.ox?(r.answer==="O"?"O，對":"X，錯"):r.answer)+"。"+(r.e||"")):""};
    var h='<div class="fbar"><span class="clk" id="fClk"></span><span class="stk">'+(q.streak>=2&&!r&&!q.tries?"🔥 連續一次答對 "+q.streak+" 題":"")+'</span></div>'+
      '<div class="meta"><span id="fMine"></span><span>'+dname(q.d)+'</span></div>'+
      '<div class="qt">'+esc(q.q)+'</div>'+sayBar();
    if(q.rev)h+='<div class="revq">🔁 復仇題：這是全班常答錯的題目，答對傷害 ×2！</div>';
    if(!r)h+='<div class="pot p'+Math.min(2,p)+'">'+(p>=2?"⚔️⚔️ 這題"+(q.tries===0?"一次就":"現在")+"答對：打 "+p+" 點":p===1?"⚔️ 這題現在答對：打 1 點":"這題現在答對不會打到魔王，但還是要找出正確答案！")+'</div>';
    if(q.ord){if(!r)h+=ordHTML(opts,"f"+q.qid+"-"+q.tries,F.frozen||F.busy,function(order){freeAnswer(null,order)});}
    else
    h+=optsHTML(opts,q.ox,function(i){return (wrong.indexOf(i)>=0?" tried":"")+(r&&opts[i]===r.answer?" right":"")},
      function(i){return !!r||F.frozen||wrong.indexOf(i)>=0},r?" done2":"");
    if(r){
      var msg=r.attempt===1?'<b>⚔️ 一次就答對！</b>打掉魔王 '+r.dmg+' 點血'+(r.dmg>2?"（連續一次答對 "+r.streak+" 題，多打 1 點！）":"")
        :r.dmg>0?'<b>⚔️ 答對了！</b>第 '+r.attempt+' 次答對，打掉魔王 '+r.dmg+' 點血'
        :'<b>✓ 答對了！</b>這次沒有打到魔王，下一題試試一次就答對！';
      h+='<div class="rv ok">'+msg+(q.ord?'<br>正確順序：'+esc(r.answer):'')+'<br>'+esc(r.e)+'</div>';
      if(TTS)h+='<div class="sayrow"><button type="button" data-say="e">🔊 唸答案和說明</button></div>';
      h+='<button type="button" class="nextbtn" id="fNext">下一題 →</button>';
    }else if(F.hit)h+='<div class="rv no"><b>被魔王打中了！</b>'+(q.ord?(F.pos!=null?"有 "+F.pos+" 個位置是對的，再排一次。":"順序不對。"):"這個答案不對。")+(F.frozen?"定身結束後再選一次。":"再想想看，選一次！")+'</div><div class="freeze" id="frz"></div>';
    else h+='<div class="msg" id="ansMsg"></div>';
    b.innerHTML=h;freeHeader();
    var o=$("opts");
    if(!r&&o)o.addEventListener("click",function(e){var btn=e.target.closest("button[data-i]");if(!btn||btn.disabled||F.busy||F.frozen)return;freeAnswer(+btn.dataset.i)});
    var nb=$("fNext");if(nb)nb.addEventListener("click",function(){stopSay();loadQ()});
  }
  function freezeThen(sec){
    var left=sec;clearTimeout(F.timer);
    var tick=function(){var z=$("frz");if(z)z.textContent=left>0?"😵 定身中…… "+left+" 秒":"";
      if(left<=0){F.frozen=false;drawFree();if(auto)readCur();return}left--;F.timer=setTimeout(tick,1000)};tick();
  }
  function freeAnswer(i,order){
    F.busy=true;stopSay();optBtns().forEach(function(x){x.disabled=true});
    var args={p_room:room,p_seat:seat,p_device:device,p_qid:F.q.qid};if(order)args.p_order=order;else args.p_choice=i;
    rpc("raid_free_answer",args).then(function(r){
      F.busy=false;
      if(r.err){
        if(r.err==="wait"||r.err==="bad_choice"){drawFree();var m=$("ansMsg");if(m)m.textContent=r.err==="wait"?"還在定身中，等一下再按！":"這個選項已經選過了。";return}
        if(r.err==="stale"){loadQ();return}
        F.on=false;poll();return;
      }
      st.hp=r.hp;st.max_hp=r.max_hp;if(r.team_hp!=null&&st.team&&st.team_hp)st.team_hp[st.team-1]=r.team_hp;hp();
      if(r.correct){
        F.res=r;F.q.streak=r.streak;if(r.dmg>0)st.my_right=(st.my_right||0)+1;st.my_dmg=(st.my_dmg||0)+r.dmg;drawFree();
        if(auto)speak(cur.e);else F.timer=setTimeout(loadQ,2500);
      }else{
        if(order)F.pos=r.pos_ok;else F.q.wrong.push(i);F.q.tries=r.attempt;F.q.streak=0;F.hit=true;F.frozen=true;drawFree();freezeThen(r.wait||3);
      }
    }).catch(function(){F.busy=false;drawFree();var m=$("ansMsg");if(m)m.textContent="網路不穩，請再按一次。"});
  }

  /* ---------- 魔王反擊：大螢幕出一題全班題，限時作答 ---------- */
  var C={sig:"",busy:false,doneN:0,doneAt:0};
  function drawCounter(){
    var c=st.counter,b=$("body"),done=!!c.done,mine=c.mine;
    var key=c.n+"|"+done+"|"+mine;
    var lt=$("cLeft");if(lt&&!done)lt.textContent="⏱ "+Math.max(0,c.left||0)+" 秒";
    if(key===C.sig)return;C.sig=key;
    var opts=c.o||[],ox=!!c.ox;
    var h='<h2 style="margin:0">⚠️ 魔王反擊！<span id="cLeft" class="left">'+(done?"":"⏱ "+Math.max(0,c.left||0)+" 秒")+'</span></h2>'+
      '<p class="muted">'+(st.mode==="team"?"隊上":"全班")+' 9 成以上的人答對，才能擋下反擊！答錯太多，魔王會回血。</p><div class="qt">'+esc(c.q)+'</div>';
    if(!done){
      cur={q:c.q,opts:opts,ox:ox,skip:[],e:""};
      if(mine==null)h+=sayBar();
      h+=optsHTML(opts,ox,function(i){return mine===i?" pick":""},function(){return mine!=null},mine!=null?" done":"");
      h+=mine!=null?'<div class="wait">✓ 已送出！看大螢幕等結算</div>':'<div class="msg" id="ansMsg"></div>';
      if(mine==null&&auto&&spoken!=="c"+c.n){spoken="c"+c.n;setTimeout(readCur,300)}
    }else{
      var r=(c.res||[]).filter(function(x){return x.t===0||x.t===st.team})[0]||{},ok=mine!=null&&mine===c.a;
      h+=optsHTML(opts,ox,function(i){return (i===c.a?" right":"")+(mine===i?" pick":"")},function(){return true}," done2");
      h+='<div class="rv '+(r.heal?"no":"ok")+'"><b>'+(r.heal?"💥 魔王回血 +"+r.heal+"！":"🛡️ 擋下反擊了！")+'</b><br>'+(r.t?tname(r.t):"全班")+' '+(r.ok||0)+' / '+(r.n||0)+' 人答對。'+
        (mine==null?"你這題沒有作答。":ok?"你答對了，謝謝你幫忙擋住！":"你這題答錯了。")+'<br>✓ 答案：<b>'+esc(opts[c.a])+'</b>　'+esc(c.e||"")+'</div><p class="muted" style="text-align:center">馬上回到你的題目……</p>';
    }
    b.innerHTML='<div class="ctr card" style="margin:-16px;gap:12px">'+h+'</div>';
    var o=$("opts");
    if(o&&!done&&mine==null)o.addEventListener("click",function(e){var btn=e.target.closest("button[data-i]");if(!btn||C.busy)return;counterAnswer(c.n,+btn.dataset.i)});
  }
  function counterAnswer(n,i){
    C.busy=true;stopSay();optBtns().forEach(function(x){x.disabled=true});
    rpc("raid_counter_answer",{p_room:room,p_seat:seat,p_device:device,p_n:n,p_choice:i}).then(function(r){
      C.busy=false;
      if(r==="ok"||r==="already"){st.counter.mine=i;drawCounter();return}
      var m={closed:"反擊已經結束了。",late:"時間到了，來不及送出。",not_joined:"請重新選座號。"}[r]||"送出失敗，請再按一次。";
      var am=$("ansMsg");if(am)am.textContent=m;optBtns().forEach(function(x){x.disabled=false});
      if(r==="not_joined")join(seat);
    }).catch(function(){C.busy=false;var am=$("ansMsg");if(am)am.textContent="網路不穩，請再按一次。";optBtns().forEach(function(x){x.disabled=false})});
  }

  if(room.length===6)goRoom(room);else show("sCode");
})();
