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
   文字作品可以用 SUBMIT.card({title, by, color, rows:[{h,t}]}) 轉成 SVG 卡片放進 svg 欄位，作品牆才能全螢幕展示。
*/
(function () {
  if (window.SUBMIT) return;
  var SB_URL = "https://tsxbphngzuzpdddhadfw.supabase.co";
  var SB_KEY = "sb_publishable_EOXrx2SRQbFRHACqHbUUig_4e-EkgkE";
  var WHO_KEY = "subWho";
  var ME = document.currentScript && document.currentScript.src;
  var TEACHER_URL = ME ? new URL("../teacher.html", ME).href : "../teacher.html";
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
    ".sb-note{font-size:.88rem;color:var(--muted,#5C6B66)}",
    /* 老師登入時：直接開放／關閉繳交 */
    ".sb-teach{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem;background:#FFF6DC;border:2px dashed #B7791F;border-radius:14px;padding:.6rem .8rem;color:#5B3F00}",
    ".sb-teach[hidden]{display:none}",
    ".sb-teach b{font-size:1.02rem}",
    ".sb-teach .t{flex:1 1 14rem;line-height:1.5}",
    ".sb-teach button,.sb-teach a{appearance:none;border:2px solid #5B3F00;border-radius:999px;min-height:2.9rem;padding:0 1.1rem;font:inherit;font-weight:700;font-size:1.05rem;cursor:pointer;background:#fff;color:#5B3F00;text-decoration:none;display:inline-flex;align-items:center}",
    ".sb-teach button.on{background:#1E7A4F;border-color:#1E7A4F;color:#fff}",
    ".sb-teach button.off{background:#fff;border-color:#B3261E;color:#B3261E}",
    ".sb-teach button:disabled{opacity:.6;cursor:default}"
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
    var teach = el("div", "sb-teach"); teach.hidden = true;
    [teach, state, who, prev, go, msg, note].forEach(function (x) { wrap.appendChild(x); });
    box.appendChild(wrap);

    var A = null, me = load(WHO_KEY, {}), timer = null;
    /* 學生模式（用老師的 QR Code 打開）：帶入班級與選好的座號（home-fab.js 存在 sessionStorage） */
    function stuWho() {
      try {
        var su = JSON.parse(sessionStorage.getItem("clsStu") || "null"), se = JSON.parse(sessionStorage.getItem("clsSeat") || "null");
        if (su && se && se.seat) me = { cls: su.cls || me.cls, seat: se.seat };
      } catch (e) {}
    }
    stuWho();
    window.addEventListener("cls-seat", function () { stuWho(); if (A) { fill(); } });
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
          drawTeach();
          if (!A) { setState(false, "這份作業還沒有設定繳交。"); return; }
          if (!A.open) { setState(false, "老師還沒開放繳交。老師開放後，這裡會自動出現繳交按鈕。"); return; }
          if (!A.classes || !A.classes.length) { setState(false, "老師還沒設定班級。"); return; }
          setState(true, "老師已開放繳交：" + A.title);
          if (!was) fill();
        })
        .catch(function () { setState(false, navigator.onLine === false ? "目前沒有網路，連上網路才能繳交。" : "連不上伺服器，稍後會自動再試。"); });
    }
    /* ---------- 老師登入時（不是學生模式）：在這裡直接開放／關閉繳交 ---------- */
    function isTeacher() {
      var stu = null; try { stu = JSON.parse(sessionStorage.getItem("clsStu") || "null"); } catch (e) {}
      return !stu && window.CLS && window.CLS.isTeacher && window.CLS.api;
    }
    var tBusy = false;
    function drawTeach() {
      if (!isTeacher()) { teach.hidden = true; return; }
      teach.hidden = false;
      if (!A) { teach.innerHTML = '<span class="t"><b>🧑‍🏫 老師</b>：資料庫裡還沒有這份作業（' + cfg.assignment + '），請 Claude 建立。</span>'; return; }
      var cls = (A.classes || []).join("、");
      teach.innerHTML = '<span class="t"><b>🧑‍🏫 老師</b>：這份作業' + (A.open ? '<b style="color:#1E7A4F">正在收作品</b>' : '<b style="color:#B3261E">還沒開放</b>') +
        (cls ? "（" + cls + "，座號 1～" + (A.seats || 25) + "）" : "（還沒設定班級，開放時會收全部班級）") +
        '。學生用左下角「QR」掃描就會打開這一站。</span>';
      var b = el("button", A.open ? "off" : "on", A.open ? "⏸ 關閉繳交" : "▶ 開放繳交"); b.type = "button"; b.disabled = tBusy;
      var w = el("a", "", "看作品牆 →"); w.href = TEACHER_URL;
      teach.appendChild(b); teach.appendChild(w);
      b.addEventListener("click", function () {
        if (tBusy) return; tBusy = true; b.disabled = true; b.textContent = "更新中…";
        var v = !A.open;
        var getCls = (v && !(A.classes || []).length)
          ? window.CLS.api("rest/v1/class_list?select=name,seats&order=sort.asc,name.asc").then(function (r) { return r.ok ? r.json() : []; })
          : Promise.resolve(null);
        getCls.then(function (list) {
          var data = { open: v };
          if (list && list.length) { data.classes = list.map(function (c) { return c.name; }); data.seats = Math.max.apply(null, list.map(function (c) { return c.seats || 25; })); }
          return window.CLS.api("rest/v1/assignments?id=eq." + encodeURIComponent(cfg.assignment), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); })
          .then(function () { tBusy = false; return check(); }, function () { tBusy = false; drawTeach(); var t = teach.querySelector(".t"); if (t) t.insertAdjacentHTML("beforeend", '<br><b style="color:#B3261E">更新失敗，請確認網路後再按一次。</b>'); });
      });
    }
    window.addEventListener("cls-status", function () { drawTeach(); });
    window.addEventListener("cls-sync", function () { drawTeach(); });
    var tWait = 0;
    (function waitCls() { if (window.CLS && window.CLS.isTeacher) { drawTeach(); return; } if (++tWait < 30) setTimeout(waitCls, 300); })();

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
  /* 文字作品轉成一張 SVG 卡片（後台作品牆和全螢幕展示都看得到）
     SUBMIT.card({ title: '標題', by: '4年1班 5 號', color: '#2A7563', rows: [{ h: '小標題', t: '內容' }, …] }) → SVG 字串 */
  function card(o) {
    var W = 600, P = 28, PER = 19.5, LH = 34, y = 0, out = [];
    function x(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
    function wrap(t) { var r = [], line = "", n = 0; Array.from(String(t || "")).forEach(function (ch) { var w = /[\x00-\xff]/.test(ch) ? 0.55 : 1; if (n + w > PER && "，。！？」）、：；,.!?)".indexOf(ch) >= 0) { line += ch; n += w; return; } if (n + w > PER || ch === "\n") { r.push(line); line = ""; n = 0; if (ch === "\n") return; } line += ch; n += w; }); if (line) r.push(line); return r.length ? r : [""]; }
    var color = o.color || "#2A7563";
    y = 96;
    (o.rows || []).forEach(function (row) {
      if (row.h) { out.push('<text x="' + P + '" y="' + (y + 6) + '" font-size="21" font-weight="700" fill="' + color + '">' + x(row.h) + "</text>"); y += 34; }
      wrap(row.t).forEach(function (l) { out.push('<text x="' + P + '" y="' + (y + 4) + '" font-size="26" fill="#1F2A27">' + x(l) + "</text>"); y += LH; });
      y += 14;
    });
    var H = Math.max(240, y + (o.by ? 46 : 10));
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H + '" font-family="Huninn,\'Noto Sans TC\',\'PingFang TC\',\'Microsoft JhengHei\',sans-serif">' +
      '<rect width="' + W + '" height="' + H + '" rx="28" fill="#FFFDF8" stroke="' + color + '" stroke-width="6"/>' +
      '<rect x="3" y="3" width="' + (W - 6) + '" height="68" rx="25" fill="' + color + '"/><rect x="3" y="44" width="' + (W - 6) + '" height="27" fill="' + color + '"/>' +
      '<text x="' + W / 2 + '" y="48" text-anchor="middle" font-size="28" font-weight="700" fill="#FFFFFF">' + x(o.title) + "</text>" + out.join("") +
      (o.by ? '<text x="' + (W - P) + '" y="' + (H - 20) + '" text-anchor="end" font-size="20" fill="#4A5550">' + x(o.by) + "</text>" : "") + "</svg>";
  }
  window.SUBMIT = { mount: mount, card: card };
})();
