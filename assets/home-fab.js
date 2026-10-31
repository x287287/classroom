/* 教室小書櫃：每份教材共用的「回書櫃」懸浮按鈕（固定在左下角）
   用法：在教材 HTML 的 </body> 前加上
   <script src="../assets/home-fab.js"></script>              */
(function () {
  if (document.querySelector(".cls-home-fab")) return;

  var css =
    ".cls-home-fab{position:fixed;z-index:2147483000;" +
    "left:max(16px,calc(env(safe-area-inset-left,0px) + 12px));" +
    "bottom:calc(env(safe-area-inset-bottom,0px) + 16px);" +
    "box-sizing:border-box;height:52px;margin:0;display:inline-flex;align-items:center;gap:.35em;padding:0 20px;" +
    "border-radius:999px;background:#1E3A34;color:#FFFFFF;border:2px solid #FFFFFF;" +
    "font:700 18px/1 'Noto Sans TC','PingFang TC','Microsoft JhengHei',system-ui,sans-serif;" +
    "text-decoration:none;box-shadow:0 4px 16px rgba(0,0,0,.28);-webkit-tap-highlight-color:transparent}" +
    ".cls-home-fab:hover{background:#2A4F47}" +
    ".cls-home-fab:active{transform:scale(.97)}" +
    ".cls-home-fab:focus-visible{outline:3px solid #F5B521;outline-offset:3px}" +
    "@media print{.cls-home-fab{display:none}}" +
    /* 頁面底部留空，最後幾行不會被按鈕蓋住；版面特殊的教材可自行覆寫 */
    "html body{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 84px)}";
  var style = document.createElement("style");
  style.textContent = css;
  document.head.insertBefore(style, document.head.firstChild);

  var a = document.createElement("a");
  a.className = "cls-home-fab";
  a.href = "../index.html";
  a.textContent = "⌂ 回書櫃";
  a.setAttribute("aria-label", "回到教室小書櫃首頁");

  /* 全螢幕時只會顯示全螢幕的那個區塊，所以把按鈕搬進去，讓它一直看得到 */
  function place() {
    var host = document.fullscreenElement || document.webkitFullscreenElement || document.body;
    if (a.parentNode !== host) host.appendChild(a);
  }
  document.addEventListener("fullscreenchange", place);
  document.addEventListener("webkitfullscreenchange", place);
  if (document.body) place();
  else document.addEventListener("DOMContentLoaded", place);
})();
