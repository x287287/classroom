/* 教室小書櫃｜補充教材共用互動元件
   KIT.quiz(el, [{q, o:[...], a:index, e:"說明"}])
   KIT.ox(el, [{s:"敘述", a:true/false, e:"說明"}])
   KIT.order(el, {steps:[{t:"名稱", d:"說明"}], done:"完成訊息"})
   KIT.sort(el, {bins:[{id, t, d}], items:[{t, bin, e}]})
   KIT.stepper(el, steps, render(i, step))   -> {go(i)}
   KIT.shuffle(arr)                                                   */
(function () {
  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function scoreBar(el, total, onReset) {
    var bar = h("div", "k-score");
    var s = h("span", "", "答對 0 / " + total);
    var b = h("button", "btn", "全部重來"); b.type = "button";
    b.addEventListener("click", onReset);
    bar.appendChild(s); bar.appendChild(b); el.appendChild(bar);
    return function (r, n) { s.textContent = (n === total ? "全部完成！" : "") + "答對 " + r + " / " + total; };
  }

  function quiz(el, qs) {
    function build() {
      el.innerHTML = "";
      var grid = h("div", "k-quiz"); el.appendChild(grid);
      var res = {}, upd;
      qs.forEach(function (x, i) {
        var d = h("div", "k-q");
        d.appendChild(h("p", "qt", (i + 1) + ". " + x.q));
        var opts = h("div", "opts"); d.appendChild(opts);
        var fb = h("p", "fb"); fb.setAttribute("aria-live", "polite"); d.appendChild(fb);
        x.o.forEach(function (t, k) {
          var b = h("button", "", t); b.type = "button";
          b.addEventListener("click", function () {
            if (i in res) return;
            var ok = k === x.a; res[i] = ok;
            opts.querySelectorAll("button").forEach(function (z, zi) {
              if (zi === x.a) z.classList.add("right"); else if (z === b) z.classList.add("wrong");
            });
            d.classList.add(ok ? "done-r" : "done-w");
            fb.className = "fb " + (ok ? "ok" : "no");
            fb.textContent = (ok ? "答對了！" : "再想想！正確答案是「" + x.o[x.a] + "」。") + (x.e || "");
            var r = 0, n = 0; for (var key in res) { n++; if (res[key]) r++; }
            upd(r, n);
          });
          opts.appendChild(b);
        });
        grid.appendChild(d);
      });
      upd = scoreBar(el, qs.length, build);
    }
    build();
  }

  function ox(el, items) {
    function build() {
      el.innerHTML = "";
      var grid = h("div", "k-quiz"); el.appendChild(grid);
      var res = {}, upd;
      items.forEach(function (x, i) {
        var d = h("div", "k-q");
        d.appendChild(h("p", "qt", (i + 1) + ". " + x.s));
        var row = h("div", "k-ox"); d.appendChild(row);
        var fb = h("p", "fb"); fb.setAttribute("aria-live", "polite"); d.appendChild(fb);
        [["O", true], ["X", false]].forEach(function (p) {
          var b = h("button", "", p[0]); b.type = "button"; b.setAttribute("aria-label", p[1] ? "對" : "錯");
          b.addEventListener("click", function () {
            if (i in res) return;
            var ok = p[1] === x.a; res[i] = ok;
            row.querySelectorAll("button").forEach(function (z) {
              var isAns = (z.textContent === "O") === x.a;
              if (isAns) z.classList.add("right"); else if (z === b) z.classList.add("wrong");
            });
            d.classList.add(ok ? "done-r" : "done-w");
            fb.className = "fb " + (ok ? "ok" : "no");
            fb.textContent = (ok ? "答對了！" : "再想想！") + "正確答案是 " + (x.a ? "O" : "X") + "。" + (x.e || "");
            var r = 0, n = 0; for (var key in res) { n++; if (res[key]) r++; }
            upd(r, n);
          });
          row.appendChild(b);
        });
        grid.appendChild(d);
      });
      upd = scoreBar(el, items.length, build);
    }
    build();
  }

  function order(el, cfg) {
    var steps = cfg.steps;
    function build() {
      el.innerHTML = "";
      var wrap = h("div", "k-order"); el.appendChild(wrap);
      var slots = h("div", "slots"); wrap.appendChild(slots);
      var slotEls = steps.map(function (_, i) {
        var s = h("div", "slot", '<span class="n">第 ' + (i + 1) + ' 步</span><b>？</b>');
        slots.appendChild(s); return s;
      });
      wrap.appendChild(h("p", "muted", cfg.hint || "依照正確順序，點下面的卡片。"));
      var pool = h("div", "pool"); wrap.appendChild(pool);
      var msg = h("div", "say"); msg.setAttribute("aria-live", "polite");
      msg.innerHTML = '<div class="t">提示</div><p>' + (cfg.start || "想一想，第一步要做什麼？") + "</p>";
      wrap.appendChild(msg);
      var next = 0;
      shuffle(steps.map(function (s, i) { return { s: s, i: i }; })).forEach(function (o) {
        var b = h("button", "", o.s.t); b.type = "button";
        b.addEventListener("click", function () {
          if (o.i === next) {
            var sl = slotEls[next];
            sl.classList.remove("wrongpos"); sl.classList.add("filled", "pop-in");
            sl.querySelector("b").textContent = o.s.t;
            b.disabled = true;
            msg.className = "say good";
            msg.innerHTML = '<div class="t">第 ' + (next + 1) + " 步：" + o.s.t + "</div><p>" + (o.s.d || "") + "</p>";
            next++;
            if (next === steps.length) {
              var again = h("button", "btn fill", "再玩一次"); again.type = "button";
              again.addEventListener("click", build);
              msg.innerHTML += '<p style="margin-top:.5rem"><b>' + (cfg.done || "全部排對了！") + "</b></p>";
              msg.appendChild(again);
            }
          } else {
            var cur = slotEls[next]; cur.classList.add("wrongpos");
            setTimeout(function () { cur.classList.remove("wrongpos"); }, 600);
            msg.className = "say bad";
            msg.innerHTML = '<div class="t">還不是這一步</div><p>「' + o.s.t + "」" + (o.s.why || "不是現在要做的事，再想想。") + "</p>";
          }
        });
        pool.appendChild(b);
      });
    }
    build();
  }

  function sort(el, cfg) {
    function build() {
      el.innerHTML = "";
      var wrap = h("div", "k-sort"); el.appendChild(wrap);
      wrap.appendChild(h("p", "muted", cfg.hint || "先點一張卡片，再點它屬於的格子。"));
      var items = h("div", "items"); wrap.appendChild(items);
      var bins = h("div", "bins"); wrap.appendChild(bins);
      var msg = h("div", "say msg"); msg.setAttribute("aria-live", "polite");
      msg.innerHTML = '<div class="t">提示</div><p>' + (cfg.start || "選一張卡片開始。") + "</p>";
      wrap.appendChild(msg);
      var picked = null, left = cfg.items.length, right = 0;
      var binEls = {};
      cfg.bins.forEach(function (b) {
        var be = h("button", "bin", "<h4>" + b.t + "</h4>" + (b.d ? '<span class="muted" style="font-size:.85rem">' + b.d + "</span>" : "") + '<div class="got"></div>');
        be.type = "button";
        be.addEventListener("click", function () {
          if (!picked) { msg.className = "say msg"; msg.innerHTML = '<div class="t">提示</div><p>先點上面的一張卡片喔！</p>'; return; }
          var it = picked.it;
          if (it.bin === b.id) {
            be.querySelector(".got").appendChild(h("span", "pop-in", it.t));
            picked.btn.remove(); left--; right++;
            msg.className = "say msg good";
            msg.innerHTML = '<div class="t">答對了</div><p>' + (it.e || "") + "</p>";
          } else {
            picked.btn.setAttribute("aria-pressed", "false");
            msg.className = "say msg bad";
            msg.innerHTML = '<div class="t">再想想</div><p>「' + it.t + "」不屬於「" + b.t + "」。" + (it.hint || "") + "</p>";
          }
          picked = null;
          Object.keys(binEls).forEach(function (k) { binEls[k].classList.remove("ready"); });
          if (!left) {
            var again = h("button", "btn fill", "再玩一次"); again.type = "button";
            again.addEventListener("click", build);
            msg.innerHTML += '<p style="margin-top:.5rem"><b>' + (cfg.done || "全部分類完成！") + "</b></p>";
            msg.appendChild(again);
          }
        });
        binEls[b.id] = be; bins.appendChild(be);
      });
      shuffle(cfg.items).forEach(function (it) {
        var btn = h("button", "", it.t); btn.type = "button"; btn.setAttribute("aria-pressed", "false");
        btn.addEventListener("click", function () {
          items.querySelectorAll("button").forEach(function (z) { z.setAttribute("aria-pressed", "false"); });
          btn.setAttribute("aria-pressed", "true"); picked = { it: it, btn: btn };
          Object.keys(binEls).forEach(function (k) { binEls[k].classList.add("ready"); });
        });
        items.appendChild(btn);
      });
    }
    build();
  }

  function stepper(el, steps, render) {
    var cur = 0;
    el.classList.add("k-step");
    var dots = h("div", "dots"); el.appendChild(dots);
    var body = h("div", ""); body.setAttribute("aria-live", "polite"); el.appendChild(body);
    var row = h("div", "btnrow"); el.appendChild(row);
    var prev = h("button", "btn", "← 上一步"); prev.type = "button";
    var next = h("button", "btn fill", "下一步 →"); next.type = "button";
    row.appendChild(prev); row.appendChild(next);
    var ds = steps.map(function (_, i) {
      var d = h("button", ""); d.type = "button"; d.setAttribute("aria-label", "第 " + (i + 1) + " 步");
      d.addEventListener("click", function () { go(i); }); dots.appendChild(d); return d;
    });
    function go(i) {
      cur = Math.max(0, Math.min(steps.length - 1, i));
      ds.forEach(function (d, k) { d.classList.toggle("on", k <= cur); });
      prev.disabled = cur === 0; next.disabled = cur === steps.length - 1;
      render(cur, steps[cur], body);
    }
    prev.addEventListener("click", function () { go(cur - 1); });
    next.addEventListener("click", function () { go(cur + 1); });
    go(0);
    return { go: go };
  }

  window.KIT = { quiz: quiz, ox: ox, order: order, sort: sort, stepper: stepper, shuffle: shuffle, h: h };

  /* ---------- 分站換頁 ----------
     有 .k-nav 的教材會自動變成「一站一頁」：
     封面＝標題和各站卡片；點某一站後，標題區縮成最上面的一排頁籤（點頁籤換站），
     畫面左右兩邊有上一站／下一站的大按鈕，簡報筆（PageUp／PageDown）和鍵盤左右鍵也能換站。
     每個 section.k-sec 是一頁（沒列在目錄裡的，例如「挑戰」，也會自動加進目錄）；資料來源（.k-foot）放在最後一頁。
     網址 #id 會記住目前在哪一站；換站時發出 window 事件 "kit-page"（detail.id），上課工具的畫筆會依站分開保存。
     不想分頁的教材：<body data-paged="off">。 */
  function paged() {
    var head = document.querySelector(".k-head"), nav = document.querySelector(".k-nav");
    var secs = [].slice.call(document.querySelectorAll("section.k-sec"));
    if (!head || !nav || secs.length < 2 || document.body.getAttribute("data-paged") === "off") return;
    var foot = document.querySelector(".k-foot");
    var title = (head.querySelector("h1") || {}).textContent || document.title;

    /* 每一站的名稱：目錄卡片上的「第 N 站」＋粗體名稱；沒在目錄裡的從段落標題取 */
    var pages = secs.map(function (sec, i) {
      if (!sec.id) sec.id = "page" + (i + 1);
      var a = nav.querySelector('a[href="#' + sec.id + '"]'), no, name;
      if (a) { no = (a.querySelector(".no") || {}).textContent || ""; name = (a.querySelector("b") || {}).textContent || ""; }
      else {
        no = (sec.querySelector(".k-sec-head .no") || {}).textContent || "";
        name = (sec.querySelector("h2") || {}).textContent || "";
        if (name.length > 10) name = name.slice(0, 10) + "…";
        var c = h("a", "", '<span class="no"></span><b></b><span></span>');
        c.href = "#" + sec.id; c.querySelector(".no").textContent = no; c.querySelector("b").textContent = name;
        var full = (sec.querySelector("h2") || {}).textContent || "";
        c.querySelector("span:last-child").textContent = full !== name ? full : "";
        nav.appendChild(c);
      }
      return { id: sec.id, sec: sec, no: no.trim(), name: name.trim() };
    });

    document.documentElement.classList.add("k-paged");
    /* 封面上「從第 1 站開始」 */
    var start = h("div", "k-start"); var sb = h("button", "btn fill", "從" + (pages[0].no || "第一站") + "開始 →"); sb.type = "button";
    start.appendChild(sb); nav.parentNode.insertBefore(start, nav.nextSibling);

    /* 最上面的頁籤列 */
    var bar = h("nav", "k-tabs"); bar.setAttribute("aria-label", "各站");
    var home = h("button", "k-tab k-home", "☰ 目錄"); home.type = "button"; bar.appendChild(home);
    var tl = h("span", "k-tt"); tl.textContent = title; bar.appendChild(tl);
    var list = h("div", "k-tablist"); bar.appendChild(list);
    var tabs = pages.map(function (p, i) {
      var b = h("button", "k-tab"); b.type = "button";
      b.innerHTML = '<span class="no"></span><b></b>';
      b.querySelector(".no").textContent = p.no || ("第 " + (i + 1) + " 頁");
      b.querySelector("b").textContent = p.name;
      b.addEventListener("click", function () { go(i); });
      list.appendChild(b); return b;
    });
    document.body.insertBefore(bar, document.body.firstChild);

    /* 左右兩邊的上一站／下一站 */
    var prev = h("button", "k-side k-prev", "<span aria-hidden=\"true\">‹</span><small></small>"); prev.type = "button";
    var next = h("button", "k-side k-next", "<span aria-hidden=\"true\">›</span><small></small>"); next.type = "button";
    document.body.appendChild(prev); document.body.appendChild(next);

    var cur = -1;
    function fire(id) { try { window.dispatchEvent(new CustomEvent("kit-page", { detail: { id: id } })); } catch (e) {} }
    function cover() {
      cur = -1;
      document.documentElement.classList.remove("k-in");
      head.hidden = false; secs.forEach(function (s) { s.hidden = true; }); if (foot) foot.hidden = true;
      bar.hidden = true; prev.hidden = next.hidden = true;
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
      window.scrollTo(0, 0); fire("");
      setTimeout(function () { window.dispatchEvent(new Event("resize")); }, 0);
    }
    function go(i, keepScroll) {
      i = Math.max(0, Math.min(pages.length - 1, i));
      var changed = i !== cur; cur = i;
      document.documentElement.classList.add("k-in");
      head.hidden = true; bar.hidden = false;
      secs.forEach(function (s, k) { s.hidden = k !== i; });
      if (foot) foot.hidden = i !== pages.length - 1;
      tabs.forEach(function (t, k) { if (k === i) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current"); });
      var pp = pages[i - 1], np = pages[i + 1];
      prev.hidden = !pp; next.hidden = !np;
      if (pp) { prev.querySelector("small").textContent = pp.no || "上一頁"; prev.setAttribute("aria-label", "上一站：" + pp.name); }
      if (np) { next.querySelector("small").textContent = np.no || "下一頁"; next.setAttribute("aria-label", "下一站：" + np.name); }
      try { history.replaceState(null, "", "#" + pages[i].id); } catch (e) {}
      if (!keepScroll) window.scrollTo(0, 0);
      tabs[i].scrollIntoView({ block: "nearest", inline: "center" });
      if (changed) fire(pages[i].id);
      /* 原本隱藏時量不到大小的圖表、畫布，切換後重新排版 */
      setTimeout(function () { window.dispatchEvent(new Event("resize")); }, 0);
    }
    home.addEventListener("click", cover);
    sb.addEventListener("click", function () { go(0); });
    prev.addEventListener("click", function () { go(cur - 1); });
    next.addEventListener("click", function () { go(cur + 1); });

    /* 頁面裡的 #連結：跳到那一站（站內的位置也會捲過去） */
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
      var id = decodeURIComponent(a.getAttribute("href").slice(1)); if (!id) return;
      var t = document.getElementById(id); if (!t) return;
      var k = -1; pages.forEach(function (p, i) { if (p.sec === t || p.sec.contains(t)) k = i; });
      if (k < 0) return;
      e.preventDefault(); go(k, t !== pages[k].sec);
      if (t !== pages[k].sec) setTimeout(function () { t.scrollIntoView({ block: "start" }); }, 30);
    });

    /* 簡報筆與鍵盤：在輸入框、滑桿等元件裡按方向鍵時不換站 */
    document.addEventListener("keydown", function (e) {
      if (cur < 0 || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      var t = e.target;
      if (t.closest && t.closest("input,textarea,select,[contenteditable],[role=slider],.ct-panel,.ct-big,.ct-wb,.ct-pen,dialog,.srcdlg")) return;
      if (e.key === "PageDown" || e.key === "ArrowRight") { if (cur < pages.length - 1) { e.preventDefault(); go(cur + 1); } }
      else if (e.key === "PageUp" || e.key === "ArrowLeft") { if (cur > 0) { e.preventDefault(); go(cur - 1); } }
    });

    var hid = decodeURIComponent(location.hash.slice(1)), at = -1;
    pages.forEach(function (p, i) { if (p.id === hid) at = i; });
    if (at >= 0) {
      /* 直接用 #站 打開時，瀏覽器會自己捲到那一段；改回從頁面最上面開始 */
      try { history.scrollRestoration = "manual"; } catch (e) {}
      go(at);
      window.addEventListener("load", function () { window.scrollTo(0, 0); });
      setTimeout(function () { window.scrollTo(0, 0); }, 50);
    } else cover();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paged);
  else setTimeout(paged, 0);
})();
