/* 教室小書櫃｜上課工具視窗：計時器、抽籤、小白板
   由 assets/home-fab.js 自動載入，每份教材打開時出現在右上角，可拖曳、可收起。
   位置、計時器、抽籤紀錄存在這台電腦（localStorage），換教材時會延續；白板內容只保留在目前這一頁。 */
(function () {
  if (window.__classTools) return;
  window.__classTools = true;

  /* ---------- 小工具 ---------- */
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function btn(cls, text, label) { var b = el("button", cls, text); b.type = "button"; if (label) b.setAttribute("aria-label", label); return b; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmt(s) { s = Math.max(0, Math.round(s)); return pad(Math.floor(s / 60)) + ":" + pad(s % 60); }
  function stop(e) { e.stopPropagation(); }

  var FONT = "'Noto Sans TC','PingFang TC','Microsoft JhengHei',system-ui,sans-serif";
  var DISPLAY = "'Huninn','Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif";
  var Z = 2147483002;

  /* ---------- 樣式 ---------- */
  var css = [
    ".ct-panel,.ct-panel *,.ct-big,.ct-big *,.ct-wb,.ct-wb *,.ct-alarm,.ct-alarm *{box-sizing:border-box}",
    ".ct-panel{position:fixed;z-index:" + Z + ";width:min(340px,calc(100vw - 24px));background:#FFFFFF;color:#1F2A27;border:2px solid #1E3A34;border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,.25);font:400 16px/1.5 " + FONT + ";touch-action:none;user-select:none;-webkit-user-select:none;text-align:left}",
    ".ct-panel button,.ct-big button,.ct-wb button,.ct-alarm button{appearance:none;-webkit-appearance:none;margin:0;font:700 16px/1.2 " + FONT + ";cursor:pointer;-webkit-tap-highlight-color:transparent;letter-spacing:0;text-transform:none;box-shadow:none;text-shadow:none}",
    ".ct-panel button:active,.ct-big button:active,.ct-wb button:active,.ct-alarm button:active{transform:scale(.96)}",
    ".ct-panel button:focus-visible,.ct-big button:focus-visible,.ct-wb button:focus-visible,.ct-alarm button:focus-visible{outline:3px solid #F5B521;outline-offset:2px}",
    ".ct-head{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 14px;min-height:52px;cursor:grab;border-radius:18px 18px 0 0;background:#1E3A34;color:#FFFFFF}",
    ".ct-head:active{cursor:grabbing}",
    ".ct-grip{opacity:.6;font-size:14px;letter-spacing:-2px}",
    ".ct-head b{font:400 19px/1 " + DISPLAY + ";color:#FFFFFF;margin:0}",
    ".ct-mini{margin-left:auto;font:700 18px/1 " + FONT + ";font-variant-numeric:tabular-nums;color:#FFE08A}",
    ".ct-mini.alarm{color:#FF8A8A}",
    ".ct-tog{min-height:44px;min-width:64px;padding:0 14px;border-radius:999px;border:2px solid rgba(255,255,255,.5);background:transparent;color:#FFFFFF}",
    ".ct-panel.collapsed{width:auto;max-width:calc(100vw - 24px)}",
    ".ct-panel.collapsed .ct-head{border-radius:18px}",
    ".ct-panel.collapsed .ct-tabs,.ct-panel.collapsed .ct-body{display:none}",
    ".ct-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:10px 10px 0}",
    ".ct-tabs button{min-height:46px;border-radius:12px;border:2px solid #C9DBD3;background:#F4F8F6;color:#1E3A34}",
    ".ct-tabs button[aria-selected=true]{background:#1E3A34;border-color:#1E3A34;color:#FFFFFF}",
    ".ct-body{padding:12px;display:grid;gap:10px}",
    ".ct-sec[hidden]{display:none}",
    ".ct-sec{display:grid;gap:10px}",
    ".ct-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
    ".ct-row.even>button{flex:1 1 0}",
    ".ct-b{min-height:46px;padding:0 14px;border-radius:12px;border:2px solid #1E3A34;background:#FFFFFF;color:#1E3A34}",
    ".ct-b.fill{background:#1E3A34;color:#FFFFFF}",
    ".ct-b.hot{background:#C4501E;border-color:#C4501E;color:#FFFFFF}",
    ".ct-b[aria-pressed=true]{background:#E0F0EA;border-color:#2A7563;color:#1E3A34}",
    ".ct-b:disabled{opacity:.45;cursor:default;transform:none}",
    ".ct-time{font:400 64px/1 " + DISPLAY + ";font-variant-numeric:tabular-nums;text-align:center;padding:6px 0;color:#1E3A34}",
    ".ct-time.warn{color:#B0333D}",
    ".ct-time.done{color:#B0333D;animation:ct-blink 1s steps(2) infinite}",
    "@keyframes ct-blink{50%{opacity:.25}}",
    ".ct-num{font:400 84px/1 " + DISPLAY + ";text-align:center;color:#C4501E;min-height:96px;display:grid;place-items:center;font-variant-numeric:tabular-nums}",
    ".ct-num.rolling{color:#93A6A0}",
    ".ct-range{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-weight:700}",
    ".ct-range input{width:76px;min-height:46px;border:2px solid #C9DBD3;border-radius:12px;text-align:center;font:700 20px/1 " + FONT + ";color:#1F2A27;background:#FFFFFF;user-select:text;-webkit-user-select:text}",
    ".ct-step{min-width:46px}",
    ".ct-hist{font-size:14px;color:#4A5A55;min-height:1.5em;overflow-wrap:anywhere}",
    ".ct-note{font-size:14px;color:#4A5A55;margin:0}",
    /* 大畫面 */
    ".ct-big{position:fixed;inset:0;z-index:" + (Z + 2) + ";background:#10201C;color:#FFFFFF;display:grid;grid-template-rows:1fr auto;place-items:center;padding:24px;font-family:" + FONT + "}",
    ".ct-big[hidden],.ct-wb[hidden],.ct-alarm[hidden]{display:none}",
    ".ct-big .v{font:400 min(34vw,62vh)/1 " + DISPLAY + ";font-variant-numeric:tabular-nums;letter-spacing:.02em}",
    ".ct-big .v.warn,.ct-big .v.done{color:#FF8A8A}",
    ".ct-big .v.done{animation:ct-blink 1s steps(2) infinite}",
    ".ct-big .v.draw{color:#FFC08A}",
    ".ct-big .cap{font:400 min(5vw,4vh)/1.3 " + DISPLAY + ";color:#C9DBD3;text-align:center}",
    ".ct-big .bar{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}",
    ".ct-big .bar button{min-height:60px;padding:0 28px;border-radius:999px;border:2px solid #FFFFFF;background:transparent;color:#FFFFFF;font-size:22px}",
    ".ct-big .bar button.fill{background:#FFFFFF;color:#10201C}",
    /* 時間到 */
    ".ct-alarm{position:fixed;inset:0;z-index:" + (Z + 4) + ";background:rgba(176,51,61,.92);display:grid;place-items:center;text-align:center;color:#FFFFFF;padding:24px}",
    ".ct-alarm b{display:block;font:400 min(16vw,22vh)/1.1 " + DISPLAY + "}",
    ".ct-alarm button{margin-top:24px;min-height:64px;padding:0 40px;border-radius:999px;border:0;background:#FFFFFF;color:#B0333D;font-size:24px}",
    /* 白板 */
    ".ct-wb{position:fixed;inset:0;z-index:" + (Z + 1) + ";touch-action:none;font-family:" + FONT + "}",
    ".ct-wb.white{background:#FFFFFF}",
    ".ct-wb.grid{background-color:#FFFFFF;background-image:linear-gradient(#DCE7E2 1px,transparent 1px),linear-gradient(90deg,#DCE7E2 1px,transparent 1px);background-size:40px 40px}",
    ".ct-wb.clear{background:rgba(255,255,255,0);outline:6px solid #F5B521;outline-offset:-6px}",
    ".ct-wb canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:crosshair}",
    ".ct-wbbar{position:absolute;top:10px;left:50%;transform:translateX(-50%);display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:6px;padding:8px 10px;max-width:calc(100vw - 20px);background:#FFFFFF;border:2px solid #1E3A34;border-radius:18px;box-shadow:0 6px 20px rgba(0,0,0,.2);z-index:1}",
    ".ct-wbbar .sep{width:2px;align-self:stretch;background:#E3ECE8;margin:0 2px}",
    ".ct-sw{width:46px;height:46px;border-radius:50%;border:3px solid #FFFFFF;box-shadow:0 0 0 2px #C9DBD3}",
    ".ct-sw[aria-pressed=true]{box-shadow:0 0 0 3px #1E3A34}",
    ".ct-sz{width:46px;height:46px;border-radius:12px;border:2px solid #C9DBD3;background:#FFFFFF;display:grid;place-items:center}",
    ".ct-sz i{display:block;border-radius:50%;background:#1E3A34}",
    ".ct-sz[aria-pressed=true]{border-color:#1E3A34;background:#E0F0EA}",
    ".ct-wbbar .ct-b{min-height:46px}",
    "html.ct-wb-open .cls-fabs,html.ct-wb-open .ct-panel{display:none!important}",
    "@media print{.ct-panel,.ct-big,.ct-wb,.ct-alarm{display:none!important}}",
    "@media (prefers-reduced-motion:reduce){.ct-time.done,.ct-big .v.done{animation:none}}"
  ].join("\n");
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- 面板 ---------- */
  var panel = el("div", "ct-panel");
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", "上課工具");
  var head = el("div", "ct-head");
  head.appendChild(el("span", "ct-grip", "⋮⋮")).setAttribute("aria-hidden", "true");
  head.appendChild(el("b", "", "上課工具"));
  var mini = head.appendChild(el("span", "ct-mini"));
  var tog = head.appendChild(btn("ct-tog", "收起"));
  panel.appendChild(head);

  var tabs = el("div", "ct-tabs");
  tabs.setAttribute("role", "tablist");
  var body = el("div", "ct-body");
  var TABS = [["timer", "計時器"], ["draw", "抽籤"], ["board", "小白板"]];
  var secs = {}, tabBtns = {};
  TABS.forEach(function (t) {
    var b = btn("", t[1]);
    b.setAttribute("role", "tab");
    b.dataset.t = t[0];
    tabs.appendChild(b);
    tabBtns[t[0]] = b;
    var s = el("section", "ct-sec");
    s.setAttribute("role", "tabpanel");
    s.setAttribute("aria-label", t[1]);
    body.appendChild(s);
    secs[t[0]] = s;
  });
  panel.appendChild(tabs);
  panel.appendChild(body);

  var curTab = load("ctTab", "timer");
  if (!secs[curTab]) curTab = "timer";
  function showTab(t) {
    curTab = t;
    save("ctTab", t);
    TABS.forEach(function (x) {
      secs[x[0]].hidden = x[0] !== t;
      tabBtns[x[0]].setAttribute("aria-selected", x[0] === t ? "true" : "false");
    });
  }
  tabs.addEventListener("click", function (e) { var b = e.target.closest("button[data-t]"); if (b) showTab(b.dataset.t); });

  /* 收起／展開：大螢幕預設展開，手機（學生掃 QR 打開）預設收起 */
  var collapsed = window.innerWidth < 900;
  function setCollapsed(c) {
    collapsed = c;
    panel.classList.toggle("collapsed", c);
    tog.textContent = c ? "展開" : "收起";
    tog.setAttribute("aria-expanded", c ? "false" : "true");
    clampPos();
  }
  tog.addEventListener("click", function () { setCollapsed(!collapsed); });

  /* 拖曳 */
  /* 位置：每份教材各自記住老師拖到哪裡；沒拖過時，放在右上角、避開教材本身的按鈕 */
  var POS_KEY = "ctPos:" + (location.pathname.split("/").pop() || "index");
  var pos = load(POS_KEY, null), autoY = null;
  function findFreeY() {
    var w = panel.offsetWidth || 340, h = panel.offsetHeight || 300, x = window.innerWidth - w - 12;
    var rects = [];
    document.querySelectorAll("button,a[href],input,select,textarea,[role=button],[tabindex]").forEach(function (e) {
      if (panel.contains(e) || e.closest(".cls-fabs,.ct-wb,.ct-big,.ct-alarm,[hidden]")) return;
      var r = e.getBoundingClientRect();
      if (r.width && r.height && r.right > x && r.left < x + w) rects.push(r);
    });
    for (var y = 12; y + Math.min(h, 200) < window.innerHeight; y += 12) {
      var hit = rects.some(function (r) { return r.bottom > y - 4 && r.top < y + h + 4; });
      if (!hit) return y;
    }
    return 12;
  }
  function clampPos() {
    var w = panel.offsetWidth || 340, h = panel.offsetHeight || 60;
    var x = pos ? pos.x : window.innerWidth - w - 12;
    var y = pos ? pos.y : (autoY != null ? autoY : 12);
    x = Math.min(Math.max(8, x), Math.max(8, window.innerWidth - w - 8));
    y = Math.min(Math.max(8, y), Math.max(8, window.innerHeight - Math.min(h, 120) - 8));
    panel.style.left = x + "px";
    panel.style.top = y + "px";
  }
  var drag = null;
  head.addEventListener("pointerdown", function (e) {
    if (e.target.closest("button")) return;
    var r = panel.getBoundingClientRect();
    drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false };
    try { head.setPointerCapture(e.pointerId); } catch (err) {}
  });
  head.addEventListener("pointermove", function (e) {
    if (!drag || drag.id !== e.pointerId) return;
    if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 6) drag.moved = true;
    if (!drag.moved) return;
    pos = { x: e.clientX - drag.dx, y: e.clientY - drag.dy };
    clampPos();
  });
  function endDrag(e) {
    if (!drag || drag.id !== e.pointerId) return;
    if (drag.moved) { var r = panel.getBoundingClientRect(); pos = { x: r.left, y: r.top }; save(POS_KEY, pos); }
    else if (collapsed) setCollapsed(false);
    drag = null;
  }
  head.addEventListener("pointerup", endDrag);
  head.addEventListener("pointercancel", endDrag);
  window.addEventListener("resize", clampPos);

  /* 面板裡的按鍵不要觸發教材本身的快捷鍵（例如空白鍵播放） */
  panel.addEventListener("keydown", stop);
  panel.addEventListener("keyup", stop);

  /* ---------- 聲音 ---------- */
  var actx = null;
  function audio() {
    try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch (e) {}
    return actx;
  }
  function beep(times) {
    var a = audio(); if (!a) return;
    for (var i = 0; i < times; i++) {
      var t0 = a.currentTime + i * 0.45, o = a.createOscillator(), g = a.createGain();
      o.type = "sine"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + 0.4);
    }
  }
  function tick() {
    var a = audio(); if (!a) return;
    var t0 = a.currentTime, o = a.createOscillator(), g = a.createGain();
    o.type = "triangle"; o.frequency.value = 1200;
    g.gain.setValueAtTime(0.15, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + 0.06);
  }

  /* ---------- 大畫面 ---------- */
  var big = el("div", "ct-big");
  big.hidden = true;
  big.setAttribute("role", "dialog");
  big.setAttribute("aria-label", "大畫面");
  var bigV = big.appendChild(el("div", "v"));
  var bigBottom = big.appendChild(el("div", ""));
  bigBottom.style.cssText = "display:grid;gap:16px;justify-items:center";
  var bigCap = bigBottom.appendChild(el("div", "cap"));
  var bigBar = bigBottom.appendChild(el("div", "bar"));
  var bigMode = null;
  big.addEventListener("keydown", function (e) { stop(e); if (e.key === "Escape") closeBig(); });
  function openBig(mode) { bigMode = mode; big.hidden = false; renderBig(); var f = bigBar.querySelector("button"); if (f) f.focus(); }
  function closeBig() { big.hidden = true; bigMode = null; }

  /* ---------- 計時器 ---------- */
  var T = load("ctTimer", { dur: 300, left: 300, end: null });
  if (T.end && T.end <= Date.now()) { T.left = 0; T.end = null; }
  var tTime = el("div", "ct-time");
  tTime.setAttribute("role", "timer");
  var tPre = el("div", "ct-row even");
  [1, 3, 5, 10].forEach(function (m) { var b = btn("ct-b", m + " 分"); b.dataset.m = m; tPre.appendChild(b); });
  var tAdj = el("div", "ct-row even");
  var bMinus = tAdj.appendChild(btn("ct-b", "− 1 分", "減少 1 分鐘"));
  var bPlus = tAdj.appendChild(btn("ct-b", "＋ 1 分", "增加 1 分鐘"));
  var bPlus30 = tAdj.appendChild(btn("ct-b", "＋ 30 秒", "增加 30 秒"));
  var tCtl = el("div", "ct-row even");
  var bGo = tCtl.appendChild(btn("ct-b fill", "開始"));
  var bReset = tCtl.appendChild(btn("ct-b", "重設"));
  var bBigT = tCtl.appendChild(btn("ct-b", "放大"));
  [tTime, tPre, tAdj, tCtl].forEach(function (x) { secs.timer.appendChild(x); });

  var alarmOn = false;
  function running() { return !!T.end; }
  function left() { return running() ? Math.max(0, (T.end - Date.now()) / 1000) : T.left; }
  function saveT() { save("ctTimer", T); }
  function setDur(s) { s = Math.max(10, Math.min(99 * 60, Math.round(s))); T.dur = s; T.left = s; if (running()) T.end = Date.now() + s * 1000; alarmOn = false; saveT(); renderT(); }
  function start() { audio(); if (T.left <= 0) T.left = T.dur; T.end = Date.now() + T.left * 1000; alarmOn = false; saveT(); renderT(); }
  function pause() { T.left = left(); T.end = null; saveT(); renderT(); }
  function reset() { T.end = null; T.left = T.dur; alarmOn = false; alarm.hidden = true; saveT(); renderT(); }
  function adjust(d) {
    if (running()) { T.end = Math.max(Date.now() + 1000, T.end + d * 1000); }
    else { T.left = Math.max(0, Math.min(99 * 60, Math.round(T.left) + d)); if (T.left > 0) T.dur = T.left; }
    alarmOn = false; saveT(); renderT();
  }
  tPre.addEventListener("click", function (e) { var b = e.target.closest("button[data-m]"); if (b) setDur(+b.dataset.m * 60); });
  bMinus.addEventListener("click", function () { adjust(-60); });
  bPlus.addEventListener("click", function () { adjust(60); });
  bPlus30.addEventListener("click", function () { adjust(30); });
  bGo.addEventListener("click", function () { running() ? pause() : start(); });
  bReset.addEventListener("click", reset);
  bBigT.addEventListener("click", function () { openBig("timer"); });

  var alarm = el("div", "ct-alarm");
  alarm.hidden = true;
  alarm.setAttribute("role", "alertdialog");
  alarm.setAttribute("aria-label", "時間到");
  alarm.innerHTML = "<div><b>時間到！</b></div>";
  var bAlarmOk = alarm.firstChild.appendChild(btn("", "知道了"));
  bAlarmOk.addEventListener("click", function () { alarm.hidden = true; });
  alarm.addEventListener("click", function (e) { if (e.target === alarm) alarm.hidden = true; });
  alarm.addEventListener("keydown", function (e) { stop(e); if (e.key === "Escape" || e.key === "Enter") alarm.hidden = true; });

  function finish() {
    T.end = null; T.left = 0; alarmOn = true; saveT();
    beep(3);
    alarm.hidden = false;
    bAlarmOk.focus();
    renderT();
  }
  var lastSec = -1;
  function renderT() {
    var s = left();
    var txt = fmt(Math.ceil(s - 0.001));
    tTime.textContent = txt;
    var warn = running() && s <= 10;
    tTime.className = "ct-time" + (alarmOn ? " done" : warn ? " warn" : "");
    bGo.textContent = running() ? "暫停" : (T.left > 0 && T.left < T.dur ? "繼續" : "開始");
    bGo.className = "ct-b " + (running() ? "hot" : "fill");
    mini.textContent = running() || alarmOn || T.left < T.dur ? (alarmOn ? "時間到" : txt) : "";
    mini.className = "ct-mini" + (alarmOn || warn ? " alarm" : "");
    if (bigMode === "timer") renderBig();
  }
  setInterval(function () {
    if (!running()) return;
    var s = left();
    var whole = Math.ceil(s - 0.001);
    if (whole !== lastSec && whole <= 5 && whole > 0) tick();
    lastSec = whole;
    if (s <= 0) finish(); else renderT();
  }, 200);

  /* ---------- 抽籤 ---------- */
  var D = load("ctDraw", { max: 30, norep: true, drawn: [] });
  var dRange = el("div", "ct-range");
  dRange.appendChild(el("span", "", "座號 1 到"));
  var dDec = dRange.appendChild(btn("ct-b ct-step", "−", "減少"));
  var dIn = dRange.appendChild(el("input"));
  dIn.type = "number"; dIn.min = 2; dIn.max = 99; dIn.inputMode = "numeric"; dIn.setAttribute("aria-label", "最大號碼");
  var dInc = dRange.appendChild(btn("ct-b ct-step", "＋", "增加"));
  var dNum = el("div", "ct-num", "?");
  dNum.setAttribute("aria-live", "polite");
  var dCtl = el("div", "ct-row even");
  var bDraw = dCtl.appendChild(btn("ct-b hot", "抽一個"));
  var bNorep = dCtl.appendChild(btn("ct-b", "不重複"));
  var dCtl2 = el("div", "ct-row even");
  var bDReset = dCtl2.appendChild(btn("ct-b", "重新開始"));
  var bBigD = dCtl2.appendChild(btn("ct-b", "放大"));
  var dHist = el("div", "ct-hist");
  [dRange, dNum, dCtl, dCtl2, dHist].forEach(function (x) { secs.draw.appendChild(x); });

  var rolling = false, lastPick = null;
  function saveD() { save("ctDraw", D); }
  function pool() { var a = []; for (var i = 1; i <= D.max; i++) if (!D.norep || D.drawn.indexOf(i) < 0) a.push(i); return a; }
  function setMax(n) { n = Math.max(2, Math.min(99, Math.round(+n) || D.max)); D.max = n; D.drawn = D.drawn.filter(function (x) { return x <= n; }); saveD(); renderD(); }
  dDec.addEventListener("click", function () { setMax(D.max - 1); });
  dInc.addEventListener("click", function () { setMax(D.max + 1); });
  dIn.addEventListener("change", function () { setMax(dIn.value); });
  bNorep.addEventListener("click", function () { D.norep = !D.norep; saveD(); renderD(); });
  bDReset.addEventListener("click", function () { D.drawn = []; lastPick = null; saveD(); renderD(); });
  bBigD.addEventListener("click", function () { openBig("draw"); });
  function doDraw() {
    if (rolling) return;
    var p = pool();
    if (!p.length) { renderD(); return; }
    audio();
    rolling = true; renderD();
    var pick = p[Math.floor(Math.random() * p.length)], n = 0, steps = 14;
    (function spin() {
      n++;
      var show = n < steps ? p[Math.floor(Math.random() * p.length)] : pick;
      dNum.textContent = show;
      if (bigMode === "draw") bigV.textContent = show;
      if (n < steps) { tick(); setTimeout(spin, 40 + n * 12); return; }
      rolling = false; lastPick = pick;
      if (D.drawn.indexOf(pick) < 0) D.drawn.push(pick);
      saveD(); beep(1); renderD();
    })();
  }
  bDraw.addEventListener("click", doDraw);
  function renderD() {
    if (document.activeElement !== dIn) dIn.value = D.max;
    var p = pool();
    if (!rolling) dNum.textContent = lastPick != null ? lastPick : "?";
    dNum.className = "ct-num" + (rolling ? " rolling" : "");
    bNorep.setAttribute("aria-pressed", D.norep ? "true" : "false");
    bNorep.textContent = D.norep ? "不重複 ✓" : "可重複";
    bDraw.disabled = rolling || !p.length;
    bDraw.textContent = p.length ? "抽一個" : "全部抽完了";
    dHist.textContent = D.drawn.length ? "已抽：" + D.drawn.join("、") + (D.norep ? "（還剩 " + p.length + " 個）" : "") : "還沒抽過，按「抽一個」開始。";
    if (bigMode === "draw") renderBig();
  }

  /* ---------- 大畫面內容 ---------- */
  function renderBig() {
    if (!bigMode) return;
    bigBar.innerHTML = "";
    var close = btn("", "關閉");
    close.addEventListener("click", closeBig);
    if (bigMode === "timer") {
      var s = left();
      bigV.textContent = fmt(Math.ceil(s - 0.001));
      bigV.className = "v" + (alarmOn ? " done" : running() && s <= 10 ? " warn" : "");
      bigCap.textContent = alarmOn ? "時間到！" : running() ? "" : "按「開始」計時";
      var g = btn("fill", running() ? "暫停" : "開始");
      g.addEventListener("click", function () { running() ? pause() : start(); });
      var r = btn("", "重設");
      r.addEventListener("click", reset);
      var p1 = btn("", "＋ 1 分");
      p1.addEventListener("click", function () { adjust(60); });
      [g, r, p1, close].forEach(function (b) { bigBar.appendChild(b); });
    } else {
      if (!rolling) bigV.textContent = lastPick != null ? lastPick : "?";
      bigV.className = "v draw";
      var p = pool();
      bigCap.textContent = "座號 1～" + D.max + (D.norep ? "・還剩 " + p.length + " 個" : "");
      var d = btn("fill", p.length ? "抽一個" : "全部抽完了");
      d.disabled = rolling || !p.length;
      d.addEventListener("click", doDraw);
      [d, close].forEach(function (b) { bigBar.appendChild(b); });
    }
  }

  /* ---------- 小白板 ---------- */
  var sBoard = secs.board;
  var bWhite = btn("ct-b fill", "打開白板（白底）");
  var bOver = btn("ct-b", "畫在教材上");
  var bRow1 = el("div", "ct-row even"); bRow1.appendChild(bWhite);
  var bRow2 = el("div", "ct-row even"); bRow2.appendChild(bOver);
  sBoard.appendChild(bRow1);
  sBoard.appendChild(bRow2);
  sBoard.appendChild(el("p", "ct-note", "「畫在教材上」會在目前的畫面上畫重點。白板上的內容在這一頁會保留，換到別的教材就會清掉。"));

  var wb = el("div", "ct-wb white");
  wb.hidden = true;
  wb.setAttribute("role", "dialog");
  wb.setAttribute("aria-label", "小白板");
  var cv = wb.appendChild(el("canvas"));
  var ctx = cv.getContext("2d");
  var bar = wb.appendChild(el("div", "ct-wbbar"));
  var COLORS = [["#1F2A27", "黑"], ["#D32F2F", "紅"], ["#1565C0", "藍"], ["#2E7D32", "綠"], ["#EF6C00", "橘"]];
  var SIZES = [[4, 8], [9, 14], [18, 22]];
  var pen = { c: COLORS[0][0], w: SIZES[1][0], er: false };
  var swBtns = [], szBtns = [];
  COLORS.forEach(function (c) {
    var b = btn("ct-sw", "", c[1] + "色筆");
    b.style.background = c[0];
    b.addEventListener("click", function () { pen.c = c[0]; pen.er = false; renderBar(); });
    bar.appendChild(b); swBtns.push([b, c[0]]);
  });
  bar.appendChild(el("span", "sep"));
  SIZES.forEach(function (s, i) {
    var b = btn("ct-sz", "<i style=\"width:" + s[1] + "px;height:" + s[1] + "px\"></i>", ["細", "中", "粗"][i]);
    b.addEventListener("click", function () { pen.w = s[0]; renderBar(); });
    bar.appendChild(b); szBtns.push([b, s[0]]);
  });
  bar.appendChild(el("span", "sep"));
  var bEr = bar.appendChild(btn("ct-b", "橡皮擦"));
  var bUndo = bar.appendChild(btn("ct-b", "復原"));
  var bClr = bar.appendChild(btn("ct-b", "全部清除"));
  var bBg = bar.appendChild(btn("ct-b", "背景"));
  var bWbClose = bar.appendChild(btn("ct-b fill", "關閉"));
  bEr.addEventListener("click", function () { pen.er = !pen.er; renderBar(); });

  var BG = [["white", "白板"], ["grid", "格線"], ["clear", "透明"]];
  var bg = "white";
  function setBg(b) { bg = b; wb.className = "ct-wb " + b; renderBar(); }
  bBg.addEventListener("click", function () { var i = 0; BG.forEach(function (x, k) { if (x[0] === bg) i = k; }); setBg(BG[(i + 1) % BG.length][0]); });

  function renderBar() {
    swBtns.forEach(function (x) { x[0].setAttribute("aria-pressed", !pen.er && pen.c === x[1] ? "true" : "false"); });
    szBtns.forEach(function (x) { x[0].setAttribute("aria-pressed", pen.w === x[1] ? "true" : "false"); });
    bEr.setAttribute("aria-pressed", pen.er ? "true" : "false");
    var name = ""; BG.forEach(function (x) { if (x[0] === bg) name = x[1]; });
    bBg.textContent = "背景：" + name;
    bUndo.disabled = !strokes.length;
  }

  var strokes = [], active = {}, dpr = 1;
  function sizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(window.innerWidth * dpr);
    cv.height = Math.round(window.innerHeight * dpr);
    redraw();
  }
  function seg(s, a, b) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = s.er ? "destination-out" : "source-over";
    ctx.strokeStyle = s.c;
    ctx.lineWidth = s.er ? s.w * 4 : s.w;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.restore();
  }
  function redraw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    var from = 0;
    for (var i = strokes.length - 1; i >= 0; i--) if (strokes[i].clear) { from = i + 1; break; }
    for (var j = from; j < strokes.length; j++) {
      var s = strokes[j], p = s.pts;
      if (p.length === 1) seg(s, p[0], [p[0][0] + 0.01, p[0][1]]);
      for (var k = 1; k < p.length; k++) seg(s, p[k - 1], p[k]);
    }
  }
  cv.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    var s = { c: pen.c, w: pen.w, er: pen.er, pts: [[e.clientX, e.clientY]] };
    strokes.push(s);
    active[e.pointerId] = s;
    seg(s, s.pts[0], [e.clientX + 0.01, e.clientY]);
    renderBar();
  });
  cv.addEventListener("pointermove", function (e) {
    var s = active[e.pointerId];
    if (!s) return;
    var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if (!evs.length) evs = [e];
    evs.forEach(function (ev) {
      var p = [ev.clientX, ev.clientY], last = s.pts[s.pts.length - 1];
      seg(s, last, p);
      s.pts.push(p);
    });
  });
  function endStroke(e) { delete active[e.pointerId]; }
  cv.addEventListener("pointerup", endStroke);
  cv.addEventListener("pointercancel", endStroke);
  bUndo.addEventListener("click", function () { strokes.pop(); redraw(); renderBar(); });
  bClr.addEventListener("click", function () { if (strokes.length && !strokes[strokes.length - 1].clear) strokes.push({ clear: true, pts: [] }); redraw(); renderBar(); });

  function openWb(mode) {
    setBg(mode);
    wb.hidden = false;
    document.documentElement.classList.add("ct-wb-open");
    sizeCanvas();
    renderBar();
    bWbClose.focus();
  }
  function closeWb() {
    wb.hidden = true;
    document.documentElement.classList.remove("ct-wb-open");
    tabBtns.board.focus();
  }
  bWhite.addEventListener("click", function () { openWb("white"); });
  bOver.addEventListener("click", function () { openWb("clear"); });
  bWbClose.addEventListener("click", closeWb);
  wb.addEventListener("keydown", function (e) {
    stop(e);
    if (e.key === "Escape") closeWb();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { strokes.pop(); redraw(); renderBar(); }
  });
  window.addEventListener("resize", function () { if (!wb.hidden) sizeCanvas(); });

  /* ---------- 放到畫面上（全螢幕時搬進全螢幕的區塊） ---------- */
  var layers = [panel, wb, big, alarm];
  function place() {
    var host = document.fullscreenElement || document.webkitFullscreenElement || document.body;
    layers.forEach(function (x) { if (x.parentNode !== host) host.appendChild(x); });
    clampPos();
  }
  document.addEventListener("fullscreenchange", place);
  document.addEventListener("webkitfullscreenchange", place);

  function init() {
    place();
    showTab(curTab);
    setCollapsed(collapsed);
    if (!pos && !collapsed) { autoY = findFreeY(); clampPos(); }
    renderT();
    renderD();
  }
  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
