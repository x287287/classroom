/* 學生角色（2026-11-20）
   每個「班級＋座號」有一個 3D 冒險者角色，存在 Supabase 的 avatars 表（只存零件設定，不存姓名）。
   零件庫：assets/avatar/parts.glb（KayKit Rig_Medium 骨架＋全部零件網格＋55 個動作）與 parts.json（貼圖、材質對照、零件目錄），
   來源是「3D模型庫建立」專案的冒險者角色編輯器（KayKit Character Pack: Adventurers 等，Kay Lousberg，CC0）。
   Three.js r128 放在 assets/vendor/three/（MIT），用到才載入。

   學生端：
     AVATAR.gate(班級, 座號, {greet})  → Promise<cfg|null>
       這個座號還沒有角色：打開全畫面「做出你的角色」，一定要做好按「完成」才會繼續（存到雲端後就不能自己改）。
       已經有角色：greet:true 時顯示「這是你的角色」卡片（會揮手），可按「想換造型？請老師幫忙」→ 老師輸入換座號密碼 → 編輯；
       greet:false 時直接繼續。沒有網路時不擋住學生。
     這台平板做過或看過的座號記在 localStorage avDone:<班級>:<座號>，下次不用再問伺服器。
   大螢幕：
     AVATAR.lib(onProgress) 載入零件庫；AVATAR.list(班級) → {座號: cfg}；AVATAR.make(cfg,{prune}) 做出一個會動的角色
     （{root, play, once, update, cfg}）；AVATAR.weapon(cfg) 回傳攻擊方式（assets/raid3d.js 用）。
   伺服器 RPC（tools/sql/avatars.sql）：avatar_get、avatar_list、avatar_create（只有還沒有角色時才能建立）、
     avatar_change（要老師的換座號密碼，和 seat_unlock 共用錯誤次數限制）。 */
(function () {
  if (window.AVATAR) return;
  var me = (document.currentScript && document.currentScript.src) || "";
  var BASE = me ? me.replace(/assets\/avatar\.js(\?.*)?$/, "") : "./";
  var SB_URL = "https://tsxbphngzuzpdddhadfw.supabase.co", SB_KEY = "sb_publishable_EOXrx2SRQbFRHACqHbUUig_4e-EkgkE";
  function rpc(fn, a) {
    return fetch(SB_URL + "/rest/v1/rpc/" + fn, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify(a), cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }
  function lget(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function lset(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function device() { var d = lget("fbDevice"); if (!d) { d = "d" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); lset("fbDevice", d); } return d; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---------- 零件目錄（照角色零件庫移植說明） ---------- */
  var SLOTS = [
    { k: "skin", t: "膚色" }, { k: "eyes", t: "眼睛", req: 1 }, { k: "brows", t: "眉毛", none: "不畫" }, { k: "nose", t: "鼻子", req: 1 }, { k: "mouth", t: "嘴巴", none: "不畫" },
    { k: "cheek", t: "臉頰", none: "沒有" }, { k: "glasses", t: "眼鏡", none: "不戴" }, { k: "hair", t: "髮型", none: "光頭" }, { k: "hairacc", t: "髮飾", none: "沒有" },
    { k: "color", t: "髮色" }, { k: "beard", t: "鬍子", none: "沒有" }, { k: "hat", t: "帽子", none: "不戴" }, { k: "body", t: "上衣", req: 1 }, { k: "legs", t: "褲子", req: 1 },
    { k: "cape", t: "披風", none: "沒有" }, { k: "back", t: "背在背上", none: "沒有" }, { k: "right", t: "右手拿的（武器）", none: "空手" }, { k: "left", t: "左手拿的", none: "空手" }];
  var TABS = [{ n: "臉", s: ["skin", "eyes", "brows", "nose", "mouth", "cheek", "glasses"] }, { n: "頭髮", s: ["hair", "color", "hairacc", "beard"] }, { n: "帽子", s: ["hat"] },
    { n: "衣服", s: ["body", "legs", "cape", "back"] }, { n: "武器", s: ["right", "left"] }, { n: "現成造型", presets: true }];
  /* 健康課在教拒酒，學生的角色不提供啤酒杯 */
  var EXCLUDE = { right: { "啤酒杯": 1 } };
  var HAIR_COLORS = [["棕色", "#9b5a45"], ["深棕", "#5a3418"], ["黑色", "#262326"], ["金色", "#e4ac5c"], ["淺金", "#f0d290"], ["薑紅", "#c8642e"], ["紅色", "#c03a2b"], ["灰白", "#c9c6c2"], ["白色", "#f4f1ea"], ["藍色", "#4f86c6"], ["紫色", "#8a5cc0"], ["粉紅", "#f08cb4"], ["綠色", "#4e9a5c"]];
  var SKIN_COLORS = [["淺膚", "#fbd7bd"], ["原色", "#f6c09c"], ["蜜桃", "#eab08a"], ["小麥", "#d79a6c"], ["焦糖", "#c68642"], ["可可", "#8d5524"], ["深棕", "#5c3a21"], ["淡綠", "#a8d8a0"], ["淡藍", "#a9c8ee"]];
  var HIDE_ALL = ["騎士頭盔", "牛角帽", "兜帽"], COVER = ["騎士頭盔", "牛角帽", "兜帽", "巫師帽", "牧師高帽", "羽毛帽", "小黃帽"], SPIKY = "刺刺短髮";
  var PRESETS = {
    "學生": { eyes: "瞇瞇眼", brows: "挑眉", nose: "小圓鼻", mouth: "大笑", cheek: "腮紅", hair: "側分長髮", color: "#262326", hat: "小黃帽", body: "學生制服", legs: "制服短褲", back: "書包", right: "大鉛筆" },
    "騎士": { eyes: "圓圓眼", brows: "粗眉", nose: "小圓鼻", mouth: "淺笑", hair: "刺刺短髮", color: "#dcae7d", hat: "騎士頭盔", body: "騎士盔甲", legs: "騎士護腿", cape: "紅披風", right: "單手劍", left: "圓盾" },
    "野蠻人": { eyes: "圓圓眼", brows: "濃眉", nose: "大蒜鼻", beard: "大鬍子", color: "#978f86", hat: "牛角帽", body: "野蠻人皮衣", legs: "毛皮褲", cape: "毛皮披肩", right: "雙手巨斧" },
    "法師": { eyes: "睫毛眼", brows: "細眉", nose: "尖鼻子", mouth: "抿嘴", hair: "中分長髮", color: "#262326", hat: "巫師帽", body: "法師長袍", legs: "法師長靴", cape: "紫披風", right: "法杖", left: "魔法書" },
    "盜賊": { eyes: "細長眼", brows: "挑眉", nose: "尖鼻子", mouth: "微笑", cheek: "耳環", hair: "側分長髮", color: "#9b5a45", body: "盜賊短衣", legs: "皮靴短褲", cape: "綠斗篷", right: "短刀", left: "副手短刀" },
    "牧師": { eyes: "睫毛眼", brows: "細眉", nose: "尖鼻子", mouth: "抿嘴", hair: "中分長髮", color: "#c8642e", hat: "牧師高帽", body: "牧師長袍", legs: "法師長靴", right: "牧師權杖", left: "聖典" },
    "弓箭手": { eyes: "細長眼", brows: "挑眉", nose: "小圓鼻", mouth: "微笑", hair: "中分長髮", hairacc: "馬尾", color: "#4a3020", hat: "皮革頭帶", body: "弓箭手皮衣", legs: "皮靴短褲", left: "長弓", back: "箭袋" },
    "德魯伊": { eyes: "圓圓眼", brows: "濃眉", nose: "大蒜鼻", beard: "大鬍子", hair: "中分長髮", color: "#e8e4dc", hat: "鹿角葉冠", body: "德魯伊苔衣", legs: "毛皮褲", right: "自然法杖" },
    "鍊金術士": { eyes: "閃亮大眼", brows: "細眉", nose: "尖鼻子", mouth: "驚訝", hair: "刺刺短髮", color: "#c8642e", hat: "護目鏡", body: "鍊金術士上衣", legs: "法師長靴", right: "綠色藥水", left: "粉紅藥水" },
    "吟遊詩人": { eyes: "細長眼", brows: "挑眉", nose: "尖鼻子", mouth: "微笑", hair: "側分長髮", color: "#e4ac5c", hat: "羽毛帽", body: "吟遊詩人短衣", legs: "吟遊詩人短褲", cape: "綠披風", back: "魯特琴" }
  };
  var CAT = null;
  function labels(k) { return Object.keys((CAT && CAT[k]) || {}).filter(function (l) { return !(EXCLUDE[k] && EXCLUDE[k][l]); }); }
  var isCol = function (c) { return typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c); };
  function pickR(a) { return a[Math.floor(Math.random() * a.length)]; }
  function blank() { var s = { v: "kk1", color: "#9b5a45", skin: "#f6c09c", head: "共用頭" }; SLOTS.forEach(function (x) { if (x.k !== "color" && x.k !== "skin") s[x.k] = null; }); return s; }
  /* 不認得的零件拿掉；必填的補上第一個。零件目錄還沒載入時原樣保留 */
  function clean(x) {
    var s = blank(); if (!x || typeof x !== "object") x = {};
    SLOTS.forEach(function (o) {
      var k = o.k;
      if (k === "color" || k === "skin") { if (isCol(x[k])) s[k] = x[k].toLowerCase(); return; }
      if (!CAT) { if (typeof x[k] === "string") s[k] = x[k]; return; }
      if (CAT[k] && CAT[k][x[k]]) s[k] = x[k]; else if (o.req) s[k] = labels(k)[0] || null;
    });
    return s;
  }
  function preset(p) { return clean(Object.assign(blank(), PRESETS[p])); }
  function random() {
    var s = blank();
    SLOTS.forEach(function (x) { if (x.k === "color" || x.k === "skin") return; var l = labels(x.k);
      s[x.k] = pickR(x.req ? l : l.concat(Array(Math.max(1, Math.round(l.length / 3))).fill(null))); });
    if (Math.random() < .5) s.back = null; if (Math.random() < .5) s.beard = null;
    s.color = pickR(HAIR_COLORS)[1]; s.skin = pickR(SKIN_COLORS.slice(0, 7))[1]; return clean(s);
  }
  /* 沒有角色的座號在大螢幕上用的樣子（學生裝，髮色依座號） */
  function standIn(seat) { var s = preset("學生"); s.right = null; s.color = HAIR_COLORS[(seat || 0) % HAIR_COLORS.length][1]; s.skin = SKIN_COLORS[(seat || 0) % 5][1]; return s; }

  /* 武器 → 攻擊方式（動作、特效、顏色）：assets/raid3d.js 依這個播特效 */
  var W = {};
  function wk(names, spec) { names.split(",").forEach(function (n) { W[n] = spec; }); }
  wk("單手劍,騎士長劍,寬刃劍,彎刀,骷髏彎刃,副手劍", { a: "1H_Melee_Attack_Chop", d: .35, fx: "wave", c: "#bfe3ff" });
  wk("黃金劍", { a: "1H_Melee_Attack_Chop", d: .35, fx: "wave", c: "#ffd54f" });
  wk("符文劍", { a: "1H_Melee_Attack_Chop", d: .35, fx: "wave", c: "#4dd0e1" });
  wk("雙手大劍", { a: "Melee_2H_Attack_Chop", d: .5, fx: "wave", c: "#e3f2fd", big: 1 });
  wk("單手斧,雙手巨斧,戰斧,雙刃斧,小手斧,伐木斧,骷髏斧,副手斧", { a: "Melee_2H_Attack_Chop", d: .5, fx: "cleave", c: "#ff9f43" });
  wk("戰鎚,大鐵鎚,釘頭鎚,鐵鎚,木槌,十字鎬", { a: "Melee_2H_Attack_Chop", d: .5, fx: "smash", c: "#ffcc80" });
  wk("短刀,匕首,彎匕首,小刀,副手短刀", { a: "Melee_Dualwield_Attack_Chop", d: .3, fx: "stab", c: "#ffffff" });
  wk("長矛,戟", { a: "Melee_1H_Attack_Stab", d: .3, fx: "thrust", c: "#b3e5fc" });
  wk("魔杖", { a: "Spellcast_Shoot", d: .35, fx: "magic", c: "#ff7eb6" });
  wk("法杖,寶珠法杖", { a: "Spellcast_Shoot", d: .35, fx: "magic", c: "#b388ff" });
  wk("木杖,自然法杖", { a: "Spellcast_Shoot", d: .35, fx: "nature", c: "#7ed957" });
  wk("牧師權杖,聖典", { a: "Spellcast_Raise", d: .45, fx: "holy", c: "#ffe082" });
  wk("星星魔杖", { a: "Spellcast_Shoot", d: .35, fx: "stars", c: "#fff176" });
  wk("骷髏法杖", { a: "Spellcast_Shoot", d: .35, fx: "magic", c: "#69f0ae", dark: 1 });
  wk("魔法書,打開的魔法書", { a: "Spellcast_Raise", d: .45, fx: "runes", c: "#b388ff" });
  wk("長弓,木弓,反曲弓", { a: "Ranged_Bow_Release", d: .15, fx: "arrow", c: "#fff59d" });
  wk("手弩,重弩", { a: "1H_Ranged_Shoot", d: .15, fx: "bolt", c: "#80deea" });
  wk("炸彈", { a: "Throw", d: .4, fx: "bomb", c: "#ff7043" });
  wk("綠色藥水", { a: "Throw", d: .4, fx: "potion", c: "#76ff03" });
  wk("粉紅藥水", { a: "Throw", d: .4, fx: "potion", c: "#ff80ab" });
  wk("拳套", { a: "Melee_Unarmed_Attack_Punch_A", d: .25, fx: "punch", c: "#ffffff" });
  wk("爪套", { a: "Melee_Unarmed_Attack_Punch_A", d: .25, fx: "claw", c: "#ff5252" });
  wk("大鉛筆,教鞭", { a: "1H_Melee_Attack_Chop", d: .35, fx: "pencil", c: "#ffffff" });
  wk("課本,筆記本,捲起的地圖", { a: "Throw", d: .4, fx: "paper", c: "#ffffff" });
  wk("火把", { a: "Spellcast_Shoot", d: .35, fx: "fire", c: "#ff9100" });
  wk("提燈,放大鏡", { a: "Spellcast_Shoot", d: .35, fx: "light", c: "#fff59d" });
  wk("鏟子,鋸子,扳手,鏝刀,螺絲起子", { a: "1H_Melee_Attack_Chop", d: .35, fx: "tool", c: "#ffb74d" });
  wk("圓盾,徽章盾,方盾,尖刺盾,木圓盾,鳶形盾,鐵框盾,小圓盾,骷髏大盾,骷髏小盾", { a: "Melee_Unarmed_Attack_Kick", d: .3, fx: "shield", c: "#82b1ff" });
  var FIST = { a: "Melee_Unarmed_Attack_Punch_A", d: .25, fx: "punch", c: "#fff3e0" };
  function weapon(cfg) { cfg = cfg || {}; return W[cfg.right] || W[cfg.left] || FIST; }

  /* ---------- 載入 three 與零件庫 ---------- */
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = function () { rej(new Error("載入失敗")); }; document.head.appendChild(s); }); }
  var threeP = null;
  function loadThree() {
    if (threeP) return threeP; var v = BASE + "assets/vendor/three/";
    threeP = (window.THREE ? Promise.resolve() : loadScript(v + "three.min.js")).then(function () {
      return Promise.all([THREE.GLTFLoader ? 0 : loadScript(v + "GLTFLoader.js"), THREE.OrbitControls ? 0 : loadScript(v + "OrbitControls.js"), THREE.SkeletonUtils ? 0 : loadScript(v + "SkeletonUtils.js")]);
    });
    threeP.catch(function () { threeP = null; });
    return threeP;
  }
  var L = null, libP = null, progs = [];
  function fetchBuf(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("零件檔讀取失敗"); var total = +r.headers.get("content-length") || 5844904;
      if (!r.body || !r.body.getReader) return r.arrayBuffer();
      var rd = r.body.getReader(), chunks = [], got = 0;
      function step() { return rd.read().then(function (x) { if (x.done) return; chunks.push(x.value); got += x.value.length; progs.forEach(function (f) { try { f(Math.min(.97, got / total)); } catch (e) {} }); return step(); }); }
      return step().then(function () { var all = new Uint8Array(got), o = 0; chunks.forEach(function (c) { all.set(c, o); o += c.length; }); return all.buffer; });
    });
  }
  function loadTex(src) { return new Promise(function (res, rej) { var img = new Image(); img.onload = function () { var t = new THREE.Texture(img); t.flipY = false; t.encoding = THREE.LinearEncoding; t.needsUpdate = true; res(t); }; img.onerror = function () { rej(new Error("貼圖讀取失敗")); }; img.src = src; }); }
  function lib(onProgress) {
    if (onProgress) progs.push(onProgress);
    if (libP) return libP;
    libP = loadThree().then(function () {
      return Promise.all([fetch(BASE + "assets/avatar/parts.json").then(function (r) { if (!r.ok) throw new Error("零件目錄讀取失敗"); return r.json(); }), fetchBuf(BASE + "assets/avatar/parts.glb")]);
    }).then(function (res) {
      var meta = res[0], buf = res[1]; CAT = meta.parts;
      var keys = Object.keys(meta.tex), texs = {};
      return Promise.all(keys.map(function (k) { return loadTex(meta.tex[k]).then(function (t) { texs[k] = t; }); })).then(function () {
        return new Promise(function (res2, rej2) { new THREE.GLTFLoader().parse(buf, "", res2, rej2); });
      }).then(function (g) {
        g.scene.traverse(function (o) { if (!o.isMesh) return; var m = o.material, key = meta.matTex[m.name]; if (key) m.map = texs[key]; m.roughness = .8; m.metalness = 0; m.needsUpdate = true; });
        L = { proto: g.scene, anims: g.animations };
        progs.forEach(function (f) { try { f(1); } catch (e) {} }); progs = [];
        return L;
      });
    });
    libP.catch(function () { libP = null; });
    return libP;
  }

  /* ---------- 做出一個角色 ---------- */
  var LOOPS = { Idle: 1, Idle_B: 1, Walking_A: 1, Running_A: 1, Running_B: 1, Push_Ups: 1, Sit_Floor_Idle: 1, Waving: 1, Cheer: 0 };
  function showParts(ch, s) {
    var by = ch.by;
    function vis(slot, label, on) { var e = CAT[slot] && CAT[slot][label]; if (!e) return; e.meshes.forEach(function (n) { var o = by[n]; if (o) o.visible = on; }); }
    Object.keys(CAT).forEach(function (k) { Object.keys(CAT[k]).forEach(function (lab) { vis(k, lab, s[k] === lab); }); });
    var hat = s.hat, covering = hat && COVER.indexOf(hat) >= 0;
    var hairShown = !!s.hair && !(hat && (HIDE_ALL.indexOf(hat) >= 0 || (covering && s.hair === SPIKY)));
    if (s.hair && !hairShown) vis("hair", s.hair, false);
    Object.keys(CAT).forEach(function (k) { var lab = s[k]; if (!lab || !CAT[k][lab]) return;
      CAT[k][lab].meshes.forEach(function (n) { var b = by[n + "_bald"], a = by[n]; if (a && b) { a.visible = hairShown; b.visible = !hairShown; } }); });
    if (s.hairacc === "包包頭" && covering) ["hairacc_bun", "hairacc_bun_bald"].forEach(function (n) { if (by[n]) by[n].visible = false; });
    if (hat === "兜帽" && by.head_ears) by.head_ears.visible = false;
    if (hat === "騎士頭盔" && s.glasses) vis("glasses", s.glasses, false);
    ch.skin.forEach(function (m) { m.color.set(s.skin); });
    ch.tint.forEach(function (m) { m.color.set(s.color).multiplyScalar(1.12); });
    ch.cfg = s;
  }
  function make(cfg, o) {
    if (!L) throw new Error("AVATAR.lib() 還沒載入");
    o = o || {};
    var root = THREE.SkeletonUtils.clone(L.proto), by = {}, tint = [], skin = [], mc = {};
    root.traverse(function (x) {
      if (!x.isMesh) return; x.castShadow = !!o.shadow; x.frustumCulled = false; by[x.name] = x;
      var m = x.material; if (m.name === "tint" || m.name === "skin") { if (!mc[m.uuid]) { mc[m.uuid] = m.clone(); (m.name === "tint" ? tint : skin).push(mc[m.uuid]); } x.material = mc[m.uuid]; }
    });
    root.traverse(function (x) { if (!by[x.name] && x.children.some(function (c) { return c.isMesh; })) by[x.name] = x; });
    var ch = { root: root, by: by, tint: tint, skin: skin, cfg: null, acts: {}, cur: null, loopAct: "Idle", after: null };
    showParts(ch, clean(cfg));
    if (o.prune) { var dead = []; root.traverse(function (x) { if (x.isMesh && !x.visible) dead.push(x); }); dead.forEach(function (x) { x.parent.remove(x); }); }
    ch.mixer = new THREE.AnimationMixer(root);
    L.anims.forEach(function (c) { var a = ch.mixer.clipAction(c); if (!LOOPS[c.name]) { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; } ch.acts[c.name] = a; });
    ch.mixer.addEventListener("finished", function (e) { if (e.action !== ch.cur) return; if (ch.after) { var f = ch.after; ch.after = null; f(); } else if (!ch.hold) ch.play(ch.loopAct); });
    ch.play = function (n, fade) { var a = ch.acts[n]; if (!a) return; a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.play(); if (ch.cur && ch.cur !== a) ch.cur.crossFadeTo(a, fade == null ? .22 : fade, false); ch.cur = a; };
    ch.once = function (n, after) { ch.after = after || null; ch.play(n, .15); };
    ch.loop = function (n) { ch.loopAct = n; ch.play(n); };
    ch.set = function (c) { showParts(ch, clean(c)); };
    ch.update = function (dt) { ch.mixer.update(dt); };
    ch.play("Idle", 0); if (o.phase) ch.mixer.update(Math.random() * 2);
    return ch;
  }

  /* ---------- 伺服器 ---------- */
  function get(cls, seat) { return rpc("avatar_get", { p_class: cls || "", p_seat: seat }).then(function (c) { return c ? clean(c) : null; }); }
  function list(cls) { return rpc("avatar_list", { p_class: cls || "" }).then(function (l) { var m = {}; (l || []).forEach(function (x) { m[x.seat] = x.cfg; }); return m; }); }

  /* ---------- 介面 ---------- */
  var css = ".av-ov{position:fixed;inset:0;z-index:2147483300;display:flex;background:#1b2340;font:400 17px/1.5 'Huninn','Noto Sans TC','PingFang TC','Microsoft JhengHei',system-ui,sans-serif;color:#1f2a37}" +
    ".av-ov *{box-sizing:border-box;min-width:0}.av-ov button{font:inherit;color:inherit;cursor:pointer}.av-ov button:focus-visible{outline:3px solid #ffc93c;outline-offset:2px}" +
    ".av-stage{position:relative;flex:1 1 58%;background:radial-gradient(ellipse at 50% 30%,#e2f5ff,#8fd3ff 80%)}.av-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}" +
    ".av-top{position:absolute;left:10px;right:10px;top:10px;display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap;pointer-events:none}.av-top>*{pointer-events:auto}" +
    ".av-tag{background:#fff;border-radius:14px;padding:6px 14px;box-shadow:0 4px 12px #0002;max-width:100%}.av-tag b{display:block;font-size:20px}.av-tag span{display:block;font-size:14px;color:#5a6675;line-height:1.35}" +
    ".av-acts{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);display:flex;gap:8px;padding:8px;border-radius:18px;background:#ffffffe6;box-shadow:0 6px 18px #0002;max-width:96%;overflow-x:auto;scrollbar-width:none}" +
    ".av-btn{border:0;border-radius:14px;min-height:48px;padding:8px 16px;background:#f4efe6;font-weight:700;box-shadow:0 3px 0 #e6dccb;white-space:nowrap;flex:none}" +
    ".av-btn.main{background:#d9483b;color:#fff;box-shadow:0 3px 0 #0003}.av-btn.sun{background:#ffc93c;color:#5a3d00}.av-btn:disabled{opacity:.5}" +
    ".av-panel{flex:0 0 42%;max-width:560px;display:flex;flex-direction:column;background:#fff;min-height:0}" +
    ".av-tabs{display:flex;gap:6px;padding:10px 10px 6px;overflow-x:auto;scrollbar-width:none;flex:none}.av-tabs button{flex:1 0 auto;border:0;border-radius:14px;min-height:50px;padding:6px 12px;background:#f4efe6;font-weight:700;white-space:nowrap}.av-tabs button.on{background:#ffc93c;color:#5a3d00}" +
    ".av-opts{flex:1 1 auto;overflow-y:auto;padding:4px 14px 14px}.av-opts h3{margin:12px 0 6px;font-size:17px;color:#5a6675;font-weight:400}.av-hint{font-size:14px;color:#5a6675;margin:-2px 0 6px}" +
    ".av-chips{display:flex;flex-wrap:wrap;gap:8px}.av-chip{border:3px solid transparent;border-radius:14px;min-height:48px;padding:6px 14px;background:#f4efe6;font-weight:700}.av-chip.on{border-color:#ffc93c;background:#ffefb8}.av-chip.none{font-weight:400;color:#5a6675}" +
    ".av-sw{display:flex;flex-wrap:wrap;gap:8px}.av-sw button{width:46px;height:46px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 2px #e6dccb}.av-sw button.on{box-shadow:0 0 0 4px #d9483b}" +
    ".av-sw label{position:relative;width:46px;height:46px;border-radius:50%;background:conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red);box-shadow:0 0 0 2px #e6dccb;overflow:hidden}.av-sw label input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer}" +
    ".av-foot{display:flex;gap:8px;padding:10px 14px 14px;border-top:1px solid #e6dccb;flex:none;flex-wrap:wrap}.av-foot .av-btn{flex:1 1 auto}" +
    ".av-load{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:20px;font-size:22px;font-weight:700;background:radial-gradient(ellipse at 50% 30%,#e2f5ff,#8fd3ff 80%);z-index:2}" +
    ".av-load small{display:block;font-size:15px;font-weight:400;margin-top:6px}.av-bar{width:min(320px,70vw);height:14px;border-radius:99px;background:#fff;margin:12px auto 0;overflow:hidden}.av-bar i{display:block;height:100%;width:0;background:#d9483b;transition:width .2s}" +
    ".av-dlg{position:absolute;inset:0;z-index:5;background:#000a;display:grid;place-items:center;padding:16px}.av-dlg .bx{background:#fff;border-radius:22px;max-width:440px;width:100%;padding:20px;text-align:center;display:grid;gap:12px}.av-dlg h2{margin:0;font-size:24px;color:#7a2e8e}.av-dlg p{margin:0}.av-dlg .row{display:grid;grid-template-columns:1fr 1fr;gap:8px}" +
    ".av-greet{align-items:center;justify-content:center;padding:16px;background:linear-gradient(160deg,#1E3A34,#24524A)}.av-card{background:#fff;border-radius:26px;width:min(520px,100%);max-height:100%;overflow:auto;display:grid;gap:10px;padding:16px;text-align:center}" +
    ".av-card .st3{position:relative;height:min(52vh,420px);border-radius:18px;overflow:hidden;background:radial-gradient(ellipse at 50% 30%,#e2f5ff,#8fd3ff 80%)}.av-card .st3 canvas{position:absolute;inset:0;width:100%;height:100%}" +
    ".av-card h2{margin:0;font-size:clamp(24px,6vw,32px);color:#1E3A34}.av-card p{margin:0;color:#4A5550}.av-card .lk{font-size:15px;color:#7A1520;font-weight:700}" +
    ".av-pin .dots{display:flex;justify-content:center;gap:10px;min-height:28px}.av-pin .dots i{width:18px;height:18px;border-radius:50%;border:2px solid #7A2E8E}.av-pin .dots i.on{background:#7A2E8E}" +
    ".av-pin .pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.av-pin .pad button{border:0;border-radius:16px;min-height:60px;font-weight:700;font-size:26px;background:#F1EDF6;color:#4A2B5E}.av-pin .msg{min-height:1.4em;font-weight:700;color:#C8414B}" +
    "@media (max-aspect-ratio:1/1){.av-ov:not(.av-greet){flex-direction:column}.av-stage{flex:0 0 46%}.av-panel{flex:1 1 auto;max-width:none}}";
  function addCss() { if (document.getElementById("av-css")) return; var st = document.createElement("style"); st.id = "av-css"; st.textContent = css; document.head.appendChild(st); }

  /* 一個小舞台：renderer＋相機＋草地圓台，關掉時釋放 */
  function stage3(box, opt) {
    opt = opt || {};
    var canvas = document.createElement("canvas"); box.appendChild(canvas);
    var r = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    var sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, .1, 100); cam.position.set(2.2, 2.6, 8.2);
    sc.add(new THREE.HemisphereLight(0xffffff, 0xb9d6a0, .6));
    var sun = new THREE.DirectionalLight(0xfff1dc, .62); sun.position.set(3, 7, 5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 4, bottom: -2 }); sun.shadow.bias = -.0006; sun.shadow.normalBias = .02; sc.add(sun);
    var p1 = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.62, .22, 32), new THREE.MeshStandardMaterial({ color: "#8fd16a", roughness: 1 })); p1.position.y = -.11; p1.receiveShadow = true; sc.add(p1);
    var p2 = new THREE.Mesh(new THREE.CylinderGeometry(1.64, 1.7, .3, 32), new THREE.MeshStandardMaterial({ color: "#b98b5e", roughness: 1 })); p2.position.y = -.3; sc.add(p2);
    var ctl = null;
    if (opt.orbit) { ctl = new THREE.OrbitControls(cam, canvas); ctl.target.set(0, 1.25, 0); ctl.enablePan = false; ctl.enableDamping = true; ctl.minDistance = 3.5; ctl.maxDistance = 12; ctl.maxPolarAngle = Math.PI * .52; ctl.minPolarAngle = Math.PI * .2; ctl.autoRotateSpeed = 6; }
    else cam.lookAt(0, 1.2, 0);
    var S = { canvas: canvas, r: r, sc: sc, cam: cam, ctl: ctl, ch: null, alive: true, spinEnd: 0 }, clock = new THREE.Clock();
    function size() { var w = box.clientWidth, h = box.clientHeight; if (!w || !h) return; r.setSize(w, h, false); cam.aspect = w / h; cam.fov = w / h < .8 ? 44 : 32; cam.updateProjectionMatrix(); }
    var ro = new ResizeObserver(size); ro.observe(box); size();
    (function loop() { if (!S.alive) return; requestAnimationFrame(loop); var dt = Math.min(clock.getDelta(), .05); if (S.ch) S.ch.update(dt);
      if (S.spinEnd && clock.elapsedTime > S.spinEnd) { ctl.autoRotate = false; S.spinEnd = 0; } if (ctl) ctl.update(); r.render(sc, cam); })();
    S.spin = function () { if (!ctl) return; ctl.autoRotate = true; S.spinEnd = clock.elapsedTime + 10; };
    S.put = function (ch) { if (S.ch) sc.remove(S.ch.root); S.ch = ch; sc.add(ch.root); };
    S.close = function () { S.alive = false; ro.disconnect(); try { r.dispose(); r.forceContextLoss(); } catch (e) {} };
    return S;
  }
  function loadingBox(box, text) {
    var d = document.createElement("div"); d.className = "av-load"; d.innerHTML = "<div>" + text + "<small>第一次打開要等幾秒鐘</small><div class=\"av-bar\"><i></i></div></div>"; box.appendChild(d);
    return { set: function (p) { var i = d.querySelector("i"); if (i) i.style.width = Math.round(p * 100) + "%"; }, fail: function (m) { d.innerHTML = "<div>" + esc(m) + "</div>"; }, done: function () { d.remove(); } };
  }
  function dlg(host, title, text, btns) {
    var d = document.createElement("div"); d.className = "av-dlg"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
    d.innerHTML = '<div class="bx"><h2>' + esc(title) + "</h2><p>" + text + '</p><div class="row"></div></div>'; host.appendChild(d);
    var row = d.querySelector(".row");
    btns.forEach(function (b) { var e = document.createElement("button"); e.type = "button"; e.className = "av-btn" + (b[2] ? " main" : ""); e.textContent = b[0]; e.onclick = function () { d.remove(); if (b[1]) b[1](); }; row.appendChild(e); });
    row.lastChild.focus();
  }

  /* 編輯器：o = {title, cfg, mustSave, saveText, onSave(cfg) → Promise<true | 錯誤訊息>}；回傳 Promise<cfg|null> */
  function editor(o) {
    addCss();
    return new Promise(function (resolve) {
      var ov = document.createElement("div"); ov.className = "av-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", o.title);
      ov.innerHTML = '<div class="av-stage"><div class="av-top"><div class="av-tag"><b></b><span></span></div></div><div class="av-acts"></div></div>' +
        '<div class="av-panel"><div class="av-tabs"></div><div class="av-opts"></div><div class="av-foot"><button type="button" class="av-btn" data-b="undo">↶ 復原</button><button type="button" class="av-btn" data-b="rand">🎲 隨機</button>' +
        (o.mustSave ? "" : '<button type="button" class="av-btn" data-b="cancel">取消</button>') + '<button type="button" class="av-btn main" data-b="save"></button></div></div>';
      document.body.appendChild(ov);
      var q = function (s) { return ov.querySelector(s); }, stEl = q(".av-stage");
      q(".av-tag b").textContent = o.title; q(".av-tag span").textContent = o.note || ""; q('[data-b="save"]').textContent = o.saveText || "完成，就是這個！";
      var ld = loadingBox(stEl, "載入角色零件…"), S = null, state = null, undo = [], tab = 0;
      lib(ld.set).then(function () {
        state = clean(o.cfg || random()); S = stage3(stEl, { orbit: true }); S.put(make(state, { shadow: true })); ld.done();
        S.ch.once("Spawn_Ground"); buildTabs(); buildOpts();
      }).catch(function () { ld.fail("角色零件載入失敗，請確認網路後重新整理。"); });
      var ACTS = [["揮手", "Waving"], ["歡呼", "Cheer"], ["跳一下", "Jump_Full_Short"], ["攻擊！", "ATK"], ["翻滾", "Dodge_Forward"]];
      q(".av-acts").innerHTML = ACTS.map(function (a) { return '<button type="button" class="av-btn" data-a="' + a[1] + '">' + a[0] + "</button>"; }).join("") + '<button type="button" class="av-btn" data-a="SPIN">轉一圈</button>';
      q(".av-acts").addEventListener("click", function (e) { var b = e.target.closest("[data-a]"); if (!b || !S) return; var a = b.dataset.a;
        if (a === "SPIN") return S.spin(); if (a === "ATK") a = weapon(state).a; S.ch.once(a); });
      function change(fn, act) { undo.push(JSON.stringify(state)); if (undo.length > 40) undo.shift(); fn(); state = clean(state); S.ch.set(state); buildOpts(); if (act) S.ch.once(act); }
      function buildTabs() { var t = q(".av-tabs"); t.innerHTML = TABS.map(function (x, i) { return '<button type="button" class="' + (i === tab ? "on" : "") + '" data-t="' + i + '">' + x.n + "</button>"; }).join(""); }
      q(".av-tabs").addEventListener("click", function (e) { var b = e.target.closest("[data-t]"); if (!b) return; tab = +b.dataset.t; buildTabs(); buildOpts(); q(".av-opts").scrollTop = 0; });
      function buildOpts() {
        var box = q(".av-opts"), top = box.scrollTop, T = TABS[tab], h = "";
        if (T.presets) h = '<h3>一鍵換成現成造型，再自己改細節</h3><div class="av-chips">' + Object.keys(PRESETS).map(function (p) { return '<button type="button" class="av-chip" data-p="' + p + '">' + p + "</button>"; }).join("") + "</div>";
        else T.s.forEach(function (k) {
          var Sl = SLOTS.filter(function (x) { return x.k === k; })[0]; h += "<h3>" + Sl.t + "</h3>";
          if (k === "color" || k === "skin") {
            var lst = k === "color" ? HAIR_COLORS : SKIN_COLORS, custom = !lst.some(function (c) { return c[1] === state[k]; });
            if (k === "color") h += '<div class="av-hint">頭髮、眉毛、鬍子和髮飾會一起換色</div>';
            h += '<div class="av-sw">' + lst.map(function (c) { return '<button type="button" data-k="' + k + '" data-v="' + c[1] + '" style="background:' + c[1] + '" class="' + (state[k] === c[1] ? "on" : "") + '" aria-label="' + c[0] + '" title="' + c[0] + '"></button>'; }).join("") +
              (custom ? '<button type="button" class="on" style="background:' + state[k] + '" aria-label="自己調的顏色"></button>' : "") + '<label aria-label="自己調顏色"><input type="color" data-k="' + k + '" value="' + state[k] + '"></label></div>';
          } else {
            if (k === "hat" && state.hat) h += '<div class="av-hint">' + (HIDE_ALL.indexOf(state.hat) >= 0 ? "這頂帽子會把頭髮整個蓋住" : COVER.indexOf(state.hat) >= 0 ? "刺刺短髮和包包頭會收進這頂帽子裡" : "這頂會貼著頭髮戴好") + "</div>";
            if (k === "right") h += '<div class="av-hint">打魔王時，不同的武器有不同的攻擊特效喔！</div>';
            h += '<div class="av-chips">' + (Sl.none ? '<button type="button" class="av-chip none ' + (state[k] == null ? "on" : "") + '" data-k="' + k + '" data-v="">' + Sl.none + "</button>" : "") +
              labels(k).map(function (l) { return '<button type="button" class="av-chip ' + (state[k] === l ? "on" : "") + '" data-k="' + k + '" data-v="' + esc(l) + '">' + esc(l) + "</button>"; }).join("") + "</div>";
          }
        });
        box.innerHTML = h; box.scrollTop = top;
      }
      q(".av-opts").addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b || !S) return;
        if (b.dataset.p) return change(function () { state = preset(b.dataset.p); }, "Cheer");
        if (!b.dataset.k) return; var k = b.dataset.k, v = b.dataset.v || null;
        change(function () { state[k] = v; });
        if (v && (k === "right" || k === "left")) S.ch.once(weapon(state).a);
      });
      q(".av-opts").addEventListener("change", function (e) { var i = e.target; if (i.type !== "color" || !S) return; change(function () { state[i.dataset.k] = i.value.toLowerCase(); }); });
      q(".av-foot").addEventListener("click", function (e) {
        var b = e.target.closest("[data-b]"); if (!b || !S) return; var k = b.dataset.b;
        if (k === "undo") { if (!undo.length) return; state = clean(JSON.parse(undo.pop())); S.ch.set(state); buildOpts(); }
        else if (k === "rand") change(function () { state = random(); }, "Cheer");
        else if (k === "cancel") { close(); resolve(null); }
        else if (k === "save") dlg(ov, "就決定是這個角色嗎？", "做好以後要請老師輸入密碼才能再改喔！", [["再改一下"], ["確定！", save, true]]);
      });
      function save() {
        var b = q('[data-b="save"]'); b.disabled = true; q(".av-tag span").textContent = "儲存中…";
        Promise.resolve(o.onSave ? o.onSave(state) : true).then(function (r) {
          if (r === true) { S.ch.once("Cheer"); setTimeout(function () { close(); resolve(state); }, 900); return; }
          b.disabled = false; q(".av-tag span").textContent = r || "存不進去，請再按一次。";
        }, function () { b.disabled = false; q(".av-tag span").textContent = "連線失敗，請確認網路後再按一次。"; });
      }
      function close() { if (S) S.close(); ov.remove(); }
    });
  }

  /* 老師輸入換座號密碼：check(pin) → Promise<'ok'|'wrong'|...>；回傳 Promise<pin|null> */
  function pinPad(title, check) {
    addCss();
    return new Promise(function (resolve) {
      var ov = document.createElement("div"); ov.className = "av-ov av-greet"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
      ov.innerHTML = '<div class="av-card av-pin"><h2>🔒 ' + esc(title) + '</h2><p>請老師輸入「換座號密碼」。</p><div class="dots" aria-hidden="true"></div><div class="msg" role="status"></div><div class="pad">' +
        [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button type="button" data-n="' + n + '">' + n + "</button>"; }).join("") +
        '<button type="button" data-n="del" aria-label="刪除一個數字">⌫</button><button type="button" data-n="0">0</button><button type="button" data-n="clr" aria-label="全部清除">清除</button></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button type="button" class="av-btn" data-x="no">取消</button><button type="button" class="av-btn main" data-x="ok">確定</button></div></div>';
      document.body.appendChild(ov);
      var pin = "", busy = false, dots = ov.querySelector(".dots"), msg = ov.querySelector(".msg");
      function paint() { var h = ""; for (var i = 0; i < Math.max(4, pin.length); i++) h += '<i class="' + (i < pin.length ? "on" : "") + '"></i>'; dots.innerHTML = h; }
      function done(v) { ov.remove(); resolve(v); }
      function go() {
        if (busy) return; if (pin.length < 4) { msg.textContent = "密碼是 4～8 位數字"; return; }
        busy = true; msg.textContent = "確認中…";
        check(pin).then(function (r) { busy = false;
          if (r === "ok") return done(pin);
          msg.textContent = { wrong: "密碼不對，請再試一次", no_pin: "老師還沒在後台設定換座號密碼", too_many: "錯太多次了，請 10 分鐘後再試" }[r] || "沒辦法確認，請再試一次";
          pin = ""; paint(); }, function () { busy = false; msg.textContent = "連線失敗，請再試一次"; });
      }
      ov.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return;
        if (b.dataset.x === "no") return done(null); if (b.dataset.x === "ok") return go();
        var n = b.dataset.n; if (n === "del") pin = pin.slice(0, -1); else if (n === "clr") pin = ""; else if (pin.length < 8) pin += n; paint(); });
      paint();
    });
  }

  /* 這是你的角色：回傳 Promise<cfg>（按「出發！」） */
  function greet(cls, seat, cfg, o) {
    addCss(); o = o || {};
    return new Promise(function (resolve) {
      var ov = document.createElement("div"); ov.className = "av-ov av-greet"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
      ov.innerHTML = '<div class="av-card"><div class="st3"></div><h2>' + seat + ' 號的冒險者</h2><p>' + (o.fresh ? "角色做好了！以後選這個座號，就會是這個角色。" : "歡迎回來！這是你的角色。") +
        '</p><button type="button" class="av-btn sun" data-x="go" style="font-size:22px;min-height:60px">出發！</button><button type="button" class="av-btn" data-x="chg">想換造型？請老師幫忙</button></div>';
      document.body.appendChild(ov);
      var box = ov.querySelector(".st3"), S = null, ld = loadingBox(box, "載入角色…");
      lib(ld.set).then(function () { S = stage3(box); var ch = make(cfg, { shadow: true }); S.put(ch); ld.done(); ch.once("Spawn_Ground", function () { ch.loop("Waving"); setTimeout(function () { if (S.alive) ch.loop("Idle"); }, 3000); }); })
        .catch(function () { ld.fail("角色載入失敗（網路不穩），不影響上課。"); });
      function close() { if (S) S.close(); ov.remove(); }
      ov.querySelector('[data-x="go"]').onclick = function () { close(); resolve(cfg); };
      ov.querySelector('[data-x="chg"]').onclick = function () {
        change(cls, seat, cfg).then(function (c2) { if (c2) { cfg = c2; if (S && S.ch) S.ch.set(c2); } });
      };
      setTimeout(function () { var b = ov.querySelector('[data-x="go"]'); if (b) b.focus(); }, 50);
    });
  }

  /* 換造型：老師輸入密碼 → 編輯 → 存（avatar_change 再驗一次密碼） */
  function change(cls, seat, cfg) {
    var dev = device();
    return pinPad("換造型要請老師幫忙", function (pin) { return rpc("avatar_change", { p_class: cls || "", p_seat: seat, p_device: dev, p_pin: pin, p_cfg: null }); }).then(function (pin) {
      if (!pin) return null;
      return editor({ title: seat + " 號的角色", note: "老師已經解鎖，可以改造型了", cfg: cfg, saveText: "改好了！", onSave: function (c) {
        return rpc("avatar_change", { p_class: cls || "", p_seat: seat, p_device: dev, p_pin: pin, p_cfg: c }).then(function (r) { return r === "ok" ? true : ({ wrong: "密碼失效了，請重新請老師輸入", too_many: "錯太多次了，請 10 分鐘後再試" }[r] || "存不進去，請再按一次。"); });
      } });
    });
  }

  /* 第一次：一定要做好角色 */
  function create(cls, seat) {
    var dev = device(), key = "avDone:" + (cls || "") + ":" + seat;
    var got = null;
    return editor({ title: seat + " 號，做出你的角色！", note: "選好臉、頭髮、衣服和武器，按「完成」。做好以後就不能自己改喔！", mustSave: true, onSave: function (c) {
      return rpc("avatar_create", { p_class: cls || "", p_seat: seat, p_device: dev, p_cfg: c }).then(function (r) {
        if (r === "ok") { lset(key, 1); return true; }
        if (r === "exists") { return get(cls, seat).then(function (c2) { got = c2; lset(key, 1); return true; }); }
        return { bad_class: "找不到這個班級，請老師確認班級名單。", too_many: "存太多次了，請等一下再試。" }[r] || "存不進去，請再按一次。";
      });
    } }).then(function (c) { if (got) return greet(cls, seat, got); return c; });
  }

  /* 學生選好座號後呼叫 */
  function gate(cls, seat, o) {
    o = o || {}; cls = cls || ""; seat = +seat;
    if (!(seat >= 1 && seat <= 40)) return Promise.resolve(null);
    var key = "avDone:" + cls + ":" + seat;
    if (lget(key) && !o.greet) return Promise.resolve(null);
    return get(cls, seat).then(function (cfg) {
      if (cfg) { lset(key, 1); return o.greet ? greet(cls, seat, cfg) : cfg; }
      return create(cls, seat).then(function (c) { return c && o.greet ? greet(cls, seat, c, { fresh: true }) : c; });
    }, function () { return null; });
  }

  window.AVATAR = { gate: gate, change: change, editor: editor, lib: lib, make: make, list: list, get: get, clean: clean, preset: preset, random: random, standIn: standIn, weapon: weapon, PRESETS: PRESETS };
})();
