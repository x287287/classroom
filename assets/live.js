/* 教室小書櫃：課堂房間（全班跟著老師換頁）
   老師（登入老師帳號）在書櫃首頁按「📡 課堂 QR」（或教材的「QR」視窗按「📡 開始課堂」）→ 產生 6 位數課堂代碼（localStorage clsLive），
   學生掃 QR（書櫃：join.html?s=代碼&c=班級；教材：教材?stu=1&c=班級&s=代碼）、選一次座號，之後平板跟著老師：
     ・平常（書櫃、教材的一般站、動畫簡報、宣導簡報、只給大螢幕的遊戲）→ 平板顯示「👀 請看大螢幕，認真上課」
     ・老師把教材換到「交給老師」那一站（#send），或 <meta name="live-play" content="站id,…"> 列的站 → 平板打開同一站一起操作
     ・老師開全班共戰房間 → 平板自動進 raid.html?r=房號；老師開想法牆 → 平板自動進 fb.html?b=代碼（座號都自動帶入）
     ・老師在任何一站按左下角「📱 給平板練習」→ 平板打開同一站自己練習（配對、分一分、小測驗…）；按「👀 收回平板」或換站就回到看大螢幕
     ・<meta name="live" content="play"> 的頁面（平板遊戲：個人挑戰、小豬消防隊）→ 平板打開同一份一起玩
     ・<meta name="live" content="screen">（兩隊對戰、全班共戰老師頁）或 "none"（書櫃首頁）→ 看大螢幕
   老師結束課堂，或 6 小時沒有換頁，學生平板就停止跟隨。
   資料表 live_sessions（id、class_name、url、title、open；只有老師能讀寫）、live_seen（哪些平板在跟）；
   學生只用 RPC live_state(p_id,p_device,p_seat)，老師用 live_host(p_id) 看幾台平板在跟。
   學生的課堂代碼記在這個分頁的 sessionStorage clsSess；裝置代碼與想法牆共用 fbDevice。
   home-fab.js 會自動載入這個檔；raid.html、fb.html、index.html 直接載入。
   window.CLS_LIVE = { id, isStudent, start(班級), end(), push(網址, 標題), screen(標題), host } */
(function () {
  if (window.CLS_LIVE) return;
  var SB_URL = "https://tsxbphngzuzpdddhadfw.supabase.co";
  var SB_KEY = "sb_publishable_EOXrx2SRQbFRHACqHbUUig_4e-EkgkE";
  var me = document.currentScript && document.currentScript.src;
  var ROOT = me ? new URL("../", me).href : new URL("./", location.href).href;
  var MAX_AGE = 6 * 3600 * 1000;

  function sget(k) { try { return JSON.parse(sessionStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function sset(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function lget(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lset(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function rpc(fn, a) {
    return fetch(SB_URL + "/rest/v1/rpc/" + fn, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify(a), cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }
  /* 網址 → 相對網站根目錄的路徑（拿掉學生模式用的 stu、c、s 參數） */
  function rel(u) {
    var x = new URL(u, location.href);
    ["stu", "c", "s"].forEach(function (p) { x.searchParams.delete(p); });
    var h = x.href;
    return h.indexOf(ROOT) === 0 ? h.slice(ROOT.length) : x.pathname.replace(/^\//, "") + x.search + x.hash;
  }
  function noHash(p) { return String(p || "").split("#")[0]; }
  function hashOf(p) { var i = String(p || "").indexOf("#"); return i < 0 ? "" : p.slice(i); }
  function metaLive() { var m = document.querySelector('meta[name="live"]'); return m ? m.getAttribute("content") : ""; }
  function pageTitle() { return ((document.querySelector("h1") || {}).textContent || document.title || "").trim().slice(0, 100); }

  var css =
    ".cls-live-pill{appearance:none;box-sizing:border-box;height:52px;display:inline-flex;align-items:center;gap:.35em;padding:0 16px;border-radius:999px;" +
    "background:#7A2E8E;color:#fff;border:2px solid #fff;font:700 17px/1 'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.28);cursor:pointer}" +
    ".cls-live-pill:focus-visible{outline:3px solid #F5B521;outline-offset:3px}" +
    ".cls-live-share{background:#1E7A4F}.cls-live-share.on{background:#B45309}" +
    ".cls-live-solo{position:fixed;z-index:2147483000;left:max(16px,calc(env(safe-area-inset-left,0px) + 12px));bottom:calc(env(safe-area-inset-bottom,0px) + 16px)}" +
    ".cls-live-stu{position:fixed;z-index:2147483000;right:12px;top:10px;background:#7A2E8E;color:#fff;border-radius:999px;padding:6px 14px;font:700 15px/1.3 'Noto Sans TC',sans-serif;box-shadow:0 3px 12px rgba(0,0,0,.25);pointer-events:none}" +
    ".cls-live-screen{position:fixed;inset:0;z-index:2147483004;background:linear-gradient(160deg,#4A2B5E,#1E1630);color:#fff;display:grid;place-items:center;padding:24px;text-align:center;font:400 20px/1.6 'Huninn','Noto Sans TC',sans-serif}" +
    ".cls-live-screen[hidden]{display:none}" +
    ".cls-live-screen b{display:block;font-size:clamp(28px,7vw,44px);margin:.3em 0;color:#FFD54F}" +
    ".cls-live-toast{position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:2147483005;background:#1E3A34;color:#fff;border-radius:999px;padding:10px 20px;font:700 17px/1.4 'Noto Sans TC',sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.3)}" +
    "@media print{.cls-live-pill,.cls-live-stu,.cls-live-screen{display:none}}";
  function addCss() { if (document.getElementById("cls-live-css")) return; var s = document.createElement("style"); s.id = "cls-live-css"; s.textContent = css; (document.head || document.documentElement).appendChild(s); }
  function onReady(fn) { if (document.body) fn(); else document.addEventListener("DOMContentLoaded", fn); }
  function toast(t) { onReady(function () { var d = document.createElement("div"); d.className = "cls-live-toast"; d.setAttribute("role", "status"); d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 4000); }); }

  var qs = new URLSearchParams(location.search);
  var qsS = (qs.get("s") || "").replace(/\D/g, "").slice(0, 6);
  if (qsS.length === 6) sset("clsSess", qsS);
  var sid = sget("clsSess");
  var L = window.CLS_LIVE = { id: null, isStudent: false, host: null };

  /* ================= 學生平板：跟著老師 ================= */
  if (sid) {
    L.id = sid; L.isStudent = true; addCss();
    var device = lget("fbDevice", null);
    if (!device) { device = "d" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); lset("fbDevice", device); }
    var screenOv = null, timer = null, moving = false;
    onReady(function () {
      var p = document.createElement("div"); p.className = "cls-live-stu"; p.textContent = "📡 跟著老師"; p.setAttribute("aria-hidden", "true");
      document.body.appendChild(p);
    });
    function seat() { var s = sget("clsSeat"); return s && s.seat || 0; }
    function showScreen(title) {
      onReady(function () {
        if (!screenOv) { screenOv = document.createElement("div"); screenOv.className = "cls-live-screen"; screenOv.setAttribute("role", "status"); document.body.appendChild(screenOv); }
        screenOv.innerHTML = "<div><div style='font-size:64px'>👀</div><b>請看大螢幕，認真上課</b><div>" + esc(title || "") + "</div><div style='font-size:16px;opacity:.8;margin-top:1em'>" + (seat() ? "我是 " + seat() + " 號・" : "") + "要玩遊戲、交作品或寫想法時，這裡會自動打開。</div>" +
          (seat() ? "<button type='button' class='re' style='margin-top:1.4em;appearance:none;border:2px solid #fff;background:transparent;color:#fff;border-radius:999px;min-height:46px;padding:0 20px;font:700 16px/1 inherit;cursor:pointer'>選錯座號？重新選</button>" : "") + "</div>";
        var re = screenOv.querySelector(".re");
        if (re) re.onclick = function () { var stu = sget("clsStu") || {}; moving = true; location.href = ROOT + "join.html?re=1&s=" + sid + (stu.cls ? "&c=" + encodeURIComponent(stu.cls) : ""); };
        screenOv.hidden = false;
      });
    }
    function stop(msg) { clearInterval(timer); timer = null; sset("clsSess", null); L.id = null; if (screenOv) screenOv.hidden = true; var p = document.querySelector(".cls-live-stu"); if (p) p.remove(); if (msg) toast(msg); }
    function poll() {
      if (moving || document.hidden) return;
      rpc("live_state", { p_id: sid, p_device: device, p_seat: seat() || null }).then(function (d) {
        if (!d || !d.open) { stop(d && d.err ? "" : "老師結束了課堂"); return; }
        var url = d.url || "";
        if (!url || url.indexOf("screen:") === 0) { showScreen(url.slice(7)); return; }
        if (screenOv) screenOv.hidden = true;
        var cur = rel(location.href);
        if (noHash(url) === noHash(cur)) {
          if (hashOf(url) !== hashOf(cur)) location.hash = hashOf(url) || "#";
          return;
        }
        var x = new URL(url, ROOT);
        if (!/(^|\/)(raid|fb)\.html$/.test(x.pathname)) {
          var stu = sget("clsStu") || {};
          x.searchParams.set("stu", "1");
          var c = stu.cls || d.class_name || "";
          if (c) x.searchParams.set("c", c);
        }
        x.searchParams.set("s", sid);
        moving = true; location.replace(x.href);
      }).catch(function () {});
    }
    timer = setInterval(poll, 2500); poll();
    document.addEventListener("visibilitychange", function () { if (!document.hidden) poll(); });
    return;
  }

  /* ================= 老師的大螢幕：開課堂、推送目前頁面 ================= */
  var live = lget("clsLive", null);
  if (live && (!live.id || Date.now() - (live.t || 0) > MAX_AGE)) { live = null; lset("clsLive", null); }
  L.id = live ? live.id : null;
  function api(path, method, body) {
    if (!window.CLS || !window.CLS.api) return Promise.reject(new Error("no CLS"));
    return window.CLS.api(path, { method: method || "GET", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || ("HTTP " + r.status)); }); return r; });
  }
  function fire() { try { window.dispatchEvent(new CustomEvent("cls-live", { detail: { id: L.id, host: L.host } })); } catch (e) {} }
  var lastPush = null, pushTimer = null;
  L.push = function (url, title) {
    if (!L.id) return;
    var body = { url: String(url || "").slice(0, 300), title: String(title || "").slice(0, 120), updated_at: new Date().toISOString() };
    if (lastPush === body.url) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      lastPush = body.url;
      live.t = Date.now(); lset("clsLive", live);
      api("rest/v1/live_sessions?id=eq." + L.id, "PATCH", body).catch(function () { lastPush = null; });
    }, 150);
  };
  L.screen = function (title) { L.push("screen:" + (title || pageTitle()), title || pageTitle()); };
  /* 依這一頁的設定推送：一般教材＝這一頁（含目前的站）；screen＝請學生看大螢幕；none＝不推送 */
  /* 平板要不要打開這一頁：只有互動環節（平板遊戲 play、「交給老師」#send 站）才打開，其餘都看大螢幕 */
  /* 老師按「📱 給平板練習／👀 收回平板」對目前這一站的臨時設定（離開這一站就失效） */
  var ov = null;
  function hereUrl() {
    var cur = rel(location.href);
    if (ov && ov.url === cur) return ov.mode === "open" ? cur : "screen:" + pageTitle();
    var m = metaLive();
    if (m === "play") return rel(location.href);
    if (m === "screen" || m === "none") return "screen:" + (m === "none" ? "" : pageTitle());
    /* 平板一起操作的站：<meta name="live-play" content="studio,send">，沒寫就只有「交給老師」#send */
    var mp = document.querySelector('meta[name="live-play"]');
    var ids = (mp ? mp.getAttribute("content") : "send").split(/[\s,]+/);
    var h = location.hash.slice(1);
    if (h && ids.indexOf(h) >= 0 && document.getElementById(h)) return rel(location.href);
    return "screen:" + pageTitle();
  }
  L.pushHere = function () { var u = hereUrl(); L.push(u, pageTitle()); };
  L.start = function (cls) {
    var tries = 0;
    function attempt() {
      var id = String(Math.floor(100000 + Math.random() * 900000));
      var url = hereUrl();
      return api("rest/v1/live_sessions", "POST", { id: id, class_name: cls || null, url: url, title: pageTitle() }).then(function () {
        live = { id: id, cls: cls || "", t: Date.now() }; lset("clsLive", live); L.id = id; lastPush = url; L.host = { count: 0, seats: [] };
        startHost(); fire(); return id;
      }).catch(function (e) { if (++tries < 3 && /duplicate|23505|409/.test(String(e.message))) return attempt(); throw e; });
    }
    return attempt();
  };
  L.end = function () {
    var id = L.id; if (!id) return Promise.resolve();
    L.id = null; live = null; lset("clsLive", null); L.host = null; stopHost(); fire();
    return api("rest/v1/live_sessions?id=eq." + id, "PATCH", { open: false, updated_at: new Date().toISOString() }).catch(function () {});
  };
  var hostTimer = null;
  function hostTick() {
    if (!L.id || document.hidden || !window.CLS || !window.CLS.api) return;
    window.CLS.api("rest/v1/rpc/live_host", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_id: L.id }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (h) {
        if (!h) return;
        if (h.open === false || h.open === null) { L.id = null; live = null; lset("clsLive", null); L.host = null; stopHost(); fire(); return; }
        L.host = h; fire();
      }).catch(function () {});
  }
  function startHost() { stopHost(); hostTimer = setInterval(hostTick, 5000); hostTick(); }
  function stopHost() { clearInterval(hostTimer); hostTimer = null; }

  /* 課堂進行中的小按鈕（點一下打開 QR 視窗；書櫃首頁沒有 QR 視窗，改成結束課堂） */
  var pill = null;
  function drawPill() {
    onReady(function () {
      if (!L.id) { if (pill) { pill.remove(); pill = null; } return; }
      addCss();
      if (!pill) {
        pill = document.createElement("button"); pill.type = "button"; pill.className = "cls-live-pill";
        pill.addEventListener("click", function () {
          var qrBtn = document.querySelector(".cls-fab.qr");
          if (qrBtn) qrBtn.click(); else L.openDialog();
        });
      }
      pill.textContent = "📡 課堂 " + L.id + (L.host ? "・" + L.host.count + " 台跟著" : "");
      pill.setAttribute("aria-label", "課堂進行中，代碼 " + L.id + (L.host ? "，" + L.host.count + " 台平板跟著" : ""));
      var bar = document.querySelector(".cls-fabs");
      if (bar) { pill.classList.remove("cls-live-solo"); if (pill.parentNode !== bar) bar.appendChild(pill); }
      else { pill.classList.add("cls-live-solo"); if (pill.parentNode !== document.body) document.body.appendChild(pill); }
      drawShare(bar);
    });
  }
  /* 「📱 給平板練習」：把目前這一站（配對、分一分、小測驗…）打開在學生平板上自己練習；再按一次收回 */
  var shareBtn = null;
  function drawShare(bar) {
    var m = metaLive();
    if (!L.id || !bar || m === "none" || m === "screen") { if (shareBtn) { shareBtn.remove(); shareBtn = null; } return; }
    if (!shareBtn) {
      shareBtn = document.createElement("button"); shareBtn.type = "button"; shareBtn.className = "cls-live-pill cls-live-share";
      shareBtn.addEventListener("click", function () {
        var open = hereUrl().indexOf("screen:") !== 0;
        ov = { url: rel(location.href), mode: open ? "screen" : "open" };
        L.pushHere(); drawShare(document.querySelector(".cls-fabs"));
      });
    }
    var isOpen = hereUrl().indexOf("screen:") !== 0;
    shareBtn.textContent = isOpen ? "👀 收回平板" : "📱 給平板練習";
    shareBtn.classList.toggle("on", isOpen);
    shareBtn.setAttribute("aria-label", isOpen ? "學生平板正打開這一站，按一下收回，改成請看大螢幕" : "把這一站打開在學生平板上，讓學生自己練習");
    if (shareBtn.parentNode !== bar) bar.appendChild(shareBtn);
  }
  window.addEventListener("cls-live", drawPill);

  /* ---------- 書櫃首頁的「📡 課堂 QR」視窗：選班級 → 開課堂 → 顯示加入用的 QR ---------- */
  var SITE = /github\.io$/.test(location.hostname) ? ROOT : "https://x287287.github.io/classroom/";
  var dlg = null, dlgCls = lget("clsClass", "");
  var dcss = ".cls-ldlg{position:fixed;inset:0;z-index:2147483003;background:rgba(10,20,18,.62);display:grid;place-items:center;padding:16px}" +
    ".cls-ldlg[hidden]{display:none}" +
    ".cls-ldlg .box{background:#fff;color:#1F2A27;border-radius:24px;padding:22px 26px;width:min(560px,100%);max-height:94vh;overflow:auto;display:grid;gap:12px;justify-items:center;text-align:center;font:400 17px/1.6 'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.35)}" +
    ".cls-ldlg h2{margin:0;font:700 26px/1.3 'Huninn','Noto Sans TC',sans-serif;color:#4A2B5E}" +
    ".cls-ldlg .cls{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}" +
    ".cls-ldlg button{appearance:none;min-height:48px;padding:0 20px;border-radius:999px;border:2px solid #1E3A34;background:#fff;color:#1E3A34;font:700 17px/1 'Noto Sans TC',sans-serif;cursor:pointer}" +
    ".cls-ldlg button[aria-pressed=true],.cls-ldlg button.go{background:#7A2E8E;border-color:#7A2E8E;color:#fff}" +
    ".cls-ldlg button.end{border-color:#B3261E;color:#B3261E}" +
    ".cls-ldlg .code{width:min(360px,70vw);aspect-ratio:1}.cls-ldlg .code svg{width:100%;height:100%}" +
    ".cls-ldlg .on{background:#F4ECF8;color:#4A2B5E;border-radius:14px;padding:8px 14px}" +
    ".cls-ldlg .url{font-size:14px;color:#4A5550;word-break:break-all}" +
    ".cls-ldlg .row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}";
  function loadQr(cb) {
    if (window.qrcode) return cb();
    var sc = document.createElement("script"); sc.src = ROOT + "assets/vendor/qrcode.js"; sc.onload = function () { cb(); }; sc.onerror = function () { cb(1); }; document.head.appendChild(sc);
  }
  function classes(cb) {
    fetch(SB_URL + "/rest/v1/class_list?select=name,seats&order=sort.asc,name.asc", { headers: { apikey: SB_KEY }, cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : []; }).then(cb).catch(function () { cb([]); });
  }
  function drawDlg() {
    if (!dlg || dlg.hidden) return;
    var box = dlg.querySelector(".box");
    if (!(window.CLS && window.CLS.isTeacher)) { box.innerHTML = "<h2>📡 課堂</h2><p>請先按「☁ 老師登入」，登入老師帳號後才能開課堂。</p><button type='button' class='x'>關閉</button>"; return; }
    if (!L.id) {
      box.innerHTML = "<h2>📡 開始課堂</h2><p>選班級後開始，學生掃 QR Code、選座號就加入。<br>平常平板顯示「請看大螢幕」，玩遊戲、交作品、寫想法時才會自動打開。</p>" +
        "<div class='cls'></div><div class='row'><button type='button' class='go'>📡 開始課堂</button><button type='button' class='x'>取消</button></div>";
      classes(function (list) {
        var c = box.querySelector(".cls"); if (!c) return;
        if (list.length && !list.some(function (x) { return x.name === dlgCls; })) dlgCls = list.length === 1 ? list[0].name : dlgCls;
        c.innerHTML = list.map(function (x) { return "<button type='button' data-c='" + esc(x.name) + "' aria-pressed='" + (x.name === dlgCls) + "'>" + esc(x.name) + "</button>"; }).join("") ||
          "<span>還沒有班級，可以到老師後台「🏫 班級名單」新增。</span>";
      });
      return;
    }
    var h = L.host || {}, seats = h.seats || [];
    var url = SITE + "join.html?s=" + L.id + (live && live.cls ? "&c=" + encodeURIComponent(live.cls) : "");
    box.innerHTML = "<h2>📡 掃描加入課堂" + (live && live.cls ? "・" + esc(live.cls) : "") + "</h2>" +
      "<div class='on'>課堂代碼 <b>" + L.id + "</b>・<b>" + (h.count || 0) + "</b> 台平板跟著" + (seats.length ? "<br><small>座號：" + seats.join("、") + "</small>" : "") + "</div>" +
      "<div class='code' aria-label='加入課堂的 QR Code'></div><div class='url'>" + esc(url) + "</div>" +
      "<div class='row'><button type='button' class='x go'>開始上課</button><button type='button' class='end'>結束課堂</button></div>";
    loadQr(function (err) {
      var c = box.querySelector(".code"); if (!c) return;
      if (err || !window.qrcode) { c.textContent = "QR Code 載入失敗，請學生輸入上面的網址。"; return; }
      var qr = window.qrcode(0, "M"); qr.addData(url); qr.make(); c.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
    });
  }
  L.openDialog = function () {
    addCss();
    if (!dlg) {
      var st = document.createElement("style"); st.textContent = dcss; document.head.appendChild(st);
      dlg = document.createElement("div"); dlg.className = "cls-ldlg"; dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true"); dlg.setAttribute("aria-label", "課堂");
      dlg.innerHTML = "<div class='box'></div>"; document.body.appendChild(dlg);
      dlg.addEventListener("click", function (e) {
        if (e.target === dlg) { dlg.hidden = true; return; }
        var b = e.target.closest("button"); if (!b) return;
        if (b.dataset.c != null) { dlgCls = b.dataset.c; lset("clsClass", dlgCls); [].forEach.call(dlg.querySelectorAll("[data-c]"), function (x) { x.setAttribute("aria-pressed", String(x === b)); }); return; }
        if (b.classList.contains("x")) { dlg.hidden = true; return; }
        if (b.classList.contains("go")) { b.disabled = true; b.textContent = "開課堂中…"; L.start(dlgCls).then(drawDlg).catch(function () { b.disabled = false; b.textContent = "開課堂失敗，請再按一次"; }); return; }
        if (b.classList.contains("end")) { if (!b.dataset.arm) { b.dataset.arm = "1"; b.textContent = "再按一次結束（平板停止跟隨）"; return; } L.end().then(function () { dlg.hidden = true; }); }
      });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && dlg && !dlg.hidden) dlg.hidden = true; });
      window.addEventListener("cls-live", function () {
        if (!dlg || dlg.hidden || dlg.querySelector(".end[data-arm]")) return;
        var on = dlg.querySelector(".on"), h = L.host || {};
        if (L.id && on && dlg.querySelector(".code svg")) on.innerHTML = "課堂代碼 <b>" + L.id + "</b>・<b>" + (h.count || 0) + "</b> 台平板跟著" + ((h.seats || []).length ? "<br><small>座號：" + h.seats.join("、") + "</small>" : "");
        else drawDlg();
      });
    }
    dlg.hidden = false; drawDlg();
  };

  /* 等登入狀態確定後，把這一頁推給學生 */
  if (L.id) {
    var waited = 0;
    (function ready() {
      if (window.CLS && window.CLS.isTeacher) { L.pushHere(); startHost(); drawPill(); return; }
      if (++waited > 40) return;
      setTimeout(ready, 250);
    })();
  }
  window.addEventListener("kit-page", function () { if (L.id) setTimeout(function () { L.pushHere(); drawShare(document.querySelector(".cls-fabs")); }, 60); });
})();
