/* GasPass service worker — offline support for the study tools.
   Reference, flashcards and mock exams work offline; the AI tutor and How-Tos
   need a connection (their /api/ calls are never cached).

   v5 fix: Vercel clean-URLs redirect every page (e.g. /howto.html -> /howto).
   A response that still carries the "redirected" flag is rejected by Safari for
   a page load ("Response served by service worker has redirections" / ERR_FAILED).
   So we strip that flag everywhere a response can reach a navigation:
     - precache: fetch + rebuild each page before storing it (cache.add kept the flag),
     - online: rebuild the network response,
     - offline: rebuild the cached fallback too. */
const VERSION = "gaspass-v6";
const CORE = [
  "./", "index.html", "reference.html", "flashcards.html", "quiz.html",
  "tutor.html", "howto.html", "updates.html",
  "style.css", "data.js", "howto-data.js", "updates-data.js", "pwa.js",
  "favicon.svg", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon-180.png",
];

// Rebuild a redirected response as a plain one so it's valid for a navigation.
async function clean(res) {
  if (!res || !res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

// Precache a URL, stripping any redirect flag before storing it.
async function precache(c, url) {
  try {
    const res = await fetch(url, { cache: "reload" });
    if (res && res.ok) await c.put(url, await clean(res));
  } catch (_) { /* one missing asset shouldn't abort the whole install */ }
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.allSettled(CORE.map((u) => precache(c, u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Cross-origin (fonts, etc.) — let the browser handle it.
  if (url.origin !== location.origin) return;

  // AI endpoints — always network, never cached.
  if (url.pathname.includes("/api/")) {
    e.respondWith(
      fetch(req).catch(() =>
        new Response(JSON.stringify({ error: "You're offline — the AI tutor and How-Tos need a connection." }),
          { status: 503, headers: { "Content-Type": "application/json" } }))
    );
    return;
  }

  // Page navigations — network-first (handles clean-URL redirects), fall back to
  // cache. Every path is rebuilt so the page never sees a redirected response.
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        return await clean(await fetch(req));
      } catch (_) {
        return (await clean(await caches.match(req))) ||
               (await clean(await caches.match("index.html"))) ||
               Response.error();
      }
    })());
    return;
  }

  // Static assets — cache-first, then network (cache only clean same-origin 200s).
  e.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((res) => {
        if (res.ok && res.type === "basic" && !res.redirected) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => undefined)
    )
  );
});
