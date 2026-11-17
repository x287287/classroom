/* 教室小書櫃｜友善校園宣導互動版共用元件（需要先載入 kit.js）
   FC.flips(el, [{t, back, em|img, c, txt}], {cols:2|3|4})   翻翻卡（c：c1 c2 c3 c4 good bad）
   FC.match(el, {pairs:[{k, v}], start, done})                點選配對（先點左邊再點右邊）
   FC.reveal(el, [{q, a}], {btn})                              一題一題點開參考答案
   FC.scenes(el, {items:[{k, t, img, qs, focus}], qs, label})   小組討論情境（頁籤切換）
   FC.vote(el, {opts:[...], analysis:"html", btn})             全班舉手計數，再看分析
   FC.pledge(el, [句子])                                        點一下打勾
   FC.shout(el, [句子])                                         點一下放大，全班一起唸
   FC.formula(el, {parts:[{t, d}], result})                    點出每一項，算出結果             */
(function () {
  var h = KIT.h;
  function btnRow(labels) {
    var row = h("div", "btnrow fliprow");
    return { row: row, btns: labels.map(function (t) { var b = h("button", "btn", t); b.type = "button"; row.appendChild(b); return b; }) };
  }

  function flips(el, list, opt) {
    opt = opt || {};
    var box = h("div", "flips" + (opt.cols && opt.cols !== 3 ? " n" + opt.cols : ""));
    el.appendChild(box);
    var btns = list.map(function (x) {
      var b = h("button", "flip " + (x.c || "")); b.type = "button"; b.setAttribute("aria-pressed", "false");
      var face = x.img ? '<img src="' + x.img + '" alt="">' : (x.em ? '<span class="em" aria-hidden="true">' + x.em + "</span>" : "");
      b.innerHTML = '<span class="in"><span class="f">' + face + (x.t ? "<b>" + x.t + "</b>" : "") + (x.txt ? '<span class="txt">' + x.txt + "</span>" : "") +
        "<small>" + (opt.hint || "點我翻面") + "</small></span>" +
        '<span class="b" aria-hidden="true">' + (x.bt != null ? (x.bt ? "<b>" + x.bt + "</b>" : "") : (x.t ? "<b>" + x.t + "</b>" : "")) + "<span>" + x.back + "</span></span></span>";
      b.addEventListener("click", function () {
        var on = b.getAttribute("aria-pressed") !== "true";
        b.setAttribute("aria-pressed", String(on));
        b.querySelector(".f").setAttribute("aria-hidden", String(on));
        b.querySelector(".b").setAttribute("aria-hidden", String(!on));
      });
      box.appendChild(b); return b;
    });
    var r = btnRow(["全部翻開", "全部蓋起來"]);
    function setAll(on) { btns.forEach(function (b) { if ((b.getAttribute("aria-pressed") === "true") !== on) b.click(); }); }
    r.btns[0].addEventListener("click", function () { setAll(true); });
    r.btns[1].addEventListener("click", function () { setAll(false); });
    el.appendChild(r.row);
  }

  function match(el, cfg) {
    function build() {
      el.innerHTML = "";
      var g = h("div", "match"), L = h("div", "col k"), R = h("div", "col v");
      g.appendChild(L); g.appendChild(R); el.appendChild(g);
      var msg = h("div", "say mmsg", '<div class="t">提示</div><p>' + (cfg.start || "先點左邊的一張，再點右邊配對的那一張。") + "</p>");
      msg.setAttribute("aria-live", "polite"); el.appendChild(msg);
      var pick = { k: null, v: null }, left = cfg.pairs.length;
      function mk(col, text, i, side) {
        var b = h("button", "", '<span class="tick" aria-hidden="true">' + (side === "k" ? "?" : "") + "</span><span>" + text + "</span>");
        b.type = "button"; b.setAttribute("aria-pressed", "false"); b.dataset.i = i;
        b.addEventListener("click", function () {
          if (b.classList.contains("done")) return;
          [].forEach.call(col.children, function (z) { z.setAttribute("aria-pressed", "false"); });
          b.setAttribute("aria-pressed", "true"); pick[side] = b;
          if (pick.k && pick.v) check();
        });
        col.appendChild(b);
      }
      function check() {
        var k = pick.k, v = pick.v; pick = { k: null, v: null };
        k.setAttribute("aria-pressed", "false"); v.setAttribute("aria-pressed", "false");
        var p = cfg.pairs[+k.dataset.i];
        if (k.dataset.i === v.dataset.i) {
          left--;
          [k, v].forEach(function (b) { b.classList.add("done"); b.querySelector(".tick").textContent = "✓"; });
          msg.className = "say mmsg good";
          msg.innerHTML = '<div class="t">配對成功</div><p><b>' + p.k + "</b>：" + p.v + "</p>";
          if (!left) {
            msg.innerHTML += '<p style="margin-top:.5rem"><b>' + (cfg.done || "全部配對完成！") + "</b></p>";
            var again = h("button", "btn fill", "再玩一次"); again.type = "button";
            again.addEventListener("click", build); msg.appendChild(again);
          }
        } else {
          [k, v].forEach(function (b) { b.classList.remove("no"); void b.offsetWidth; b.classList.add("no"); setTimeout(function () { b.classList.remove("no"); }, 500); });
          msg.className = "say mmsg bad";
          msg.innerHTML = '<div class="t">再想想</div><p>「' + p.k + "」不是配這一個喔，再試一次！</p>";
        }
      }
      cfg.pairs.forEach(function (p, i) { mk(L, p.k, i, "k"); });
      KIT.shuffle(cfg.pairs.map(function (p, i) { return { v: p.v, i: i }; })).forEach(function (o) { mk(R, o.v, o.i, "v"); });
    }
    build();
  }

  function reveal(el, list, opt) {
    opt = opt || {};
    var label = opt.btn || "想好了，看參考答案";
    var box = h("div", "game"); el.appendChild(box);
    var nums = "①②③④⑤⑥⑦⑧⑨⑩";
    var items = list.map(function (g, i) {
      var d = h("div", "gq", '<div class="q"><span class="n">' + (opt.plain ? i + 1 : nums.charAt(i)) + "</span><span>" + g.q + "</span></div>" +
        '<div class="row"><button class="btn" type="button" aria-expanded="false">' + label + "</button></div>" +
        '<div class="ans pop-in" hidden>' + g.a + "</div>");
      var b = d.querySelector("button"), a = d.querySelector(".ans");
      function set(open) { a.hidden = !open; b.setAttribute("aria-expanded", String(open)); b.textContent = open ? "收起" : label; }
      b.addEventListener("click", function () { set(a.hidden); });
      box.appendChild(d); return set;
    });
    if (list.length > 1) {
      var r = btnRow(["全部打開", "全部收起"]);
      r.btns[0].addEventListener("click", function () { items.forEach(function (s) { s(true); }); });
      r.btns[1].addEventListener("click", function () { items.forEach(function (s) { s(false); }); });
      el.appendChild(r.row);
    }
  }

  function scenes(el, cfg) {
    var S = cfg.items, cur = 0;
    var tabs = h("div", "sc-tabs"); tabs.setAttribute("role", "tablist"); el.appendChild(tabs);
    var scene = h("div", "scene"); el.appendChild(scene);
    var row = h("div", "btnrow"); row.style.marginTop = "1rem";
    var next = h("button", "btn fill", "下一個情境 →"); next.type = "button"; row.appendChild(next); el.appendChild(row);
    S.forEach(function (s, i) { var b = h("button", "chip", s.k); b.type = "button"; b.setAttribute("role", "tab"); b.addEventListener("click", function () { show(i); }); tabs.appendChild(b); });
    function show(i) {
      cur = i; var s = S[i], qs = s.qs || cfg.qs;
      [].forEach.call(tabs.children, function (b, k) { b.setAttribute("aria-selected", String(k === i)); });
      scene.innerHTML = '<div class="story">' + (s.img ? '<img src="' + s.img + '" alt="">' : "") + '<span class="lab">' + (s.title || s.k) + "</span>" + s.t +
        '<div class="prog">' + (cfg.label || "小組討論") + "（ " + (i + 1) + " ／ " + S.length + " ）</div></div>" +
        '<div class="panel"><h3>' + (cfg.ask || "請討論：") + "</h3><ol>" + qs.map(function (q, k) { return "<li>" + "①②③④⑤".charAt(k) + " " + q + "</li>"; }).join("") + "</ol>" +
        (s.focus ? '<div class="focus" data-focus></div>' : "") + (cfg.note ? '<p class="muted" style="margin-top:.7rem">' + cfg.note + "</p>" : "") + "</div>";
      if (s.focus) reveal(scene.querySelector("[data-focus]"), [{ q: "討論完了嗎？", a: "<b>對應重點：</b>" + s.focus }], { btn: "看對應重點", plain: true });
      next.textContent = i < S.length - 1 ? "下一個情境 →" : "回到第一個情境";
    }
    next.addEventListener("click", function () { show((cur + 1) % S.length); });
    show(0);
  }

  function vote(el, cfg) {
    var counts = cfg.opts.map(function () { return 0; });
    var box = h("div", "vote"); el.appendChild(box);
    var bs = cfg.opts.map(function (o, i) {
      var b = h("button", "", "<span>" + o + '</span><span class="c">0</span>'); b.type = "button";
      b.addEventListener("click", function () { counts[i]++; b.querySelector(".c").textContent = counts[i]; });
      box.appendChild(b); return b;
    });
    var row = h("div", "vote-row"), reset = h("button", "btn", "票數歸零"), show = h("button", "btn fill", cfg.btn || "看分析");
    reset.type = show.type = "button";
    row.appendChild(show); row.appendChild(reset); row.appendChild(h("small", "", "舉手的人數，點一下加 1"));
    el.appendChild(row);
    var an = h("div", "analysis pop-in", cfg.analysis); an.hidden = true; el.appendChild(an);
    reset.addEventListener("click", function () { counts = counts.map(function () { return 0; }); bs.forEach(function (b) { b.querySelector(".c").textContent = "0"; }); an.hidden = true; show.textContent = cfg.btn || "看分析"; });
    show.addEventListener("click", function () { an.hidden = !an.hidden; show.textContent = an.hidden ? (cfg.btn || "看分析") : "收起分析"; });
  }

  function pledge(el, lines) {
    var box = h("div", "pledge"); el.appendChild(box);
    lines.forEach(function (t) {
      var b = h("button", "", t); b.type = "button"; b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () { b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true")); });
      box.appendChild(b);
    });
  }

  function shout(el, lines) {
    var box = h("div", "shout"); el.appendChild(box);
    lines.forEach(function (t) {
      var b = h("button", "", t); b.type = "button";
      b.addEventListener("click", function () { b.classList.remove("go"); void b.offsetWidth; b.classList.add("go"); setTimeout(function () { b.classList.remove("go"); }, 900); });
      box.appendChild(b);
    });
  }

  function formula(el, cfg) {
    var box = h("div", "formula"); el.appendChild(box);
    var on = 0, res;
    cfg.parts.forEach(function (p, i) {
      if (i) box.appendChild(h("span", "op", "＋"));
      var b = h("button", "", "<b>？</b>點我"); b.type = "button";
      b.addEventListener("click", function () {
        if (b.classList.contains("on")) return;
        b.classList.add("on"); b.innerHTML = "<b>" + p.t + "</b>" + (p.d || ""); on++;
        if (on === cfg.parts.length) { res.classList.add("on"); res.innerHTML = cfg.result; }
      });
      box.appendChild(b);
    });
    box.appendChild(h("span", "op", "＝"));
    res = h("div", "res", "？"); box.appendChild(res);
  }

  window.FC = { flips: flips, match: match, reveal: reveal, scenes: scenes, vote: vote, pledge: pledge, shout: shout, formula: formula };
})();
