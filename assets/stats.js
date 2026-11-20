/* 教室小書櫃｜遊戲作答統計（共用）
   由 assets/home-fab.js 自動載入，每份教材都有 window.STATS。
   遊戲結束（或過一關）時呼叫：

     STATS.send('u2-solo', {                 // 遊戲代號：小寫英數與 -，同一個遊戲固定用同一個
       title: '趕走三惡魔：個人挑戰',          // 後台顯示的名稱（可加模式，例如「…・只練菸惡魔」）
       data: {                               // 統一格式（後台會讀這些欄位）
         right: 18, total: 22,               //   答對題數／作答題數（必填）
         stars: 2, win: true,                //   （可選）星星、是否過關
         items: [{ q: '題目', ok: true, tries: 1 }, …]   // （建議）每題：題目、是否第一次就答對、作答次數
                                              //   答錯時再加 w: ['學生選的錯答案', …]、r: '正確答案'，老師後台「錯題明細」會顯示
         // 其他欄位可自由加，後台會原樣保存
       },
       board: false                          // 大螢幕全班一起玩的遊戲設 true：沒有座號，班級用老師 QR 視窗最後選的班級
     });

   只有學生模式（用老師的 QR Code 打開、已選座號）或 board:true 的遊戲才會送出；老師自己在書櫃打開試玩不會記錄。
   寫入 Supabase RPC game_submit（只能新增，學生讀不到任何紀錄），老師在 teacher.html「🎮 遊戲作答統計」看。
   沒網路時先存在這台平板（localStorage statsQueue），連上網路後自動補傳。 */
(function () {
  if (window.STATS && window.STATS._real) return;
  var SB_URL = "https://tsxbphngzuzpdddhadfw.supabase.co";
  var SB_KEY = "sb_publishable_EOXrx2SRQbFRHACqHbUUig_4e-EkgkE";
  var QK = "statsQueue";
  function lget(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function device() {
    var d = lget("fbDevice", null);
    if (!d) { d = "d" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); lset("fbDevice", d); }
    return d;
  }
  function toast(t) {
    var el = document.createElement("div"); el.className = "cls-stats-toast"; el.setAttribute("role", "status"); el.textContent = t;
    (document.fullscreenElement || document.body).appendChild(el);
    setTimeout(function () { el.remove(); }, 3200);
  }
  function post(item) {
    return fetch(SB_URL + "/rest/v1/rpc/game_submit", {
      method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify(item), cache: "no-store"
    }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (res) { if (res !== "ok" && res !== "bad_data" && res !== "bad_game" && res !== "bad_seat") throw new Error(res); return res; });
  }
  var flushing = false;
  function flush() {
    if (flushing) return; var q = lget(QK, []); if (!q.length) return;
    flushing = true;
    post(q[0]).then(function () {
      var q2 = lget(QK, []); q2.shift(); lset(QK, q2); flushing = false;
      if (q2.length) flush();
    }).catch(function () { flushing = false; });
  }
  function clip(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n) + "…" : s; }
  function send(game, o) {
    o = o || {};
    var stu = window.CLS_STU || { on: false };
    if (!stu.on && !o.board) return false;
    if (stu.on && !stu.seat) return false;
    var data = {};
    var src = o.data || {};
    Object.keys(src).forEach(function (k) { data[k] = src[k]; });
    if (Array.isArray(data.items)) data.items = data.items.slice(0, 150).map(function (it) {
      var x = {}; Object.keys(it || {}).forEach(function (k) { x[k] = typeof it[k] === "string" ? clip(it[k], 140) : it[k]; }); return x;
    });
    data.page = location.pathname.split("/").pop();
    var item = {
      p_game: game, p_title: clip(o.title || document.title, 78), p_session: o.session || null,
      p_class: stu.on ? (stu.cls || null) : (lget("clsClass", "") || null),
      p_seat: stu.on ? stu.seat : null, p_device: device(), p_data: data
    };
    post(item).then(function () {
      if (stu.on) toast("✓ 作答結果已經傳給老師");
      flush();
    }).catch(function () {
      var q = lget(QK, []); q.push(item); lset(QK, q.slice(-30));
      if (stu.on) toast("網路不穩，連上網路後會自動補傳");
    });
    return true;
  }
  var pending = (window.STATS && window.STATS._q) || [];
  window.STATS = { _real: true, send: send, flush: flush };
  pending.forEach(function (a) { send(a[0], a[1]); });
  window.addEventListener("online", flush);
  setTimeout(flush, 1500);
})();
