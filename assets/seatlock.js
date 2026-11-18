/* 座號鎖定（2026-11-18）
   學生在平板上選好座號後，同一台平板當天就鎖在這個座號，不能自己換；
   要換座號時由老師輸入「換座號密碼」（老師在後台「🏫 班級名單」設定，資料庫只存雜湊）。
   鎖定記在 localStorage clsSeatLock：{ "<班級>": {seat, day}, "*": {seat, day, at} }
     - 知道班級時用班級當 key，當天有效（隔天自動解除）。
     - 不知道班級時用 "*"，60 分鐘內有效（避免下一節別班用同一台平板時被鎖住）。
   用法：
     SEATLOCK.get(班級)          → 鎖定的座號（沒有就是 0）
     SEATLOCK.set(班級, 座號)    → 鎖定
     SEATLOCK.unlock(班級)       → 跳出「請老師輸入密碼」，密碼對了會解除鎖定，回傳 Promise<true/false>
   伺服器：RPC seat_unlock(p_device, p_pin) → ok／wrong／no_pin／too_many（同一台平板 10 分鐘最多錯 5 次）。
   home-fab.js 有一份相同格式的讀寫（因為它要在這個檔載入前就決定座號）。 */
(function () {
  if (window.SEATLOCK) return;
  var SB_URL = "https://tsxbphngzuzpdddhadfw.supabase.co", SB_KEY = "sb_publishable_EOXrx2SRQbFRHACqHbUUig_4e-EkgkE";
  var K = "clsSeatLock";
  function today() { var d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function all() { try { return JSON.parse(localStorage.getItem(K) || "{}") || {}; } catch (e) { return {}; } }
  function put(m) { try { localStorage.setItem(K, JSON.stringify(m)); } catch (e) {} }
  function key(cls) { return cls ? String(cls) : "*"; }
  function valid(r, k) { return r && r.seat && r.day === today() && (k !== "*" || Date.now() - (r.at || 0) < 60 * 60 * 1000); }
  function device() {
    var d = null; try { d = JSON.parse(localStorage.getItem("fbDevice") || "null"); } catch (e) {}
    if (!d) { d = "d" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); try { localStorage.setItem("fbDevice", JSON.stringify(d)); } catch (e) {} }
    return d;
  }
  var api = {
    get: function (cls) { var k = key(cls), r = all()[k]; return valid(r, k) ? r.seat : 0; },
    set: function (cls, seat) { var m = all(), k = key(cls); m[k] = { seat: +seat, day: today(), at: Date.now() };
      Object.keys(m).forEach(function (x) { if (!valid(m[x], x) && x !== k) delete m[x]; }); put(m); },
    clear: function (cls) { var m = all(); delete m[key(cls)]; put(m); },
    unlock: function (cls) { return dialog(cls); }
  };

  var css = ".sl-ov{position:fixed;inset:0;z-index:2147483600;background:rgba(14,11,24,.82);display:grid;place-items:center;padding:16px;font:400 18px/1.6 'Huninn','Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif}" +
    ".sl-box{background:#fff;color:#1F2A27;border-radius:22px;max-width:420px;width:100%;padding:20px;display:grid;gap:12px;text-align:center;box-shadow:0 14px 34px #0008}" +
    ".sl-box h2{margin:0;font-size:24px;color:#7A2E8E}.sl-box p{margin:0;color:#4A5550;font-size:16px}" +
    ".sl-dots{display:flex;justify-content:center;gap:10px;min-height:28px}.sl-dots i{width:18px;height:18px;border-radius:50%;border:2px solid #7A2E8E}.sl-dots i.on{background:#7A2E8E}" +
    ".sl-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}" +
    ".sl-ov .sl-pad button,.sl-ov .sl-row button{appearance:none;border:0;border-radius:16px;min-height:60px;padding:0;font-weight:700;font-size:26px;line-height:1;font-family:inherit;background:#F1EDF6;color:#4A2B5E;cursor:pointer;width:auto}" +
    ".sl-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.sl-ov .sl-row button{font-size:19px;min-height:52px}.sl-ov .sl-row .ok{background:#7A2E8E;color:#fff}" +
    ".sl-msg{min-height:1.4em;font-weight:700;color:#C8414B}" +
    ".sl-pad button:focus-visible,.sl-row button:focus-visible{outline:3px solid #FFD54F;outline-offset:2px}";
  function dialog(cls) {
    return new Promise(function (resolve) {
      if (!document.getElementById("sl-css")) { var st = document.createElement("style"); st.id = "sl-css"; st.textContent = css; document.head.appendChild(st); }
      var pin = "", busy = false;
      var ov = document.createElement("div"); ov.className = "sl-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "請老師輸入密碼");
      ov.innerHTML = '<div class="sl-box"><h2>🔒 換座號要請老師幫忙</h2><p>選好的座號不能自己換。<br>請老師輸入「換座號密碼」。</p>' +
        '<div class="sl-dots" aria-hidden="true"></div><div class="sl-msg" role="status"></div>' +
        '<div class="sl-pad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button type="button" data-n="' + n + '">' + n + "</button>"; }).join("") +
        '<button type="button" data-n="del" aria-label="刪除一個數字">⌫</button><button type="button" data-n="0">0</button><button type="button" data-n="clr" aria-label="全部清除">清除</button></div>' +
        '<div class="sl-row"><button type="button" class="no">取消</button><button type="button" class="ok">確定</button></div></div>';
      document.body.appendChild(ov);
      var dots = ov.querySelector(".sl-dots"), msg = ov.querySelector(".sl-msg");
      function paint() { var h = ""; for (var i = 0; i < Math.max(4, pin.length); i++) h += '<i class="' + (i < pin.length ? "on" : "") + '"></i>'; dots.innerHTML = h; }
      function done(v) { document.removeEventListener("keydown", key2); ov.remove(); resolve(v); }
      function submit() {
        if (busy) return; if (pin.length < 4) { msg.textContent = "密碼是 4～8 位數字"; return; }
        busy = true; msg.textContent = "確認中…";
        fetch(SB_URL + "/rest/v1/rpc/seat_unlock", { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_device: device(), p_pin: pin }), cache: "no-store" })
          .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
          .then(function (r) {
            busy = false;
            if (r === "ok") { api.clear(cls); done(true); return; }
            pin = ""; paint();
            msg.textContent = { wrong: "密碼不對，請再試一次。", too_many: "錯太多次了，請 10 分鐘後再試。", no_pin: "老師還沒有設定換座號密碼（老師後台 →「🏫 班級名單」）。" }[r] || "無法確認，請再試一次。";
          })
          .catch(function () { busy = false; msg.textContent = "連線失敗，請確認網路後再試一次。"; });
      }
      function press(n) {
        if (n === "del") pin = pin.slice(0, -1); else if (n === "clr") pin = ""; else if (pin.length < 8) pin += n;
        msg.textContent = ""; paint();
      }
      ov.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        if (b.classList.contains("no")) return done(false);
        if (b.classList.contains("ok")) return submit();
        press(b.dataset.n);
      });
      function key2(e) { if (/^[0-9]$/.test(e.key)) press(e.key); else if (e.key === "Backspace") press("del"); else if (e.key === "Enter") submit(); else if (e.key === "Escape") done(false); }
      document.addEventListener("keydown", key2);
      paint(); ov.querySelector("button[data-n='1']").focus();
    });
  }
  window.SEATLOCK = api;
})();
