/* 教室小書櫃｜離線用的 Service Worker
   第一次打開網站時，把首頁、所有教材、共用檔和字型存到這台電腦。
   之後有網路時一律先抓最新版（同時更新存檔），沒網路或網路太慢時改用存檔。
   新增檔案不用改這裡：教材清單會從 index.html 的 MATERIALS 自動讀取。 */
const CACHE = "classroom-v1";  /* 改這個名字會清掉舊存檔，重新存一次 */
const CORE = [
  "./", "index.html",
  "assets/fonts.css", "assets/kit.css", "assets/kit.js", "assets/home-fab.js", "assets/class-tools.js", "assets/sync.js", "lessons/view.html",
  "assets/vendor/qrcode.js",
  "lessons/data/u2-game-questions.js", "lessons/data/u3-game-levels.js"
];
const TIMEOUT = 4000;

async function precache() {
  const cache = await caches.open(CACHE);
  let lessons = [];
  try {
    const html = await (await fetch("index.html", { cache: "no-cache" })).text();
    lessons = [...html.matchAll(/url:\s*"(lessons\/[^"]+)"/g)].map(m => m[1]);
  } catch (e) {}
  try {
    const fcss = await (await fetch("assets/fonts.css", { cache: "no-cache" })).text();
    lessons = lessons.concat([...fcss.matchAll(/url\('(fonts\/[^']+-site\.woff2[^']*)'\)/g)].map(m => "assets/" + m[1]));
  } catch (e) {}
  await Promise.all([...CORE, ...lessons].map(u =>
    fetch(u, { cache: "no-cache" }).then(r => { if (r.ok) return cache.put(u, r); }).catch(() => {})
  ));
}

self.addEventListener("install", e => { e.waitUntil(precache().then(() => self.skipWaiting())); });

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("message", e => { if (e.data === "precache") e.waitUntil(precache()); });

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET") return;

  /* 老師上傳的 PDF／圖片（Supabase 公開檔案）：先抓最新版，沒網路時用存檔 */
  if (url.origin !== location.origin) {
    if (/\.supabase\.co$/.test(url.hostname) && url.pathname.indexOf("/storage/v1/object/public/") === 0) {
      e.respondWith(fetch(req).then(r => {
        if (r.ok) { const c = r.clone(); caches.open(CACHE).then(cache => cache.put(req.url, c)); }
        return r;
      }).catch(() => caches.match(req.url).then(hit => hit || Promise.reject(new Error("offline")))));
    }
    return;
  }

  /* 字型網址帶有版本號（?v=…），同一個網址內容不會變：先用存檔 */
  if (url.pathname.endsWith(".woff2")) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok) { const c = r.clone(); caches.open(CACHE).then(cache => cache.put(req, c)); }
      return r;
    })));
    return;
  }

  /* 其他檔案：先抓最新版，抓不到或太慢就用存檔 */
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const net = fetch(req).then(r => {
      if (r.ok) cache.put(req, r.clone());
      return r;
    });
    net.catch(() => {});
    const timeout = new Promise(res => setTimeout(() => res(null), TIMEOUT));
    try {
      const r = await Promise.race([net, timeout]);
      if (r) return r;
    } catch (err) {}
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === "navigate") {
      const home = await cache.match("index.html");
      if (home) return home;
    }
    return net;
  })());
});
