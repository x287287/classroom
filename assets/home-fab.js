/* 教室小書櫃：每份教材共用的左下角按鈕
   「⌂ 回書櫃」回到首頁；「QR」顯示這份教材的 QR Code（老師先選班級），學生用平板或手機掃描就能打開。
   學生模式：用 QR Code 打開的網址帶 ?stu=1&c=班級。學生模式不顯示「回書櫃」、QR 和上課工具，
   一打開先選座號（記在這個分頁的 sessionStorage clsSeat），左下角顯示「班級 座號」可以換。
   window.CLS_STU = {on, cls, seat}；選好座號時發出 cls-seat 事件。
   也會載入 assets/stats.js（遊戲作答統計 STATS.send），在它載入前呼叫的 STATS.send 會先排隊。
   用法：在教材 HTML 的 </body> 前加上
   <script src="../assets/home-fab.js"></script>              */
(function () {
  if (document.querySelector(".cls-fabs")) return;

  var SITE = "https://x287287.github.io/classroom/";
  var me = document.currentScript && document.currentScript.src;
  var QR_LIB = me ? me.replace(/home-fab\.js(\?.*)?$/, "vendor/qrcode.js") : "../assets/vendor/qrcode.js";

  var SB_URL = "https://tsxbphngzuzpdddhadfw.supabase.co";
  var SB_KEY = "sb_publishable_EOXrx2SRQbFRHACqHbUUig_4e-EkgkE";
  function sget(k) { try { return JSON.parse(sessionStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function sset(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function lget(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  /* 班級名單（class_list，公開可讀），快取在 clsClasses */
  function getClasses(cb) {
    var cache = lget("clsClasses", null);
    if (cache) cb(cache);
    fetch(SB_URL + "/rest/v1/class_list?select=name,seats&order=sort.asc,name.asc", { headers: { apikey: SB_KEY }, cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (list) { if (list) { var changed = JSON.stringify(list) !== JSON.stringify(cache); lset("clsClasses", list); if (changed || !cache) cb(list); } })
      .catch(function () { if (!cache) cb([]); });
  }

  /* 學生模式 */
  var qs = new URLSearchParams(location.search);
  var stu = sget("clsStu");
  if (qs.get("stu") === "1") {
    var c0 = (qs.get("c") || "").slice(0, 20);
    if (!stu || stu.cls !== c0) sset("clsSeat", null);
    stu = { cls: c0 }; sset("clsStu", stu);
  }
  var seatRec = stu ? sget("clsSeat") : null;
  window.CLS_STU = stu ? { on: true, cls: stu.cls || "", seat: seatRec && seatRec.seat || 0 } : { on: false, cls: "", seat: 0 };

  /* 遊戲作答統計：先放一個排隊用的 STATS，stats.js 載入後會補送 */
  if (!window.STATS) window.STATS = { _q: [], send: function (g, o) { this._q.push([g, o]); return true; } };
  if (me) { var st = document.createElement("script"); st.src = me.replace(/home-fab\.js(\?.*)?$/, "stats.js"); document.head.appendChild(st); }
  /* 課堂房間（全班跟著老師換頁）：assets/live.js */
  if (me && !window.CLS_LIVE) { var lv = document.createElement("script"); lv.src = me.replace(/home-fab\.js(\?.*)?$/, "live.js"); document.head.appendChild(lv); }

  var css =
    ".cls-fabs{position:fixed;z-index:2147483000;display:flex;gap:10px;align-items:center;" +
    "left:max(16px,calc(env(safe-area-inset-left,0px) + 12px));" +
    "bottom:calc(env(safe-area-inset-bottom,0px) + 16px)}" +
    ".cls-fab{box-sizing:border-box;height:52px;margin:0;display:inline-flex;align-items:center;justify-content:center;gap:.35em;padding:0 20px;" +
    "border-radius:999px;background:#1E3A34;color:#FFFFFF;border:2px solid #FFFFFF;cursor:pointer;" +
    "font:700 18px/1 'Noto Sans TC','PingFang TC','Microsoft JhengHei',system-ui,sans-serif;" +
    "text-decoration:none;box-shadow:0 4px 16px rgba(0,0,0,.28);-webkit-tap-highlight-color:transparent}" +
    ".cls-fab.qr{padding:0 16px;background:#FFFFFF;color:#1E3A34;border-color:#1E3A34}" +
    ".cls-fab.qr svg{width:22px;height:22px}" +
    ".cls-fab:active{transform:scale(.97)}" +
    ".cls-fab:focus-visible{outline:3px solid #F5B521;outline-offset:3px}" +
    ".cls-qr{position:fixed;inset:0;z-index:2147483001;background:rgba(10,20,18,.72);display:grid;place-items:center;padding:16px}" +
    ".cls-qr[hidden]{display:none}" +
    ".cls-qr .box{background:#FFFFFF;color:#1F2A27;border-radius:24px;padding:22px 26px;max-width:min(92vw,560px);width:100%;text-align:center;display:grid;gap:12px;" +
    "font:400 17px/1.6 'Noto Sans TC','PingFang TC','Microsoft JhengHei',system-ui,sans-serif;max-height:94vh;overflow:auto}" +
    ".cls-qr h2{margin:0;font:700 26px/1.3 'Huninn','Noto Sans TC',sans-serif;color:#1E3A34}" +
    ".cls-qr .code{display:grid;place-items:center}" +
    ".cls-qr .code svg{width:min(70vh,72vw,420px);height:auto;display:block}" +
    ".cls-qr .url{font-size:14px;color:#4A5550;word-break:break-all;user-select:all}" +
    ".cls-qr button{appearance:none;justify-self:center;min-height:48px;padding:0 28px;border-radius:999px;border:2px solid #1E3A34;background:#1E3A34;color:#fff;font:700 18px/1 'Noto Sans TC',sans-serif;cursor:pointer}" +
    ".cls-qr .cls-pick{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center}" +
    ".cls-qr .cls-pick b{font-size:16px;color:#1E3A34}" +
    ".cls-qr .cls-pick button{min-height:44px;padding:0 16px;font-size:16px;background:#fff;color:#1E3A34}" +
    ".cls-qr .cls-pick button[aria-pressed=true]{background:#1E3A34;color:#fff}" +
    ".cls-qr .cls-pick button.close-x{display:none}" +
    ".cls-qr .cls-live{display:grid;gap:6px;justify-items:center}" +
    ".cls-qr .cls-live:empty{display:none}" +
    ".cls-qr .cls-live p{margin:0;font-size:15px;color:#4A5550}" +
    ".cls-qr .cls-live .on{background:#F4ECF8;color:#4A2B5E;border-radius:14px;padding:8px 14px;font-size:17px}" +
    ".cls-qr .cls-live button.live-go{background:#7A2E8E;border-color:#7A2E8E}" +
    ".cls-qr .cls-live button.live-end{background:#fff;color:#B3261E;border-color:#B3261E;font-size:16px}" +
    ".cls-seat{position:fixed;inset:0;z-index:2147483002;background:linear-gradient(160deg,#1E3A34,#24524A);display:grid;place-items:center;padding:16px;overflow:auto}" +
    ".cls-seat[hidden]{display:none}" +
    ".cls-seat .box{background:#fff;color:#1F2A27;border-radius:24px;padding:22px clamp(14px,4vw,28px);width:min(640px,100%);display:grid;gap:14px;text-align:center;font:400 17px/1.6 'Noto Sans TC','PingFang TC','Microsoft JhengHei',system-ui,sans-serif}" +
    ".cls-seat h2{margin:0;font:700 clamp(24px,6vw,32px)/1.3 'Huninn','Noto Sans TC',sans-serif;color:#1E3A34}" +
    ".cls-seat .cl{font-weight:700;color:#2A7563;font-size:18px}" +
    ".cls-seat .grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}" +
    ".cls-seat .grid button{appearance:none;min-height:64px;border-radius:16px;border:2px solid #C9D2CC;background:#F4F6F3;color:#1E3A34;font:700 26px/1 'Huninn','Noto Sans TC',sans-serif;cursor:pointer}" +
    ".cls-seat .grid button[aria-pressed=true]{background:#1E3A34;color:#fff;border-color:#1E3A34}" +
    ".cls-seat .grid button:active{transform:scale(.96)}" +
    ".cls-seat .cancel{justify-self:center;appearance:none;min-height:48px;padding:0 24px;border-radius:999px;border:2px solid #1E3A34;background:#fff;color:#1E3A34;font:700 17px/1 'Noto Sans TC',sans-serif;cursor:pointer}" +
    ".cls-fab.cls-me{background:#FFFFFF;color:#1E3A34;border-color:#1E3A34;font-size:17px;padding:0 16px}" +
    ".cls-stats-toast{position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:2147483003;background:#1E3A34;color:#fff;border-radius:999px;padding:10px 20px;font:700 17px/1.4 'Noto Sans TC',sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.3)}" +
    "@media print{.cls-fabs,.cls-qr,.cls-seat{display:none}}" +
    /* 頁面底部留空，最後幾行不會被按鈕蓋住；版面特殊的教材可自行覆寫 */
    "html body{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 84px)}";
  var style = document.createElement("style");
  style.textContent = css;
  document.head.insertBefore(style, document.head.firstChild);

  var wrap = document.createElement("div");
  wrap.className = "cls-fabs";

  if (stu) {
    /* ---------- 學生模式：只有「班級 座號」按鈕和選座號畫面 ---------- */
    var meBtn = document.createElement("button");
    meBtn.type = "button"; meBtn.className = "cls-fab cls-me";
    wrap.appendChild(meBtn);
    var seatOv = document.createElement("div");
    seatOv.className = "cls-seat"; seatOv.setAttribute("role", "dialog"); seatOv.setAttribute("aria-modal", "true"); seatOv.setAttribute("aria-label", "選你的座號");
    var nSeats = 25;
    function paintMe() { var s = window.CLS_STU; meBtn.textContent = (s.cls ? s.cls + " " : "") + (s.seat ? s.seat + " 號" : "選座號"); meBtn.setAttribute("aria-label", "我是" + (s.cls || "") + (s.seat ? s.seat + "號" : "") + "，點一下換座號"); }
    function drawSeats() {
      var s = window.CLS_STU, h = "";
      for (var i = 1; i <= nSeats; i++) h += '<button type="button" data-s="' + i + '" aria-pressed="' + (i === s.seat) + '" aria-label="' + i + ' 號">' + i + "</button>";
      seatOv.innerHTML = '<div class="box"><h2>👋 選你的座號</h2>' + (s.cls ? '<div class="cl">' + esc(s.cls) + "</div>" : "") +
        '<div class="grid">' + h + "</div>" + (s.seat ? '<button type="button" class="cancel">不用換，回去</button>' : '<p style="margin:0;color:#4A5550;font-size:15px">選好座號才能開始。</p>') + "</div>";
    }
    function openSeat() { drawSeats(); seatOv.hidden = false; var b = seatOv.querySelector("button"); if (b) b.focus(); }
    seatOv.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.classList.contains("cancel")) { seatOv.hidden = true; return; }
      var n = +b.dataset.s; if (!n) return;
      window.CLS_STU.seat = n; sset("clsSeat", { seat: n }); seatOv.hidden = true; paintMe();
      try { window.dispatchEvent(new CustomEvent("cls-seat", { detail: window.CLS_STU })); } catch (x) {}
    });
    meBtn.addEventListener("click", openSeat);
    getClasses(function (list) { var c = (list || []).filter(function (x) { return x.name === window.CLS_STU.cls; })[0]; var n = c ? c.seats : 25; if (n !== nSeats) { nSeats = n; if (!seatOv.hidden) drawSeats(); } });
    paintMe();
    if (window.CLS_STU.seat) seatOv.hidden = true; else { seatOv.hidden = false; drawSeats(); }
    var placeStu = function () {
      var host = document.fullscreenElement || document.webkitFullscreenElement || document.body;
      if (wrap.parentNode !== host) host.appendChild(wrap);
      if (seatOv.parentNode !== host) host.appendChild(seatOv);
    };
    document.addEventListener("fullscreenchange", placeStu);
    document.addEventListener("webkitfullscreenchange", placeStu);
    if (document.body) placeStu(); else document.addEventListener("DOMContentLoaded", placeStu);
    return;
  }

  var a = document.createElement("a");
  a.className = "cls-fab cls-home-fab";
  a.href = "../index.html";
  a.textContent = "⌂ 回書櫃";
  a.setAttribute("aria-label", "回到教室小書櫃首頁");

  var q = document.createElement("button");
  q.type = "button";
  q.className = "cls-fab qr";
  q.setAttribute("aria-label", "顯示這份教材的 QR Code");
  q.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 3h8v8H3zm2 2v4h4V5zm8-2h8v8h-8zm2 2v4h4V5zM3 13h8v8H3zm2 2v4h4v-4zm11-2h2v2h-2zm-3 0h2v4h-2zm3 3h2v2h-2zm2 2h3v3h-2v-1h-1zm-5 1h2v2h-2zm7-6h1v3h-1z"/></svg>QR';
  wrap.appendChild(a);
  wrap.appendChild(q);

  var ov = document.createElement("div");
  ov.className = "cls-qr";
  ov.hidden = true;
  ov.setAttribute("role", "dialog");
  ov.setAttribute("aria-label", "這份教材的 QR Code");

  function pageUrl() {
    var file = location.pathname.split("/").pop() || "";
    /* 保留這份教材自己的參數（例如 ?u=3 第三單元），拿掉學生模式用的 stu、c、s */
    var sp = new URLSearchParams(location.search); ["stu", "c", "s"].forEach(function (k) { sp.delete(k); });
    var extra = sp.toString();
    if (/github\.io$/.test(location.hostname)) return location.origin + location.pathname + (extra ? "?" + extra : "");
    return SITE + "lessons/" + file + (extra ? "?" + extra : "");
  }
  function loadLib(cb) {
    if (window.qrcode) return cb();
    var s = document.createElement("script");
    s.src = QR_LIB;
    s.onload = function () { cb(); };
    s.onerror = function () { cb(new Error("load")); };
    document.head.appendChild(s);
  }
  function liveId() { return window.CLS_LIVE && !window.CLS_LIVE.isStudent ? window.CLS_LIVE.id : null; }
  function qrUrl() { var c = lget("clsClass", ""), u = pageUrl(), id = liveId(); return u + (u.indexOf("?") < 0 ? "?" : "&") + "stu=1" + (c ? "&c=" + encodeURIComponent(c) : "") + (id ? "&s=" + id : "") + (/^#[\w-]+$/.test(location.hash) ? location.hash : ""); }
  /* 課堂房間：開始／結束、顯示幾台平板跟著 */
  function drawLive() {
    var box = ov.querySelector(".cls-live"); if (!box) return;
    var L = window.CLS_LIVE, id = liveId();
    if (!L || !L.start) { box.innerHTML = ""; return; }
    if (id) {
      var h = L.host || {}, seats = h.seats || [];
      box.innerHTML = '<div class="on">📡 課堂進行中・代碼 <b>' + id + '</b>・<b>' + (h.count || 0) + '</b> 台平板跟著' +
        (seats.length ? '<br><small>座號：' + seats.join("、") + "</small>" : "") + '</div>' +
        '<p>平常學生平板顯示「請看大螢幕」；你換到「交給老師」那一站、開全班共戰或想法牆、打開平板遊戲時，平板會自動打開。還沒加入的同學掃這個 QR Code。</p>' +
        '<button type="button" class="live-end">結束課堂</button>';
    } else if (window.CLS && window.CLS.isTeacher) {
      box.innerHTML = '<button type="button" class="live-go">📡 開始課堂：全班跟著我換頁</button>' +
        '<p>學生只要掃一次、選一次座號。平常平板顯示「請看大螢幕」，玩遊戲、交作品、寫想法時才會自動打開。（書櫃首頁也有「📡 課堂 QR」）</p>';
    } else box.innerHTML = '<p>登入老師帳號後，可以開「課堂房間」讓全班平板跟著你換頁。</p>';
  }
  window.addEventListener("cls-live", function () {
    if (ov.hidden) return;
    var u = ov.querySelector(".url"); if (u && u.textContent !== qrUrl()) show(); else drawLive();
  });
  function drawPick(list) {
    var box = ov.querySelector(".cls-pick"); if (!box) return;
    var cur = lget("clsClass", "");
    if (cur && !(list || []).some(function (x) { return x.name === cur; })) { cur = ""; lset("clsClass", ""); }
    box.innerHTML = "<b>班級：</b>" + [{ name: "" }].concat(list || []).map(function (c) { return '<button type="button" data-c="' + esc(c.name) + '" aria-pressed="' + (c.name === cur) + '">' + (c.name ? esc(c.name) : "不指定") + "</button>"; }).join("");
  }
  function show() {
    var url = qrUrl();
    var title = (document.querySelector("h1") || {}).textContent || document.title;
    ov.innerHTML = '<div class="box"><h2></h2><p style="margin:0">學生用平板掃描，選好座號就能開始（作答統計會傳到老師後台）</p><div class="cls-pick"></div><div class="cls-live"></div><div class="code" aria-hidden="true">產生中…</div><div class="url"></div><button type="button">關閉</button></div>';
    ov.querySelector("h2").textContent = title.trim();
    ov.querySelector(".url").textContent = url;
    ov.querySelector(".box > button").addEventListener("click", hide);
    ov.querySelector(".cls-pick").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-c]"); if (!b) return;
      lset("clsClass", b.getAttribute("data-c")); show();
    });
    ov.querySelector(".cls-live").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b || !window.CLS_LIVE) return;
      if (b.classList.contains("live-go")) {
        b.disabled = true; b.textContent = "開課堂中…";
        window.CLS_LIVE.start(lget("clsClass", "")).then(show).catch(function () { b.disabled = false; b.textContent = "開課堂失敗，請再按一次"; });
      } else if (b.classList.contains("live-end")) {
        if (!b.dataset.arm) { b.dataset.arm = "1"; b.textContent = "再按一次結束課堂（學生平板會停止跟隨）"; return; }
        window.CLS_LIVE.end().then(show);
      }
    });
    drawLive();
    getClasses(drawPick);
    ov.hidden = false;
    loadLib(function (err) {
      var box = ov.querySelector(".code");
      if (err || !window.qrcode) { box.textContent = "QR Code 載入失敗，請直接輸入上面的網址。"; return; }
      var qr = window.qrcode(0, "M");
      qr.addData(url);
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
    });
    ov.querySelector(".box > button").focus();
  }
  function hide() { ov.hidden = true; q.focus(); }
  q.addEventListener("click", show);
  ov.addEventListener("click", function (e) { if (e.target === ov) hide(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !ov.hidden) hide(); });

  /* 全螢幕時只會顯示全螢幕的那個區塊，所以把按鈕搬進去，讓它一直看得到 */
  function place() {
    var host = document.fullscreenElement || document.webkitFullscreenElement || document.body;
    if (wrap.parentNode !== host) host.appendChild(wrap);
    if (ov.parentNode !== host) host.appendChild(ov);
  }
  /* 上課工具視窗（計時器、抽籤、小白板） */
  /* 先載入雲端同步（assets/sync.js），再載入上課工具，讓工具的設定也會同步 */
  if (me && !window.__classTools) {
    var loadTools = function () {
      var t = document.createElement("script");
      t.src = me.replace(/home-fab\.js(\?.*)?$/, "class-tools.js");
      document.head.appendChild(t);
    };
    if (window.CLS) loadTools();
    else {
      var sy = document.createElement("script");
      sy.src = me.replace(/home-fab\.js(\?.*)?$/, "sync.js");
      sy.onload = sy.onerror = loadTools;
      document.head.appendChild(sy);
    }
  }
  /* 離線使用：讓這台電腦存一份教材（只在正式網站上執行） */
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost") && me) {
    try { navigator.serviceWorker.register(new URL("../sw.js", me).href, { scope: new URL("../", me).href }).catch(function () {}); } catch (e) {}
  }

  document.addEventListener("fullscreenchange", place);
  document.addEventListener("webkitfullscreenchange", place);
  if (document.body) place();
  else document.addEventListener("DOMContentLoaded", place);
})();
