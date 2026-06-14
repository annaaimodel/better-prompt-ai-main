const $ = id => document.getElementById(id);

async function load() {
  const { syncUrl } = await chrome.storage.local.get("syncUrl");
  if (syncUrl) $("syncUrl").value = syncUrl;
}

$("save").onclick = async () => {
  const url = $("syncUrl").value.trim();
  if (url && !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(url)) {
    $("status").textContent = "That doesn't look like an Apps Script /exec URL — saved anyway.";
  } else {
    $("status").textContent = url ? "Saved ✓" : "Cleared — sync turned off.";
  }
  await chrome.storage.local.set({ syncUrl: url });
};

load();
