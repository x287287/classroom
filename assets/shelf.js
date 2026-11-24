/* 書櫃首頁（index.html）的程式。教材清單 MATERIALS 與 TYPES 留在 index.html（sw.js 會從 index.html 讀教材網址），這個檔要在它們之後載入。 2026-11-24 從頁面裡移出來，方便維護。 */
const gradeName=g=>("一二三四五六"[g-1]||"")+"年級";
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const $=id=>document.getElementById(id);
/* 只有內容真的改變時才更新畫面，避免同步時整頁重畫、打斷正在點的動作 */
function setHTML(el,html){if(el.__html===html)return false;el.__html=html;el.innerHTML=html;return true;}
let curType="all", curGrade="all", query="";

/* 隱藏的教材：只有登入的老師看得到 */
const visible=i=>!i.hidden||(window.CLS&&CLS.isTeacher);
function filtered(){
  const q=query.trim().toLowerCase();
  return MATERIALS.filter(i=>visible(i)&&(!onlyTodo||!doneSet[i.url])&&(curGrade==="all"||String(i.grade)===curGrade||(i.grades||[]).includes(+curGrade))&&(!q||[i.title,i.unit,i.lesson,i.topic,i.note].join(" ").toLowerCase().includes(q)));
}
function card(i){
  const meta=[i.pages?`課本 p.${esc(i.pages)}`:"",i.mins?`約 ${i.mins} 分鐘`:""].filter(Boolean).join("・");
  const isDone=!!doneSet[i.url];
  const inner=`<span class="chip ${esc(i.type)}">${TYPES[i.type]||"其他"}</span>${i.topic?`<span class="lesson">課本小標題：${esc(i.topic)}</span>`:i.up?`<span class="up-tag">老師上傳</span>`:"<span></span>"}${i.hidden?`<span class="hid-tag">已隱藏（學生看不到）</span>`:""}<div><h3>${esc(i.title).split("：").map((t,k,a)=>`<span class="tw">${t}${k<a.length-1?"：":""}</span>`).join("")}</h3>${i.note?`<p>${esc(i.note)}</p>`:""}</div>${meta?`<span class="meta">${meta}</span>`:"<span></span>"}`;
  const body=i.url
    ? `<a class="card-link" href="${esc(i.url)}" data-url="${esc(i.url)}">${inner}<span class="go">${i.type==="video"?"觀看":i.type==="game"?"開始玩":"打開"} →</span></a>`
    : `<div class="card-link">${inner}<span class="go none">連結待補</span></div>`;
  const isWeek=!!weekSet[i.url];
  return `<article class="card${isDone?" is-done":""}${isWeek?" is-week":""}${i.hidden?" is-hidden":""}">${body}${i.url?`<div class="acts"><button class="pin-btn" type="button" data-week="${esc(i.url)}" aria-pressed="${isWeek}" aria-label="${isWeek?"從本週要用移除":"加到本週要用"}：${esc(i.title)}">${isWeek?"★ 本週":"☆ 本週"}</button><button class="done-btn" type="button" data-done="${esc(i.url)}" aria-pressed="${isDone}" aria-label="${isDone?"取消已上過":"標記為已上過"}：${esc(i.title)}">${isDone?"✓ 已上過":"標記已上過"}</button>${window.CLS&&CLS.isTeacher?`<button class="edit-btn" type="button" ${i.up?`data-edit="${esc(i.up.id)}"`:`data-card="${esc(i.url)}"`} aria-label="編輯：${esc(i.title)}">編輯</button>`:""}</div>`:""}</article>`;
}
/* 這台電腦的瀏覽器記住：已上過、最近打開（讀不到也沒關係） */
function load(k,d){try{return JSON.parse(localStorage.getItem(k)||"null")||d}catch(e){return d}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
let doneSet=load("shelfDone",{}), recent=load("shelfRecent",[]), onlyTodo=false;
/* 本週要用：老師在卡片上按「☆ 本週」釘選，置頂顯示；要換週時按「清空本週」 */
let weekSet=load("shelfWeek",{});
function renderWeek(){
  const box=$("week"), items=MATERIALS.filter(m=>m.url&&weekSet[m.url]&&visible(m));
  box.hidden=!items.length;
  if(!items.length){setHTML(box,"");return;}
  const mins=items.reduce((a,m)=>a+(m.mins||0),0);
  if(!setHTML(box,`<div class="recent-h"><b>★ 本週要用</b><div class="week-btns"><span class="lesson" style="align-self:center">${items.length} 份${mins?`・約 ${mins} 分鐘`:""}</span><button class="mini" type="button" id="clearWeek">清空本週</button></div></div><div class="recent-list">${items.map(m=>`<a class="rc${doneSet[m.url]?" is-done":""}" href="${esc(m.url)}" data-url="${esc(m.url)}"><span class="chip ${esc(m.type)}">${TYPES[m.type]||""}</span><b>${doneSet[m.url]?"✓ ":""}${esc(m.title)}</b><small class="meta">${esc(((m.lesson||"").match(/^第\s*\d+\s*課/)||[m.type==="game"?"單元統整":(m.lesson||"")])[0])}${m.pages?`・課本 p.${esc(m.pages)}`:""}${m.mins?`・約 ${m.mins} 分鐘`:""}</small></a>`).join("")}</div>`))return;
  $("clearWeek").addEventListener("click",()=>{weekSet={};save("shelfWeek",weekSet);render();});
}
function ago(t){const m=Math.round((Date.now()-t)/60000);if(m<1)return"剛剛";if(m<60)return m+" 分鐘前";const h=Math.round(m/60);if(h<24)return h+" 小時前";const d=Math.round(h/24);return d+" 天前"}
function renderRecent(){
  const box=$("recent"), items=recent.map(r=>({r,m:MATERIALS.find(x=>x.url===r.url)})).filter(x=>x.m&&visible(x.m)).slice(0,4);
  box.hidden=!items.length;
  if(!items.length)return;
  if(!setHTML(box,`<div class="recent-h"><b>最近打開</b><button class="mini" type="button" id="clearRecent">清除紀錄</button></div><div class="recent-list">${items.map(({r,m})=>`<a class="rc" href="${esc(m.url)}" data-url="${esc(m.url)}"><span class="chip ${esc(m.type)}">${TYPES[m.type]||""}</span><b>${esc(m.title)}</b><small>${esc(m.unit.split(" ")[0].replace("康軒健康四上　",""))}・${ago(r.t)}</small></a>`).join("")}</div>`))return;
  $("clearRecent").addEventListener("click",()=>{recent=[];save("shelfRecent",recent);renderRecent();});
}
function render(){
  const base=filtered();
  setHTML($("tabs"),Object.entries(TYPES).map(([k,v])=>{
    const n=k==="all"?base.length:base.filter(i=>i.type===k).length;
    if(k!=="all"&&!MATERIALS.some(i=>i.type===k)) return "";
    return `<button class="tab" type="button" data-t="${k}" aria-pressed="${k===curType}">${v}<span class="n">${n}</span></button>`;
  }).join(""));
  const vis=MATERIALS.filter(i=>!i.hidden);
  $("sTotal").textContent=vis.length;
  $("sUnits").textContent=new Set(vis.map(i=>i.unit||"未分單元")).size;

  const list=base.filter(i=>curType==="all"||i.type===curType);
  if(!list.length){setHTML($("units"),`<div class="empty"><b>找不到符合的教材</b><span>換個關鍵字、年級或類型看看。</span></div>`);$("expandAll").hidden=$("collapseAll").hidden=true;renderRecent();renderWeek();return;}
  const units=new Map();
  list.forEach(i=>{
    const uk=(i.grade||0)+"|"+(i.unit||"未分單元");
    if(!units.has(uk))units.set(uk,new Map());
    const lk=i.type==="game"?"單元統整遊戲":(i.lesson||"其他");
    const L=units.get(uk); if(!L.has(lk))L.set(lk,[]); L.get(lk).push(i);
  });
  const filtering=!!query.trim()||curType!=="all"||curGrade!=="all"||onlyTodo;
  setHTML($("units"),[...units.keys()].map((uk,ui)=>{
    const[g,u]=uk.split("|"); const L=units.get(uk);
    const total=[...L.values()].reduce((a,x)=>a+x.length,0);
    const allU=MATERIALS.filter(x=>(x.grade||0)+"|"+(x.unit||"未分單元")===uk), doneU=allU.filter(x=>doneSet[x.url]).length;
    const isOpen=filtering||!!openSet[uk];
    const lessons=[...L.keys()].filter(k=>k!=="單元統整遊戲").length, hasGame=L.has("單元統整遊戲");
    return `<section class="unit${isOpen?" open":""}"><h2><button class="unit-toggle" type="button" aria-expanded="${isOpen}" aria-controls="ub${ui}" data-uk="${esc(uk)}"><span class="chev" aria-hidden="true"></span><span class="ut">${esc(u)}</span>${+g?`<span class="g">${gradeName(+g)}</span>`:""}<span class="cnt">${lessons} ${[...L.keys()].every(k=>/年級/.test(k))?"個年級":"課"}・${total} 份教材${hasGame?"・含統整遊戲":""}</span><span class="prog" aria-label="已上過 ${doneU} / ${allU.length} 份"><i style="width:${allU.length?doneU/allU.length*100:0}%"></i></span><span class="pt">已上過 ${doneU} / ${allU.length}</span></button></h2><div class="unit-body" id="ub${ui}"${isOpen?"":" hidden"}>${
      [...L.keys()].map((lk,li)=>{
        const lkey=uk+"||"+lk, lOpen=filtering||!!openSet[lkey], items=L.get(lk), dn=items.filter(x=>doneSet[x.url]).length;
        return `<div class="lesson-group${lOpen?" open":""}"><h3 class="lesson-h${lk==="單元統整遊戲"?" game":""}"><button class="lesson-toggle" type="button" aria-expanded="${lOpen}" aria-controls="lb${ui}_${li}" data-lk="${esc(lkey)}"><span class="chev" aria-hidden="true"></span><span class="lt">${esc(lk)}</span><span class="n">${items.length} 份</span><span class="pt">${dn?`已上過 ${dn} / ${items.length}`:""}</span></button></h3><div class="lesson-body" id="lb${ui}_${li}"${lOpen?"":" hidden"}><div class="cards">${items.map(card).join("")}</div></div></div>`;
      }).join("")
    }</div></section>`;
  }).join(""));
  $("expandAll").hidden=$("collapseAll").hidden=filtering;renderRecent();renderWeek();
}
/* 展開狀態記在這台電腦的瀏覽器裡（下次打開保持一樣）；讀不到也沒關係，預設全部收合 */
let openSet={};
try{openSet=JSON.parse(localStorage.getItem("shelfOpen")||"{}")||{}}catch(e){openSet={}}
function saveOpen(){try{localStorage.setItem("shelfOpen",JSON.stringify(openSet))}catch(e){}}
$("units").addEventListener("click",e=>{
  const t=e.target.closest(".lesson-toggle"); if(t){
    const g=t.closest(".lesson-group"), body=g.querySelector(".lesson-body"), open=t.getAttribute("aria-expanded")!=="true";
    t.setAttribute("aria-expanded",open); body.hidden=!open; g.classList.toggle("open",open);
    if(!query.trim()&&curType==="all"&&curGrade==="all"&&!onlyTodo){ if(open)openSet[t.dataset.lk]=1; else delete openSet[t.dataset.lk]; saveOpen(); }
    return;
  }
  const b=e.target.closest(".unit-toggle"); if(!b)return;
  const sec=b.closest(".unit"), body=sec.querySelector(".unit-body"), open=b.getAttribute("aria-expanded")!=="true";
  b.setAttribute("aria-expanded",open); body.hidden=!open; sec.classList.toggle("open",open);
  if(!query.trim()&&curType==="all"&&curGrade==="all"&&!onlyTodo){ if(open)openSet[b.dataset.uk]=1; else delete openSet[b.dataset.uk]; saveOpen(); }
});
$("units").addEventListener("click",e=>{
  const w=e.target.closest(".pin-btn"); if(w){const u=w.dataset.week; if(weekSet[u])delete weekSet[u]; else weekSet[u]=Date.now(); save("shelfWeek",weekSet); render(); const again=document.querySelector('.pin-btn[data-week="'+CSS.escape(u)+'"]'); if(again)again.focus(); return;}
  const d=e.target.closest(".done-btn"); if(d){const u=d.dataset.done; if(doneSet[u])delete doneSet[u]; else doneSet[u]=Date.now(); save("shelfDone",doneSet); render(); const again=document.querySelector('.done-btn[data-done="'+CSS.escape(u)+'"]'); if(again)again.focus(); return;}
  const a=e.target.closest("a[data-url]"); if(a)remember(a.dataset.url);
});
$("recent").addEventListener("click",e=>{const a=e.target.closest("a[data-url]");if(a)remember(a.dataset.url);});
$("week").addEventListener("click",e=>{const a=e.target.closest("a[data-url]");if(a)remember(a.dataset.url);});
/* 字級與全螢幕（字級記在這台電腦，教材頁的「上課工具」也用同一個設定） */
const FONT_LV=[[1,"標準"],[1.15,"大"],[1.3,"特大"],[1.5,"超大"]];
let fontI=Math.max(0,Math.min(FONT_LV.length-1,+load("clsFont",0)||0));
function applyFont(){document.documentElement.style.setProperty("--zoom",FONT_LV[fontI][0]);$("fontBtn").textContent="字："+FONT_LV[fontI][1];$("fontBtn").setAttribute("aria-label","文字大小："+FONT_LV[fontI][1]+"（點一下換下一級）");}
$("fontBtn").addEventListener("click",()=>{fontI=(fontI+1)%FONT_LV.length;save("clsFont",fontI);applyFont();});
applyFont();
const fsEl=()=>document.fullscreenElement||document.webkitFullscreenElement;
if(!(document.fullscreenEnabled||document.webkitFullscreenEnabled))$("fsBtn").hidden=true;
$("fsBtn").addEventListener("click",()=>{try{if(fsEl())(document.exitFullscreen||document.webkitExitFullscreen).call(document);else{const r=document.documentElement;(r.requestFullscreen||r.webkitRequestFullscreen).call(r);}}catch(e){}});
$("liveBtn").addEventListener("click",()=>{if(window.CLS_LIVE&&CLS_LIVE.openDialog)CLS_LIVE.openDialog();});
const renderFs=()=>{$("fsBtn").textContent=fsEl()?"⛶ 結束全螢幕":"⛶ 全螢幕";};
document.addEventListener("fullscreenchange",renderFs);document.addEventListener("webkitfullscreenchange",renderFs);
function remember(u){recent=[{url:u,t:Date.now()}].concat(recent.filter(r=>r.url!==u)).slice(0,8);save("shelfRecent",recent);}
$("todoOnly").addEventListener("click",e=>{onlyTodo=!onlyTodo;e.currentTarget.setAttribute("aria-pressed",onlyTodo);render();});
$("expandAll").addEventListener("click",()=>{document.querySelectorAll(".unit-toggle").forEach(b=>openSet[b.dataset.uk]=1);document.querySelectorAll(".lesson-toggle").forEach(b=>openSet[b.dataset.lk]=1);saveOpen();render();});
$("collapseAll").addEventListener("click",()=>{openSet={};saveOpen();render();});
$("tabs").addEventListener("click",e=>{const b=e.target.closest(".tab");if(!b)return;curType=b.dataset.t;render();});
$("gradeSel").addEventListener("change",e=>{curGrade=e.target.value;render();});
$("q").addEventListener("input",e=>{query=e.target.value;render();});

/* ============================================================
   老師上傳的教材（存在 Supabase，公開可讀；只有老師能新增／修改）
   清單也存一份在這台電腦（clsUploads），沒網路時照樣顯示。
   ============================================================ */
const BASE_N=MATERIALS.length;
/* 網站內建教材的原始資料；老師在網站上改的卡片資訊存在 Supabase 的 overrides（只存改過的欄位），也快取在 clsOverrides */
const ORIG=MATERIALS.map(m=>Object.assign({},m));
const CARD_F=["title","unit","lesson","topic","type","grade","grades","pages","mins","note"];
let overrides=load("clsOverrides",{});
const STORE_PUB=()=>CLS.url+"/storage/v1/object/public/materials/";
let uploads=load("clsUploads",[]);
const isImg=m=>/^image\//.test(m||""), isPdf=m=>m==="application/pdf";
function applyUploads(){
  MATERIALS.splice(0);
  ORIG.forEach(o=>{const v=overrides[o.url]; MATERIALS.push(v?Object.assign({},o,v.data||{},{hidden:!!v.hidden,edited:true}):Object.assign({},o));});
  uploads.slice().sort((a,b)=>a.sort-b.sort).forEach(r=>MATERIALS.push({
    unit:r.unit||"老師上傳的教材", lesson:r.lesson||"", topic:r.topic||"", title:r.title, type:r.type||"other",
    grade:r.grades&&r.grades.length>1?0:(r.grade||0), grades:r.grades||[], pages:r.pages||"", mins:r.mins||0, note:r.note||"", url:"lessons/view.html?id="+r.id, up:r
  }));
}
function fetchOverrides(){
  return CLS.api("rest/v1/overrides?select=url,data,hidden").then(r=>r.ok?r.json():Promise.reject(r)).then(rows=>{
    const o={}; rows.forEach(x=>o[x.url]={data:x.data||{},hidden:x.hidden});
    const changed=JSON.stringify(o)!==JSON.stringify(overrides);
    overrides=o; try{localStorage.setItem("clsOverrides",JSON.stringify(o))}catch(e){}
    return changed;
  }).catch(()=>false);
}
function fetchUploads(){
  if(!window.CLS)return Promise.resolve();
  return fetchOverrides().then(ch=>{ if(ch){applyUploads();render();} }).then(()=>CLS.api("rest/v1/materials?select=*&order=sort.asc")).then(r=>r.ok?r.json():Promise.reject(r)).then(rows=>{
    const changed=JSON.stringify(rows)!==JSON.stringify(uploads);
    uploads=rows; try{localStorage.setItem("clsUploads",JSON.stringify(rows))}catch(e){}
    if(changed){applyUploads();render();}
    cacheUploadFiles();
  }).catch(()=>{});
}
/* PDF 與圖片也存到這台電腦，網路斷線時一樣打得開 */
async function cacheUploadFiles(){
  if(!("caches" in window))return;
  try{
    const c=await caches.open("classroom-v1");
    for(const r of uploads){ if(r.kind!=="file"||!(isPdf(r.mime)||isImg(r.mime)))continue;
      const u=STORE_PUB()+r.path; if(!(await c.match(u))) await c.add(u).catch(()=>{}); }
  }catch(e){}
}
applyUploads();

/* ---------- 對話框共用 ---------- */
let lastFocus=null;
function openDlg(id,focusSel){lastFocus=document.activeElement;const d=$(id);d.hidden=false;const f=d.querySelector(focusSel||"input,button");if(f)f.focus();}
function closeDlg(id,byCancel){if(id==="upDlg"&&byCancel)clearDraft();$(id).hidden=true;if(lastFocus&&lastFocus.focus)lastFocus.focus();}
document.querySelectorAll(".dlg").forEach(d=>{
  /* 點視窗外面關閉：按下和放開都要在外面才算（在輸入框裡拖曳選字、放開在外面，不會關掉）。
     新增教材的視窗不會因為點外面而關閉，只能按「取消」或「儲存」。 */
  let downOut=false;
  d.addEventListener("pointerdown",e=>{downOut=e.target===d;});
  d.addEventListener("click",e=>{
    if(e.target.closest("[data-close]")){closeDlg(d.id,true);return;}
    if(e.target===d&&downOut&&d.id!=="upDlg")closeDlg(d.id);
    downOut=false;
  });
  /* Esc：打注音選字時按的 Esc 不算；新增教材視窗不用 Esc 關閉 */
  d.addEventListener("keydown",e=>{if(e.key==="Escape"&&!e.isComposing&&e.keyCode!==229&&d.id!=="upDlg")closeDlg(d.id);});
});
function msg(id,t,kind){const m=$(id);m.textContent=t||"";m.className="msg"+(kind?" "+kind:"");}

/* ---------- 登入與同步狀態 ---------- */
const ST={off:"☁ 老師登入",syncing:"☁ 同步中…",ok:"☁ 已同步",offline:"☁ 離線中",error:"☁ 同步失敗"};
const STL={syncing:"正在同步…",ok:"已同步：這台電腦的標記和設定都是最新的。",offline:"目前沒有網路。這段時間的修改會先存在這台電腦，連上網路後自動同步。",error:"同步失敗，稍後會自動再試一次。"};
function renderAcct(){
  if(!window.CLS)return;
  const b=$("acctBtn");
  /* 背景定時同步時不要閃「同步中…」：已同步過就維持「已同步」，按鈕寬度才不會一直變 */
  let s=CLS.status; if(s==="syncing"&&(b.dataset.s==="ok"))s="ok";
  b.textContent=ST[s]||ST.off; b.dataset.s=s;
  b.setAttribute("aria-label",s==="off"?"老師登入":"雲端同步："+(STL[s]||""));
  $("addBtn").hidden=!CLS.isTeacher; $("workBtn").hidden=!CLS.isTeacher; $("liveBtn").hidden=!CLS.isTeacher;
  $("acEmail").textContent=CLS.user?CLS.user.email:""; $("acState").textContent=CLS.user&&!CLS.isTeacher?"這個帳號不是老師帳號，無法同步或上傳。":(STL[s]||"");
}
let wasTeacher=window.CLS&&CLS.isTeacher, lastSt=window.CLS&&CLS.status;
window.addEventListener("cls-status",()=>{
  renderAcct();
  if(CLS.isTeacher!==wasTeacher){wasTeacher=CLS.isTeacher;render();}   /* 登入／登出：卡片上的「編輯」按鈕要更新 */
  if(CLS.status==="ok"&&lastSt!=="ok"&&lastSt!=="syncing")fetchUploads(); /* 從離線恢復時才重新抓上傳清單 */
  lastSt=CLS.status;
});
/* 別台電腦改了標記或設定：重新讀取並更新畫面 */
window.addEventListener("cls-sync",e=>{
  const k=(e.detail&&e.detail.keys)||[];
  doneSet=load("shelfDone",{}); weekSet=load("shelfWeek",{}); recent=load("shelfRecent",[]);
  try{openSet=JSON.parse(localStorage.getItem("shelfOpen")||"{}")||{}}catch(x){}
  if(k.includes("clsFont")){fontI=Math.max(0,Math.min(FONT_LV.length-1,+load("clsFont",0)||0));applyFont();}
  render();
});
$("acctBtn").addEventListener("click",()=>{
  if(!window.CLS)return;
  if(CLS.user){msg("acMsg","");$("pwNew").value="";renderAcct();openDlg("acctDlg","#acSync");}
  else{msg("lgMsg","");openDlg("loginDlg","#lgEmail");}
});
$("loginForm").addEventListener("submit",e=>{
  e.preventDefault();
  const em=$("lgEmail").value.trim(), pw=$("lgPw").value;
  if(!em||!pw){msg("lgMsg","請輸入 Email 和密碼","err");return;}
  if(navigator.onLine===false){msg("lgMsg","目前沒有網路，連上網路後再登入","err");return;}
  $("lgGo").disabled=true; msg("lgMsg","登入中…");
  CLS.login(em,pw).then(()=>{$("lgPw").value="";closeDlg("loginDlg");renderAcct();fetchUploads();render();})
    .catch(err=>msg("lgMsg",err&&err.message&&!/fetch/i.test(err.message)?err.message:"連不上伺服器，請確認網路後再試","err"))
    .finally(()=>{$("lgGo").disabled=false;});
});
$("acSync").addEventListener("click",()=>{CLS.syncNow();fetchUploads();});
$("acOut").addEventListener("click",()=>{CLS.logout();closeDlg("acctDlg");renderAcct();render();});
$("pwForm").addEventListener("submit",e=>{
  e.preventDefault(); const pw=$("pwNew").value;
  if(pw.length<8){msg("acMsg","新密碼至少要 8 個字","err");return;}
  msg("acMsg","更改中…");
  CLS.changePassword(pw).then(()=>{$("pwNew").value="";msg("acMsg","密碼已更改，下次登入請用新密碼","ok");}).catch(err=>msg("acMsg",err.message,"err"));
});

/* ---------- 新增／編輯教材 ---------- */
const EXT_MIME={pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",gif:"image/gif",webp:"image/webp",
  doc:"application/msword",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt:"application/vnd.ms-powerpoint",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt:"application/vnd.oasis.opendocument.text",odp:"application/vnd.oasis.opendocument.presentation"};
const MAX_MB=50;
let upSrc="file", upFile=null, editing=null, delArmed=false;
$("upType").innerHTML=Object.entries(TYPES).filter(([k])=>k!=="all").map(([k,v])=>`<option value="${k}">${v}</option>`).join("");
function fillLists(){
  const units=[...new Set(MATERIALS.map(m=>m.unit).filter(Boolean))];
  $("unitList").innerHTML=units.map(u=>`<option value="${esc(u)}">`).join("");
  const u=$("upUnit").value.trim();
  const ls=[...new Set(MATERIALS.filter(m=>!u||m.unit===u).map(m=>m.lesson).filter(Boolean))];
  $("lessonList").innerHTML=ls.map(l=>`<option value="${esc(l)}">`).join("");
}
$("upUnit").addEventListener("input",fillLists);
function setSrc(s){
  upSrc=s; document.querySelectorAll("#upForm [data-src]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.src===s));
  $("upDrop").hidden=s!=="file"; $("upLinkF").hidden=s!=="link";
}
document.querySelectorAll("#upForm [data-src]").forEach(b=>b.addEventListener("click",()=>{setSrc(b.dataset.src);msg("upMsg","");}));
function extOf(n){return (String(n).split(".").pop()||"").toLowerCase();}
function guessType(mime,url){
  if(url){ if(/youtu\.?be/.test(url))return"video"; if(/docs\.google\.com\/presentation|canva\.com/.test(url))return"ppt"; if(/forms\.gle|docs\.google\.com\/forms|quizizz|kahoot|wordwall/.test(url))return"quiz"; return"other"; }
  if(/presentation|powerpoint/.test(mime))return"ppt"; if(isImg(mime))return"other"; return"pdf";
}
function pickFile(f){
  if(!f)return;
  const mime=f.type&&EXT_MIME[extOf(f.name)]?EXT_MIME[extOf(f.name)]:(f.type||EXT_MIME[extOf(f.name)]||"");
  if(!Object.values(EXT_MIME).includes(mime)){msg("upMsg","這種檔案不能上傳。可以上傳 PDF、Word、PowerPoint 或圖片。","err");return;}
  if(f.size>MAX_MB*1024*1024){msg("upMsg",`檔案太大（${(f.size/1048576).toFixed(1)} MB），請小於 ${MAX_MB} MB。影片請先放到 YouTube 再貼網址。`,"err");return;}
  upFile={f,mime}; if(!editing)keptFile=upFile; msg("upMsg","");
  $("upFileName").textContent="✓ "+f.name+"（"+(f.size/1048576).toFixed(1)+" MB）";
  if(!$("upTitle").value.trim())$("upTitle").value=f.name.replace(/\.[^.]+$/,"").replace(/[_]+/g," ").slice(0,120);
  if(!editing)$("upType").value=guessType(mime);
  saveDraft();
}
$("upFile").addEventListener("change",e=>pickFile(e.target.files[0]));
const drop=$("upDrop");
["dragenter","dragover"].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.add("over");}));
["dragleave","drop"].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.remove("over");}));
drop.addEventListener("drop",e=>pickFile(e.dataTransfer.files[0]));
$("upUrl").addEventListener("change",()=>{const u=$("upUrl").value.trim();if(u&&!editing)$("upType").value=guessType("",u);});

/* 還沒存的內容自動保留（存在這個分頁，重新整理也還在）；按「取消」或儲存成功才清掉 */
const DRAFT_F=["upUrl","upTitle","upUnit","upLesson","upTopic","upType","upGrade","upPages","upMins","upNote"];
function draftKey(){return "clsUpDraft:"+(editing?editing.id:cardItem?"card:"+cardItem.url:"new");}
function saveDraft(){
  if($("upDlg").hidden)return;
  const d={src:upSrc,hide:$("upHide").checked}; DRAFT_F.forEach(f=>d[f]=$(f).value);
  try{sessionStorage.setItem(draftKey(),JSON.stringify(d))}catch(e){}
}
function clearDraft(){try{sessionStorage.removeItem(draftKey())}catch(e){} keptFile=null;}
let keptFile=null; /* 選好的檔案也先留著（同一個分頁內） */
$("upForm").addEventListener("input",saveDraft);
$("upForm").addEventListener("change",saveDraft);
let cardItem=null, resetArmed=false;
function setCardMode(on){
  document.querySelector("#upForm .seg").hidden=on; $("upHideF").hidden=!on; $("upHint").hidden=on;
  if(on){$("upDrop").hidden=true;$("upLinkF").hidden=true;}
  $("upReset").hidden=true; $("upReset").textContent="還原成原本的資料"; $("upReset").classList.remove("armed"); resetArmed=false;
}
/* 編輯網站內建教材的卡片資訊 */
function openCard(url){
  const o=ORIG.find(x=>x.url===url), m=MATERIALS.find(x=>x.url===url); if(!o||!m)return;
  editing=null; cardItem=o; upFile=null;
  $("upForm").reset(); $("upBar").hidden=true; msg("upMsg","");
  setCardMode(true);
  $("upH").textContent="編輯卡片資訊"; $("upDel").hidden=true;
  $("upTitle").value=m.title||""; $("upUnit").value=m.unit||""; $("upLesson").value=m.lesson||""; $("upTopic").value=m.topic||"";
  $("upType").value=m.type||"other"; $("upGrade").value=(m.grades&&m.grades.length?m.grades:[m.grade||4]).join(",");
  if(!$("upGrade").value)$("upGrade").value="4";
  $("upPages").value=m.pages||""; $("upMins").value=m.mins||""; $("upNote").value=m.note||""; $("upHide").checked=!!m.hidden;
  $("upReset").hidden=!overrides[url];
  let d=null; try{d=JSON.parse(sessionStorage.getItem(draftKey())||"null")}catch(e){}
  if(d){DRAFT_F.forEach(f=>{if(d[f]!=null&&f!=="upUrl")$(f).value=d[f];}); if(d.hide!=null)$("upHide").checked=d.hide; msg("upMsg","已恢復剛才還沒儲存的內容。","ok");}
  fillLists(); openDlg("upDlg","#upTitle");
}
function openUpload(row){
  editing=row||null; cardItem=null; upFile=null; delArmed=false; setCardMode(false);
  $("upForm").reset(); $("upBar").hidden=true; msg("upMsg","");
  $("upH").textContent=row?"編輯教材":"新增教材";
  $("upDel").hidden=!row; $("upDel").textContent="刪除"; $("upDel").classList.remove("armed");
  $("upFileName").textContent=row&&row.kind==="file"?"目前檔案已上傳；要換檔案再點這裡選擇":"點這裡選擇檔案，或把檔案拖進來";
  const lastUnit=(MATERIALS[MATERIALS.length-1]||{}).unit||"";
  const r=row||{kind:"file",unit:lastUnit,lesson:"",topic:"",title:"",type:"pdf",grade:curGrade!=="all"?+curGrade:4,grades:[],pages:"",mins:"",note:""};
  setSrc(r.kind);
  $("upUrl").value=r.kind==="link"?r.url||"":"";
  $("upTitle").value=r.title; $("upUnit").value=r.unit; $("upLesson").value=r.lesson; $("upTopic").value=r.topic||"";
  $("upType").value=r.type||"other"; $("upGrade").value=(r.grades&&r.grades.length?r.grades:[r.grade||4]).join(","); $("upPages").value=r.pages||""; $("upMins").value=r.mins||""; $("upNote").value=r.note||"";
  document.querySelectorAll("#upForm [data-src]").forEach(b=>b.disabled=!!row);
  /* 恢復上次沒存的內容 */
  let d=null; try{d=JSON.parse(sessionStorage.getItem(draftKey())||"null")}catch(e){}
  if(d){ if(!row)setSrc(d.src||"file"); DRAFT_F.forEach(f=>{if(d[f]!=null)$(f).value=d[f];}); }
  if(!row&&keptFile){upFile=keptFile;$("upFileName").textContent="✓ "+keptFile.f.name+"（"+(keptFile.f.size/1048576).toFixed(1)+" MB）";}
  if(d||(!row&&keptFile))msg("upMsg","已恢復剛才還沒儲存的內容。","ok");
  fillLists(); openDlg("upDlg","#upTitle");
}
$("addBtn").addEventListener("click",()=>openUpload(null));
$("units").addEventListener("click",e=>{const b=e.target.closest(".edit-btn");if(!b)return;if(b.dataset.card){openCard(b.dataset.card);return;}const r=uploads.find(x=>x.id===b.dataset.edit);if(r)openUpload(r);});

function uploadFile(file,mime,path,onProg){
  return CLS.token().then(t=>new Promise((res,rej)=>{
    if(!t){rej(new Error("登入已過期，請重新登入"));return;}
    const x=new XMLHttpRequest();
    x.open("POST",CLS.url+"/storage/v1/object/materials/"+path);
    x.setRequestHeader("apikey",CLS.key); x.setRequestHeader("Authorization","Bearer "+t);
    x.setRequestHeader("Content-Type",mime); x.setRequestHeader("x-upsert","false"); x.setRequestHeader("cache-control","max-age=31536000");
    x.upload.onprogress=e=>{if(e.lengthComputable)onProg(e.loaded/e.total);};
    x.onload=()=>x.status<300?res():rej(new Error("檔案上傳失敗（"+x.status+"）"));
    x.onerror=()=>rej(new Error("網路中斷，檔案沒有上傳成功"));
    x.send(file);
  }));
}
function removeFile(path){
  if(!path)return Promise.resolve();
  return CLS.api("storage/v1/object/materials",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({prefixes:[path]})}).catch(()=>{});
}
$("upForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!CLS.isTeacher){msg("upMsg","請先用老師帳號登入","err");return;}
  if(navigator.onLine===false){msg("upMsg","目前沒有網路，連上網路後再上傳","err");return;}
  const title=$("upTitle").value.trim();
  if(cardItem){ await saveCard(title); return; }
  const url=$("upUrl").value.trim();
  if(upSrc==="file"&&!editing&&!upFile){msg("upMsg","請先選擇要上傳的檔案","err");return;}
  if(upSrc==="link"&&!/^https?:\/\/\S+\.\S+/.test(url)){msg("upMsg","請貼上完整的網址（https:// 開頭）","err");return;}
  if(!title){msg("upMsg","請輸入標題","err");$("upTitle").focus();return;}
  const row={title,unit:$("upUnit").value.trim(),lesson:$("upLesson").value.trim(),topic:$("upTopic").value.trim(),
    type:$("upType").value,grades:$("upGrade").value.split(",").map(Number),grade:$("upGrade").value.includes(",")?0:+$("upGrade").value,pages:$("upPages").value.trim(),mins:Math.round(+$("upMins").value)||null,note:$("upNote").value.trim()};
  $("upGo").disabled=true;
  try{
    let oldPath=null;
    if(upSrc==="link"){row.kind="link";row.url=url;}
    if(upFile){
      const path="u/"+new Date().getFullYear()+"/"+Date.now().toString(36)+Math.random().toString(36).slice(2,8)+"."+extOf(upFile.f.name);
      $("upBar").hidden=false; $("upBar").firstElementChild.style.width="0%"; msg("upMsg","上傳檔案中…");
      await uploadFile(upFile.f,upFile.mime,path,p=>{$("upBar").firstElementChild.style.width=Math.round(p*100)+"%";msg("upMsg","上傳檔案中… "+Math.round(p*100)+"%");});
      Object.assign(row,{kind:"file",path,mime:upFile.mime,size:upFile.f.size,url:null});
      if(editing&&editing.path)oldPath=editing.path;
    }
    msg("upMsg","儲存中…");
    const r=editing
      ? await CLS.api("rest/v1/materials?id=eq."+editing.id,{method:"PATCH",headers:{"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify(Object.assign(row,{updated_at:new Date().toISOString()}))})
      : await CLS.api("rest/v1/materials",{method:"POST",headers:{"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify(row)});
    if(!r.ok){ if(upFile&&row.path)removeFile(row.path); throw new Error("儲存失敗（"+r.status+"），請重新登入後再試"); }
    if(oldPath)removeFile(oldPath);
    clearDraft();
    await fetchUploads();
    closeDlg("upDlg");
    const saved=(await r.json())[0];
    if(saved){const uk=(saved.grade||0)+"|"+(saved.unit||"老師上傳的教材");openSet[uk]=1;saveOpen();render();
      const c=document.querySelector('.edit-btn[data-edit="'+saved.id+'"]');if(c){c.closest(".card").scrollIntoView({block:"center",behavior:"smooth"});c.focus({preventScroll:true});}}
  }catch(err){msg("upMsg",err.message||"發生錯誤，請再試一次","err");}
  finally{$("upGo").disabled=false;}
});
/* 存卡片資訊：只存跟原本不一樣的欄位 */
async function saveCard(title){
  if(!title){msg("upMsg","請輸入標題","err");$("upTitle").focus();return;}
  const gv=$("upGrade").value, gs=gv.split(",").map(Number);
  const now={title,unit:$("upUnit").value.trim(),lesson:$("upLesson").value.trim(),topic:$("upTopic").value.trim(),type:$("upType").value,
    grade:gv.includes(",")?0:+gv,grades:gs,pages:$("upPages").value.trim(),mins:Math.round(+$("upMins").value)||0,note:$("upNote").value.trim()};
  const o=cardItem, og={grade:o.grade||0,grades:o.grades&&o.grades.length?o.grades:[o.grade||0]};
  const data={};
  CARD_F.forEach(k=>{
    const a=k==="grades"?og.grades:k==="grade"?og.grade:(o[k]==null?(k==="mins"?0:""):o[k]);
    if(JSON.stringify(a)!==JSON.stringify(now[k]))data[k]=now[k];
  });
  if(("grades" in data)&&!("grade" in data))data.grade=now.grade;
  if(("grade" in data)&&!("grades" in data))data.grades=now.grades;
  const hidden=$("upHide").checked;
  $("upGo").disabled=true; msg("upMsg","儲存中…");
  try{
    const r=(!Object.keys(data).length&&!hidden)
      ? await CLS.api("rest/v1/overrides?url=eq."+encodeURIComponent(o.url),{method:"DELETE"})
      : await CLS.api("rest/v1/overrides?on_conflict=url",{method:"POST",headers:{"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},
          body:JSON.stringify({url:o.url,data,hidden,updated_at:new Date().toISOString()})});
    if(!r.ok)throw new Error("儲存失敗（"+r.status+"），請重新登入後再試");
    clearDraft(); await fetchOverrides(); applyUploads(); closeDlg("upDlg");
    const m=MATERIALS.find(x=>x.url===o.url); if(m){openSet[(m.grade||0)+"|"+(m.unit||"未分單元")]=1;saveOpen();}
    render();
    const c=document.querySelector('.edit-btn[data-card="'+CSS.escape(o.url)+'"]');if(c){c.closest(".card").scrollIntoView({block:"center",behavior:"smooth"});c.focus({preventScroll:true});}
  }catch(err){msg("upMsg",err.message||"發生錯誤，請再試一次","err");}
  finally{$("upGo").disabled=false;}
}
$("upReset").addEventListener("click",async()=>{
  if(!cardItem)return;
  if(!resetArmed){resetArmed=true;$("upReset").textContent="再按一次確定還原";$("upReset").classList.add("armed");return;}
  $("upReset").disabled=true; msg("upMsg","還原中…");
  try{
    const r=await CLS.api("rest/v1/overrides?url=eq."+encodeURIComponent(cardItem.url),{method:"DELETE"});
    if(!r.ok)throw new Error("還原失敗（"+r.status+"）");
    clearDraft(); await fetchOverrides(); applyUploads(); closeDlg("upDlg"); render();
  }catch(err){msg("upMsg",err.message,"err");}
  finally{$("upReset").disabled=false;}
});
$("upDel").addEventListener("click",async()=>{
  if(!editing)return;
  if(!delArmed){delArmed=true;$("upDel").textContent="再按一次確定刪除";$("upDel").classList.add("armed");return;}
  $("upDel").disabled=true; msg("upMsg","刪除中…");
  try{
    const r=await CLS.api("rest/v1/materials?id=eq."+editing.id,{method:"DELETE"});
    if(!r.ok)throw new Error("刪除失敗（"+r.status+"）");
    removeFile(editing.path);
    const u="lessons/view.html?id="+editing.id;
    if(doneSet[u]){delete doneSet[u];save("shelfDone",doneSet);} if(weekSet[u]){delete weekSet[u];save("shelfWeek",weekSet);}
    clearDraft(); await fetchUploads(); closeDlg("upDlg"); render();
  }catch(err){msg("upMsg",err.message,"err");}
  finally{$("upDel").disabled=false;}
});

renderAcct();
render();
fetchUploads();
document.addEventListener("visibilitychange",()=>{if(!document.hidden)fetchUploads();});
setInterval(()=>{if(!document.hidden)fetchUploads();},60000);
/* 離線使用：把教材存到這台電腦（只在正式網站上執行） */
(function(){
  if(!("serviceWorker" in navigator)||(location.protocol!=="https:"&&location.hostname!=="localhost"))return;
  navigator.serviceWorker.register("sw.js").catch(()=>{});
  const el=$("offline");let tries=0;
  async function check(){
    try{
      const urls=MATERIALS.filter(m=>!m.up).map(m=>m.url).filter(Boolean);let n=0;
      for(const u of urls){if(await caches.match(u))n++;}
      el.textContent=n>=urls.length?"・已存到這台電腦，網路斷線也能用":"・正在存到這台電腦（"+n+" / "+urls.length+"）";
      if(n<urls.length&&++tries<40)setTimeout(check,3000);
    }catch(e){}
  }
  navigator.serviceWorker.ready.then(check).catch(()=>{});
})();
