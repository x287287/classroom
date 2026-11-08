/* 教室小書櫃：每份教材共用的左下角按鈕
   「⌂ 回書櫃」回到首頁；「QR」顯示這份教材的 QR Code，學生用平板或手機掃描就能打開。
   用法：在教材 HTML 的 </body> 前加上
   <script src="../assets/home-fab.js"></script>              */
(function () {
  if (document.querySelector(".cls-fabs")) return;

  var SITE = "https://x287287.github.io/classroom/";
  var me = document.currentScript && document.currentScript.src;
  var QR_LIB = me ? me.replace(/home-fab\.js(\?.*)?$/, "vendor/qrcode.js") : "../assets/vendor/qrcode.js";

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
    "@media print{.cls-fabs,.cls-qr{display:none}}" +
    /* 頁面底部留空，最後幾行不會被按鈕蓋住；版面特殊的教材可自行覆寫 */
    "html body{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 84px)}";
  var style = document.createElement("style");
  style.textContent = css;
  document.head.insertBefore(style, document.head.firstChild);

  var wrap = document.createElement("div");
  wrap.className = "cls-fabs";

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
    if (/github\.io$/.test(location.hostname)) return location.origin + location.pathname;
    return SITE + "lessons/" + file;
  }
  function loadLib(cb) {
    if (window.qrcode) return cb();
    var s = document.createElement("script");
    s.src = QR_LIB;
    s.onload = function () { cb(); };
    s.onerror = function () { cb(new Error("load")); };
    document.head.appendChild(s);
  }
  function show() {
    var url = pageUrl();
    var title = (document.querySelector("h1") || {}).textContent || document.title;
    ov.innerHTML = '<div class="box"><h2></h2><p style="margin:0">用平板或手機的相機掃描，就能打開這份教材</p><div class="code" aria-hidden="true">產生中…</div><div class="url"></div><button type="button">關閉</button></div>';
    ov.querySelector("h2").textContent = title.trim();
    ov.querySelector(".url").textContent = url;
    ov.querySelector("button").addEventListener("click", hide);
    ov.hidden = false;
    loadLib(function (err) {
      var box = ov.querySelector(".code");
      if (err || !window.qrcode) { box.textContent = "QR Code 載入失敗，請直接輸入上面的網址。"; return; }
      var qr = window.qrcode(0, "M");
      qr.addData(url);
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
    });
    ov.querySelector("button").focus();
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
