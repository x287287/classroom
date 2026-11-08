/* 教室小書櫃｜雲端同步（Supabase）
   老師在任一台電腦登入一次後，「已上過」、「本週要用」、「最近打開」、單元展開狀態、
   文字大小、抽籤設定與紀錄、計時器，只要連上網路就會在所有登入的電腦之間同步。
   沒登入或沒網路時，網站照常使用這台電腦的 localStorage；恢復連線後自動補傳。

   作法：攔截 localStorage 寫入（只看 SYNC_KEYS 裡的項目），記下修改時間，
   再上傳到 kv 資料表；每筆以「最後修改的那一台」為準。其他頁面不用改寫程式，
   收到別台電腦的更新時會發出 window 事件 "cls-sync"（detail.keys = 變動的項目）。

   對外提供 window.CLS：
     CLS.user / CLS.isTeacher / CLS.status（off、syncing、ok、offline、error）
     CLS.login(email, pw)、CLS.logout()、CLS.changePassword(pw)
     CLS.api(path, opts)：帶登入憑證呼叫 Supabase REST / Storage
     CLS.syncNow()
   事件："cls-sync"（資料更新）、"cls-status"（登入或連線狀態改變） */
(function () {
  if (window.CLS) return;
  var SB_URL = "https://tsxbphngzuzpdddhadfw.supabase.co";
  var SB_KEY = "sb_publishable_EOXrx2SRQbFRHACqHbUUig_4e-EkgkE"; /* 公開金鑰：只能做資料庫權限規則允許的事 */
  /* 要同步的項目。ctPos（工具視窗位置）、ctTab（目前分頁）跟螢幕大小有關，不同步。 */
  var SYNC_KEYS = ["shelfDone", "shelfWeek", "shelfRecent", "shelfOpen", "clsFont", "ctDraw", "ctTimer"];
  /* 第一次在某台電腦登入時，這幾個「清單型」的項目會把兩邊合併，不會蓋掉這台電腦原有的標記 */
  var MERGE_KEYS = { shelfDone: 1, shelfWeek: 1, shelfOpen: 1 };
  var AUTH_KEY = "clsAuth", META_KEY = "clsSyncMeta";
  var PULL_EVERY = 20000;

  var ls = null;
  try { ls = window.localStorage; ls.getItem("x"); } catch (e) { ls = null; }
  var rawSet = Storage.prototype.setItem, rawRemove = Storage.prototype.removeItem;
  function get(k) { try { return ls ? ls.getItem(k) : null; } catch (e) { return null; } }
  function put(k, v) { try { if (ls) rawSet.call(ls, k, v); } catch (e) {} }
  function del(k) { try { if (ls) rawRemove.call(ls, k); } catch (e) {} }
  function readJSON(k, d) { try { var v = get(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }

  var session = readJSON(AUTH_KEY, null);
  var meta = readJSON(META_KEY, {});
  function saveMeta() { put(META_KEY, JSON.stringify(meta)); }

  var CLS = window.CLS = {
    url: SB_URL, key: SB_KEY, keys: SYNC_KEYS.slice(),
    user: session && session.user ? session.user : null,
    isTeacher: !!(session && session.teacher),
    status: session ? "syncing" : "off"
  };
  function setStatus(s) {
    if (CLS.status === s) return;
    CLS.status = s;
    try { window.dispatchEvent(new CustomEvent("cls-status", { detail: { status: s } })); } catch (e) {}
  }

  /* ---------- 攔截這台電腦的寫入 ---------- */
  var applying = false;
  function touched(k) {
    if (applying || SYNC_KEYS.indexOf(k) < 0) return;
    meta[k] = { ts: Date.now(), dirty: true, known: meta[k] && meta[k].known };
    saveMeta();
    schedulePush();
  }
  Storage.prototype.setItem = function (k, v) {
    rawSet.call(this, k, v);
    if (this === ls) touched(String(k));
  };
  Storage.prototype.removeItem = function (k) {
    rawRemove.call(this, k);
    if (this === ls) touched(String(k));
  };

  /* ---------- 登入憑證 ---------- */
  function saveSession(s) {
    session = s;
    if (s) put(AUTH_KEY, JSON.stringify(s)); else del(AUTH_KEY);
    CLS.user = s && s.user ? s.user : null;
    CLS.isTeacher = !!(s && s.teacher);
  }
  function fromToken(d, old) {
    return {
      access_token: d.access_token, refresh_token: d.refresh_token,
      expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
      user: d.user ? { id: d.user.id, email: d.user.email } : (old && old.user),
      teacher: old ? old.teacher : false
    };
  }
  function authFetch(path, body) {
    return fetch(SB_URL + "/auth/v1/" + path, {
      method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body)
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.__status = r.status; return j; }); });
  }
  var refreshing = null;
  function token() {
    if (!session) return Promise.resolve(null);
    if (session.expires_at - 90 > Date.now() / 1000) return Promise.resolve(session.access_token);
    if (!refreshing) {
      refreshing = authFetch("token?grant_type=refresh_token", { refresh_token: session.refresh_token }).then(function (d) {
        refreshing = null;
        if (d.access_token) { saveSession(fromToken(d, session)); return session.access_token; }
        if (d.__status >= 400 && d.__status < 500) { saveSession(null); setStatus("off"); return null; } /* 憑證失效：要重新登入 */
        throw new Error("refresh");
      }, function (e) { refreshing = null; throw e; });
    }
    return refreshing;
  }
  /* 呼叫 Supabase：path 例如 "rest/v1/materials?select=*" 或 "storage/v1/object/..." */
  CLS.api = function (path, opts) {
    opts = opts || {};
    return token().then(function (t) {
      var h = { apikey: SB_KEY };
      if (t) h.Authorization = "Bearer " + t;
      var o = opts.headers || {};
      for (var k in o) h[k] = o[k];
      return fetch(SB_URL + "/" + path, { method: opts.method || "GET", headers: h, body: opts.body, cache: "no-store" });
    });
  };
  function json(r) {
    if (!r.ok) return r.text().then(function (t) { var e = new Error(t || ("HTTP " + r.status)); e.status = r.status; throw e; });
    return r.text().then(function (t) { return t ? JSON.parse(t) : null; });
  }

  CLS.login = function (email, pw) {
    return authFetch("token?grant_type=password", { email: String(email).trim(), password: pw }).then(function (d) {
      if (!d.access_token) {
        var m = d.error_code === "invalid_credentials" || /invalid/i.test(d.msg || d.error_description || "") ? "Email 或密碼不正確" : "登入失敗，請稍後再試";
        throw new Error(m);
      }
      saveSession(fromToken(d, null));
      return CLS.api("rest/v1/rpc/is_teacher", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(json).then(function (t) {
        session.teacher = !!t; saveSession(session);
        /* 這台電腦第一次登入：還沒跟雲端比對過的項目，先合併再同步 */
        SYNC_KEYS.forEach(function (k) { if (meta[k]) meta[k].known = false; });
        saveMeta();
        setStatus("syncing");
        return syncNow().then(function () { return CLS.user; });
      });
    });
  };
  CLS.logout = function () {
    var t = session && session.access_token;
    if (t) fetch(SB_URL + "/auth/v1/logout", { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + t } }).catch(function () {});
    saveSession(null);
    setStatus("off");
  };
  CLS.changePassword = function (pw) {
    return token().then(function (t) {
      if (!t) throw new Error("請先登入");
      return fetch(SB_URL + "/auth/v1/user", {
        method: "PUT", headers: { apikey: SB_KEY, Authorization: "Bearer " + t, "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw })
      });
    }).then(function (r) {
      if (r.ok) return true;
      return r.json().catch(function () { return {}; }).then(function (d) {
        var c = d.error_code || "";
        throw new Error(c === "weak_password" ? "密碼太簡單，請至少 8 個字並混合英文和數字" : c === "same_password" ? "新密碼不能和舊密碼一樣" : "改密碼失敗，請稍後再試");
      });
    });
  };

  /* ---------- 同步 ---------- */
  function mergeMaps(a, b) {
    var o = {}, k;
    if (a && typeof a === "object") for (k in a) o[k] = a[k];
    if (b && typeof b === "object") for (k in b) o[k] = k in o ? Math.max(+o[k] || 0, +b[k] || 0) || o[k] : b[k];
    return o;
  }
  function localValue(k) { var v = get(k); if (v == null) return null; try { return JSON.parse(v); } catch (e) { return v; } }

  var busy = null, again = false;
  function syncNow() {
    if (!session || !CLS.isTeacher) { if (session) setStatus("ok"); return Promise.resolve(); }
    if (busy) { again = true; return busy; }
    if (navigator.onLine === false) { setStatus("offline"); return Promise.resolve(); }
    setStatus("syncing");
    busy = CLS.api("rest/v1/kv?select=key,value,ts").then(json).then(function (rows) {
      var remote = {}, changed = [], up = [];
      (rows || []).forEach(function (r) { remote[r.key] = r; });
      applying = true;
      try {
        SYNC_KEYS.forEach(function (k) {
          var m = meta[k] || { ts: 0 }, r = remote[k], lv = get(k);
          if (!m.known) {
            /* 第一次比對：清單合併，其他項目以雲端為準；雲端沒有就上傳這台的 */
            if (r && MERGE_KEYS[k] && lv != null) {
              var mv = mergeMaps(r.value, localValue(k));
              rawSet.call(ls, k, JSON.stringify(mv)); changed.push(k);
              m = { ts: Date.now(), dirty: true };
            } else if (r) {
              if (r.value == null) rawRemove.call(ls, k); else rawSet.call(ls, k, JSON.stringify(r.value));
              if (lv !== get(k)) changed.push(k);
              m = { ts: r.ts, dirty: false };
            } else if (lv != null) m = { ts: m.ts || Date.now(), dirty: true };
            m.known = true; meta[k] = m;
          } else if (r && r.ts > m.ts) {
            /* 別台電腦比較新 */
            if (r.value == null) rawRemove.call(ls, k); else rawSet.call(ls, k, JSON.stringify(r.value));
            if (lv !== get(k)) changed.push(k);
            meta[k] = { ts: r.ts, dirty: false, known: true };
          } else if (m.dirty && (!r || m.ts >= r.ts)) {
            /* 這台比較新 */
          } else if (m.dirty) { meta[k].dirty = false; }
          if (meta[k] && meta[k].dirty) up.push({ key: k, value: localValue(k), ts: meta[k].ts });
        });
      } finally { applying = false; }
      saveMeta();
      if (changed.length) { try { window.dispatchEvent(new CustomEvent("cls-sync", { detail: { keys: changed } })); } catch (e) {} }
      if (!up.length) return;
      return CLS.api("rest/v1/kv?on_conflict=user_id,key", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(up)
      }).then(json).then(function () {
        up.forEach(function (u) { if (meta[u.key] && meta[u.key].ts === u.ts) meta[u.key].dirty = false; });
        saveMeta();
      });
    }).then(function () {
      busy = null; setStatus(session ? "ok" : "off");
      if (again) { again = false; return syncNow(); }
    }, function (e) {
      busy = null; again = false;
      setStatus(!session ? "off" : (navigator.onLine === false || e instanceof TypeError) ? "offline" : "error");
    });
    return busy;
  }
  CLS.syncNow = syncNow;
  CLS.token = token; /* 取得目前的登入憑證（會自動更新）；沒登入時是 null */

  var pushT = null;
  function schedulePush() {
    if (!session) return;
    clearTimeout(pushT);
    pushT = setTimeout(syncNow, 800);
  }

  /* 打開頁面、回到頁面、恢復網路、每 20 秒（頁面顯示中）各同步一次 */
  if (session) setTimeout(syncNow, 0);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) syncNow(); });
  window.addEventListener("online", function () { syncNow(); });
  window.addEventListener("offline", function () { if (session) setStatus("offline"); });
  setInterval(function () { if (!document.hidden && session) syncNow(); }, PULL_EVERY);
  /* 離開頁面前還沒上傳的，盡量送出 */
  window.addEventListener("pagehide", function () {
    if (!session || !session.teacher || session.expires_at - 30 < Date.now() / 1000) return;
    var up = SYNC_KEYS.filter(function (k) { return meta[k] && meta[k].dirty; }).map(function (k) { return { key: k, value: localValue(k), ts: meta[k].ts }; });
    if (!up.length) return;
    try {
      fetch(SB_URL + "/rest/v1/kv?on_conflict=user_id,key", {
        method: "POST", keepalive: true,
        headers: { apikey: SB_KEY, Authorization: "Bearer " + session.access_token, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(up)
      }).catch(function () {});
    } catch (e) {}
  });
})();
