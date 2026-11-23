/* 3D 大魔王（2026-11-23）：全班共戰 3D 戰場用的魔王，照遊戲原本 2D 魔王的設定自己做（找不到合適的 CC0 模型）。
   第二單元「三惡魔合體大魔王」：紫色大身體，三顆頭＝菸惡魔（煙霧頭＋兩根香菸角，菸頭會冒煙）、酒惡魔（粉紅酒瓶頭，貼「酒」標籤）、檳榔惡魔（綠色檳榔頭＋紅嘴）。
   第三單元「火災大魔王」：焦黑身體、岩漿肚子，三顆頭＝燙燙壺怪（冒蒸氣的水壺）、火焰怪（會跳動的火焰）、濃煙怪（灰黑煙霧頭）。
   全部用 Three.js 基本形狀組成，動作也是程式算的。介面和 AVATAR.make 的角色一樣（assets/raid3d.js 直接換用）：
     BOSS3D.make(unit) → {root, mats, update(dt), play('Idle'), once(名稱, 完成後), hold, hitY}
     動作名稱沿用 KayKit：Idle、Hit_A（受傷）、2H_Melee_Attack_Spin（反擊：舉手轉一圈砸地，0.55 秒落地）、Death_A（倒下）、Cheer（勝利跳躍）。 */
(function () {
  if (window.BOSS3D) return;
  var T;
  var DUR = { Hit_A: .45, "2H_Melee_Attack_Spin": 1.3, Death_A: 1.6, Cheer: 1.4, Spawn_Ground: .8 };
  var glowTex = null;
  function glow() {
    if (glowTex) return glowTex; var c = document.createElement("canvas"); c.width = c.height = 64; var x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.4, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return glowTex = new T.CanvasTexture(c);
  }
  function labelTex(txt, bg, fg) {
    var c = document.createElement("canvas"); c.width = 256; c.height = 128; var x = c.getContext("2d");
    x.fillStyle = bg; x.fillRect(0, 0, 256, 128); x.strokeStyle = fg; x.lineWidth = 8; x.strokeRect(10, 10, 236, 108);
    x.fillStyle = fg; x.font = "bold 84px 'Huninn','Noto Sans TC',sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(txt, 128, 70);
    var t = new T.CanvasTexture(c); return t;
  }

  function make(unit) {
    T = THREE;
    var mats = [];
    function M(col, o) { var m = new T.MeshStandardMaterial(Object.assign({ color: col, roughness: .65, metalness: 0 }, o || {})); m.userData.e0 = m.emissive.clone(); mats.push(m); return m; }
    function mesh(geo, mat, x, y, z, parent) { var m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(m); return m; }
    function sph(r, ws) { return new T.SphereGeometry(r, ws || 20, Math.round((ws || 20) * .7)); }
    var root = new T.Group(), body = new T.Group(); root.add(body);
    var U2 = unit !== "u3";
    var C = U2 ? { body: "#5b3f80", belly: "#9c8cb9", leg: "#3f2b5c", spike: "#d8c8ff", claw: "#f3ecff" }
               : { body: "#3b2a26", belly: "#ff6d00", leg: "#2a1d1a", spike: "#ff9100", claw: "#ffd180" };
    var mBody = M(C.body), mLeg = M(C.leg), mClaw = M(C.claw, { roughness: .4 });
    var mBelly = U2 ? M(C.belly) : M(C.belly, { emissive: new T.Color("#ff5a00"), emissiveIntensity: .9, roughness: .5 });
    if (!U2) mBelly.userData.e0 = mBelly.emissive.clone().multiplyScalar(.9);
    var mSpike = U2 ? M(C.spike, { roughness: .4 }) : M(C.spike, { emissive: new T.Color("#ff6d00"), emissiveIntensity: .7 });
    if (!U2) mSpike.userData.e0 = mSpike.emissive.clone().multiplyScalar(.7);

    /* 腿與腳 */
    [-1, 1].forEach(function (s) {
      mesh(new T.CylinderGeometry(.5, .6, 1.1, 16), mLeg, s * .85, .55, 0, body);
      var f = mesh(sph(.62), mLeg, s * .9, .22, .25, body); f.scale.set(1, .55, 1.35);
      for (var i = -1; i <= 1; i++) { var c = mesh(new T.ConeGeometry(.12, .35, 8), mClaw, s * .9 + i * .25, .18, .95, body); c.rotation.x = Math.PI / 2; }
    });
    /* 身體 */
    var torso = mesh(sph(1.85, 28), mBody, 0, 2.35, 0, body); torso.scale.set(1.12, 1, .95);
    var belly = mesh(sph(1.3, 24), mBelly, 0, 2.15, 1.12, body); belly.scale.set(1, .95, .5);
    /* 背上的尖刺（第三單元是火焰形） */
    for (var i = 0; i < 5; i++) { var a = (i - 2) * .38, sp = mesh(new T.ConeGeometry(.28, .9, 8), mSpike, Math.sin(a) * 1.5, 2.9 + Math.cos(a) * .5 - Math.abs(i - 2) * .2, -1.45, body); sp.rotation.x = -.9; sp.rotation.z = -a * .6; }

    /* 手臂：肩膀關節，往下垂、拳頭帶爪 */
    var arms = [-1, 1].map(function (s) {
      var g = new T.Group(); g.position.set(s * 1.9, 3.05, 0); body.add(g);
      var up = mesh(new T.CylinderGeometry(.36, .44, 1.5, 14), mBody, 0, -.75, 0, g);
      var fist = mesh(sph(.6), U2 ? mBody : mLeg, 0, -1.65, 0, g);
      for (var j = -1; j <= 1; j++) { var c = mesh(new T.ConeGeometry(.11, .38, 8), mClaw, j * .22, -2.15, .2, g); c.rotation.x = Math.PI; }
      if (!U2) { var em = mesh(sph(.62), M("#ff6d00", { emissive: new T.Color("#ff3d00"), emissiveIntensity: .6, transparent: true, opacity: .35 }), 0, -1.65, 0, g); em.material.userData.e0 = new T.Color("#ff3d00").multiplyScalar(.6); }
      g.userData.s = s; return g;
    });

    /* 臉：眼睛＋生氣眉毛＋嘴巴；倒下時換成 X 眼 */
    var pupils = [], xeyes = [], mouths = [];
    var mWhite = M("#ffffff", { roughness: .3 }), mBlack = M("#1b1b1b", { roughness: .4 });
    function face(g, y, z, sc, mouthCol, grin) {
      [-1, 1].forEach(function (s) {
        var e = mesh(sph(.22 * sc), mWhite, s * .27 * sc, y, z, g); e.scale.z = .6;
        var p = mesh(sph(.11 * sc), mBlack, s * .25 * sc, y - .02 * sc, z + .12 * sc, g); pupils.push(p);
        var br = mesh(new T.BoxGeometry(.36 * sc, .08 * sc, .08 * sc), mBlack, s * .28 * sc, y + .25 * sc, z + .08 * sc, g); br.rotation.z = s * .4;
        var xg = new T.Group(); xg.position.set(s * .27 * sc, y, z + .15 * sc); g.add(xg); xg.visible = false; xeyes.push(xg);
        [1, -1].forEach(function (r) { var b = mesh(new T.BoxGeometry(.32 * sc, .07 * sc, .05 * sc), mBlack, 0, 0, 0, xg); b.rotation.z = r * .78; });
      });
      var mm = M(mouthCol || "#3a0f14", { roughness: .5 });
      /* 壞壞的大笑嘴＋兩顆尖牙 */
      var mo = mesh(new T.SphereGeometry(.26 * sc, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mm, 0, y - .3 * sc, z - .04, g); mo.rotation.x = Math.PI; mo.scale.set(1.55, grin ? 1.05 : .8, .55);
      mouths.push(mo);
      for (var t = -1; t <= 1; t += 2) { var tooth = mesh(new T.ConeGeometry(.06 * sc, .17 * sc, 6), mWhite, t * .17 * sc, y - .34 * sc, z + .07 * sc, g); tooth.rotation.x = Math.PI; }
    }
    /* 冒煙／蒸氣／火星的小粒子（自己管） */
    var emitters = [], parts = [];
    function emitter(obj, pos, col, rate, rise, size, add) { emitters.push({ obj: obj, pos: pos, col: col, rate: rate, rise: rise, size: size, add: add !== false, acc: 0 }); }

    var heads = [];
    function headGroup(x, y, z) { var g = new T.Group(); g.position.set(x, y, z); body.add(g); g.userData.base = g.position.clone(); heads.push(g);
      var nk = mesh(new T.CylinderGeometry(.35, .45, .7, 12), mBody, 0, -.55, 0, g); return g; }
    function cloud(g, col, n, r) { var m = M(col, { roughness: .9 }); var pts = [[0, 0, 0, 1], [-.55, .1, 0, .75], [.55, .1, 0, .75], [0, .55, -.1, .78], [-.35, -.35, .1, .7], [.35, -.35, .1, .7], [0, .1, -.45, .8]];
      pts.slice(0, n).forEach(function (p) { mesh(sph(r * p[3], 16), m, p[0] * r, p[1] * r, p[2] * r, g); }); return m; }

    var flames = [];
    if (U2) {
      /* 左：菸惡魔 */
      var h1 = headGroup(-1.45, 4.35, .15); cloud(h1, "#9C8CB9", 7, .8); face(h1, .05, .72, 1.1);
      [-1, 1].forEach(function (s) {
        var cg = new T.Group(); cg.position.set(s * .55, .55, 0); cg.rotation.z = -s * .45; h1.add(cg);
        mesh(new T.CylinderGeometry(.13, .13, 1.1, 12), M("#fafafa", { roughness: .5 }), 0, .55, 0, cg);
        mesh(new T.CylinderGeometry(.135, .135, .35, 12), M("#e0a050"), 0, .08, 0, cg);
        var tip = mesh(new T.CylinderGeometry(.14, .14, .14, 12), M("#ff5722", { emissive: new T.Color("#ff3d00"), emissiveIntensity: 1 }), 0, 1.15, 0, cg);
        tip.material.userData.e0 = new T.Color("#ff3d00");
        emitter(tip, new T.Vector3(0, .1, 0), "#b9b2c9", 7, .9, .55, false);
      });
      /* 中：酒惡魔（酒瓶） */
      var h2 = headGroup(0, 4.75, .35);
      var glass = M("#D8708A", { roughness: .25, metalness: .1 });
      mesh(new T.CylinderGeometry(.78, .82, 1.5, 24), glass, 0, .1, 0, h2);
      var sh = mesh(sph(.79, 24), glass, 0, .85, 0, h2); sh.scale.y = .55;
      mesh(new T.CylinderGeometry(.28, .34, .75, 16), glass, 0, 1.35, 0, h2);
      mesh(new T.CylinderGeometry(.24, .24, .3, 12), M("#8d6e63"), 0, 1.85, 0, h2);
      var lb = new T.Mesh(new T.CylinderGeometry(.84, .84, .62, 24, 1, true, -Math.PI * .45, Math.PI * .9), M("#ffffff", { map: labelTex("酒", "#fff6f8", "#b2385a") })); lb.position.y = -.25; h2.add(lb);
      face(h2, .5, .78, 1.05);
      [-1, 1].forEach(function (s) { var hn = mesh(new T.ConeGeometry(.16, .55, 8), mSpike, s * .55, 1.05, 0, h2); hn.rotation.z = -s * .5; });
      /* 右：檳榔惡魔 */
      var h3 = headGroup(1.45, 4.35, .15);
      var nut = mesh(sph(.82, 24), M("#5DAA68", { roughness: .55 }), 0, 0, 0, h3); nut.scale.set(.92, 1.18, .92);
      mesh(new T.CylinderGeometry(.08, .1, .45, 8), M("#6D4C41"), 0, 1.1, 0, h3);
      [-1, 1].forEach(function (s) { var lf = mesh(sph(.3), M("#43A047"), s * .3, 1.25, 0, h3); lf.scale.set(1.4, .3, .7); lf.rotation.z = s * .4; });
      face(h3, .1, .74, 1.05, "#b71c1c", true);
    } else {
      /* 左：燙燙壺怪（水壺） */
      var k1 = headGroup(-1.45, 4.35, .15), km = M("#C2410C", { roughness: .35, metalness: .35 });
      var kb = mesh(sph(.85, 24), km, 0, 0, 0, k1); kb.scale.set(1, .85, 1);
      mesh(new T.CylinderGeometry(.42, .55, .2, 20), km, 0, .72, 0, k1); mesh(sph(.13), M("#3e2723"), 0, .9, 0, k1);
      var sp2 = mesh(new T.CylinderGeometry(.09, .17, .9, 10), km, -.85, .15, 0, k1); sp2.rotation.z = .9;
      var hd = mesh(new T.TorusGeometry(.48, .07, 8, 20, Math.PI), M("#3e2723"), 0, .78, 0, k1); hd.rotation.y = Math.PI / 2;
      var spoutTip = new T.Object3D(); spoutTip.position.set(-1.22, .45, 0); k1.add(spoutTip);
      emitter(spoutTip, new T.Vector3(), "#eceff1", 10, 1.4, .5, false);
      face(k1, .02, .8, 1.05);
      /* 中：火焰怪 */
      var f2 = headGroup(0, 4.6, .35);
      /* 一大團火：中間三層（紅、橘、黃），外面幾條歪歪的火舌，會一直跳動 */
      function fm(col, k) { var m = M(col, { emissive: new T.Color(col), emissiveIntensity: k, roughness: .7, flatShading: true }); m.userData.e0 = new T.Color(col).multiplyScalar(k); return m; }
      var mR = fm("#e53935", .45), mO = fm("#ff7a00", .6), mY = fm("#ffd54f", .75);
      var core = mesh(sph(1, 14), mR, 0, 0, 0, f2); core.scale.set(1, .95, .9);
      [[0, 1.35, 0, 0, .75, 2.1, mR], [-.62, .95, 0, .5, .45, 1.5, mR], [.62, .95, 0, -.5, .45, 1.5, mR], [-.35, 1.25, .2, .3, .38, 1.2, mO], [.4, 1.2, .2, -.3, .4, 1.25, mO], [0, 1.05, .35, 0, .5, 1.3, mO], [0, .7, .55, 0, .35, .9, mY]].forEach(function (L, i) {
        var c = mesh(new T.ConeGeometry(L[4], L[5], 8), L[6], L[0], L[1], L[2], f2); c.rotation.z = L[3]; c.userData.rz = L[3]; flames.push({ m: c, i: i }); });
      var inner = mesh(sph(.62, 12), mO, 0, -.05, .4, f2); inner.scale.set(1, .9, .6);
      face(f2, .05, .98, 1.05);
      emitter(f2, new T.Vector3(0, 1.8, 0), "#ffab40", 8, 2.4, .35, true);
      /* 右：濃煙怪 */
      var s3 = headGroup(1.45, 4.35, .15); cloud(s3, "#5F6473", 7, .82); face(s3, .05, .74, 1.05);
      emitter(s3, new T.Vector3(0, .9, -.2), "#4a4f5c", 5, .8, .8, false);
    }

    var B = { root: root, mats: mats, hold: false, hitY: 3.3, cur: "Idle", t: 0, after: null, time: Math.random() * 10 };
    B.play = function (n) { B.cur = DUR[n] ? n : "Idle"; B.t = 0; B.after = null; };
    B.loop = B.play;
    B.once = function (n, after) { if (B.cur === "Dead") return; B.cur = DUR[n] ? n : "Idle"; B.t = 0; B.after = after || null; };
    B.set = function () {};
    function pose(dt) {
      var t = B.time, n = B.cur, k = DUR[n] ? Math.min(1, B.t / DUR[n]) : 0;
      body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); body.scale.set(1, 1 + Math.sin(t * 2) * .025, 1);
      arms.forEach(function (a, i) { a.rotation.set(Math.sin(t * 2 + i) * .08, 0, a.userData.s * (.28 + Math.sin(t * 2) * .05)); });
      heads.forEach(function (h, i) { h.position.copy(h.userData.base); h.position.y += Math.sin(t * 2.4 + i * 2) * .08; h.rotation.set(0, Math.sin(t * .9 + i * 1.7) * .25, Math.sin(t * 1.5 + i) * .07); });
      flames.forEach(function (f) { var s = 1 + Math.sin(t * (8 + f.i * 2.3)) * .12 + Math.sin(t * 17 + f.i) * .05; f.m.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s)); f.m.rotation.z = (f.m.userData.rz || 0) + Math.sin(t * 6 + f.i * 1.3) * .12; });
      if (n === "Hit_A") { var l = Math.sin(k * Math.PI); body.rotation.x = -l * .22; heads.forEach(function (h, i) { h.rotation.x -= l * .35; h.rotation.z += l * (i - 1) * .2; }); }
      else if (n === "2H_Melee_Attack_Spin") {
        var raise = k < .3 ? k / .3 : k < .75 ? 1 : 1 - (k - .75) / .25;
        arms.forEach(function (a) { a.rotation.z = a.userData.s * (.28 + raise * 1.6); });
        body.rotation.y = k < .3 ? -k / .3 * .6 : k < .75 ? -.6 + (k - .3) / .45 * (Math.PI * 2 + .6) : 0;
        body.position.y = k > .38 && k < .5 ? Math.sin((k - .38) / .12 * Math.PI) * .5 : 0;
      }
      else if (n === "Death_A" || n === "Dead") {
        var d = n === "Dead" ? 1 : k, fall = Math.min(1, d * 1.4);
        body.rotation.x = -fall * 1.35; body.position.y = -fall * .3; body.position.z = -fall * 1.2;
        arms.forEach(function (a) { a.rotation.z = a.userData.s * (.28 + fall * 1.3); });
        heads.forEach(function (h, i) { h.rotation.z = (i - 1) * .5 * fall; h.rotation.x = .3 * fall; });
      }
      else if (n === "Cheer") {
        var j = Math.abs(Math.sin(k * Math.PI * 2)); body.position.y = j * .7;
        arms.forEach(function (a) { a.rotation.z = a.userData.s * 2.4; a.rotation.x = Math.sin(t * 12) * .2; });
        heads.forEach(function (h, i) { h.rotation.z = Math.sin(t * 10 + i) * .2; });
      }
      else if (n === "Spawn_Ground") { var g = 1 - Math.pow(1 - k, 3); body.scale.setScalar(.2 + .8 * g); body.position.y = -(1 - g) * 2; }
      var dead = n === "Death_A" || n === "Dead";
      pupils.forEach(function (p) { p.visible = !dead; }); xeyes.forEach(function (x) { x.visible = dead; });
      mouths.forEach(function (m) { m.scale.y = n === "Cheer" ? .9 : m.scale.y; });
    }
    B.update = function (dt) {
      B.time += dt; B.t += dt;
      if (DUR[B.cur] && B.t >= DUR[B.cur]) {
        var f = B.after; B.after = null;
        if (B.cur === "Death_A") B.cur = "Dead";
        else if (f) { B.cur = "Idle"; B.t = 0; f(); }
        else if (B.hold && B.cur === "Cheer") { B.t = 0; }
        else { B.cur = "Idle"; B.t = 0; }
      }
      pose(dt);
      /* 粒子 */
      var wp = new T.Vector3();
      if (B.cur !== "Dead") emitters.forEach(function (e) { e.acc += dt * e.rate; while (e.acc >= 1) { e.acc -= 1;
        var s = new T.Sprite(new T.SpriteMaterial({ map: glow(), color: e.col, transparent: true, depthWrite: false, blending: e.add ? T.AdditiveBlending : T.NormalBlending }));
        e.obj.updateWorldMatrix(true, false); wp.copy(e.pos); e.obj.localToWorld(wp); root.worldToLocal(wp);
        s.position.copy(wp).add(new T.Vector3((Math.random() - .5) * .2, 0, (Math.random() - .5) * .2)); s.scale.setScalar(e.size * .5); root.add(s);
        parts.push({ s: s, life: 1 + Math.random() * .6, t: 0, rise: e.rise, size: e.size, op: e.add ? 1 : .6 }); } });
      for (var i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.t += dt; var k = p.t / p.life;
        if (k >= 1) { root.remove(p.s); p.s.material.dispose(); parts.splice(i, 1); continue; }
        p.s.position.y += p.rise * dt; p.s.position.x += Math.sin(B.time * 2 + i) * dt * .2; p.s.scale.setScalar(p.size * (.5 + k)); p.s.material.opacity = p.op * (1 - k); }
    };
    B.update(0);
    return B;
  }
  window.BOSS3D = { make: make };
})();
