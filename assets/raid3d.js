/* 全班共戰的 3D 魔王戰場（2026-11-20）
   大螢幕（lessons/u2-game-raid.html）用：魔王是放大的 KayKit 角色（第二單元紫色煙霧、第三單元火焰），
   學生用自己的角色（assets/avatar.js，依「班級＋座號」）圍在魔王前面；分隊競賽時畫面依隊數切成 2～4 格，每隊一個戰場。
   每個學生答對時，依他拿的武器播攻擊動作與特效（AVATAR.weapon：劍氣、斧頭重擊、鎚子地裂、短刀連斬、長矛突刺、法杖魔法彈、
   自然法杖葉子、權杖聖光柱、星星魔杖、魔法書魔法陣、弓箭、弩箭、炸彈爆炸、藥水潑灑、拳頭、爪子、鉛筆彩虹星星、課本紙片、
   火把火球、提燈光束、工具火花、盾牌衝擊波），打中魔王時跳出傷害數字。特效都是程式畫的（角色編輯器沒有特效檔）。
   用法：
     R3D.init(容器, {teams, unit}) → Promise；R3D.players([{seat,team}], {座號:cfg})；R3D.attack(座號, 傷害, 隊)；
     R3D.volley([座號…], 總傷害, 暴擊, 隊)（同步作答公布答案）；R3D.hp(隊, 剩下比例)；R3D.counter(隊或 0)；R3D.heal(隊)；
     R3D.end(結果, 獲勝隊)；R3D.rects() → 各戰場在容器裡的位置（比例）；R3D.destroy()。
   沒有 WebGL 或零件載入失敗時 init 會 reject，頁面繼續用原本的 2D 魔王。 */
(function () {
  if (window.R3D) return;
  var T = null, st = null;
  var TEAMC = ["#7A2E8E", "#C8414B", "#1D5FBF", "#17784E", "#A84A00"];
  var BOSS = {
    u2: { cfg: { skin: "#a58ad0", eyes: "細長眼", brows: "濃眉", nose: "大蒜鼻", mouth: "抿嘴", beard: "大鬍子", color: "#3b2f4a", hat: "牛角帽", body: "野蠻人皮衣", legs: "毛皮褲", cape: "毛皮披肩", right: "骷髏斧", left: "骷髏大盾" },
      tint: "#c9b3ff", aura: ["#8f7fb0", "#6e8f6a", "#b07a8f"], fire: false, ground: "#3b2d52", rim: "#5b4a7c", sky: "#1d1530" },
    u3: { cfg: { skin: "#e8875e", eyes: "細長眼", brows: "濃眉", nose: "大蒜鼻", mouth: "抿嘴", beard: "大鬍子", color: "#5a1d0e", hat: "牛角帽", body: "野蠻人皮衣", legs: "毛皮褲", cape: "紅披風", right: "火把", left: "骷髏小盾" },
      tint: "#ffb38a", aura: ["#ff9100", "#ff5722", "#ffd54f"], fire: true, ground: "#4a2a22", rim: "#7a3a22", sky: "#24130f" }
  };

  /* ---------- 小工具 ---------- */
  function V(x, y, z) { return new T.Vector3(x || 0, y || 0, z || 0); }
  var texC = {};
  function canvasTex(key, w, h, draw) { if (texC[key]) return texC[key]; var c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); var t = new T.CanvasTexture(c); return texC[key] = t; }
  function glowTex() { return canvasTex("glow", 64, 64, function (x, w) { var g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.25, "rgba(255,255,255,.8)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, w, w); }); }
  function softTex() { return canvasTex("soft", 64, 64, function (x, w) { var g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,.9)"); g.addColorStop(.6, "rgba(255,255,255,.35)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, w, w); }); }
  function starTex() { return canvasTex("star", 64, 64, function (x) { x.fillStyle = "#fff"; x.beginPath(); for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11 : 30; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.fill(); }); }
  function shadowTex() { return canvasTex("shadow", 64, 64, function (x, w) { var g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, w, w); }); }
  function runeTex() { return canvasTex("rune", 256, 256, function (x) { x.strokeStyle = "#fff"; x.lineWidth = 6; x.beginPath(); x.arc(128, 128, 118, 0, 7); x.stroke(); x.lineWidth = 3; x.beginPath(); x.arc(128, 128, 92, 0, 7); x.stroke();
    x.beginPath(); for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3; x.lineTo(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92); } x.closePath(); x.stroke();
    x.font = "bold 22px serif"; x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle"; "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ".split("").forEach(function (ch, i) { var a = i / 12 * Math.PI * 2; x.fillText(ch, 128 + Math.cos(a) * 105, 128 + Math.sin(a) * 105); }); }); }
  function labelTex(n, col) { return canvasTex("lb" + n + col, 128, 128, function (x) { x.fillStyle = col; x.beginPath(); x.arc(64, 64, 52, 0, 7); x.fill(); x.lineWidth = 8; x.strokeStyle = "#fff"; x.stroke();
    x.fillStyle = "#fff"; x.font = "bold " + (String(n).length > 1 ? 58 : 66) + "px 'Huninn','Noto Sans TC',sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(n, 64, 68); }); }
  function textTex(s, col) { return canvasTex("tx" + s + col, 256, 128, function (x) { x.font = "bold 84px 'Huninn','Noto Sans TC',sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
    x.lineWidth = 14; x.strokeStyle = "#5a0f2a"; x.strokeText(s, 128, 66); x.fillStyle = col; x.fillText(s, 128, 66); }); }
  var geoC = {};
  function geo(k, f) { return geoC[k] || (geoC[k] = f()); }
  function addMat(c, o) { return new T.MeshBasicMaterial(Object.assign({ color: c, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }, o || {})); }
  function sprMat(c, tex, add) { return new T.SpriteMaterial({ map: tex || glowTex(), color: c, transparent: true, depthWrite: false, blending: add === false ? T.NormalBlending : T.AdditiveBlending }); }

  /* ---------- 特效系統（每個特效：obj、壽命、每格更新） ---------- */
  function fx(A, obj, life, upd, done) { A.g.add(obj); st.fx.push({ A: A, obj: obj, t: 0, life: life, upd: upd, done: done }); return obj; }
  function later(sec, fn) { st.timers.push({ at: st.now + sec, fn: fn }); }
  function sprite(A, pos, col, size, life, o) {
    o = o || {}; var s = new T.Sprite(sprMat(col, o.tex, o.add)); s.position.copy(pos); s.scale.setScalar(size);
    var v = o.vel ? o.vel.clone() : null, g = o.grav || 0, grow = o.grow == null ? 1 : o.grow, rot = o.spin || 0;
    return fx(A, s, life, function (k, dt) { if (v) { v.y -= g * dt; s.position.addScaledVector(v, dt); } if (o.rise) s.position.y += o.rise * dt;
      s.scale.setScalar(size * (1 + (grow - 1) * k)); s.material.opacity = (o.op || 1) * (o.fadeIn ? Math.min(1, k * 5) : 1) * (1 - k); if (rot) s.material.rotation += rot * dt; });
  }
  function burst(A, pos, col, n, speed, size, o) {
    o = o || {};
    for (var i = 0; i < n; i++) { var d = V(Math.random() - .5, Math.random() * (o.up == null ? .8 : o.up) - .1, Math.random() - .5).normalize().multiplyScalar(speed * (.5 + Math.random() * .7));
      sprite(A, pos, Array.isArray(col) ? col[i % col.length] : col, size * (.6 + Math.random() * .6), (o.life || .6) * (.7 + Math.random() * .5), { vel: d, grav: o.grav == null ? 6 : o.grav, tex: o.tex, spin: o.tex ? 6 : 0, grow: o.grow == null ? .4 : o.grow, add: o.add }); }
  }
  function ring(A, pos, col, r0, r1, life, flat, o) {
    o = o || {}; var m = new T.Mesh(geo("ring", function () { return new T.RingGeometry(.86, 1, 48); }), addMat(col));
    m.position.copy(pos); if (flat) m.rotation.x = -Math.PI / 2; else if (o.face) m.lookAt(o.face); m.scale.setScalar(r0);
    return fx(A, m, life, function (k) { m.scale.setScalar(r0 + (r1 - r0) * (1 - Math.pow(1 - k, 2))); m.material.opacity = (o.op || 1) * (1 - k); }, o.done);
  }
  function crescent(A, pos, dir, col, size, life, rotZ, o) {
    o = o || {}; var m = new T.Mesh(geo("cres", function () { return new T.RingGeometry(.62, 1, 32, 1, -Math.PI * .45, Math.PI * .9); }), addMat(col));
    m.position.copy(pos); m.lookAt(pos.clone().add(dir)); m.rotateZ(rotZ || 0); m.scale.setScalar(size);
    return fx(A, m, life, function (k) { m.scale.setScalar(size * (1 + k * (o.grow || .5))); m.material.opacity = 1 - k * k; });
  }
  function beam(A, from, to, col, w, life, o) {
    o = o || {}; var len = from.distanceTo(to), m = new T.Mesh(geo("beam", function () { var g = new T.CylinderGeometry(1, 1, 1, 10, 1, true); g.translate(0, .5, 0); g.rotateX(Math.PI / 2); return g; }), addMat(col));
    m.position.copy(from); m.lookAt(to); m.scale.set(w, w, len);
    return fx(A, m, life, function (k) { var ww = w * (o.grow ? (1 + k * o.grow) : (1 - k * .6)); m.scale.set(ww, ww, len); m.material.opacity = 1 - k; });
  }
  function text(A, pos, s, col, size) {
    var sp = new T.Sprite(new T.SpriteMaterial({ map: textTex(s, col || "#FFE27A"), transparent: true, depthWrite: false, depthTest: false })); sp.renderOrder = 10;
    sp.position.copy(pos); var w = size || 2.2; sp.scale.set(w * 2, w, 1);
    return fx(A, sp, 1.3, function (k) { sp.position.y += .9 * (1 / 60); var s0 = k < .15 ? .4 + k / .15 * .8 : 1.2 - (k - .15) * .2; sp.scale.set(w * 2 * s0, w * s0, 1); sp.material.opacity = k > .7 ? (1 - k) / .3 : 1; });
  }
  /* 飛行物：obj 從 a 飛到 b（arc 高度），trail(pos) 每 0.03 秒呼叫一次，到達呼叫 hit */
  function fly(A, obj, a, b, dur, arc, o, hit) {
    o = o || {}; obj.position.copy(a); var acc = 0, prev = a.clone();
    return fx(A, obj, dur, function (k, dt) {
      var p = a.clone().lerp(b, k); p.y += (arc || 0) * 4 * k * (1 - k); obj.position.copy(p);
      if (o.orient) { var nx = a.clone().lerp(b, Math.min(1, k + .02)); nx.y += (arc || 0) * 4 * (k + .02) * (1 - k - .02); obj.lookAt(A.g.localToWorld(nx)); if (o.rotZ) obj.rotateZ(o.rotZ); }
      if (o.spin) { obj.rotation.x += o.spin * dt; obj.rotation.z += o.spin * .7 * dt; }
      if (o.trail) { acc += dt; while (acc > .03) { acc -= .03; o.trail(p.clone(), prev); } } prev = p;
    }, hit);
  }
  function orb(A, a, b, col, size, dur, arc, trailCol, hit, o) {
    o = o || {}; var s = new T.Sprite(sprMat(col, o.tex)); s.scale.setScalar(size);
    return fly(A, s, a, b, dur, arc, { trail: function (p) { sprite(A, p, trailCol || col, size * .7, o.tl || .35, { tex: o.ttex, grow: .2, rise: o.rise || 0 }); if (o.tr2) o.tr2(p); }, spin: 0 }, hit);
  }

  /* ---------- 攻擊特效（依武器） ---------- */
  var FX = {
    wave: function (A, a, b, w, hit) {
      var dir = b.clone().sub(a).normalize(), m = new T.Mesh(geo("cres", function () { return new T.RingGeometry(.62, 1, 32, 1, -Math.PI * .45, Math.PI * .9); }), addMat(w.c));
      var sz = w.big ? 1.6 : 1.1; m.scale.setScalar(sz);
      fly(A, m, a, b, .32, 0, { orient: true, rotZ: Math.PI / 2, trail: function (p) { sprite(A, p, w.c, .5, .25, { grow: .2 }); } }, function () {
        crescent(A, b, dir, w.c, w.big ? 3 : 2.3, .3, Math.random() * 2 - 1); crescent(A, b, dir, "#ffffff", w.big ? 2.2 : 1.6, .22, Math.random() * 2 - 1);
        burst(A, b, [w.c, "#ffffff"], 10, 6, .45); hit(); });
    },
    cleave: function (A, a, b, w, hit) {
      FX.wave(A, a, b, { c: w.c, big: 1 }, function () { var gnd = V(b.x, .08, b.z); ring(A, gnd, w.c, .5, 4.5, .5, true); burst(A, gnd, ["#8d6e63", "#ffcc80"], 12, 7, .5, { grav: 14, up: 1.2, add: false }); st.shake(A, .25); hit(); });
    },
    smash: function (A, a, b, w, hit) {
      var g0 = V(a.x, .1, a.z), g1 = V(b.x, .1, b.z);
      for (var i = 1; i <= 6; i++) (function (i) { later(i * .05, function () { var p = g0.clone().lerp(g1, i / 6); sprite(A, p, w.c, 1.1, .4, { grow: .6 }); burst(A, p, ["#8d6e63", "#a1887f"], 3, 4, .35, { grav: 12, up: 1.4, add: false }); }); })(i);
      later(.33, function () { ring(A, g1, w.c, .5, 5.5, .55, true); ring(A, g1, "#ffffff", .3, 3.5, .4, true); sprite(A, b, "#ffe0b2", 3.2, .35, { grow: 1.5 });
        burst(A, g1, ["#6d4c41", "#8d6e63", "#bcaaa4"], 14, 8, .55, { grav: 16, up: 1.4, add: false }); st.shake(A, .35); hit(); });
    },
    stab: function (A, a, b, w, hit) {
      beam(A, a, b, w.c, .05, .15); var dir = b.clone().sub(a).normalize();
      [0, .08, .16].forEach(function (t, i) { later(t + .1, function () { crescent(A, b.clone().add(V(0, (i - 1) * .4, 0)), dir, i === 1 ? "#ffd54f" : w.c, 1.2, .2, [-.8, .8, 0][i]); burst(A, b, w.c, 4, 5, .3); if (i === 2) hit(); }); });
    },
    thrust: function (A, a, b, w, hit) {
      beam(A, a, b, w.c, .12, .32, { grow: .6 }); beam(A, a, b, "#ffffff", .05, .25);
      later(.12, function () { sprite(A, b, w.c, 2.6, .3, { grow: 1.4 }); burst(A, b, [w.c, "#fff"], 10, 7, .4); hit(); });
    },
    magic: function (A, a, b, w, hit) {
      sprite(A, a, w.c, 1.2, .3, { grow: 1.6 });
      orb(A, a, b, w.c, w.dark ? 1.1 : .9, .45, 1.2, w.dark ? "#4a148c" : w.c, function () { sprite(A, b, w.c, 3.4, .45, { grow: 1.6 }); ring(A, b, w.c, .4, 3, .45, false, { face: st.camOf(A).position.clone().sub(A.g.position) });
        burst(A, b, [w.c, "#ffffff"], 14, 6, .4, { grav: 2 }); hit(); });
    },
    nature: function (A, a, b, w, hit) {
      orb(A, a, b, w.c, .9, .5, 1.4, "#c5e1a5", function () { sprite(A, b, w.c, 3, .4, { grow: 1.4 }); burst(A, b, ["#7ed957", "#aed581", "#33691e"], 14, 5, .45, { grav: 3, tex: starTex() });
        ring(A, V(b.x, .08, b.z), "#7ed957", .5, 3.5, .5, true); hit(); }, { ttex: starTex() });
    },
    holy: function (A, a, b, w, hit) {
      sprite(A, a.clone().add(V(0, 1, 0)), w.c, 1.6, .5, { grow: 1.5 });
      later(.2, function () { var top = V(b.x, 14, b.z), gnd = V(b.x, 0, b.z); beam(A, top, gnd, w.c, .9, .6, { grow: .5 }); beam(A, top, gnd, "#ffffff", .35, .5);
        ring(A, V(b.x, .08, b.z), w.c, .5, 4.5, .6, true); burst(A, b, [w.c, "#ffffff"], 16, 5, .45, { tex: starTex(), grav: 1 }); hit(); });
    },
    stars: function (A, a, b, w, hit) {
      orb(A, a, b, w.c, 1, .5, 1.6, "#ffffff", function () { burst(A, b, ["#fff176", "#ffffff", "#ffd54f", "#80deea"], 18, 6, .6, { tex: starTex(), grav: 2 }); sprite(A, b, w.c, 2.6, .35, { grow: 1.3 }); hit(); }, { tex: starTex(), ttex: starTex() });
    },
    runes: function (A, a, b, w, hit) {
      var m = new T.Mesh(geo("plane", function () { return new T.PlaneGeometry(1, 1); }), addMat(w.c, { map: runeTex() })); m.rotation.x = -Math.PI / 2; m.position.set(b.x, .1, b.z);
      fx(A, m, .9, function (k) { m.scale.setScalar(.5 + Math.min(1, k * 3) * 5.5); m.rotation.z += .05; m.material.opacity = k < .7 ? 1 : (1 - k) / .3; });
      var m2 = new T.Mesh(geo("plane"), addMat(w.c, { map: runeTex() })); m2.rotation.x = -Math.PI / 2; m2.position.set(a.x, .1, a.z);
      fx(A, m2, .6, function (k) { m2.scale.setScalar(1.8); m2.rotation.z -= .06; m2.material.opacity = 1 - k; });
      later(.35, function () { beam(A, V(b.x, 0, b.z), V(b.x, 7, b.z), w.c, 1.6, .5, { grow: .3 }); burst(A, V(b.x, .5, b.z), [w.c, "#ffffff"], 16, 4, .4, { grav: -4, up: 2 }); hit(); });
    },
    arrow: function (A, a, b, w, hit) {
      var g = new T.Group(), sh = new T.Mesh(geo("shaft", function () { var c = new T.CylinderGeometry(.03, .03, 1, 6); c.rotateX(Math.PI / 2); return c; }), new T.MeshBasicMaterial({ color: "#8d6e63" }));
      var hd = new T.Mesh(geo("head", function () { var c = new T.ConeGeometry(.08, .25, 6); c.rotateX(Math.PI / 2); c.translate(0, 0, .6); return c; }), new T.MeshBasicMaterial({ color: "#eceff1" }));
      g.add(sh, hd); fly(A, g, a, b, .42, 1, { orient: true, trail: function (p) { sprite(A, p, w.c, .35, .25, { grow: .2 }); } }, function () { burst(A, b, [w.c, "#ffffff"], 10, 6, .35); ring(A, b, w.c, .3, 2, .3, false, { face: st.camOf(A).position.clone().sub(A.g.position) }); hit(); });
    },
    bolt: function (A, a, b, w, hit) {
      var m = new T.Mesh(geo("bolt", function () { var c = new T.ConeGeometry(.1, .7, 6); c.rotateX(Math.PI / 2); return c; }), new T.MeshBasicMaterial({ color: "#cfd8dc" }));
      fly(A, m, a, b, .2, .2, { orient: true, trail: function (p) { sprite(A, p, w.c, .3, .2); } }, function () { sprite(A, b, "#ffb74d", 2.6, .35, { grow: 1.6 }); burst(A, b, ["#ff7043", "#ffd54f"], 10, 7, .4); hit(); });
    },
    bomb: function (A, a, b, w, hit) {
      var g = new T.Group(), bm = new T.Mesh(geo("bombb", function () { return new T.SphereGeometry(.25, 12, 10); }), new T.MeshStandardMaterial({ color: "#263238", roughness: .4 })); g.add(bm);
      fly(A, g, a, b, .7, 2.6, { spin: 6, trail: function (p) { sprite(A, p.clone().add(V(0, .3, 0)), "#ffca28", .35, .25); } }, function () {
        sprite(A, b, "#ff7043", 2, .5, { grow: 3 }); sprite(A, b, "#ffd54f", 1.4, .35, { grow: 2.5 });
        for (var i = 0; i < 8; i++) sprite(A, b.clone().add(V(Math.random() * 2 - 1, Math.random(), Math.random() * 2 - 1)), "#777", 1.2, 1.1, { tex: softTex(), add: false, rise: 1.2, grow: 2, op: .6 });
        ring(A, V(b.x, .08, b.z), "#ff7043", .5, 5, .5, true); burst(A, b, ["#ff7043", "#ffd54f", "#5d4037"], 16, 9, .5, { grav: 10 }); st.shake(A, .45); hit(); });
    },
    potion: function (A, a, b, w, hit) {
      var m = new T.Mesh(geo("pot", function () { return new T.SphereGeometry(.18, 10, 8); }), new T.MeshStandardMaterial({ color: w.c, emissive: w.c, emissiveIntensity: .4, transparent: true, opacity: .85 }));
      fly(A, m, a, b, .6, 2.2, { spin: 8, trail: function (p) { sprite(A, p, w.c, .25, .3); } }, function () {
        sprite(A, b, w.c, 3, .4, { grow: 1.5 });
        for (var i = 0; i < 14; i++) { var bb = new T.Mesh(geo("bub", function () { return new T.SphereGeometry(.12, 8, 6); }), addMat(w.c, { blending: T.NormalBlending, opacity: .8 })); bb.position.copy(b);
          (function (bb, v) { fx(A, bb, .8, function (k, dt) { v.y -= 9 * dt; bb.position.addScaledVector(v, dt); bb.material.opacity = .8 * (1 - k); }); })(bb, V(Math.random() * 6 - 3, Math.random() * 5, Math.random() * 6 - 3)); }
        ring(A, V(b.x, .08, b.z), w.c, .5, 3.5, .5, true); hit(); });
    },
    punch: function (A, a, b, w, hit) {
      var m = new T.Mesh(geo("ring"), addMat(w.c)); m.scale.setScalar(.4);
      fly(A, m, a, b, .28, 0, { orient: true, trail: function (p) { sprite(A, p, w.c, .4, .2); } }, function () { sprite(A, b, "#ffffff", 3.2, .25, { tex: starTex(), grow: 1.4 }); ring(A, b, w.c, .5, 3, .3, false, { face: st.camOf(A).position.clone().sub(A.g.position) });
        burst(A, b, ["#fff", "#ffe082"], 8, 6, .35, { tex: starTex() }); st.shake(A, .15); hit(); });
      fx(A, new T.Object3D(), .28, function (k) { m.scale.setScalar(.4 + k * 1.2); });
    },
    claw: function (A, a, b, w, hit) {
      beam(A, a, b, w.c, .04, .15); var dir = b.clone().sub(a).normalize(), side = V(-dir.z, 0, dir.x);
      later(.12, function () { [-1, 0, 1].forEach(function (i, j) { later(j * .05, function () { var p = b.clone().addScaledVector(side, i * .35); beam(A, p.clone().add(V(0, 1.2, 0)).addScaledVector(side, .6), p.clone().add(V(0, -1.2, 0)).addScaledVector(side, -.6), j === 1 ? "#ffffff" : w.c, .07, .35); }); });
        later(.15, function () { burst(A, b, [w.c, "#fff"], 8, 5, .35); hit(); }); });
    },
    pencil: function (A, a, b, w, hit) {
      var hue = 0, s = new T.Sprite(sprMat("#ffffff", starTex(), false)); s.scale.setScalar(.8);
      fly(A, s, a, b, .55, 1.6, { trail: function (p) { hue = (hue + 40) % 360; sprite(A, p, new T.Color("hsl(" + hue + ",90%,60%)"), .45, .5, { grow: .3 }); } }, function () {
        burst(A, b, ["#ff5252", "#ffd740", "#69f0ae", "#40c4ff", "#e040fb"], 18, 6, .55, { tex: starTex(), grav: 3, add: false }); hit(); });
    },
    paper: function (A, a, b, w, hit) {
      for (var i = 0; i < 4; i++) (function (i) { later(i * .07, function () {
        var m = new T.Mesh(geo("paper", function () { return new T.PlaneGeometry(.35, .45); }), new T.MeshBasicMaterial({ color: "#ffffff", side: T.DoubleSide }));
        fly(A, m, a.clone().add(V(0, i * .1, 0)), b.clone().add(V(Math.random() - .5, Math.random() - .5, Math.random() - .5)), .5, 1 + i * .3, { spin: 10 }, function () {
          burst(A, b, ["#ffffff", "#bbdefb"], 4, 4, .3, { tex: starTex() }); if (i === 3) { text(A, b.clone().add(V(0, 1.5, 0)), "知識！", "#bbdefb", 1.2); hit(); } }); }); })(i);
    },
    fire: function (A, a, b, w, hit) {
      orb(A, a, b, "#ff9100", 1.1, .5, 1, "#ff5722", function () { for (var i = 0; i < 12; i++) sprite(A, b.clone().add(V(Math.random() - .5, Math.random() - .5, Math.random() - .5)), ["#ff9100", "#ffd54f", "#ff3d00"][i % 3], 1.1, .7, { rise: 3, grow: .3 });
        sprite(A, b, "#ffab40", 3, .4, { grow: 1.5 }); hit(); }, { rise: 1.5, tl: .4 });
    },
    light: function (A, a, b, w, hit) {
      beam(A, a, b, w.c, .25, .5, { grow: 1.2 }); beam(A, a, b, "#ffffff", .08, .45);
      later(.15, function () { sprite(A, b, w.c, 3.4, .45, { grow: 1.3 }); burst(A, b, [w.c, "#fff"], 10, 5, .4, { tex: starTex(), grav: 1 }); hit(); });
    },
    tool: function (A, a, b, w, hit) {
      orb(A, a, b, w.c, .6, .4, 1.4, "#ffe0b2", function () { burst(A, b, ["#ffb74d", "#ffe082", "#ffffff"], 16, 8, .25, { grav: 12 }); sprite(A, b, w.c, 2, .3, { grow: 1.3 }); hit(); });
    },
    shield: function (A, a, b, w, hit) {
      var m = new T.Mesh(geo("hex", function () { return new T.RingGeometry(.6, 1, 6); }), addMat(w.c)); m.scale.setScalar(.8);
      fly(A, m, a, b, .35, 0, { orient: true, trail: function (p) { sprite(A, p, w.c, .5, .25); } }, function () { ring(A, b, w.c, .5, 3.4, .35, false, { face: st.camOf(A).position.clone().sub(A.g.position) }); burst(A, b, [w.c, "#ffffff"], 10, 6, .35); st.shake(A, .15); hit(); });
    }
  };

  /* ---------- 戰場 ---------- */
  function layout(n) {
    if (n <= 1) return [[0, 0, 1, 1]];
    if (n === 2) return [[0, 0, 1, .5], [0, .5, 1, .5]];
    if (n === 3) return [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, 1, .5]];
    return [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]];
  }
  function bossOf(A) { return A.boss; }
  function makeArena(i, team) {
    var U = st.U, g = new T.Group(); g.position.x = i * 90; st.scene.add(g);
    var A = { i: i, team: team, g: g, players: {}, order: [], hp: 1, shakeV: 0, cam: new T.PerspectiveCamera(34, 1.6, .1, 200), dead: false, auraT: 0 };
    var gr = new T.Mesh(new T.CylinderGeometry(14, 14.6, .5, 48), new T.MeshStandardMaterial({ color: U.ground, roughness: 1 })); gr.position.y = -.25; g.add(gr);
    var rim = new T.Mesh(new T.TorusGeometry(14.2, .25, 8, 64), new T.MeshStandardMaterial({ color: team ? TEAMC[team] : U.rim, roughness: .6 })); rim.rotation.x = Math.PI / 2; g.add(rim);
    var circle = new T.Mesh(new T.RingGeometry(3.2, 3.5, 48), new T.MeshBasicMaterial({ color: team ? TEAMC[team] : "#ffd54f", transparent: true, opacity: .35, side: T.DoubleSide })); circle.rotation.x = -Math.PI / 2; circle.position.set(-4.5, .02, 0); g.add(circle);
    var rockM = new T.MeshStandardMaterial({ color: U.rim, roughness: 1, flatShading: true });
    for (var k = 0; k < 14; k++) { var a = k / 14 * Math.PI * 2 + .2, r = 12 + Math.random() * 1.5, rk = new T.Mesh(geo("rock", function () { return new T.DodecahedronGeometry(1, 0); }), rockM);
      rk.position.set(Math.cos(a) * r, .3, Math.sin(a) * r); rk.scale.set(.6 + Math.random(), .6 + Math.random() * 1.6, .6 + Math.random()); rk.rotation.y = Math.random() * 3; g.add(rk); }
    /* 魔王：放大的角色，材質帶單元顏色 */
    var b = AVATAR.make(U.cfg, { prune: true }), tint = new T.Color(U.tint);
    b.root.traverse(function (o) { if (!o.isMesh) return; var m = o.material.clone(); if (m.name !== "skin" && m.name !== "tint") m.color.multiply(tint); m.emissive = new T.Color(0, 0, 0); o.material = m; (b.mats = b.mats || []).push(m); });
    b.root.scale.setScalar(2.3); b.root.position.set(-4.5, 0, 0); b.root.rotation.y = Math.PI / 2; g.add(b.root);
    var sh = new T.Mesh(geo("shp", function () { var p = new T.PlaneGeometry(1, 1); p.rotateX(-Math.PI / 2); return p; }), new T.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false })); sh.scale.setScalar(4.2); sh.position.set(-4.5, .03, 0); g.add(sh);
    A.boss = b; A.flash = 0; A.hitCool = 0;
    return A;
  }
  /* 學生排成方陣站在魔王右邊（一排最多 7 人，單雙排錯開），從前面斜上方看得到每個人 */
  function slot(A, k, n) {
    var cols = n <= 7 ? n : Math.ceil(n / Math.ceil(n / 7)), rows = Math.ceil(n / cols), r = Math.floor(k / cols), c = k % cols, cnt = Math.min(cols, n - r * cols);
    return V(4 + (c - (cnt - 1) / 2) * 1.8 + (r % 2) * .5, 0, (r - (rows - 1) / 2) * 2.4 + .4);
  }
  function relayout(A) {
    var seats = A.order = Object.keys(A.players).map(Number).sort(function (a, b) { return a - b; }), bp = A.boss.root.position;
    seats.forEach(function (s, k) { var P = A.players[s], p = slot(A, k, seats.length); P.home = p; P.ch.root.position.copy(p); P.ch.root.rotation.y = Math.atan2(bp.x - p.x, bp.z - p.z) + .25; P.sh.position.set(p.x, .03, p.z); P.lb.position.set(p.x, 2.95, p.z); });
  }
  function addPlayer(A, seat, cfg) {
    var old = A.players[seat]; if (old) { A.g.remove(old.ch.root, old.sh, old.lb); }
    var ch = AVATAR.make(cfg || AVATAR.standIn(seat), { prune: true, phase: true });
    var sh = new T.Mesh(geo("shp"), new T.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false })); sh.scale.setScalar(1.6);
    var lb = new T.Sprite(new T.SpriteMaterial({ map: labelTex(seat, TEAMC[A.team || 0]), transparent: true, depthWrite: false })); lb.scale.setScalar(.72);
    A.g.add(ch.root, sh, lb); A.players[seat] = { ch: ch, sh: sh, lb: lb, cfg: cfg || null, key: JSON.stringify(cfg || null) };
    relayout(A); if (!old) { ch.once("Spawn_Ground"); sprite(A, ch.root.position.clone().add(V(0, 1, 0)), TEAMC[A.team || 0], 2.2, .6, { grow: 1.5 }); }
  }
  function arenaFor(team) { return st.arenas.length > 1 ? st.arenas[Math.max(0, Math.min(st.arenas.length - 1, (team || 1) - 1))] : st.arenas[0]; }
  function bossPoint(A) { var p = A.boss.root.position; return V(p.x + .6, 2.8 + (Math.random() - .5) * 1.2, p.z + (Math.random() - .5) * 1.4); }
  function bossHit(A, dmg, col, crit) {
    if (!A || A.dead) return;
    A.flash = 1; A.shakeB = .25;
    if (A.hitCool <= 0) { A.hitCool = .7; if (!A.busy) A.boss.once("Hit_A"); }
    if (dmg) text(A, bossPoint(A).add(V((Math.random() - .5) * 2.4, 2 + Math.random(), 0)), (crit ? "暴擊！" : "") + "-" + dmg, crit ? "#FFD54F" : "#FFE27A", crit ? 2.8 : 1.9);
  }
  function fire(a) {
    var A = arenaFor(a.team), P = A.players[a.seat];
    if (!P || A.dead) { bossHit(A, a.dmg, "#fff"); return; }
    var w = AVATAR.weapon(P.ch.cfg), src = P.ch.root.position.clone().add(V(0, 1.3, 0)), dst = bossPoint(A);
    src.add(dst.clone().sub(src).setY(0).normalize().multiplyScalar(.6));
    P.ch.once(w.a);
    later(w.d, function () { (FX[w.fx] || FX.punch)(A, src, dst, w, function () { bossHit(A, a.dmg, w.c, a.crit); }); });
  }

  /* ---------- 主迴圈 ---------- */
  function frame() {
    if (!st || !st.alive) return; requestAnimationFrame(frame);
    var dt = Math.min(st.clock.getDelta(), .05); st.now += dt;
    for (var i = st.timers.length - 1; i >= 0; i--) if (st.timers[i].at <= st.now) { var f = st.timers[i].fn; st.timers.splice(i, 1); try { f(); } catch (e) {} }
    if (st.q.length && st.now >= st.nextAt) { if (st.q.length > 40) { var extra = st.q.splice(0, st.q.length - 40); extra.forEach(function (x) { bossHit(arenaFor(x.team), x.dmg); }); }
      fire(st.q.shift()); st.nextAt = st.now + (st.q.length > 15 ? .05 : st.q.length > 5 ? .12 : .2); }
    for (var j = st.fx.length - 1; j >= 0; j--) { var e = st.fx[j]; e.t += dt; var k = e.t / e.life;
      if (k >= 1) { st.fx.splice(j, 1); e.A.g.remove(e.obj); if (e.obj.material && e.obj.material.dispose) e.obj.material.dispose(); if (e.done) try { e.done(); } catch (x) {} } else try { e.upd(k, dt); } catch (x) {} }
    st.arenas.forEach(function (A) {
      A.boss.update(dt); Object.keys(A.players).forEach(function (s) { A.players[s].ch.update(dt); });
      A.hitCool -= dt;
      if (A.flash > 0) { A.flash = Math.max(0, A.flash - dt * 3); var fcol = A.flash * .6; A.boss.mats.forEach(function (m) { m.emissive.setRGB(fcol, fcol * .15, fcol * .1); }); }
      var bp = A.boss.root.position; if (A.shakeB > 0) { A.shakeB -= dt; bp.x = -4.5 + (Math.random() - .5) * .25 * A.shakeB * 4; } else bp.x = -4.5;
      A.auraT -= dt;
      if (A.auraT <= 0 && !A.dead) { var U = st.U, low = A.hp < .3; A.auraT = low ? .06 : .12;
        var p = V(-4.5 + (Math.random() - .5) * 3, Math.random() * 3, (Math.random() - .5) * 3), col = low ? "#ff5252" : U.aura[Math.floor(Math.random() * U.aura.length)];
        if (U.fire) sprite(A, p, col, .9 + Math.random() * .6, .9, { rise: 2.4, grow: .2 }); else sprite(A, p, col, 1.4 + Math.random(), 1.6, { rise: 1, grow: 2, tex: softTex(), add: false, op: .45, fadeIn: 1 }); }
    });
    render();
  }
  function camFit(A, w, h) {
    var asp = w / h, d = Math.max(10.8 / (Math.tan(17 * Math.PI / 180) * asp), 15), tgt = V(.4, asp > 2.4 ? 1.9 : 1.1, .6).add(A.g.position);
    var dir = V(.04, .62, 1).normalize(); A.cam.aspect = asp; A.cam.position.copy(tgt).addScaledVector(dir, d);
    if (A.shakeV > 0) { A.cam.position.add(V((Math.random() - .5), (Math.random() - .5), 0).multiplyScalar(A.shakeV)); }
    A.cam.lookAt(tgt); A.cam.updateProjectionMatrix();
  }
  function render() {
    var el = st.el, W = el.clientWidth, H = el.clientHeight; if (!W || !H) return;
    if (W !== st.w || H !== st.h) { st.w = W; st.h = H; st.r.setSize(W, H, false); }
    var rs = layout(st.arenas.length); st.r.setScissorTest(true);
    st.arenas.forEach(function (A, i) { var f = rs[i], x = Math.round(f[0] * W), y = Math.round((1 - f[1] - f[3]) * H), w = Math.round(f[2] * W), h = Math.round(f[3] * H);
      if (A.shakeV > 0) A.shakeV = Math.max(0, A.shakeV - .02);
      st.r.setViewport(x, y, w, h); st.r.setScissor(x, y, w, h); camFit(A, w, h); st.r.render(st.scene, A.cam); });
  }

  /* ---------- 對外 ---------- */
  var R3D = {
    init: function (el, o) {
      o = o || {};
      if (!window.AVATAR) return Promise.reject(new Error("no avatar"));
      try { var test = document.createElement("canvas"); if (!(test.getContext("webgl") || test.getContext("experimental-webgl"))) return Promise.reject(new Error("no webgl")); } catch (e) { return Promise.reject(e); }
      return AVATAR.lib().then(function () {
        T = THREE; if (st) R3D.destroy();
        var U = BOSS[o.unit] || BOSS.u2;
        var canvas = document.createElement("canvas"); canvas.className = "r3d-canvas"; canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
        el.appendChild(canvas);
        var r = new T.WebGLRenderer({ canvas: canvas, antialias: true }); r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); r.setClearColor(U.sky);
        var scene = new T.Scene(); scene.fog = new T.Fog(U.sky, 40, 90);
        scene.add(new T.HemisphereLight(0xffffff, 0x554466, .78)); var sun = new T.DirectionalLight(0xfff1dc, .7); sun.position.set(6, 12, 8); scene.add(sun);
        st = { el: el, canvas: canvas, r: r, scene: scene, U: U, arenas: [], fx: [], timers: [], q: [], now: 0, nextAt: 0, clock: new T.Clock(), alive: true, w: 0, h: 0, teams: o.teams || 0,
          shake: function (A, v) { A.shakeV = Math.max(A.shakeV, v); }, camOf: function (A) { return A.cam; } };
        var n = o.teams > 1 ? o.teams : 1;
        for (var i = 0; i < n; i++) st.arenas.push(makeArena(i, o.teams > 1 ? i + 1 : 0));
        frame();
        return R3D;
      });
    },
    ready: function () { return !!(st && st.alive); },
    players: function (list, cfgs) {
      if (!st) return; cfgs = cfgs || {};
      (list || []).forEach(function (x) {
        var seat = x.seat || x, A = arenaFor(x.team), cfg = cfgs[seat] || null, P = A.players[seat];
        if (st.arenas.length > 1) st.arenas.forEach(function (B) { if (B !== A && B.players[seat]) { var Q = B.players[seat]; B.g.remove(Q.ch.root, Q.sh, Q.lb); delete B.players[seat]; relayout(B); } });
        if (!P || P.key !== JSON.stringify(cfg)) addPlayer(A, seat, cfg);
      });
    },
    attack: function (seat, dmg, team) { if (st) st.q.push({ seat: seat, dmg: dmg, team: team }); },
    volley: function (seats, dmg, crit, team) {
      if (!st) return; var A = arenaFor(team); seats = (seats || []).filter(function (s) { return A.players[s]; });
      if (!seats.length) { bossHit(A, dmg, "#fff", crit); return; }
      seats.forEach(function (s, i) { later(i * .09, function () { fire({ seat: s, dmg: 0, team: team }); }); });
      later(seats.length * .09 + .9, function () { bossHit(A, dmg, "#ffd54f", crit); if (crit) { st.shake(A, .6); ring(A, V(-4.5, .1, 0), "#ffd54f", 1, 12, .8, true); sprite(A, bossPoint(A), "#ffd54f", 6, .5, { grow: 1.6 }); } });
    },
    hp: function (team, ratio) { if (!st) return; var A = arenaFor(team); A.hp = ratio; if (ratio <= 0 && !A.dead) R3D.defeat(team); },
    defeat: function (team) {
      if (!st) return; var A = arenaFor(team); if (A.dead) return; A.dead = true; A.boss.hold = true; A.boss.once("Death_A");
      later(.8, function () { burst(A, V(-4.5, 2, 0), ["#ffd54f", "#ffffff", "#ff80ab"], 30, 8, .7, { tex: starTex(), grav: 4 }); ring(A, V(-4.5, .1, 0), "#ffd54f", 1, 12, 1, true); });
      Object.keys(A.players).forEach(function (s, i) { later(.3 + i * .05, function () { cheerLoop(A.players[s].ch); }); });
    },
    counter: function (team) {
      if (!st) return; (team ? [arenaFor(team)] : st.arenas).forEach(function (A) {
        if (A.dead) return; A.busy = true; A.boss.once("2H_Melee_Attack_Spin", function () { A.busy = false; A.boss.play("Idle"); });
        later(.55, function () { ring(A, V(-4.5, .12, 0), "#ff1744", 1, 16, .9, true, { op: 1 }); ring(A, V(-4.5, .14, 0), "#ff8a80", 1, 13, .8, true); st.shake(A, .5);
          Object.keys(A.players).forEach(function (s) { var P = A.players[s], d = P.ch.root.position.distanceTo(A.boss.root.position); later(d / 16 * .9, function () { P.ch.once("Hit_A"); sprite(A, P.ch.root.position.clone().add(V(0, 1.2, 0)), "#ff1744", 1.6, .4, { grow: 1.4 }); }); }); });
      });
    },
    heal: function (team) {
      if (!st) return; (team ? [arenaFor(team)] : st.arenas).forEach(function (A) { if (A.dead) return;
        for (var i = 0; i < 16; i++) sprite(A, V(-4.5 + (Math.random() - .5) * 3, Math.random() * 2, (Math.random() - .5) * 3), "#69f0ae", .8, 1.2, { rise: 3, tex: Math.random() < .5 ? starTex() : null });
        text(A, V(-4.5, 7.5, 0), "回血！", "#69f0ae", 1.8); });
    },
    end: function (result, winner) {
      if (!st) return;
      st.arenas.forEach(function (A) {
        var won = result === "win" && (st.arenas.length === 1 || A.team === winner);
        if (won || A.hp <= 0) { if (!A.dead) R3D.defeat(A.team || 0); return; }
        A.boss.hold = true; A.boss.once("Cheer");
        if (st.arenas.length > 1 && A.team === winner) Object.keys(A.players).forEach(function (s) { cheerLoop(A.players[s].ch); });
      });
    },
    rects: function (n) { return layout(n || (st ? st.arenas.length : 1)); },
    destroy: function () { if (!st) return; st.alive = false; try { st.r.dispose(); st.r.forceContextLoss(); } catch (e) {} if (st.canvas.parentNode) st.canvas.parentNode.removeChild(st.canvas); st = null; }
  };
  function cheerLoop(ch) { ch.hold = true; (function again() { if (!st || !st.alive) return; ch.once("Cheer", function () { later(.2 + Math.random() * .6, again); }); })(); }
  window.R3D = R3D;
})();
