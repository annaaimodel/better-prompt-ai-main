/* GasPass service worker — offline support for the study tools.
   Reference, flashcards and mock exams work fully offline; the AI tutor and
   How-Tos need a connection (their /api/ calls are never cached). */
const VERSION = "gaspass-v2";
const CORE = [
  "./", "index.html", "reference.html", "flashcards.html", "quiz.html",
  "tutor.html", "howto.html", "updates.html",
  "style.css", "data.js", "howto-data.js", "updates-data.js",
  "favicon.svg", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon-180.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache the AI endpoints — always go to the network.
  if (url.pathname.includes("/api/")) {
    e.respondWith(fetch(req).catch(() =>
      new Response(JSON.stringify({ error: "You're offline — the AI tutor and How-Tos need a connection." }),
        { status: 503, headers: { "Content-Type": "application/json" } })));
    return;
  }

  // Static & navigations: cache-first, fall back to network, then to home.
  e.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((res) => {
        if (res.ok && url.origin === location.origin) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => (req.mode === "navigate" ? caches.match("index.html") : undefined))
    )
  );
});
