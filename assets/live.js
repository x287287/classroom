/* 教室小書櫃：課堂房間（全班跟著老師換頁）
   老師（登入老師帳號）在教材的「QR」視窗按「📡 開始課堂」→ 產生 6 位數課堂代碼（localStorage clsLive），
   QR Code 變成「教材?stu=1&c=班級&s=代碼」。學生掃一次、選一次座號，之後：
     ・老師打開別份教材 → 學生平板自動跳到同一份（學生模式，座號沿用）
     ・老師在分站教材換站（kit-page）→ 學生平板跟著換到同一站
     ・老師開全班共戰房間 → 學生平板自動進 raid.html?r=房號（座號自動帶入）
     ・老師開想法牆 → 學生平板自動進 fb.html?b=代碼（座號自動帶入）
     ・只給大螢幕用的頁面（<meta name="live" content="screen">，例如兩隊對戰）→ 學生平板顯示「請看大螢幕」
     ・<meta name="live" content="none"> 的頁面（書櫃首頁）不會帶學生過去
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
        screenOv.innerHTML = "<div><div style='font-size:64px'>👀</div><b>請看大螢幕</b><div>" + esc(title || "") + "</div><div style='font-size:16px;opacity:.8;margin-top:1em'>老師換到下一個活動時，這裡會自動換過去。</div></div>";
        screenOv.hidden = false;
      });
    }
    function stop(msg) { clearInterval(timer); timer = null; sset("clsSess", null); L.id = null; if (screenOv) screenOv.hidden = true; var p = document.querySelector(".cls-live-stu"); if (p) p.remove(); if (msg) toast(msg); }
    function poll() {
      if (moving || document.hidden) return;
      rpc("live_state", { p_id: sid, p_device: device, p_seat: seat() || null }).then(function (d) {
        if (!d || !d.open) { stop(d && d.err ? "" : "老師結束了課堂"); return; }
        var url = d.url || "";
        if (!url) return;
        if (url.indexOf("screen:") === 0) { showScreen(url.slice(7)); return; }
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
  L.pushHere = function () {
    var m = metaLive();
    if (m === "none") return;
    if (m === "screen") return L.screen(pageTitle());
    L.push(rel(location.href), pageTitle());
  };
  L.start = function (cls) {
    var tries = 0;
    function attempt() {
      var id = String(Math.floor(100000 + Math.random() * 900000));
      var m = metaLive();
      var url = m === "none" ? "" : m === "screen" ? "screen:" + pageTitle() : rel(location.href);
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
          if (qrBtn) qrBtn.click();
          else if (pill.dataset.arm) { L.end(); }
          else { pill.dataset.arm = "1"; pill.textContent = "再按一次結束課堂"; setTimeout(function () { if (pill) { delete pill.dataset.arm; drawPill(); } }, 3000); }
        });
      }
      if (!pill.dataset.arm) pill.textContent = "📡 課堂 " + L.id + (L.host ? "・" + L.host.count + " 台跟著" : "");
      pill.setAttribute("aria-label", "課堂進行中，代碼 " + L.id + (L.host ? "，" + L.host.count + " 台平板跟著" : ""));
      var bar = document.querySelector(".cls-fabs");
      if (bar) { pill.classList.remove("cls-live-solo"); if (pill.parentNode !== bar) bar.appendChild(pill); }
      else { pill.classList.add("cls-live-solo"); if (pill.parentNode !== document.body) document.body.appendChild(pill); }
    });
  }
  window.addEventListener("cls-live", drawPill);

  /* 等登入狀態確定後，把這一頁推給學生 */
  if (L.id) {
    var waited = 0;
    (function ready() {
      if (window.CLS && window.CLS.isTeacher) { L.pushHere(); startHost(); drawPill(); return; }
      if (++waited > 40) return;
      setTimeout(ready, 250);
    })();
    window.addEventListener("kit-page", function () { setTimeout(L.pushHere, 60); });
  }
})();
