/* 教室小書櫃｜上課工具視窗：計時器、抽籤、白板、畫筆
   由 assets/home-fab.js 自動載入，每份教材打開時出現在右上角，可拖曳、可收起。
   位置、計時器、抽籤紀錄存在這台電腦（localStorage），換教材時會延續；白板和畫筆的內容只保留在目前這一頁。 */
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
  var SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }

  var FONT = "'Noto Sans TC','PingFang TC','Microsoft JhengHei',system-ui,sans-serif";
  var DISPLAY = "'Huninn','Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif";
  var Z = 2147483002;

  /* ---------- 樣式 ---------- */
  var css = [
    ".ct-panel,.ct-panel *,.ct-big,.ct-big *,.ct-wb,.ct-wb *,.ct-pen,.ct-pen *,.ct-alarm,.ct-alarm *{box-sizing:border-box}",
    ".ct-panel{position:fixed;z-index:" + Z + ";width:min(340px,calc(100vw - 24px));background:#FFFFFF;color:#1F2A27;border:2px solid #1E3A34;border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,.25);font:400 16px/1.5 " + FONT + ";touch-action:none;user-select:none;-webkit-user-select:none;text-align:left}",
    ".ct-panel button,.ct-big button,.ct-wb button,.ct-pen button,.ct-alarm button{appearance:none;-webkit-appearance:none;margin:0;font:700 16px/1.2 " + FONT + ";cursor:pointer;-webkit-tap-highlight-color:transparent;letter-spacing:0;text-transform:none;box-shadow:none;text-shadow:none}",
    ".ct-panel button:active,.ct-big button:active,.ct-wb button:active,.ct-pen button:active,.ct-alarm button:active{transform:scale(.96)}",
    ".ct-panel button:focus-visible,.ct-big button:focus-visible,.ct-wb button:focus-visible,.ct-pen button:focus-visible,.ct-alarm button:focus-visible{outline:3px solid #F5B521;outline-offset:2px}",
    ".ct-head{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 14px;min-height:52px;cursor:grab;border-radius:18px 18px 0 0;background:#1E3A34;color:#FFFFFF}",
    ".ct-head:active{cursor:grabbing}",
    ".ct-grip{opacity:.6;font-size:14px;letter-spacing:-2px}",
    ".ct-head b{font:400 19px/1 " + DISPLAY + ";color:#FFFFFF;margin:0}",
    ".ct-mini{margin-left:auto;font:700 18px/1 " + FONT + ";font-variant-numeric:tabular-nums;color:#FFE08A}",
    ".ct-mini.alarm{color:#FF8A8A}",
    ".ct-tog{min-height:44px;min-width:64px;padding:0 14px;border-radius:999px;border:2px solid rgba(255,255,255,.5);background:transparent;color:#FFFFFF}",
    ".ct-hb{min-width:44px;padding:0 10px}",
    ".ct-tog,.ct-mini{white-space:nowrap;flex:none}",
    ".ct-head>b{white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto}",
    ".ct-head{gap:6px}",
    ".ct-head .ct-grip{flex:none}",
    ".ct-hb[hidden]{display:none}",
    ".ct-panel.collapsed{width:auto;max-width:calc(100vw - 24px)}",
    /* 收起時縮成一顆小按鈕：只留「工具」（計時中會多顯示剩餘時間） */
    ".ct-panel.collapsed{border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.25)}",
    ".ct-panel.collapsed .ct-head{border-radius:999px;padding:3px;min-height:0;gap:6px}",
    ".ct-panel.collapsed .ct-grip,.ct-panel.collapsed .ct-head>b,.ct-panel.collapsed .ct-hb{display:none}",
    ".ct-panel.collapsed .ct-mini{margin-left:10px;font-size:16px}",
    ".ct-panel.collapsed .ct-mini:empty{display:none}",
    ".ct-panel.collapsed .ct-tog{min-width:0;min-height:44px;padding:0 14px;border-color:transparent;font-size:15px}",
    ".ct-panel.collapsed .ct-tabs,.ct-panel.collapsed .ct-body{display:none}",
    ".ct-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:10px 10px 0}",
    ".ct-tabs button{min-height:46px;padding:0 2px;border-radius:12px;border:2px solid #C9DBD3;background:#F4F8F6;color:#1E3A34}",
    ".ct-tabs button[aria-selected=true]{background:#1E3A34;border-color:#1E3A34;color:#FFFFFF}",
    ".ct-tabs button .on{display:inline-block;width:8px;height:8px;border-radius:50%;background:#C4501E;margin-left:3px;vertical-align:2px}",
    ".ct-body{padding:12px;display:grid;gap:10px}",
    ".ct-sec[hidden]{display:none}",
    ".ct-sec{display:grid;gap:10px}",
    ".ct-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
    ".ct-row.even>button{flex:1 1 0}",
    ".ct-b{min-height:46px;padding:0 12px;border-radius:12px;border:2px solid #1E3A34;background:#FFFFFF;color:#1E3A34}",
    ".ct-b.fill{background:#1E3A34;color:#FFFFFF}",
    ".ct-b.hot{background:#C4501E;border-color:#C4501E;color:#FFFFFF}",
    ".ct-b[aria-pressed=true]{background:#E0F0EA;border-color:#2A7563;color:#1E3A34}",
    ".ct-b:disabled{opacity:.45;cursor:default;transform:none}",
    ".ct-b.sm{min-height:44px;font-size:15px;padding:0 8px}",
    /* 計時器轉盤 */
    ".ct-dialwrap{display:grid;justify-items:center;gap:4px}",
    ".ct-dial{width:min(240px,100%);height:auto;display:block;touch-action:none;cursor:pointer}",
    ".ct-dial .face{fill:#FFFFFF;stroke:#1E3A34;stroke-width:3}",
    ".ct-dial .tk{stroke:#1E3A34;stroke-width:1.2}",
    ".ct-dial .tk.mj{stroke-width:2.6}",
    ".ct-dial .lb{font:700 12px " + FONT + ";fill:#1E3A34;text-anchor:middle;dominant-baseline:central}",
    ".ct-dial .wedge{fill:#C4501E}",
    ".ct-dial.warn .wedge{fill:#B0333D}",
    ".ct-dial .hub{fill:#1E3A34}",
    ".ct-dial .knob{fill:#FFFFFF;stroke:#C4501E;stroke-width:3.5}",
    ".ct-dial.warn .knob{stroke:#B0333D}",
    ".ct-dial .hint{font:700 9px " + FONT + ";fill:#4A5A55;text-anchor:middle}",
    ".ct-time{font:400 52px/1 " + DISPLAY + ";font-variant-numeric:tabular-nums;text-align:center;color:#1E3A34}",
    ".ct-time.warn{color:#B0333D}",
    ".ct-time.done{color:#B0333D;animation:ct-blink 1s steps(2) infinite}",
    ".ct-scale{display:grid;grid-template-columns:1fr 1fr;gap:6px}",
    ".ct-fine{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}",
    "@keyframes ct-blink{50%{opacity:.25}}",
    /* 抽籤 */
    ".ct-num{font:400 84px/1 " + DISPLAY + ";text-align:center;color:#C4501E;min-height:96px;display:grid;place-items:center;font-variant-numeric:tabular-nums}",
    ".ct-num.rolling{color:#93A6A0}",
    ".ct-range{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-weight:700}",
    ".ct-range input{width:76px;min-height:46px;border:2px solid #C9DBD3;border-radius:12px;text-align:center;font:700 20px/1 " + FONT + ";color:#1F2A27;background:#FFFFFF;user-select:text;-webkit-user-select:text}",
    ".ct-step{min-width:46px}",
    ".ct-hist{font-size:14px;color:#4A5A55;min-height:1.5em;overflow-wrap:anywhere}",
    ".ct-abs{display:grid;gap:8px;padding:10px;border:2px dashed #C9DBD3;border-radius:14px;background:#F8FAF9}",
    ".ct-abs[hidden]{display:none}",
    ".ct-abs p{margin:0;font-size:14px;color:#4A5A55}",
    ".ct-absgrid{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;max-height:260px;overflow:auto;touch-action:pan-y}",
    ".ct-absgrid button{min-height:44px;border-radius:10px;border:2px solid #C9DBD3;background:#FFFFFF;color:#1E3A34;font-variant-numeric:tabular-nums}",
    ".ct-absgrid button[aria-pressed=true]{background:#FBE3E5;border-color:#B0333D;color:#B0333D;text-decoration:line-through}",
    ".ct-b.abs{border-style:dashed}",
    ".ct-note{font-size:14px;color:#4A5A55;margin:0}",
    /* 大畫面 */
    ".ct-big{position:fixed;inset:0;z-index:" + (Z + 3) + ";background:#10201C;color:#FFFFFF;display:grid;grid-template-rows:1fr auto;place-items:center;padding:24px;font-family:" + FONT + "}",
    ".ct-big[hidden],.ct-wb[hidden],.ct-pen[hidden],.ct-alarm[hidden]{display:none}",
    ".ct-big .main{display:flex;align-items:center;justify-content:center;gap:4vw;flex-wrap:wrap;width:100%}",
    ".ct-big .ct-dial{width:min(62vh,44vw);min-width:220px}",
    ".ct-big .ct-dial .face{stroke:#FFFFFF}",
    ".ct-big .v{font:400 min(30vw,46vh)/1 " + DISPLAY + ";font-variant-numeric:tabular-nums;letter-spacing:.02em}",
    ".ct-big .main.timer .v{font-size:min(16vw,30vh)}",
    ".ct-big .v.warn,.ct-big .v.done{color:#FF8A8A}",
    ".ct-big .v.done{animation:ct-blink 1s steps(2) infinite}",
    ".ct-big .v.draw{color:#FFC08A}",
    ".ct-big .cap{font:400 min(5vw,4vh)/1.3 " + DISPLAY + ";color:#C9DBD3;text-align:center}",
    ".ct-big .bar{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}",
    ".ct-big .bar button{min-height:60px;padding:0 28px;border-radius:999px;border:2px solid #FFFFFF;background:transparent;color:#FFFFFF;font-size:22px}",
    ".ct-big .bar button.fill{background:#FFFFFF;color:#10201C}",
    /* 時間到 */
    ".ct-alarm{position:fixed;inset:0;z-index:" + (Z + 5) + ";background:rgba(176,51,61,.92);display:grid;place-items:center;text-align:center;color:#FFFFFF;padding:24px}",
    ".ct-alarm b{display:block;font:400 min(16vw,22vh)/1.1 " + DISPLAY + "}",
    ".ct-alarm button{margin-top:24px;min-height:64px;padding:0 40px;border-radius:999px;border:0;background:#FFFFFF;color:#B0333D;font-size:24px}",
    /* 白板（全螢幕） */
    ".ct-wb{position:fixed;inset:0;z-index:" + (Z + 2) + ";touch-action:none;font-family:" + FONT + "}",
    ".ct-wb.white{background:#FFFFFF}",
    ".ct-wb.grid{background-color:#FFFFFF;background-image:linear-gradient(#DCE7E2 1px,transparent 1px),linear-gradient(90deg,#DCE7E2 1px,transparent 1px);background-size:40px 40px}",
    ".ct-wb.chalk{background:#21463B}",
    /* 畫筆（疊在教材上） */
    ".ct-pen{position:fixed;inset:0;z-index:" + (Z - 1) + ";pointer-events:none}",
    ".ct-pen canvas{pointer-events:none}",
    ".ct-pen.drawing canvas.ink{pointer-events:auto;cursor:crosshair}",
    ".ct-pen.drawing{box-shadow:inset 0 0 0 5px #F5B521}",
    ".ct-pen .ct-bar{pointer-events:auto}",
    ".ct-wb canvas,.ct-pen canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none}",
    ".ct-wb canvas.ink{cursor:crosshair}",
    "canvas.ct-hl{opacity:.42}",
    /* 工具列（白板、畫筆共用） */
    ".ct-bar{position:absolute;top:10px;left:50%;transform:translateX(-50%);display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:6px;padding:8px 10px;max-width:calc(100vw - 20px);background:#FFFFFF;border:2px solid #1E3A34;border-radius:18px;box-shadow:0 6px 20px rgba(0,0,0,.2);z-index:1;touch-action:none}",
    ".ct-bar.bottom{top:auto;bottom:10px}",
    /* 畫筆工具列在下方時，讓出左下角的「回書櫃」按鈕 */
    ".ct-pen .ct-bar.bottom{left:calc(50% + 120px);max-width:calc(100vw - 260px)}",
    "@media (max-width:700px){.ct-pen .ct-bar.bottom{left:50%;max-width:calc(100vw - 20px);bottom:84px}}",
    ".ct-bar .sep{width:2px;align-self:stretch;background:#E3ECE8;margin:0 2px}",
    ".ct-bar .ttl{font:400 18px/1 " + DISPLAY + ";color:#1E3A34;padding:0 4px}",
    ".ct-sw{width:46px;height:46px;border-radius:50%;border:3px solid #FFFFFF;box-shadow:0 0 0 2px #C9DBD3}",
    ".ct-sw[aria-pressed=true]{box-shadow:0 0 0 3px #1E3A34}",
    ".ct-sw.hl{border-radius:12px;background:#FFE066!important;display:grid;place-items:center;font-size:13px;color:#1E3A34}",
    ".ct-sz{width:46px;height:46px;border-radius:12px;border:2px solid #C9DBD3;background:#FFFFFF;display:grid;place-items:center}",
    ".ct-sz i{display:block;border-radius:50%;background:#1E3A34}",
    ".ct-sz[aria-pressed=true]{border-color:#1E3A34;background:#E0F0EA}",
    ".ct-bar .ct-b{min-height:46px}",
    "html.ct-wb-open .cls-fabs,html.ct-wb-open .ct-panel,html.ct-wb-open .ct-pen{display:none!important}",
    "@media print{.ct-panel,.ct-big,.ct-wb,.ct-pen,.ct-alarm{display:none!important}}",
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
  head.appendChild(el("b", "", "工具"));
  var mini = head.appendChild(el("span", "ct-mini"));
  var bFont = head.appendChild(btn("ct-tog ct-hb", "字"));
  var bFs = head.appendChild(btn("ct-tog ct-hb", "⛶", "全螢幕"));
  var tog = head.appendChild(btn("ct-tog", "收起"));
  panel.appendChild(head);

  /* ---------- 字級：放大教材文字，讓後排看得清楚（記在這台電腦，所有教材共用） ---------- */
  var FONT_LV = [[1, "標準"], [1.15, "大"], [1.3, "特大"], [1.5, "超大"]];
  var fontI = Math.max(0, Math.min(FONT_LV.length - 1, +load("clsFont", 0) || 0));
  var fontSt = document.createElement("style");
  function applyFont() {
    fontSt.textContent = "";
    var s = FONT_LV[fontI][0];
    if (s !== 1) {
      var base = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      fontSt.textContent = "html{font-size:" + (base * s).toFixed(2) + "px!important}";
    }
    bFont.textContent = "字" + (fontI ? " " + FONT_LV[fontI][1] : "");
    bFont.setAttribute("aria-label", "文字大小：" + FONT_LV[fontI][1] + "（點一下換下一級）");
  }
  bFont.addEventListener("click", function () { fontI = (fontI + 1) % FONT_LV.length; save("clsFont", fontI); applyFont(); clampPos(); });
  window.addEventListener("resize", applyFont);

  /* ---------- 全螢幕 ---------- */
  var fsOk = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  if (!fsOk) bFs.hidden = true;
  function fsEl() { return document.fullscreenElement || document.webkitFullscreenElement; }
  bFs.addEventListener("click", function () {
    try {
      if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else { var r = document.documentElement; (r.requestFullscreen || r.webkitRequestFullscreen).call(r); }
    } catch (e) {}
  });
  function renderFs() {
    var on = !!fsEl();
    bFs.textContent = on ? "⛶ 結束" : "⛶";
    bFs.setAttribute("aria-label", on ? "離開全螢幕" : "全螢幕");
  }

  var tabs = el("div", "ct-tabs");
  tabs.setAttribute("role", "tablist");
  var body = el("div", "ct-body");
  var TABS = [["timer", "計時器"], ["draw", "抽籤"], ["board", "白板"], ["pen", "畫筆"]];
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
    clampPos();
  }
  tabs.addEventListener("click", function (e) { var b = e.target.closest("button[data-t]"); if (b) showTab(b.dataset.t); });

  /* 收起／展開：每次打開教材都先收起，不擋畫面 */
  var collapsed = true; /* 預設收起成一條，要用時再點「展開」 */
  function setCollapsed(c) {
    collapsed = c;
    panel.classList.toggle("collapsed", c);
    tog.textContent = c ? "工具" : "收起";
    tog.setAttribute("aria-label", c ? "展開上課工具" : "收起上課工具");
    tog.setAttribute("aria-expanded", c ? "false" : "true");
    clampPos();
  }
  var tapAt = 0; /* 收起時點一下（或拖曳）由 pointer 事件處理，避免 click 又觸發一次 */
  tog.addEventListener("click", function () { if (Date.now() - tapAt < 400) { tapAt = 0; return; } setCollapsed(!collapsed); });

  /* 位置：每份教材各自記住老師拖到哪裡；沒拖過時，放在右上角、避開教材本身的按鈕 */
  var POS_KEY = "ctPos:" + (location.pathname.split("/").pop() || "index");
  var pos = load(POS_KEY, null), autoY = null;
  function findFreeY() {
    var w = panel.offsetWidth || 340, h = panel.offsetHeight || 300, x = window.innerWidth - w - 12;
    var rects = [];
    document.querySelectorAll("button,a[href],input,select,textarea,[role=button],[tabindex]").forEach(function (e) {
      if (panel.contains(e) || e.closest(".cls-fabs,.ct-wb,.ct-big,.ct-pen,.ct-alarm,[hidden]")) return;
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
    var b = e.target.closest("button");
    if (b && !(collapsed && b === tog)) return; /* 收起時整顆按鈕都可以拖曳 */
    var r = panel.getBoundingClientRect();
    drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false, onTog: b === tog };
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
    if (drag.moved) { var r = panel.getBoundingClientRect(); pos = { x: r.left, y: r.top }; save(POS_KEY, pos); if (drag.onTog) tapAt = Date.now(); }
    else if (collapsed) { setCollapsed(false); if (drag.onTog) tapAt = Date.now(); }
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
  var bigMain = big.appendChild(el("div", "main"));
  var bigV = el("div", "v");
  var bigBottom = big.appendChild(el("div", ""));
  bigBottom.style.cssText = "display:grid;gap:16px;justify-items:center";
  var bigCap = bigBottom.appendChild(el("div", "cap"));
  var bigBar = bigBottom.appendChild(el("div", "bar"));
  var bigMode = null;
  big.addEventListener("keydown", function (e) { stop(e); if (e.key === "Escape") closeBig(); });
  function openBig(mode) { bigMode = mode; big.hidden = false; renderBig(true); var f = bigBar.querySelector("button"); if (f) f.focus(); }
  function closeBig() { big.hidden = true; bigMode = null; }

  /* ---------- 計時器（拖拉轉盤） ---------- */
  var T = load("ctTimer", { dur: 300, left: 300, end: null, scale: 600 });
  if (T.scale !== 600 && T.scale !== 3600) T.scale = T.dur > 600 ? 3600 : 600;
  if (T.end && T.end <= Date.now()) { T.left = 0; T.end = null; }
  var alarmOn = false;
  function running() { return !!T.end; }
  function left() { return running() ? Math.max(0, (T.end - Date.now()) / 1000) : T.left; }
  function saveT() { save("ctTimer", T); }

  /* 轉盤：像廚房計時器，紅色扇形代表剩下的時間；拖拉扇形邊緣（或盤面任何地方）設定時間 */
  function makeDial() {
    var svg = svgEl("svg", { viewBox: "0 0 200 200", "class": "ct-dial", role: "slider", tabindex: "0", "aria-label": "拖拉設定時間" });
    svg.appendChild(svgEl("circle", { cx: 100, cy: 100, r: 94, "class": "face" }));
    var ticks = svgEl("g", {});
    svg.appendChild(ticks);
    var wedge = svgEl("path", { "class": "wedge" });
    svg.appendChild(wedge);
    svg.appendChild(svgEl("circle", { cx: 100, cy: 100, r: 9, "class": "hub" }));
    var knob = svgEl("circle", { r: 7, "class": "knob" });
    svg.appendChild(knob);
    var drawnScale = 0;
    function drawTicks(S) {
      if (drawnScale === S) return;
      drawnScale = S;
      ticks.innerHTML = "";
      var n = S === 600 ? 60 : 60, major = S === 600 ? 6 : 5; /* 10 分盤：每 10 秒一格、每分鐘一個數字；60 分盤：每分鐘一格、每 5 分一個數字 */
      for (var i = 0; i < n; i++) {
        var a = i / n * Math.PI * 2, mj = i % major === 0;
        var r1 = mj ? 80 : 85, r2 = 91;
        ticks.appendChild(svgEl("line", { x1: 100 + Math.sin(a) * r1, y1: 100 - Math.cos(a) * r1, x2: 100 + Math.sin(a) * r2, y2: 100 - Math.cos(a) * r2, "class": "tk" + (mj ? " mj" : "") }));
        if (mj) {
          var lab = S === 600 ? i / 6 : i;
          var t = svgEl("text", { x: 100 + Math.sin(a) * 71, y: 100 - Math.cos(a) * 71, "class": "lb" });
          t.textContent = lab;
          ticks.appendChild(t);
        }
      }
    }
    function render(s, S, warn) {
      drawTicks(S);
      var f = Math.max(0, Math.min(1, s / S)), R = 54;
      var a = f * Math.PI * 2, x = 100 + Math.sin(a) * R, y = 100 - Math.cos(a) * R;
      if (f <= 0) wedge.setAttribute("d", "");
      else if (f >= 0.9999) wedge.setAttribute("d", "M100 100 m0 -54 a54 54 0 1 1 0 108 a54 54 0 1 1 0 -108 z");
      else wedge.setAttribute("d", "M100 100 L100 46 A54 54 0 " + (f > 0.5 ? 1 : 0) + " 1 " + x.toFixed(2) + " " + y.toFixed(2) + " Z");
      knob.setAttribute("cx", (100 + Math.sin(a) * R).toFixed(2));
      knob.setAttribute("cy", (100 - Math.cos(a) * R).toFixed(2));
      svg.classList.toggle("warn", !!warn);
      svg.setAttribute("aria-valuetext", fmt(s));
    }
    /* 拖拉：角度換成秒數；10 分盤每 5 秒一格、60 分盤每 15 秒一格；轉到 0 或最大值時停住，不會繞一圈跳過去 */
    var dragId = null, prev = 0;
    function secAt(e) {
      var r = svg.getBoundingClientRect();
      var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      var a = Math.atan2(dx, -dy); if (a < 0) a += Math.PI * 2;
      return a / (Math.PI * 2) * T.scale;
    }
    function apply(e) {
      var S = T.scale, step = S === 600 ? 5 : 15, s = secAt(e);
      if (prev > S * 0.75 && s < S * 0.25) s = S;
      else if (prev < S * 0.25 && s > S * 0.75) s = 0;
      prev = s;
      s = Math.round(s / step) * step;
      setTime(s, true);
    }
    svg.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      dragId = e.pointerId;
      try { svg.setPointerCapture(e.pointerId); } catch (err) {}
      if (running()) pause();
      prev = left();
      apply(e);
    });
    svg.addEventListener("pointermove", function (e) { if (dragId === e.pointerId) apply(e); });
    function end(e) { if (dragId === e.pointerId) { dragId = null; saveT(); } }
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
    svg.addEventListener("keydown", function (e) {
      var k = { ArrowUp: 5, ArrowRight: 5, ArrowDown: -5, ArrowLeft: -5, PageUp: 60, PageDown: -60 }[e.key];
      if (k) { e.preventDefault(); adjust(k); }
    });
    return { svg: svg, render: render };
  }

  function setTime(s, dragging) {
    s = Math.max(0, Math.min(T.scale, Math.round(s)));
    T.left = s;
    if (s > 0) T.dur = s;
    T.end = null;
    alarmOn = false;
    if (!dragging) saveT();
    renderT();
  }
  function setScale(S) {
    T.scale = S;
    if (T.left > S) { T.left = S; T.dur = S; }
    saveT(); renderT();
  }
  function start() { audio(); if (T.left <= 0) T.left = T.dur; if (T.left <= 0) return; T.end = Date.now() + T.left * 1000; alarmOn = false; saveT(); renderT(); }
  function pause() { T.left = left(); T.end = null; saveT(); renderT(); }
  function reset() { T.end = null; T.left = T.dur; alarmOn = false; alarm.hidden = true; saveT(); renderT(); }
  function adjust(d) {
    if (running()) { T.end = Math.max(Date.now() + 1000, T.end + d * 1000); if (left() > T.scale) T.scale = 3600; }
    else {
      var s = Math.max(0, Math.min(99 * 60, Math.round(T.left) + d));
      if (s > T.scale) T.scale = 3600;
      T.left = s; if (s > 0) T.dur = s;
    }
    alarmOn = false; saveT(); renderT();
  }

  var dial = makeDial();
  var tWrap = el("div", "ct-dialwrap");
  tWrap.appendChild(dial.svg);
  var tTime = tWrap.appendChild(el("div", "ct-time"));
  tTime.setAttribute("role", "timer");
  var tScale = el("div", "ct-scale");
  var bS10 = tScale.appendChild(btn("ct-b sm", "10 分鐘盤"));
  var bS60 = tScale.appendChild(btn("ct-b sm", "60 分鐘盤"));
  bS10.addEventListener("click", function () { setScale(600); });
  bS60.addEventListener("click", function () { setScale(3600); });
  var tFine = el("div", "ct-fine");
  [[-60, "−1 分"], [-5, "−5 秒"], [5, "+5 秒"], [60, "+1 分"]].forEach(function (x) {
    var b = tFine.appendChild(btn("ct-b sm", x[1], (x[0] < 0 ? "減少" : "增加") + x[1].replace(/[−+]/, "")));
    b.addEventListener("click", function () { adjust(x[0]); });
  });
  var tCtl = el("div", "ct-row even");
  var bGo = tCtl.appendChild(btn("ct-b fill", "開始"));
  var bReset = tCtl.appendChild(btn("ct-b", "重設"));
  var bBigT = tCtl.appendChild(btn("ct-b", "放大"));
  [tWrap, tScale, tFine, tCtl].forEach(function (x) { secs.timer.appendChild(x); });
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
    var shown = Math.ceil(s - 0.001);
    var txt = fmt(shown);
    var warn = running() && s <= 10;
    tTime.textContent = txt;
    tTime.className = "ct-time" + (alarmOn ? " done" : warn ? " warn" : "");
    dial.render(running() ? s : T.left, T.scale, warn || alarmOn);
    bS10.setAttribute("aria-pressed", T.scale === 600 ? "true" : "false");
    bS60.setAttribute("aria-pressed", T.scale === 3600 ? "true" : "false");
    bGo.textContent = running() ? "暫停" : (T.left > 0 && T.left < T.dur ? "繼續" : "開始");
    bGo.className = "ct-b " + (running() ? "hot" : "fill");
    bGo.disabled = !running() && T.left <= 0 && T.dur <= 0;
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
  /* 未到的號碼只算當天：隔天打開會自動清空 */
  var TODAY = new Date().toDateString();
  if (!D.absent || D.absentDay !== TODAY) { D.absent = []; D.absentDay = TODAY; }
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
  var bAbs = btn("ct-b abs", "未到");
  var dAbsRow = el("div", "ct-row even"); dAbsRow.appendChild(bAbs);
  var dAbs = el("div", "ct-abs");
  dAbs.hidden = true;
  dAbs.appendChild(el("p", "", "點選今天沒來的號碼，抽籤就不會抽到。再點一次可以取消。"));
  var dAbsGrid = dAbs.appendChild(el("div", "ct-absgrid"));
  dAbsGrid.setAttribute("role", "group");
  dAbsGrid.setAttribute("aria-label", "未到的號碼");
  var dAbsCtl = dAbs.appendChild(el("div", "ct-row even"));
  var bAbsClr = dAbsCtl.appendChild(btn("ct-b sm", "全部到齊"));
  var bAbsDone = dAbsCtl.appendChild(btn("ct-b sm fill", "完成"));
  [dRange, dAbsRow, dAbs, dNum, dCtl, dCtl2, dHist].forEach(function (x) { secs.draw.appendChild(x); });
  bAbs.addEventListener("click", function () { dAbs.hidden = !dAbs.hidden; renderD(); clampPos(); });
  bAbsDone.addEventListener("click", function () { dAbs.hidden = true; renderD(); clampPos(); bAbs.focus(); });
  bAbsClr.addEventListener("click", function () { D.absent = []; saveD(); renderD(); });
  dAbsGrid.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-n]"); if (!b) return;
    var n = +b.dataset.n, i = D.absent.indexOf(n);
    if (i < 0) D.absent.push(n); else D.absent.splice(i, 1);
    D.absent.sort(function (a, c) { return a - c; });
    saveD(); renderD();
  });

  var rolling = false, lastPick = null;
  function saveD() { save("ctDraw", D); }
  function pool() { var a = []; for (var i = 1; i <= D.max; i++) if (D.absent.indexOf(i) < 0 && (!D.norep || D.drawn.indexOf(i) < 0)) a.push(i); return a; }
  function setMax(n) { n = Math.max(2, Math.min(99, Math.round(+n) || D.max)); D.max = n; D.drawn = D.drawn.filter(function (x) { return x <= n; }); D.absent = D.absent.filter(function (x) { return x <= n; }); saveD(); renderD(); }
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
    dHist.textContent = (D.drawn.length ? "已抽：" + D.drawn.join("、") + (D.norep ? "（還剩 " + p.length + " 個）" : "") : "還沒抽過，按「抽一個」開始。");
    bAbs.textContent = dAbs.hidden ? (D.absent.length ? "未到：" + D.absent.join("、") + " 號（點這裡修改）" : "設定未到的號碼") : "設定未到的號碼";
    bAbs.setAttribute("aria-expanded", dAbs.hidden ? "false" : "true");
    if (!dAbs.hidden) {
      if (dAbsGrid.childNodes.length !== D.max) {
        dAbsGrid.innerHTML = "";
        for (var i = 1; i <= D.max; i++) { var b = btn("", String(i), i + " 號"); b.dataset.n = i; dAbsGrid.appendChild(b); }
      }
      dAbsGrid.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", D.absent.indexOf(+b.dataset.n) >= 0 ? "true" : "false"); });
    }
    if (bigMode === "draw") renderBig();
  }

  /* ---------- 大畫面內容 ---------- */
  var bigDial = makeDial();
  function renderBig(rebuild) {
    if (!bigMode) return;
    if (rebuild) {
      bigMain.innerHTML = "";
      bigMain.className = "main " + bigMode;
      if (bigMode === "timer") bigMain.appendChild(bigDial.svg);
      bigMain.appendChild(bigV);
    }
    bigBar.innerHTML = "";
    var close = btn("", "關閉");
    close.addEventListener("click", closeBig);
    if (bigMode === "timer") {
      var s = left(), warn = running() && s <= 10;
      bigV.textContent = fmt(Math.ceil(s - 0.001));
      bigV.className = "v" + (alarmOn ? " done" : warn ? " warn" : "");
      bigDial.render(running() ? s : T.left, T.scale, warn || alarmOn);
      bigCap.textContent = alarmOn ? "時間到！" : running() ? "" : "拖拉轉盤設定時間，再按「開始」";
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
      bigCap.textContent = "座號 1～" + D.max + (D.absent.length ? "・未到 " + D.absent.length + " 人" : "") + (D.norep ? "・還剩 " + p.length + " 個" : "");
      var d = btn("fill", p.length ? "抽一個" : "全部抽完了");
      d.disabled = rolling || !p.length;
      d.addEventListener("click", doDraw);
      [d, close].forEach(function (b) { bigBar.appendChild(b); });
    }
  }

  /* ---------- 畫圖共用：畫布、筆畫、復原 ---------- */
  var INK_LIGHT = "#1F2A27", INK_DARK = "#FFFFFF";
  var COLORS = [["ink", "黑"], ["#D32F2F", "紅"], ["#1565C0", "藍"], ["#2E7D32", "綠"], ["#EF6C00", "橘"]];
  var SIZES = [[4, 8], [9, 14], [18, 22]];

  /* anchored：畫筆跟著頁面捲動（座標記在整頁上），白板不用 */
  function makeSurface(host, anchored) {
    var hl = host.appendChild(el("canvas", "ct-hl"));
    var ink = host.appendChild(el("canvas", "ink"));
    var cx = { hl: hl.getContext("2d"), ink: ink.getContext("2d") };
    var S = { strokes: [], active: {}, dpr: 1, dark: false, host: host, inkCanvas: ink };
    function off() { return anchored ? [window.scrollX || 0, window.scrollY || 0] : [0, 0]; }
    function color(c) { return c === "ink" ? (S.dark ? INK_DARK : INK_LIGHT) : c; }
    function seg(s, a, b) {
      var o = off(), g = s.hl ? cx.hl : cx.ink;
      var targets = s.er ? [cx.hl, cx.ink] : [g];
      targets.forEach(function (ctx) {
        ctx.save();
        ctx.setTransform(S.dpr, 0, 0, S.dpr, -o[0] * S.dpr, -o[1] * S.dpr);
        ctx.globalCompositeOperation = s.er ? "destination-out" : "source-over";
        ctx.strokeStyle = s.hl ? "#FFD400" : color(s.c);
        ctx.lineWidth = s.er ? s.w * 4 : s.hl ? Math.max(22, s.w * 3) : s.w;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
        ctx.restore();
      });
    }
    S.size = function () {
      S.dpr = Math.min(window.devicePixelRatio || 1, 2);
      [hl, ink].forEach(function (c) { c.width = Math.round(window.innerWidth * S.dpr); c.height = Math.round(window.innerHeight * S.dpr); });
      S.redraw();
    };
    S.redraw = function () {
      [cx.hl, cx.ink].forEach(function (ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, hl.width, hl.height); });
      var from = 0;
      for (var i = S.strokes.length - 1; i >= 0; i--) if (S.strokes[i].clear) { from = i + 1; break; }
      for (var j = from; j < S.strokes.length; j++) {
        var s = S.strokes[j], p = s.pts;
        if (p.length === 1) seg(s, p[0], [p[0][0] + 0.01, p[0][1]]);
        for (var k = 1; k < p.length; k++) seg(s, p[k - 1], p[k]);
      }
    };
    S.undo = function () { S.strokes.pop(); S.redraw(); };
    S.clear = function () { if (S.strokes.length && !S.strokes[S.strokes.length - 1].clear) S.strokes.push({ clear: true, pts: [] }); S.redraw(); };
    S.hasInk = function () { for (var i = S.strokes.length - 1; i >= 0; i--) { if (S.strokes[i].clear) return false; return true; } return false; };
    S.pen = { c: "ink", w: SIZES[1][0], er: false, hl: false };
    S.onChange = function () {};
    function pt(e) { var o = off(); return [e.clientX + o[0], e.clientY + o[1]]; }
    ink.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      try { ink.setPointerCapture(e.pointerId); } catch (err) {}
      var p = pt(e), s = { c: S.pen.c, w: S.pen.w, er: S.pen.er, hl: !S.pen.er && S.pen.hl, pts: [p] };
      S.strokes.push(s);
      S.active[e.pointerId] = s;
      seg(s, p, [p[0] + 0.01, p[1]]);
      S.onChange();
    });
    ink.addEventListener("pointermove", function (e) {
      var s = S.active[e.pointerId];
      if (!s) return;
      var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      if (!evs.length) evs = [e];
      evs.forEach(function (ev) { var p = pt(ev); seg(s, s.pts[s.pts.length - 1], p); s.pts.push(p); });
    });
    function endStroke(e) { delete S.active[e.pointerId]; }
    ink.addEventListener("pointerup", endStroke);
    ink.addEventListener("pointercancel", endStroke);
    return S;
  }

  /* 工具列：顏色、粗細、（螢光筆）、橡皮擦、復原、清除，再加上各自的按鈕 */
  function makeBar(S, opts) {
    var bar = el("div", "ct-bar");
    var grip = bar.appendChild(el("span", "ttl", opts.title));
    var sw = [], sz = [];
    COLORS.forEach(function (c) {
      var b = btn("ct-sw", "", c[1] + "色筆");
      b.addEventListener("click", function () { S.pen.c = c[0]; S.pen.er = false; S.pen.hl = false; render(); });
      bar.appendChild(b); sw.push([b, c[0]]);
    });
    var bHl = null;
    if (opts.highlighter) {
      bHl = bar.appendChild(btn("ct-sw hl", "螢光", "螢光筆"));
      bHl.addEventListener("click", function () { S.pen.hl = true; S.pen.er = false; render(); });
    }
    bar.appendChild(el("span", "sep"));
    SIZES.forEach(function (s, i) {
      var b = btn("ct-sz", "<i style=\"width:" + s[1] + "px;height:" + s[1] + "px\"></i>", ["細", "中", "粗"][i]);
      b.addEventListener("click", function () { S.pen.w = s[0]; render(); });
      bar.appendChild(b); sz.push([b, s[0]]);
    });
    bar.appendChild(el("span", "sep"));
    var bEr = bar.appendChild(btn("ct-b", "橡皮擦"));
    var bUndo = bar.appendChild(btn("ct-b", "復原"));
    var bClr = bar.appendChild(btn("ct-b", "全部清除"));
    bEr.addEventListener("click", function () { S.pen.er = !S.pen.er; render(); });
    bUndo.addEventListener("click", function () { S.undo(); render(); });
    bClr.addEventListener("click", function () { S.clear(); render(); });
    (opts.extra || []).forEach(function (b) { bar.appendChild(b); });
    function render() {
      sw.forEach(function (x) {
        x[0].style.background = x[1] === "ink" ? (S.dark ? INK_DARK : INK_LIGHT) : x[1];
        x[0].setAttribute("aria-label", (x[1] === "ink" ? (S.dark ? "白" : "黑") : x[0].getAttribute("aria-label").charAt(0)) + "色筆");
        x[0].setAttribute("aria-pressed", !S.pen.er && !S.pen.hl && S.pen.c === x[1] ? "true" : "false");
      });
      if (bHl) bHl.setAttribute("aria-pressed", S.pen.hl && !S.pen.er ? "true" : "false");
      sz.forEach(function (x) { x[0].setAttribute("aria-pressed", S.pen.w === x[1] ? "true" : "false"); });
      bEr.setAttribute("aria-pressed", S.pen.er ? "true" : "false");
      bUndo.disabled = !S.strokes.length;
      bClr.disabled = !S.hasInk();
      if (opts.onRender) opts.onRender();
    }
    S.onChange = render;
    bar.addEventListener("keydown", stop);
    return { bar: bar, render: render, grip: grip };
  }

  /* ---------- 白板（全螢幕，獨立的一張板子） ---------- */
  var wb = el("div", "ct-wb white");
  wb.hidden = true;
  wb.setAttribute("role", "dialog");
  wb.setAttribute("aria-label", "白板");
  var wbS = makeSurface(wb, false);
  var BG = [["white", "白板"], ["grid", "格線"], ["chalk", "黑板"]];
  var bg = "white";
  var bBg = btn("ct-b", "背景");
  var bWbClose = btn("ct-b fill", "關閉");
  var wbBar = makeBar(wbS, { title: "白板", highlighter: false, extra: [el("span", "sep"), bBg, bWbClose] });
  wb.appendChild(wbBar.bar);
  function setBg(b) {
    bg = b;
    wb.className = "ct-wb " + b;
    wbS.dark = b === "chalk";
    var name = ""; BG.forEach(function (x) { if (x[0] === b) name = x[1]; });
    bBg.textContent = "背景：" + name;
    wbS.redraw(); wbBar.render();
  }
  bBg.addEventListener("click", function () { var i = 0; BG.forEach(function (x, k) { if (x[0] === bg) i = k; }); setBg(BG[(i + 1) % BG.length][0]); });
  function openWb() {
    if (penOn) penPause(true);
    wb.hidden = false;
    document.documentElement.classList.add("ct-wb-open");
    wbS.size();
    setBg(bg);
    bWbClose.focus();
  }
  function closeWb() {
    wb.hidden = true;
    document.documentElement.classList.remove("ct-wb-open");
    renderBoardTab();
    tabBtns.board.focus();
  }
  bWbClose.addEventListener("click", closeWb);
  wb.addEventListener("keydown", function (e) {
    stop(e);
    if (e.key === "Escape") closeWb();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { wbS.undo(); wbBar.render(); }
  });

  var bOpenWb = btn("ct-b fill", "打開白板");
  var rowWb = el("div", "ct-row even"); rowWb.appendChild(bOpenWb);
  var wbInfo = el("p", "ct-note");
  secs.board.appendChild(rowWb);
  secs.board.appendChild(wbInfo);
  bOpenWb.addEventListener("click", openWb);
  function renderBoardTab() {
    wbInfo.textContent = wbS.hasInk()
      ? "白板上已經有內容，打開會接著寫。可以在白板上換成格線或黑板，按「全部清除」重新開始。"
      : "全螢幕的空白板子，可以換成格線或黑板。內容在這一頁會保留，換到別的教材就會清掉。";
    tabBtns.board.innerHTML = "白板" + (wbS.hasInk() ? "<span class=\"on\" aria-hidden=\"true\"></span>" : "");
  }

  /* ---------- 畫筆（直接畫在教材上，跟著頁面捲動） ---------- */
  var pen = el("div", "ct-pen");
  pen.hidden = true;
  pen.setAttribute("aria-label", "畫筆");
  var penS = makeSurface(pen, true);
  penS.pen.c = "#D32F2F";
  var bPause = btn("ct-b", "點教材");
  var bMove = btn("ct-b", "移到上面", "工具列移到畫面上方");
  var bPenClose = btn("ct-b fill", "收起畫筆");
  var penBar = makeBar(penS, { title: "畫筆", highlighter: true, extra: [el("span", "sep"), bPause, bMove, bPenClose], onRender: function () { renderPenTab(); } });
  penBar.bar.classList.add("bottom"); /* 畫筆工具列預設在畫面下方 */
  pen.appendChild(penBar.bar);
  var penOn = false, penDrawing = false;
  function penSet(on, drawing) {
    penOn = on; penDrawing = on && drawing;
    pen.hidden = !on;
    pen.classList.toggle("drawing", penDrawing);
    bPause.textContent = penDrawing ? "點教材" : "繼續畫";
    bPause.setAttribute("aria-pressed", penDrawing ? "false" : "true");
    if (on) { penS.size(); penBar.render(); }
    renderPenTab();
  }
  function penPause(p) { if (penOn) penSet(true, !p); }
  bPause.addEventListener("click", function () { penSet(true, !penDrawing); });
  bMove.addEventListener("click", function () { var b = penBar.bar.classList.toggle("bottom"); bMove.textContent = b ? "移到上面" : "移到下面"; bMove.setAttribute("aria-label", b ? "工具列移到畫面上方" : "工具列移到畫面下方"); });
  bPenClose.addEventListener("click", function () { penSet(false, false); tabBtns.pen.focus(); });
  pen.addEventListener("keydown", function (e) {
    stop(e);
    if (e.key === "Escape") penSet(false, false);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { penS.undo(); penBar.render(); }
  });
  var scrollQueued = false;
  window.addEventListener("scroll", function () {
    if (!penOn || scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(function () { scrollQueued = false; penS.redraw(); });
  }, { passive: true });

  var bPenGo = btn("ct-b hot", "開始畫重點");
  var bPenClr = btn("ct-b", "清除畫筆");
  var rowPen = el("div", "ct-row even"); rowPen.appendChild(bPenGo);
  var rowPen2 = el("div", "ct-row even"); rowPen2.appendChild(bPenClr);
  var penInfo = el("p", "ct-note");
  secs.pen.appendChild(rowPen);
  secs.pen.appendChild(rowPen2);
  secs.pen.appendChild(penInfo);
  bPenGo.addEventListener("click", function () {
    if (penOn && penDrawing) penSet(false, false);
    else { penSet(true, true); setCollapsed(true); }
  });
  bPenClr.addEventListener("click", function () { penS.clear(); penBar.render(); renderPenTab(); });
  function renderPenTab() {
    bPenGo.textContent = !penOn ? (penS.hasInk() ? "顯示並繼續畫" : "開始畫重點") : penDrawing ? "收起畫筆" : "繼續畫";
    bPenGo.className = "ct-b " + (penOn && penDrawing ? "fill" : "hot");
    bPenClr.disabled = !penS.hasInk();
    penInfo.textContent = "直接在教材畫面上圈重點，有紅、藍等顏色和螢光筆。按工具列的「點教材」可以暫時停筆、操作教材，畫的線會留著；頁面捲動時線會跟著走。";
    tabBtns.pen.innerHTML = "畫筆" + (penOn ? "<span class=\"on\" aria-hidden=\"true\"></span>" : "");
  }

  window.addEventListener("resize", function () {
    if (!wb.hidden) wbS.size();
    if (penOn) penS.size();
  });

  /* ---------- 放到畫面上（全螢幕時搬進全螢幕的區塊） ---------- */
  var layers = [pen, panel, wb, big, alarm];
  function place() {
    var host = document.fullscreenElement || document.webkitFullscreenElement || document.body;
    layers.forEach(function (x) { if (x.parentNode !== host) host.appendChild(x); });
    renderFs();
    clampPos();
  }
  document.addEventListener("fullscreenchange", place);
  document.addEventListener("webkitfullscreenchange", place);

  function init() {
    document.head.appendChild(fontSt);
    applyFont();
    place();
    showTab(curTab);
    setCollapsed(collapsed);
    renderT();
    renderD();
    renderBoardTab();
    renderPenTab();
    if (!pos) { autoY = findFreeY(); clampPos(); }
  }
  /* 雲端同步（assets/sync.js）：別台電腦改了設定，這裡跟著更新 */
  window.addEventListener("cls-sync", function (e) {
    var k = (e.detail && e.detail.keys) || [];
    if (k.indexOf("clsFont") >= 0) { fontI = Math.max(0, Math.min(FONT_LV.length - 1, +load("clsFont", 0) || 0)); applyFont(); clampPos(); }
    if (k.indexOf("ctDraw") >= 0 && !rolling) {
      var nd = load("ctDraw", D);
      if (!nd.absent || nd.absentDay !== TODAY) { nd.absent = []; nd.absentDay = TODAY; }
      D = nd; if (lastPick != null && D.drawn.indexOf(lastPick) < 0) lastPick = null; renderD();
      if (bigMode === "draw") renderBig(false);
    }
    if (k.indexOf("ctTimer") >= 0 && !alarmOn) {
      var nt = load("ctTimer", T);
      if (nt.end && nt.end <= Date.now()) { nt.left = 0; nt.end = null; }
      T = nt; renderT();
    }
  });

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
