/* GasPass service worker — offline support for the study tools.
   Reference, flashcards and mock exams work offline; the AI tutor and How-Tos
   need a connection (their /api/ calls are never cached).

   v3 fix: navigations are network-first and any redirected response (Vercel
   clean-URL redirect) is rebuilt before it reaches the page — returning a
   redirected/opaque response for a navigation makes the browser fail it with
   ERR_FAILED, which broke every clean-URL page in v2. */
const VERSION = "gaspass-v4";
const CORE = [
  "./", "index.html", "reference.html", "flashcards.html", "quiz.html",
  "tutor.html", "howto.html", "updates.html",
  "style.css", "data.js", "howto-data.js", "updates-data.js",
  "favicon.svg", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon-180.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION)
      // don't let one missing asset abort the whole install
      .then((c) => Promise.allSettled(CORE.map((u) => c.add(u))))
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

// Rebuild a redirected response as a plain one so it's valid for a navigation.
async function clean(res) {
  if (!res || !res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

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

  // Page navigations — network-first (handles clean-URL redirects), fall back to cache.
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        return await clean(await fetch(req));
      } catch (_) {
        return (await caches.match(req)) || (await caches.match("index.html")) || Response.error();
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
