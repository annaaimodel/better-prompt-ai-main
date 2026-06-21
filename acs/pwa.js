/* Registers the GasPass service worker for offline + installability. */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => { /* offline-only; ignore */ });
  });
}
