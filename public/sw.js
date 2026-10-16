// LeagueSim service worker: lets the site be installed as an app and keeps the
// last data it saw available offline. Network first for everything, so a
// deploy or a fresh data commit is always picked up as soon as there is a
// connection; the cache is only the fallback. Hashed build files never change,
// so those are served from the cache first.
const CACHE = "leaguesim-__BUILD__";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const HASHED = /\.[0-9a-f]{10}\.(js|css|woff2)$/;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.protocol !== "https:" && url.hostname !== "localhost") return;
  const sameOrigin = url.origin === self.location.origin;
  const isData = url.hostname === "raw.githubusercontent.com" && url.pathname.toLowerCase().includes("/handball-league/");
  if (!sameOrigin && !isData) return;

  if (sameOrigin && HASHED.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  event.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: req.mode === "navigate" }).then((hit) => hit || Response.error()))
  );
});
