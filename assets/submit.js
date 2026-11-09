/* 教室小書櫃｜學生作品繳交（共用元件）
   學生用平板打開教材，選班級、座號，按「繳交給老師」。作品存到 Supabase 的 submissions，只有登入的老師在 teacher.html 看得到。
   只有老師在後台按「開放繳交」的作業才收得到；同一個班級座號再交一次，會取代上一次。不傳姓名。

   用法（教材裡）：
     <div id="submitBox"></div>
     <script src="../assets/submit.js"></script>
     SUBMIT.mount(document.getElementById('submitBox'), {
       assignment: 'u2-3b-logo',                // 作業代號（assignments.id，要先在資料庫建立）
       collect: function (who) { return {...} }, // 回傳要交的內容；who = {cls, seat}
                                                 //   內容可用的欄位：svg（字串，後台會當圖片顯示）、title、lines（字串陣列）、text
       preview: function (data) { return '<html>' } // （可選）繳交前的預覽
     });
*/
(function () {
  if (window.SUBMIT) return;
  var SB_URL = "https://tsxbphngzuzpdddhadfw.supabase.co";
  var SB_KEY = "sb_publishable_EOXrx2SRQbFRHACqHbUUig_4e-EkgkE";
  var WHO_KEY = "subWho";
  function api(path, opts) {
    opts = opts || {};
    var h = { apikey: SB_KEY };
    if (opts.json) h["Content-Type"] = "application/json";
    return fetch(SB_URL + "/" + path, { method: opts.method || "GET", headers: h, body: opts.json ? JSON.stringify(opts.json) : undefined, cache: "no-store" });
  }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var css = [
    ".sb-box{background:var(--surface,#fff);border:2px solid var(--accent,#2E7D6B);border-radius:20px;padding:clamp(14px,2.4vw,26px);display:grid;gap:1rem}",
    ".sb-state{font-weight:700;font-size:1.05rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}",
    ".sb-state .dot{width:.8rem;height:.8rem;border-radius:50%;background:#9AA5A0;flex:none}",
    ".sb-state.open .dot{background:#2E9E5B}.sb-state.closed .dot{background:#C8414B}",
    ".sb-who{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem}",
    "@media (max-width:520px){.sb-who{grid-template-columns:minmax(0,1fr)}}",
    ".sb-who label{display:grid;gap:.3rem;font-weight:700}",
    ".sb-who select{font:inherit;font-size:1.25rem;min-height:3.2rem;border-radius:12px;border:2px solid var(--line,#C9D2CC);background:var(--bg,#fff);color:var(--fg,#1F2A27);padding:0 .8rem;width:100%}",
    ".sb-prev{border:1.5px dashed var(--line,#C9D2CC);border-radius:14px;padding:.8rem;background:var(--sunk,#F4F6F3)}",
    ".sb-prev:empty{display:none}",
    ".sb-go{appearance:none;border:0;border-radius:999px;background:var(--accent,#2E7D6B);color:var(--accent-ink,#fff);font:inherit;font-size:1.25rem;font-weight:700;min-height:3.6rem;padding:0 2rem;cursor:pointer;justify-self:start}",
    ".sb-go:disabled{opacity:.5;cursor:default}",
    ".sb-msg{font-weight:700;min-height:1.4em;font-size:1.05rem}",
    ".sb-msg.ok{color:var(--good,#1E7A4F)}.sb-msg.err{color:var(--bad,#B3261E)}",
    ".sb-note{font-size:.88rem;color:var(--muted,#5C6B66)}"
  ].join("\n");

  function mount(box, cfg) {
    if (!document.getElementById("sb-css")) { var st = el("style"); st.id = "sb-css"; st.textContent = css; document.head.appendChild(st); }
    box.innerHTML = "";
    var wrap = el("div", "sb-box");
    var state = el("div", "sb-state", '<span class="dot"></span><span>確認老師是否開放繳交…</span>');
    var who = el("div", "sb-who");
    var lc = el("label", "", "<span>我的班級</span>"), sc = el("select"); sc.setAttribute("aria-label", "班級"); lc.appendChild(sc);
    var ls = el("label", "", "<span>我的座號</span>"), ss = el("select"); ss.setAttribute("aria-label", "座號"); ls.appendChild(ss);
    who.appendChild(lc); who.appendChild(ls);
    var prev = el("div", "sb-prev");
    var go = el("button", "sb-go", "📤 繳交給老師"); go.type = "button";
    var msg = el("div", "sb-msg"); msg.setAttribute("aria-live", "polite");
    var note = el("p", "sb-note", "只會傳出班級和座號，不會傳出名字。交錯了可以修改後再交一次，老師會看到最新的那一份。");
    [state, who, prev, go, msg, note].forEach(function (x) { wrap.appendChild(x); });
    box.appendChild(wrap);

    var A = null, me = load(WHO_KEY, {}), timer = null;
    function setState(open, text) {
      state.className = "sb-state " + (open ? "open" : "closed");
      state.lastChild.textContent = text;
      who.hidden = !open; go.hidden = !open;
    }
    function fill() {
      var cl = A.classes || [];
      sc.innerHTML = "";
      function opt(v, t) { var o = document.createElement("option"); o.value = v; o.textContent = t; sc.appendChild(o); }
      if (cl.length > 1) opt("", "選擇班級");
      cl.forEach(function (c) { opt(c, c); });
      if (me.cls && cl.indexOf(me.cls) >= 0) sc.value = me.cls;
      var h = '<option value="">選擇座號</option>';
      for (var i = 1; i <= (A.seats || 30); i++) h += '<option value="' + i + '">' + i + " 號</option>";
      ss.innerHTML = h;
      if (me.seat && me.seat <= A.seats) ss.value = String(me.seat);
    }
    function check() {
      return api("rest/v1/assignments?select=id,title,open,classes,seats&id=eq." + encodeURIComponent(cfg.assignment))
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
        .then(function (rows) {
          var a = rows[0];
          var was = A && A.open && JSON.stringify(A.classes) === JSON.stringify(a && a.classes) && A.seats === (a && a.seats);
          A = a || null;
          if (!A) { setState(false, "這份作業還沒有設定繳交。"); return; }
          if (!A.open) { setState(false, "老師還沒開放繳交。老師開放後，這裡會自動出現繳交按鈕。"); return; }
          if (!A.classes || !A.classes.length) { setState(false, "老師還沒設定班級。"); return; }
          setState(true, "老師已開放繳交：" + A.title);
          if (!was) fill();
        })
        .catch(function () { setState(false, navigator.onLine === false ? "目前沒有網路，連上網路才能繳交。" : "連不上伺服器，稍後會自動再試。"); });
    }
    function poll() { clearTimeout(timer); timer = setTimeout(function () { if (!document.hidden) check().then(poll, poll); else poll(); }, A && A.open ? 30000 : 10000); }
    check().then(poll, poll);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) check(); });

    function updPrev() {
      if (!cfg.preview) return;
      try { prev.innerHTML = cfg.preview(cfg.collect({ cls: sc.value || "（班級）", seat: +ss.value || 0 })) || ""; } catch (e) { prev.innerHTML = ""; }
    }
    function clearMsg() { if (msg.className.indexOf("err") >= 0) { msg.className = "sb-msg"; msg.textContent = ""; } }
    sc.addEventListener("change", function () { clearMsg(); updPrev(); }); ss.addEventListener("change", function () { clearMsg(); updPrev(); });
    box.addEventListener("pointerenter", updPrev);
    cfg.refresh = updPrev;
    updPrev();

    var MSG = { closed: "老師已經關閉繳交了。", bad_class: "班級不對，請重新選擇。", bad_seat: "座號不對，請重新選擇。", too_big: "作品太大了，交不出去。", full: "這份作業的繳交數量已經滿了，請告訴老師。", no_assignment: "找不到這份作業，請告訴老師。" };
    go.addEventListener("click", function () {
      var cls = sc.value, seat = +ss.value;
      if (!cls) { msg.className = "sb-msg err"; msg.textContent = "請先選擇班級。"; sc.focus(); return; }
      if (!seat) { msg.className = "sb-msg err"; msg.textContent = "請先選擇座號。"; ss.focus(); return; }
      var data;
      try { data = cfg.collect({ cls: cls, seat: seat }); } catch (e) { data = null; }
      if (!data) { msg.className = "sb-msg err"; msg.textContent = "作品還沒完成喔！"; return; }
      go.disabled = true; msg.className = "sb-msg"; msg.textContent = "繳交中…";
      api("rest/v1/rpc/submit_work", { method: "POST", json: { p_assignment: cfg.assignment, p_class: cls, p_seat: seat, p_data: data } })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
        .then(function (res) {
          if (res === "ok") {
            me = { cls: cls, seat: seat }; save(WHO_KEY, me);
            var t = new Date(), hm = (t.getHours() < 10 ? "0" : "") + t.getHours() + ":" + (t.getMinutes() < 10 ? "0" : "") + t.getMinutes();
            msg.className = "sb-msg ok"; msg.textContent = "✓ 繳交成功！（" + cls + " " + seat + " 號，" + hm + "）";
          } else { msg.className = "sb-msg err"; msg.textContent = MSG[res] || "繳交失敗，請再試一次。"; if (res === "closed" || res === "bad_class" || res === "bad_seat") check(); }
        })
        .catch(function () { msg.className = "sb-msg err"; msg.textContent = navigator.onLine === false ? "目前沒有網路，連上網路後再按一次繳交。" : "繳交失敗，請再按一次。"; })
        .then(function () { go.disabled = false; });
    });
    return { refresh: updPrev, check: check };
  }
  window.SUBMIT = { mount: mount };
})();
