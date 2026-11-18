/* 教室小書櫃｜學生回饋想法牆（上課工具的「回饋」分頁）
   老師（登入老師帳號）開一個題目 → 大螢幕顯示 QR Code（課堂房間進行中就不顯示，學生平板自動打開）→ 學生用平板打開 fb.html?b=代碼，
   先選座號，再輸入想法（每個座號 1 則，要重寫先刪除）→ 全班匿名看到彼此的想法，每人最多按 3 個讚。
   老師的想法牆看得到座號（可切換隱藏）、可以隱藏不適當的想法、關閉／重新開放、課後再看。

   資料表（Supabase）：fb_boards（題目）、fb_posts（想法，含座號）、fb_likes（讚）。
   學生只能透過 RPC fb_list / fb_post / fb_delete / fb_like 存取，拿不到座號，也看不到被隱藏的想法。
   老師用 CLS.api（sync.js）直接讀寫資料表，RPC fb_teacher_list 取得含座號的全部想法。

   用法：FB.panel(容器)  由 class-tools.js 在第一次打開「回饋」分頁時呼叫。 */
(function () {
  if (window.FB) return;
  var me = document.currentScript && document.currentScript.src;
  var BASE = me ? me.replace(/assets\/feedback\.js(\?.*)?$/, "") : "../";
  var QR_LIB = BASE + "assets/vendor/qrcode.js";
  var CUR_KEY = "fbCur", CLASS_KEY = "fbClass", SEAT_SHOW = "fbSeatShow";
  var POLL = 3000;

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function load(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function btn(cls, html, label) { var b = el("button", cls, html); b.type = "button"; if (label) b.setAttribute("aria-label", label); return b; }
  function api(path, opts) {
    opts = opts || {};
    var h = {}; if (opts.json !== undefined) h["Content-Type"] = "application/json";
    if (opts.prefer) h.Prefer = opts.prefer;
    return window.CLS.api(path, { method: opts.method || "GET", headers: h, body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t || "HTTP " + r.status); });
      return r.text().then(function (t) { return t ? JSON.parse(t) : null; });
    });
  }
  function studentUrl(id) { return new URL(BASE + "fb.html?b=" + encodeURIComponent(id), location.href).href; }
  function fmt(t) { var d = new Date(t); return (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }

  var qrWaiting = [];
  function withQR(cb) {
    if (window.qrcode) return cb();
    qrWaiting.push(cb);
    if (qrWaiting.length > 1) return;
    var s = document.createElement("script"); s.src = QR_LIB;
    s.onload = s.onerror = function () { var w = qrWaiting; qrWaiting = []; w.forEach(function (f) { f(); }); };
    document.head.appendChild(s);
  }
  function drawQR(box, url) {
    withQR(function () {
      if (!window.qrcode) { box.textContent = "QR Code 載入失敗，請學生輸入下面的網址。"; return; }
      var q = window.qrcode(0, "M"); q.addData(url); q.make();
      box.innerHTML = q.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
    });
  }

  var FONT = "'Huninn','Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif";
  var css = [
    ".fb-p{display:grid;gap:10px}",
    ".fb-p textarea,.fb-p input{width:100%;font:400 16px/1.5 " + FONT + ";border:2px solid #C9DBD3;border-radius:12px;padding:8px 10px;color:#1F2A27;background:#fff;user-select:text;-webkit-user-select:text;touch-action:auto}",
    ".fb-p textarea{min-height:76px;resize:vertical}",
    ".fb-p label{display:grid;gap:4px;font-weight:700;font-size:14px}",
    ".fb-cur{border:2px solid #1E3A34;border-radius:14px;padding:10px 12px;display:grid;gap:8px;background:#F4F8F6}",
    ".fb-cur b{font-size:16px;line-height:1.4;overflow-wrap:anywhere}",
    ".fb-st{font-size:13px;font-weight:700}.fb-st.on{color:#1E7A4F}.fb-st.off{color:#B3261E}",
    ".fb-list{display:grid;gap:6px;max-height:260px;overflow:auto;touch-action:pan-y}",
    ".fb-item{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:6px;align-items:center;border:1.5px solid #C9DBD3;border-radius:12px;padding:6px 8px}",
    ".fb-item span{font-size:14px;overflow-wrap:anywhere}.fb-item small{display:block;color:#4A5A55;font-size:12px}",
    /* 想法牆 */
    ".fb-wall{position:fixed;inset:0;z-index:2147483100;background:#F3F1EA;color:#1F2A27;display:grid;grid-template-rows:auto minmax(0,1fr);font:400 18px/1.5 " + FONT + "}",
    ".fb-wall *{box-sizing:border-box}",
    ".fb-wall button{appearance:none;font:700 17px/1.2 " + FONT + ";cursor:pointer;min-height:48px;padding:0 16px;border-radius:999px;border:2px solid #1E3A34;background:#fff;color:#1E3A34}",
    ".fb-wall button.fb-dark{background:#1E3A34;color:#fff}.fb-wall button.hot{background:#B3261E;border-color:#B3261E;color:#fff}",
    ".fb-wall button:focus-visible{outline:3px solid #F5B521;outline-offset:2px}",
    ".fb-top{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;padding:14px 20px;background:#fff;border-bottom:2px solid #1E3A34}",
    ".fb-top h2{margin:0;font:700 clamp(22px,2.6vw,34px)/1.3 " + FONT + ";flex:1 1 20rem;overflow-wrap:anywhere}",
    ".fb-top .meta{font-size:15px;color:#4A5A55;font-weight:700;margin-right:auto}",
    ".fb-sub{flex:1 1 100%;display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
    ".fb-wall .fb-sub button{min-height:44px;font-size:15px;padding:0 12px}",
    ".fb-main{display:grid;grid-template-columns:minmax(0,1fr) auto;min-height:0}",
    /* 想法多、字多時：卡片用瀑布流排列，字級自動縮放到整面牆放得下（--fbfs，最小 15px，再多就捲動） */
    ".fb-grid{--fbfs:26px;overflow:auto;padding:16px 18px 90px;column-width:calc(var(--fbfs) * 11);column-gap:12px;min-height:0}",
    ".fb-card{background:#fff;border:2px solid #C9DBD3;border-radius:16px;padding:calc(var(--fbfs) * .45) calc(var(--fbfs) * .6);display:grid;gap:6px;break-inside:avoid;margin:0 0 12px;cursor:zoom-in}",
    ".fb-card.new{animation:fbIn .9s}",
    "@keyframes fbIn{0%{transform:scale(.9);background:#FFF3C4}100%{transform:none;background:#fff}}",
    ".fb-card p{margin:0;font-size:var(--fbfs);line-height:1.45;overflow-wrap:anywhere;white-space:pre-wrap}",
    ".fb-card .row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}",
    ".fb-card .lk{font:700 calc(var(--fbfs) * .7)/1 " + FONT + ";color:#B3261E}",
    ".fb-card .seat{font-size:max(13px,calc(var(--fbfs) * .55));font-weight:700;color:#fff;background:#1E3A34;border-radius:999px;padding:2px 10px}",
    ".fb-card .row button{margin-left:auto;min-height:40px;font-size:14px;padding:0 10px}",
    ".fb-fs{display:inline-flex;gap:4px;align-items:center}.fb-wall .fb-fs button{min-width:48px;padding:0 10px}",
    /* 點卡片放大看 */
    ".fb-zoom{position:fixed;inset:0;z-index:2147483101;background:rgba(15,25,22,.86);display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;padding:24px}",
    ".fb-zoom[hidden]{display:none}",
    ".fb-zoom .zc{background:#fff;border-radius:24px;padding:clamp(20px,4vw,48px);max-height:88vh;overflow:auto;display:grid;gap:18px}",
    ".fb-zoom .zc p{margin:0;font-size:clamp(28px,3.6vw,56px);line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}",
    ".fb-zoom .zc .row{display:flex;gap:14px;align-items:center;font-size:24px}",
    ".fb-zoom .nav{width:64px;height:64px;border-radius:50%;font-size:34px;padding:0}",
    ".fb-zoom .zx{position:absolute;top:16px;right:16px}",
    /* 計時 */
    ".fb-tm{display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap}",
    ".fb-tm .clock{font:700 clamp(26px,2.6vw,38px)/1 " + FONT + ";font-variant-numeric:tabular-nums;color:#1E3A34;background:#FFF6DC;border:2px solid #B7791F;border-radius:14px;padding:6px 14px;min-width:4.2em;text-align:center}",
    ".fb-tm .clock.warn{color:#fff;background:#B3261E;border-color:#B3261E}",
    ".fb-tm .clock.up{animation:fbBlink 1s steps(2) infinite}",
    "@keyframes fbBlink{50%{opacity:.35}}",
    ".fb-live{font-size:15px;font-weight:700;color:#7A2E8E}",
    ".fb-card.top1{border-color:#E0A100;box-shadow:0 0 0 3px #F5D46B}",
    ".fb-card.hid{opacity:.55;border-style:dashed}",
    ".fb-card.hid p{text-decoration:line-through}",
    ".fb-wall.noseat .seat{display:none}",
    ".fb-qr{width:min(34vw,360px);background:#fff;border-left:2px solid #1E3A34;padding:18px;display:grid;gap:10px;align-content:start;text-align:center;overflow:auto}",
    ".fb-qr[hidden]{display:none}",
    ".fb-qr .code svg{width:100%;height:auto;display:block}",
    ".fb-qr .url{font-size:13px;color:#4A5A55;word-break:break-all;user-select:all}",
    ".fb-qr b{font-size:22px}",
    ".fb-empty{grid-column:1/-1;text-align:center;color:#4A5A55;padding:40px 10px;font-size:22px}",
    "@media (max-width:760px){.fb-main{grid-template-columns:minmax(0,1fr)}.fb-qr{width:auto;border-left:0;border-top:2px solid #1E3A34;order:-1}.fb-qr .code svg{max-width:240px;margin:0 auto}}"
  ].join("\n");
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  /* ---------- 想法牆（全螢幕） ---------- */
  var wall = null, wallTimer = null, wallBoard = null, seen = {}, sortBy = "new", posts = [];
  function openWall(board) {
    closeWall();
    wallBoard = board; seen = {}; posts = [];
    wall = el("div", "fb-wall" + (load(SEAT_SHOW, true) ? "" : " noseat"));
    wall.setAttribute("role", "dialog"); wall.setAttribute("aria-label", "全班想法牆");
    var top = el("div", "fb-top");
    var h = el("h2", "", esc(board.title));
    var meta = el("span", "meta");
    var inLive = !!(window.CLS_LIVE && window.CLS_LIVE.id && !window.CLS_LIVE.isStudent);
    var bQR = btn("", "QR Code"), bSeat = btn("", ""), bSort = btn("", ""), bOpen = btn("", ""), bX = btn("fb-dark", "✕ 關閉想法牆");
    /* 計時：選分鐘開始倒數，時間到自動關閉回饋 */
    var tm = el("span", "fb-tm");
    var fs = el("span", "fb-fs"), bA = btn("", "A−", "字小一點"), bAuto = btn("", "自動", "字級自動"), bB = btn("", "A＋", "字大一點");
    fs.appendChild(bA); fs.appendChild(bAuto); fs.appendChild(bB);
    /* 第一列：題目、計時、開放／關閉、關閉想法牆；第二列：小按鈕 */
    var sub = el("div", "fb-sub");
    top.appendChild(h); top.appendChild(tm); top.appendChild(bOpen); top.appendChild(bX); top.appendChild(sub);
    sub.appendChild(meta);
    if (inLive) sub.appendChild(el("span", "fb-live", "📡 課堂中：學生平板已自動打開"));
    else sub.appendChild(bQR);
    sub.appendChild(fs); sub.appendChild(bSeat); sub.appendChild(bSort);
    var main = el("div", "fb-main"), grid = el("div", "fb-grid"), qr = el("aside", "fb-qr");
    var url = studentUrl(board.id);
    /* 課堂房間：學生平板自動打開這個想法牆 */
    if (window.CLS_LIVE && window.CLS_LIVE.push && window.CLS_LIVE.id) window.CLS_LIVE.push("fb.html?b=" + encodeURIComponent(board.id), board.title);
    qr.innerHTML = '<b>用平板掃描</b><div class="code"></div><div class="url">' + esc(url) + "</div><span>寫下你的想法，幫最好的想法按讚！</span>";
    drawQR(qr.querySelector(".code"), url);
    main.appendChild(grid); if (!inLive) main.appendChild(qr);
    wall.appendChild(top); wall.appendChild(main);
    document.body.appendChild(wall);
    document.documentElement.classList.add("ct-wb-open");
    function labels() {
      var show = !wall.classList.contains("noseat");
      bSeat.textContent = show ? "隱藏座號" : "顯示座號";
      bSort.textContent = sortBy === "new" ? "排序：最新" : "排序：最多讚";
      bOpen.textContent = wallBoard.open ? "停止回饋" : "▶ 重新開放";
      bOpen.className = wallBoard.open ? "hot" : "fb-dark";
      bQR.textContent = qr.hidden ? "顯示 QR Code" : "隱藏 QR Code";
    }
    bQR.addEventListener("click", function () { qr.hidden = !qr.hidden; labels(); fit(); });
    /* ---- 計時 ---- */
    var tEnd = 0, tLeft = 0, tRun = false, tTick = null;
    function mmss(n) { n = Math.max(0, Math.ceil(n)); return Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0"); }
    function drawTimer() {
      if (!tRun && !tLeft) {
        tm.innerHTML = '<span style="font-weight:700">⏱</span>' + [1, 2, 3, 5].map(function (m) { return '<button type="button" data-m="' + m + '">' + m + " 分</button>"; }).join("");
        return;
      }
      var left = tRun ? (tEnd - Date.now()) / 1000 : tLeft;
      if (!tm.querySelector(".clock")) tm.innerHTML = '<span class="clock" role="timer"></span><button type="button" data-t="pause"></button><button type="button" data-t="plus">＋1 分</button><button type="button" data-t="stop" aria-label="取消計時">✕</button>';
      var c = tm.querySelector(".clock");
      c.textContent = left <= 0 ? "時間到！" : mmss(left);
      c.className = "clock" + (left <= 0 ? " warn up" : left <= 10 ? " warn" : "");
      tm.querySelector("[data-t=pause]").textContent = tRun ? "暫停" : "繼續";
      tm.querySelector("[data-t=pause]").setAttribute("aria-label", tRun ? "暫停計時" : "繼續計時");
      tm.querySelector("[data-t=pause]").hidden = left <= 0;
      tm.querySelector("[data-t=plus]").hidden = left <= 0;
    }
    function tick() {
      if (!wall) return clearInterval(tTick);
      if (tRun && Date.now() >= tEnd) {
        tRun = false; tLeft = 0; clearInterval(tTick); tTick = null;
        tm.innerHTML = ""; tEnd = 0; tm.dataset.up = "1";
        tm.innerHTML = '<span class="clock warn up" role="timer">時間到！</span><button type="button" data-t="stop">✕</button>';
        if (wallBoard.open) setOpen(false);
        return;
      }
      drawTimer();
    }
    tm.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.m) { tEnd = Date.now() + b.dataset.m * 60000; tRun = true; tLeft = 1; tm.innerHTML = ""; clearInterval(tTick); tTick = setInterval(tick, 250); drawTimer(); if (!wallBoard.open) setOpen(true); return; }
      var t = b.dataset.t;
      if (t === "pause") { if (tRun) { tLeft = (tEnd - Date.now()) / 1000; tRun = false; } else { tEnd = Date.now() + tLeft * 1000; tRun = true; } drawTimer(); }
      else if (t === "plus") { if (tRun) tEnd += 60000; else tLeft += 60; drawTimer(); }
      else if (t === "stop") { tRun = false; tLeft = 0; clearInterval(tTick); tTick = null; tm.innerHTML = ""; drawTimer(); }
    });
    drawTimer();
    /* ---- 字級：自動縮放到整面牆放得下；A−／A＋ 手動調整 ---- */
    var fsMode = "auto", fsVal = 26;
    function fit() {
      if (!wall) return;
      if (fsMode !== "auto") { grid.style.setProperty("--fbfs", fsVal + "px"); return; }
      var lo = 15, hi = 34, best = lo;
      while (lo <= hi) {
        var mid = (lo + hi) >> 1;
        grid.style.setProperty("--fbfs", mid + "px");
        if (grid.scrollHeight <= grid.clientHeight + 2 && grid.scrollWidth <= grid.clientWidth + 2) { best = mid; lo = mid + 1; } else hi = mid - 1;
      }
      fsVal = best; grid.style.setProperty("--fbfs", best + "px");
    }
    function fsLabels() { bAuto.className = fsMode === "auto" ? "fb-dark" : ""; }
    bA.addEventListener("click", function () { fsMode = "man"; fsVal = Math.max(13, fsVal - 2); fit(); fsLabels(); });
    bB.addEventListener("click", function () { fsMode = "man"; fsVal = Math.min(48, fsVal + 2); fit(); fsLabels(); });
    bAuto.addEventListener("click", function () { fsMode = "auto"; fit(); fsLabels(); });
    fsLabels();
    var onResize = function () { fit(); }; window.addEventListener("resize", onResize);
    /* ---- 點卡片放大看（左右鍵換下一則） ---- */
    var zoom = el("div", "fb-zoom"); zoom.hidden = true; wall.appendChild(zoom);
    var zList = [], zi = 0;
    function drawZoom() {
      var p = zList[zi]; if (!p) { zoom.hidden = true; return; }
      zoom.innerHTML = '<button type="button" class="nav" data-z="-1" aria-label="上一則">‹</button><div class="zc"><p>' + esc(p.body) + '</p><div class="row"><span class="lk" style="color:#B3261E;font-weight:700">♥ ' + p.likes + '</span>' +
        (wall.classList.contains("noseat") ? "" : '<span class="seat" style="background:#1E3A34;color:#fff;border-radius:999px;padding:4px 14px">' + p.seat + ' 號</span>') +
        '<span style="margin-left:auto;color:#4A5A55;font-size:18px">' + (zi + 1) + " / " + zList.length + '</span></div></div><button type="button" class="nav" data-z="1" aria-label="下一則">›</button><button type="button" class="zx">✕ 關閉</button>';
      zoom.hidden = false;
    }
    zoom.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) { if (e.target === zoom) zoom.hidden = true; return; }
      if (b.classList.contains("zx")) { zoom.hidden = true; return; }
      zi = (zi + (+b.dataset.z) + zList.length) % zList.length; drawZoom();
    });
    wall.addEventListener("keydown", function (e) {
      if (zoom.hidden) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") { zi = (zi + 1) % zList.length; drawZoom(); e.preventDefault(); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { zi = (zi - 1 + zList.length) % zList.length; drawZoom(); e.preventDefault(); }
      else if (e.key === "Escape") { zoom.hidden = true; e.stopPropagation(); }
    }, true);
    bSeat.addEventListener("click", function () { var s = wall.classList.toggle("noseat"); save(SEAT_SHOW, !s); labels(); });
    bSort.addEventListener("click", function () { sortBy = sortBy === "new" ? "likes" : "new"; labels(); render(); });
    bOpen.addEventListener("click", function () { setOpen(!wallBoard.open); });
    function setOpen(v) {
      api("rest/v1/fb_boards?id=eq." + encodeURIComponent(wallBoard.id), { method: "PATCH", json: { open: v, updated_at: new Date().toISOString() } })
        .then(function () { wallBoard.open = v; labels(); render(); FB._refreshPanel && FB._refreshPanel(); }).catch(function () { meta.textContent = "連線失敗，請再試一次"; });
    }
    bX.addEventListener("click", closeWall);
    grid.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-hide]");
      if (!b) {
        var c = e.target.closest(".fb-card[data-id]"); if (!c) return;
        zList = shownList.filter(function (p) { return !p.hidden; }); zi = Math.max(0, zList.map(function (p) { return p.id; }).indexOf(c.dataset.id));
        if (zList.length) drawZoom(); return;
      }
      var id = b.dataset.hide, p = posts.filter(function (x) { return x.id === id; })[0]; if (!p) return;
      var v = !p.hidden; b.disabled = true;
      api("rest/v1/fb_posts?id=eq." + encodeURIComponent(id), { method: "PATCH", json: { hidden: v } })
        .then(function () { p.hidden = v; render(); }).catch(function () { b.disabled = false; });
    });
    var shownList = [];
    function render() {
      var list = posts.slice();
      if (sortBy === "likes") list.sort(function (a, b) { return (b.likes - a.likes) || (a.created_at < b.created_at ? -1 : 1); });
      else list.reverse();
      var max = 0; posts.forEach(function (p) { if (!p.hidden && p.likes > max) max = p.likes; });
      var shown = posts.filter(function (p) { return !p.hidden; }).length;
      meta.textContent = (wallBoard.class_name ? wallBoard.class_name + "・" : "") + shown + " 則想法" + (posts.length > shown ? "（隱藏 " + (posts.length - shown) + " 則）" : "") + (wallBoard.open ? "・開放中" : "・已關閉");
      grid.innerHTML = list.length ? list.map(function (p) {
        var cls = "fb-card" + (p.hidden ? " hid" : "") + (!seen[p.id] && Object.keys(seen).length ? " new" : "") + (!p.hidden && max > 0 && p.likes === max ? " top1" : "");
        return '<div class="' + cls + '" data-id="' + esc(p.id) + '"><p>' + esc(p.body) + '</p><div class="row"><span class="lk">♥ ' + p.likes + '</span><span class="seat">' + p.seat + " 號</span>" +
          '<button type="button" data-hide="' + esc(p.id) + '">' + (p.hidden ? "重新顯示" : "隱藏") + "</button></div></div>";
      }).join("") : '<div class="fb-empty">' + (inLive ? "還沒有想法，等學生在平板上寫！" : "還沒有想法，請學生掃描 QR Code 開始寫！") + "</div>";
      shownList = list;
      posts.forEach(function (p) { seen[p.id] = 1; });
      if (!Object.keys(seen).length) seen.__ = 1;
      fit();
    }
    function pull() {
      api("rest/v1/rpc/fb_teacher_list", { method: "POST", json: { p_board: wallBoard.id } }).then(function (d) {
        if (!wall) return;
        var sig = JSON.stringify(d), old = JSON.stringify(posts);
        if (sig !== old) { posts = d || []; render(); }
      }).catch(function () { if (meta) meta.textContent = "連線中斷，重新連線中…"; });
    }
    labels(); render(); pull();
    wallTimer = setInterval(pull, POLL);
    wall.addEventListener("keydown", function (e) { if (e.key === "Escape") closeWall(); });
    wall._cleanup = function () { clearInterval(tTick); window.removeEventListener("resize", onResize); };
    bX.focus();
  }
  function closeWall() {
    if (wallTimer) clearInterval(wallTimer); wallTimer = null;
    if (wall) { if (wall._cleanup) wall._cleanup(); wall.remove(); wall = null; if (window.CLS_LIVE && window.CLS_LIVE.pushHere && window.CLS_LIVE.id) window.CLS_LIVE.pushHere(); }
    document.documentElement.classList.remove("ct-wb-open");
  }

  /* ---------- 工具面板裡的「回饋」分頁 ---------- */
  function guessTitle() {
    var sec = [].filter.call(document.querySelectorAll("section.k-sec"), function (s) { return s.offsetParent; })[0];
    var h = sec && sec.querySelector("h2"), story = sec && sec.querySelector(".scene .story");
    var t = h ? h.textContent.trim() : (document.querySelector("h1") || document.title || { textContent: "" }).textContent;
    if (story) {
      var c = story.cloneNode(true), lab = c.querySelector(".lab"), pr = c.querySelector(".prog");
      if (pr) pr.remove();
      var lt = lab ? lab.textContent.trim() : ""; if (lab) lab.remove();
      t += (lt ? " " + lt : "") + "：" + c.textContent.trim();
    }
    return (t || document.title || "").replace(/\s+/g, " ").slice(0, 120);
  }
  function panel(box) {
    box.innerHTML = "";
    var wrap = el("div", "fb-p"); box.appendChild(wrap);
    var cls = window.CLS;
    if (!cls || !cls.isTeacher) {
      wrap.innerHTML = '<p class="ct-note">學生回饋要用<b>老師帳號</b>開題目。請先到書櫃首頁按「老師登入」，再回到這份教材。</p>' +
        '<p class="ct-note">開好題目後，學生用平板掃 QR Code 寫想法、互相按讚，大螢幕會顯示全班想法。</p>';
      return;
    }
    var cur = load(CUR_KEY, null);
    if (cur && cur.id) showCurrent(cur); else showNew();
    function showNew() {
      wrap.innerHTML = "";
      var lt = el("label", "", "<span>討論題目</span>"), ta = el("textarea"); ta.maxLength = 200; ta.value = guessTitle(); lt.appendChild(ta);
      var lc = el("label", "", "<span>班級（可不填）</span>"), ic = el("input"); ic.maxLength = 20; ic.placeholder = "例如：四年三班"; ic.value = load(CLASS_KEY, ""); lc.appendChild(ic);
      var go = btn("ct-b fill", "💬 開放回饋");
      var row = el("div", "ct-row even"), hist = btn("ct-b sm", "之前的討論"); row.appendChild(hist);
      var msg = el("p", "ct-note");
      wrap.appendChild(lt); wrap.appendChild(lc); wrap.appendChild(go); wrap.appendChild(msg); wrap.appendChild(row);
      go.addEventListener("click", function () {
        var t = ta.value.trim(); if (!t) { msg.textContent = "請先輸入題目。"; ta.focus(); return; }
        save(CLASS_KEY, ic.value.trim()); go.disabled = true; msg.textContent = "建立中…";
        api("rest/v1/fb_boards", { method: "POST", prefer: "return=representation", json: { title: t, class_name: ic.value.trim(), lesson_url: location.pathname.split("/").slice(-2).join("/") } })
          .then(function (d) { var b = d && d[0]; save(CUR_KEY, b); showCurrent(b); openWall(b); })
          .catch(function () { go.disabled = false; msg.textContent = "建立失敗，請確認網路連線後再試一次。"; });
      });
      hist.addEventListener("click", showHistory);
    }
    function showCurrent(b) {
      wrap.innerHTML = "";
      var c = el("div", "fb-cur", "<b>" + esc(b.title) + '</b><span class="fb-st ' + (b.open ? "on" : "off") + '">' + (b.open ? "● 開放中：學生可以寫想法、按讚" : "● 已關閉") + "</span>");
      var r1 = el("div", "ct-row even"), bw = btn("ct-b fill", "📺 想法牆");
      var r2 = el("div", "ct-row even"), bo = btn("ct-b sm", b.open ? "⏸ 關閉回饋" : "▶ 重新開放"), bn = btn("ct-b sm", "換新題目");
      var r3 = el("div", "ct-row even"), bh = btn("ct-b sm", "之前的討論");
      r1.appendChild(bw); r2.appendChild(bo); r2.appendChild(bn); r3.appendChild(bh);
      var msg = el("p", "ct-note");
      wrap.appendChild(c); wrap.appendChild(r1); wrap.appendChild(r2); wrap.appendChild(r3); wrap.appendChild(msg);
      bw.addEventListener("click", function () { openWall(b); });
      bo.addEventListener("click", function () {
        var v = !b.open; bo.disabled = true;
        api("rest/v1/fb_boards?id=eq." + encodeURIComponent(b.id), { method: "PATCH", json: { open: v, updated_at: new Date().toISOString() } })
          .then(function () { b.open = v; save(CUR_KEY, b); showCurrent(b); }).catch(function () { bo.disabled = false; msg.textContent = "連線失敗，請再試一次。"; });
      });
      bn.addEventListener("click", function () {
        if (b.open) api("rest/v1/fb_boards?id=eq." + encodeURIComponent(b.id), { method: "PATCH", json: { open: false, updated_at: new Date().toISOString() } }).catch(function () {});
        save(CUR_KEY, null); showNew();
      });
      bh.addEventListener("click", showHistory);
    }
    function showHistory() {
      wrap.innerHTML = '<p class="ct-note">之前開過的題目（最新的在上面）。點「看」打開想法牆；刪除要按兩次。</p>';
      var list = el("div", "fb-list", '<p class="ct-note">讀取中…</p>'), back = btn("ct-b sm", "← 返回");
      wrap.appendChild(list); wrap.appendChild(back);
      back.addEventListener("click", function () { var c = load(CUR_KEY, null); if (c && c.id) showCurrent(c); else showNew(); });
      api("rest/v1/fb_boards?select=id,title,class_name,open,created_at,lesson_url,fb_posts(count)&order=created_at.desc&limit=50").then(function (d) {
        if (!d || !d.length) { list.innerHTML = '<p class="ct-note">還沒有開過題目。</p>'; return; }
        list.innerHTML = "";
        d.forEach(function (b) {
          var n = b.fb_posts && b.fb_posts[0] ? b.fb_posts[0].count : 0;
          var it = el("div", "fb-item", "<span>" + esc(b.title) + "<small>" + fmt(b.created_at) + (b.class_name ? "・" + esc(b.class_name) : "") + "・" + n + " 則" + (b.open ? "・開放中" : "") + "</small></span>");
          var bv = btn("ct-b sm", "看"), bd = btn("ct-b sm", "刪除"), armed = false;
          it.appendChild(bv); it.appendChild(bd); list.appendChild(it);
          bv.addEventListener("click", function () { openWall(b); });
          bd.addEventListener("click", function () {
            if (!armed) { armed = true; bd.textContent = "確定？"; bd.className = "ct-b sm hot"; setTimeout(function () { armed = false; bd.textContent = "刪除"; bd.className = "ct-b sm"; }, 3000); return; }
            api("rest/v1/fb_boards?id=eq." + encodeURIComponent(b.id), { method: "DELETE" }).then(function () {
              it.remove(); var c = load(CUR_KEY, null); if (c && c.id === b.id) save(CUR_KEY, null);
            });
          });
        });
      }).catch(function () { list.innerHTML = '<p class="ct-note">讀取失敗，請確認網路連線。</p>'; });
    }
    FB._refreshPanel = function () { var c = load(CUR_KEY, null); if (c && wallBoard && c.id === wallBoard.id) { c.open = wallBoard.open; save(CUR_KEY, c); showCurrent(c); } };
  }

  window.FB = { panel: panel, openWall: openWall, closeWall: closeWall };
})();
