/* Registers the GasPass service worker for offline + installability,
   and shows a one-time "Add to Home Screen" tip so users get offline access. */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => { /* offline-only; ignore */ });
  });
}

/* ---------- Add-to-Home-Screen banner ---------- */
(function () {
  const KEY = "gp-a2hs-dismissed";
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (standalone) return;                       // already installed — never nag
  try { if (localStorage.getItem(KEY)) return; } catch (_) { /* private mode */ }

  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // iOS install only works in Safari, not inside other apps' web views.
  const iosSafari = isIOS && /safari/i.test(ua) && !/(crios|fxios|edgios)/i.test(ua);

  let deferred = null;                          // Android/Chrome install prompt

  function dismiss() {
    try { localStorage.setItem(KEY, "1"); } catch (_) {}
    const el = document.getElementById("a2hs");
    if (el) el.remove();
  }

  function show(html, onAction) {
    if (document.getElementById("a2hs")) return;
    const bar = document.createElement("div");
    bar.id = "a2hs";
    bar.className = "a2hs";
    bar.innerHTML =
      '<span class="a2hs-ic">📲</span><div class="a2hs-txt">' + html + "</div>" +
      (onAction ? '<button class="a2hs-go">Install</button>' : "") +
      '<button class="a2hs-x" aria-label="Dismiss">✕</button>';
    bar.querySelector(".a2hs-x").onclick = dismiss;
    if (onAction) bar.querySelector(".a2hs-go").onclick = onAction;
    // lift above a visible composer (Tutor / How-Tos Ask) so they don't overlap
    const comp = document.querySelector(".composer");
    if (comp && comp.offsetParent !== null) bar.classList.add("has-composer");
    (document.body || document.documentElement).appendChild(bar);
  }

  // Android / Chromium: capture the real install prompt and offer a button.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    show("Install <b>GasPass</b> for full-screen, offline access on the job.", async () => {
      const el = document.getElementById("a2hs");
      if (el) el.remove();
      deferred.prompt();
      try { await deferred.userChoice; } catch (_) {}
      try { localStorage.setItem(KEY, "1"); } catch (_) {}
      deferred = null;
    });
  });
  window.addEventListener("appinstalled", dismiss);

  // iOS Safari has no install API — show the manual tip after the page settles.
  if (iosSafari) {
    window.addEventListener("load", () => {
      setTimeout(() => {
        if (deferred) return;                    // (won't fire on iOS, just in case)
        show('<b>Add to Home Screen</b> for offline use: tap <span class="a2hs-share">' +
          '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">' +
          '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
          'd="M12 15V3m0 0L8 7m4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/></svg></span> ' +
          "then <b>Add to Home Screen</b>.");
      }, 1800);
    });
  }
})();
